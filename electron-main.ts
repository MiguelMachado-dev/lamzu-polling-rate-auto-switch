import * as dotenv from "dotenv";
import * as path from "path";

// Determinar ambiente ANTES de carregar qualquer módulo
const isDevelopment =
  process.env.NODE_ENV === "development" ||
  process.env.ELECTRON_IS_DEV === "true" ||
  !process.env.NODE_ENV;

const envFile = isDevelopment ? ".env.development" : ".env.production";

// Carregar .env com path absoluto
const envPath = path.resolve(__dirname, "..", envFile);
const result = dotenv.config({ path: envPath });

// Environment debug will be handled by logger later

import {
  app,
  Tray,
  Menu,
  BrowserWindow,
  Notification,
  nativeImage,
  ipcMain,
} from "electron";
import { exec } from "child_process";
import { promisify } from "util";
import AutoLaunch from "auto-launch";
import { GameWatcher, GameWatcherConfig } from "./core/gameWatcher.js";
import { SettingsManager, AppSettings } from "./core/settingsManager.js";
import { MouseController } from "./core/mouseController.js";
import { BatteryInfo } from "./core/batteryMonitor.js";
import { logInfo, logError, logDebug, logUI } from "./core/utils/logger.js";

const execAsync = promisify(exec);

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let gameWatcher: GameWatcher;
let settingsManager: SettingsManager;
let autoLauncher: AutoLaunch;
let isQuitting = false;

// Current status state
let currentStatus = {
  isGameRunning: false,
  currentRate: 1000,
  isAutoMode: true,
  battery: {
    level: 0,
    isCharging: false,
    isAvailable: false,
  },
};

const WINDOW_FOCUS_RETRY_DELAY_MS = 200;

function createTrayIcon() {
  try {
    const iconPath = path.join(__dirname, "../assets/icon.png");
    return nativeImage.createFromPath(iconPath);
  } catch {
    return nativeImage.createEmpty().resize({ width: 16, height: 16 });
  }
}

function createTray() {
  const trayIcon = createTrayIcon();
  tray = new Tray(trayIcon);

  updateTrayMenu();

  tray.setToolTip("Lamzu Mouse Automator");

  // Single click to show/hide window
  tray.on("click", () => {
    if (mainWindow && !mainWindow.isDestroyed() && mainWindow.isVisible()) {
      mainWindow.hide();
    } else {
      showAndFocusWindow();
    }
  });

  // Double click to show window (for consistency)
  tray.on("double-click", () => {
    showAndFocusWindow();
  });
}

