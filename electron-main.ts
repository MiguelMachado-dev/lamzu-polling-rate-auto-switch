import {
  app,
  Tray,
  Menu,
  BrowserWindow,
  Notification,
  nativeImage,
  ipcMain,
} from "electron";
import * as path from "path";
import { GameWatcher, GameWatcherConfig } from "./core/gameWatcher.js";
import { SettingsManager, AppSettings } from "./core/settingsManager.js";

let tray: Tray | null = null;
let mainWindow: BrowserWindow | null = null;
let gameWatcher: GameWatcher;
let settingsManager: SettingsManager;

// Current status state
let currentStatus = {
  isGameRunning: false,
  currentRate: 1000,
  isAutoMode: true,
};

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

  tray.on("double-click", () => {
    if (mainWindow) {
      mainWindow.show();
    } else {
      createWindow();
    }
  });
}

function updateTrayMenu() {
  const { isGameRunning, currentRate, isAutoMode } = currentStatus;
  const modeText = isAutoMode
    ? isGameRunning
      ? "Gaming"
      : "Normal"
    : "Manual";

  const contextMenu = Menu.buildFromTemplate([
    {
      label: `Status: ${modeText} Mode (${currentRate}Hz)`,
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
        if (mainWindow) {
          mainWindow.show();
        } else {
          createWindow();
        }
      },
    },
    {
      label: "Quit",
      click: () => {
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
  currentStatus = { isGameRunning, currentRate: rate, isAutoMode };
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
    show: !settings.startMinimized,
    autoHideMenuBar: true,
  });

  mainWindow.loadFile(path.join(__dirname, "../ui/index.html"));

  mainWindow.on("close", (event) => {
    event.preventDefault();
    mainWindow?.hide();
  });

  mainWindow.once("ready-to-show", () => {
    if (!settings.startMinimized) {
      mainWindow?.show();
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

// IPC handlers
ipcMain.handle("get-current-status", () => {
  return currentStatus;
});

ipcMain.handle("get-settings", () => {
  return settingsManager.getSettings();
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

app.whenReady().then(async () => {
  // Initialize settings manager
  settingsManager = SettingsManager.getInstance();
  const settings = settingsManager.getSettings();

  createTray();

  // Initialize current status with default rate
  currentStatus.currentRate = settings.defaultPollingRate;

  // Initialize game watcher with saved settings
  restartGameWatcher();

  console.log("Lamzu Mouse Automator started in system tray");
  console.log("Settings file:", settingsManager.getSettingsPath());

  if (settings.enableNotifications) {
    showNotification(
      "Lamzu Automator Started",
      "Mouse automator is running in system tray"
    );
  }
});

app.on("window-all-closed", () => {
  // Prevent app from quitting when all windows are closed (keep running in tray)
});

app.on("before-quit", () => {
  if (gameWatcher) {
    gameWatcher.stop();
  }
});

app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