function updateTrayMenu() {
  const { isGameRunning, currentRate, isAutoMode, battery } = currentStatus;
  const modeText = isAutoMode
    ? isGameRunning
      ? "Gaming"
      : "Normal"
    : "Manual";

  // Format battery info for display
  let batteryText = "Battery: Not Available";
  if (battery.isAvailable) {
    const chargingIndicator = battery.isCharging ? " ⚡" : "";
    batteryText = `Battery: ${battery.level}%${chargingIndicator}`;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Status: ${modeText} Mode (${currentRate}Hz)`,
      enabled: false,
    },
    {
      label: batteryText,
      enabled: false,
    },
    { type: "separator" },
    {
      label: "Manual Control",
      submenu: [
        {
          label: "500 Hz",
          click: () => setManualRate(500),
        },
        {
          label: "1000 Hz",
          click: () => setManualRate(1000),
        },
        {
          label: "2000 Hz",
          click: () => setManualRate(2000),
        },
        {
          label: "4000 Hz",
          click: () => setManualRate(4000),
        },
        {
          label: "8000 Hz",
          click: () => setManualRate(8000),
        },
      ],
    },
    {
      label: isAutoMode ? "Disable Auto Mode" : "Enable Auto Mode",
      click: () => toggleAutoMode(),
    },
    { type: "separator" },
    {
      label: "Settings",
      click: () => {
        showAndFocusWindow();
      },
    },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        gameWatcher.stop();
        app.quit();
      },
    },
  ]);

  tray?.setContextMenu(contextMenu);
}

function updateStatus(
  isGameRunning: boolean,
  rate: number,
  isAutoMode: boolean = true
) {
  currentStatus = {
    isGameRunning,
    currentRate: rate,
    isAutoMode,
    battery: currentStatus.battery, // Preserve existing battery info
  };
  updateTrayMenu();

  // Send status update to renderer if window exists
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("status-update", currentStatus);
  }
}

async function setManualRate(rate: number) {
  const success = await gameWatcher.setManualRate(rate);
  if (success) {
    const settings = settingsManager.getSettings();
    if (settings.enableNotifications) {
      showNotification(`Manual Rate Set`, `Polling rate set to ${rate}Hz`);
    }
    updateStatus(false, rate, false); // Manual mode
  }
}

function toggleAutoMode() {
  if (currentStatus.isAutoMode) {
    updateStatus(currentStatus.isGameRunning, currentStatus.currentRate, false);
    showNotification("Auto Mode Disabled", "Manual control enabled");
  } else {
    updateStatus(currentStatus.isGameRunning, currentStatus.currentRate, true);
    showNotification("Auto Mode Enabled", "Automatic game detection resumed");
  }
}

function createWindow() {
  const settings = settingsManager.getSettings();

  mainWindow = new BrowserWindow({
    width: 550,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    show: false, // Always start hidden, then show conditionally
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, "../ui/index.html"));

  mainWindow.on("close", (event) => {
    if (!isQuitting) {
      event.preventDefault();
      mainWindow?.hide();
    }
  });

  mainWindow.once("ready-to-show", () => {
    if (!settings.startMinimized) {
      mainWindow?.show();
      mainWindow?.focus();
    }
    // Send initial data to renderer
    mainWindow?.webContents.send("status-update", currentStatus);
    mainWindow?.webContents.send("settings-update", settings);
  });
}

function showNotification(title: string, body: string) {
  const settings = settingsManager.getSettings();
  if (Notification.isSupported() && settings.enableNotifications) {
    new Notification({
      title,
      body,
    }).show();
  }
}

function restartGameWatcher() {
  if (gameWatcher) {
    gameWatcher.stop();
  }

  const settings = settingsManager.getSettings();
  const config: GameWatcherConfig = {
    gamesList: settings.gamesList,
    gamePollingRate: settings.gamePollingRate,
    defaultPollingRate: settings.defaultPollingRate,
    checkIntervalMs: settings.checkIntervalMs,
  };

  gameWatcher = new GameWatcher(config);
  gameWatcher.setStatusChangeCallback((isGameRunning, rate) => {
    if (currentStatus.isAutoMode) {
      updateStatus(isGameRunning, rate, true);
      const mode = isGameRunning ? "Gaming" : "Normal";
      if (settings.enableNotifications) {
        showNotification(
          `Mode Changed`,
          `Switched to ${mode} mode (${rate}Hz)`
        );
      }
    }
  });

  gameWatcher.start();
}

// Auto-launch functionality
function initializeAutoLaunch() {
  autoLauncher = new AutoLaunch({
    name: "Lamzu Mouse Automator",
    path: app.getPath("exe"),
    isHidden: true, // Start minimized
  });
}

async function isRunningAsAdmin(): Promise<boolean> {
  try {
    // Try to access a system resource that requires admin rights
    await execAsync("net session");
    return true; // If no error, running as admin
  } catch {
    return false; // Error means not admin
  }
}

async function createAdminAutoLaunch(): Promise<void> {
  const appPath = process.execPath;
  const appName = "Lamzu Mouse Automator";

  try {
    // Create a scheduled task that runs at startup with highest privileges
    const command = `schtasks /create /tn "${appName}" /tr "\\"${appPath}\\"" /sc onlogon /rl highest /f`;
    await execAsync(command);
    logInfo("Admin auto-launch created successfully via Task Scheduler");
  } catch (error) {
    logError("Failed to create admin auto-launch:", error);
    throw error;
  }
}

async function removeAdminAutoLaunch(): Promise<void> {
  const appName = "Lamzu Mouse Automator";

  try {
    const command = `schtasks /delete /tn "${appName}" /f`;
    await execAsync(command);
    logInfo("Admin auto-launch removed successfully from Task Scheduler");
  } catch (error) {
    logError("Failed to remove admin auto-launch:", error);
    throw error;
  }
}

async function checkAdminAutoLaunchExists(): Promise<boolean> {
  const appName = "Lamzu Mouse Automator";

  try {
    const { stdout } = await execAsync(`schtasks /query /tn "${appName}"`);
    return stdout.includes(appName);
  } catch {
    return false;
  }
}

async function updateAutoLaunch(enabled: boolean) {
  try {
    const isAdmin = await isRunningAsAdmin();

    if (isAdmin) {
      // Use Task Scheduler for admin apps
      console.log("Admin mode detected - using Task Scheduler for auto-launch");
      if (enabled) {
        await createAdminAutoLaunch();
      } else {
        await removeAdminAutoLaunch();
      }
    } else {
      // Use regular auto-launch for non-admin apps
      logDebug("Regular mode detected - using Registry for auto-launch");
      const isEnabled = await autoLauncher.isEnabled();

      if (enabled && !isEnabled) {
        await autoLauncher.enable();
        logInfo("Regular auto-launch enabled");
      } else if (!enabled && isEnabled) {
        await autoLauncher.disable();
        logInfo("Regular auto-launch disabled");
      }
    }
  } catch (error) {
    logError("Error updating auto-launch:", error);
    throw error;
  }
}

async function getAutoLaunchStatus(): Promise<boolean> {
  try {
    const isAdmin = await isRunningAsAdmin();

    if (isAdmin) {
      return await checkAdminAutoLaunchExists();
    } else {
      return await autoLauncher.isEnabled();
    }
  } catch (error) {
    console.error("Error getting auto-launch status:", error);
    return false;
  }
}

// IPC handlers
ipcMain.handle("get-current-status", () => {
  return currentStatus;
});

ipcMain.handle("get-settings", () => {
  return settingsManager.getSettings();
});

// Battery monitoring IPC handlers
ipcMain.handle("check-battery-support", async () => {
  return await MouseController.checkBatterySupport();
});

ipcMain.handle("start-battery-monitoring", async () => {
  return await MouseController.startBatteryMonitoring(
    (battery: BatteryInfo) => {
      // Update global status with battery info
      currentStatus.battery = {
        level: battery.level,
        isCharging: battery.isCharging,
        isAvailable: battery.isAvailable,
      };

      // Update tray menu with new battery info
      updateTrayMenu();

      // Send battery updates to renderer
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send("battery-update", battery);
      }
    }
  );
});

ipcMain.handle("get-current-battery", async () => {
  return await MouseController.getCurrentBatteryInfo();
});

ipcMain.handle(
  "update-settings",
  async (event, newSettings: Partial<AppSettings>) => {
    const updatedSettings = settingsManager.updateSettings(newSettings);

    // Restart game watcher if game-related settings changed
    if (
      newSettings.gamesList ||
      newSettings.gamePollingRate ||
      newSettings.defaultPollingRate ||
      newSettings.checkIntervalMs
    ) {
      restartGameWatcher();
    }

    // Send updated settings to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("settings-update", updatedSettings);
    }

    return updatedSettings;
  }
);

ipcMain.handle("add-game", async (event, gameName: string) => {
  const updatedSettings = settingsManager.addGame(gameName);
  restartGameWatcher();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("settings-update", updatedSettings);
  }

  return updatedSettings;
});

ipcMain.handle("remove-game", async (event, gameName: string) => {
  const updatedSettings = settingsManager.removeGame(gameName);
  restartGameWatcher();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("settings-update", updatedSettings);
  }

  return updatedSettings;
});

ipcMain.handle("reset-settings", async () => {
  const updatedSettings = settingsManager.resetToDefaults();
  restartGameWatcher();

  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send("settings-update", updatedSettings);
  }

  return updatedSettings;
});

ipcMain.handle("export-settings", () => {
  return settingsManager.exportSettings();
});

ipcMain.handle("import-settings", async (event, jsonString: string) => {
  try {
    const updatedSettings = settingsManager.importSettings(jsonString);
    restartGameWatcher();

    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("settings-update", updatedSettings);
    }

    return { success: true, settings: updatedSettings };
  } catch (error) {
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("get-settings-path", () => {
  return settingsManager.getSettingsPath();
});

ipcMain.handle("set-manual-rate", async (event, rate: number) => {
  return await setManualRate(rate);
});

ipcMain.handle("toggle-auto-mode", () => {
  toggleAutoMode();
  return currentStatus;
});

ipcMain.handle("get-auto-launch-status", async () => {
  return await getAutoLaunchStatus();
});

ipcMain.handle("set-auto-launch", async (event, enabled: boolean) => {
  try {
    await updateAutoLaunch(enabled);

    // Update the setting in settings manager
    const updatedSettings = settingsManager.updateSettings({
      startWithWindows: enabled,
    });

    // Send updated settings to renderer
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send("settings-update", updatedSettings);
    }

    return { success: true, enabled };
  } catch (error) {
    console.error("Failed to update auto-launch:", error);
    return { success: false, error: (error as Error).message };
  }
});

ipcMain.handle("check-admin-status", async () => {
  return await isRunningAsAdmin();
});

app.whenReady().then(async () => {
  // Initialize settings manager
  settingsManager = SettingsManager.getInstance();
  const settings = settingsManager.getSettings();

  // Initialize auto-launch
  initializeAutoLaunch();

  // Sync auto-launch with settings
  try {
    await updateAutoLaunch(settings.startWithWindows);
  } catch (error) {
    console.error("Failed to sync auto-launch setting:", error);
  }

  createTray();

  // Initialize current status with default rate
  currentStatus.currentRate = settings.defaultPollingRate;

  // Initialize game watcher with saved settings
  restartGameWatcher();

  // Initialize battery monitoring
  try {
    const batterySuccess = await MouseController.startBatteryMonitoring(
      (battery: BatteryInfo) => {
        // Update global status with battery info
        currentStatus.battery = {
          level: battery.level,
          isCharging: battery.isCharging,
          isAvailable: battery.isAvailable,
        };

        // Update tray menu with new battery info
        updateTrayMenu();

        // Send battery updates to renderer if window exists
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send("battery-update", battery);
        }
      }
    );

    if (batterySuccess) {
      logInfo("✅ LAMZU battery monitoring started");
    } else {
      logDebug("⚠️ LAMZU battery monitoring not available");
    }
  } catch (error) {
    logError("❌ Failed to start battery monitoring:", error);
  }

  initializeAutoLaunch();

  logInfo("Lamzu Mouse Automator started in system tray");
  logDebug("Settings file:", settingsManager.getSettingsPath());

  if (settings.enableNotifications) {
    showNotification(
      "Lamzu Automator Started",
      "Mouse automator is running in system tray"
    );
  }
});

app.on("window-all-closed", () => {
  // Only quit if we're actually trying to quit
  if (isQuitting) {
    app.quit();
  }
});

app.on("before-quit", () => {
  isQuitting = true;
  if (gameWatcher) {
    gameWatcher.stop();
  }
  MouseController.stopBatteryMonitoring(); // Cleanup battery monitoring
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

function showAndFocusWindow() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Force the window to show regardless of current state
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }

    // Ensure window is visible
    if (!mainWindow.isVisible()) {
      mainWindow.show();
    }

    // Call show() again to ensure it's actually visible
    mainWindow.show();
    mainWindow.focus();

    // Force window to foreground on Windows
    if (process.platform === "win32") {
      mainWindow.setAlwaysOnTop(true);
      setTimeout(() => {
        if (mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.setAlwaysOnTop(false);
        }
      }, 100);
      mainWindow.moveTop();
    }

    // Additional focus attempts for stubborn windows
    setTimeout(() => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.focus();
        mainWindow.flashFrame(true);
      }
    }, WINDOW_FOCUS_RETRY_DELAY_MS);
  } else {
    createWindow();
  }
}
