import * as fs from "fs";
import * as path from "path";
import { app } from "electron";

export interface AppSettings {
  gamesList: string[];
  gamePollingRate: number;
  defaultPollingRate: number;
  checkIntervalMs: number;
  enableNotifications: boolean;
  startMinimized: boolean;
  startWithWindows: boolean;
  mouseConfig: {
    vendorId: number;
    productId: number;
    interfaceNumber: number;
  };
}

export class SettingsManager {
  private static instance: SettingsManager;
  private settingsPath: string;
  private currentSettings: AppSettings;

  private defaultSettings: AppSettings = {
    gamesList: ["cs2.exe", "r5apex_dx12.exe", "dota2.exe"],
    gamePollingRate: 2000,
    defaultPollingRate: 1000,
    checkIntervalMs: 5000,
    enableNotifications: true,
    startMinimized: false,
    startWithWindows: false,
    mouseConfig: {
      vendorId: 14142,
      productId: 30,
      interfaceNumber: 2,
    },
  };

  private constructor() {
    // Get the user data directory (AppData on Windows)
    const userDataPath = app.getPath("userData");
    this.settingsPath = path.join(userDataPath, "settings.json");

    // Ensure the directory exists
    this.ensureDirectoryExists(userDataPath);

    // Load settings on initialization
    this.currentSettings = this.loadSettings();
  }

  public static getInstance(): SettingsManager {
    if (!SettingsManager.instance) {
      SettingsManager.instance = new SettingsManager();
    }
    return SettingsManager.instance;
  }

  private ensureDirectoryExists(dirPath: string): void {
    try {
      if (!fs.existsSync(dirPath)) {
        fs.mkdirSync(dirPath, { recursive: true });
      }
    } catch (error) {
      console.error("Failed to create settings directory:", error);
    }
  }

  private loadSettings(): AppSettings {
    try {
      if (fs.existsSync(this.settingsPath)) {
        const fileContent = fs.readFileSync(this.settingsPath, "utf-8");
        const loadedSettings = JSON.parse(fileContent);

        // Merge with defaults to ensure all properties exist
        const settings = { ...this.defaultSettings, ...loadedSettings };

        // Validate critical settings
        if (!Array.isArray(settings.gamesList)) {
          settings.gamesList = this.defaultSettings.gamesList;
        }

        if (
          typeof settings.gamePollingRate !== "number" ||
          settings.gamePollingRate < 500
        ) {
          settings.gamePollingRate = this.defaultSettings.gamePollingRate;
        }

        if (
          typeof settings.defaultPollingRate !== "number" ||
          settings.defaultPollingRate < 500
        ) {
          settings.defaultPollingRate = this.defaultSettings.defaultPollingRate;
        }

        console.log("Settings loaded from:", this.settingsPath);
        return settings;
      } else {
        console.log("No settings file found, using defaults");
        // Save default settings to create the file
        this.saveSettingsToFile(this.defaultSettings);
        return { ...this.defaultSettings };
      }
    } catch (error) {
      console.error("Failed to load settings, using defaults:", error);
      return { ...this.defaultSettings };
    }
  }

  private saveSettingsToFile(settings: AppSettings): void {
    try {
      const jsonString = JSON.stringify(settings, null, 2);
      fs.writeFileSync(this.settingsPath, jsonString, "utf-8");
      console.log("Settings saved to:", this.settingsPath);
    } catch (error) {
      console.error("Failed to save settings:", error);
      throw error;
    }
  }

  public getSettings(): AppSettings {
    return { ...this.currentSettings };
  }

  public updateSettings(newSettings: Partial<AppSettings>): AppSettings {
    // Merge new settings with current settings
    this.currentSettings = { ...this.currentSettings, ...newSettings };

    // Save to file
    this.saveSettingsToFile(this.currentSettings);

    return this.getSettings();
  }

  public addGame(gameName: string): AppSettings {
    if (!this.currentSettings.gamesList.includes(gameName)) {
      this.currentSettings.gamesList.push(gameName);
      this.saveSettingsToFile(this.currentSettings);
    }
    return this.getSettings();
  }

  public removeGame(gameName: string): AppSettings {
    const index = this.currentSettings.gamesList.indexOf(gameName);
    if (index > -1) {
      this.currentSettings.gamesList.splice(index, 1);
      this.saveSettingsToFile(this.currentSettings);
    }
    return this.getSettings();
  }

  public updateGamesList(gamesList: string[]): AppSettings {
    this.currentSettings.gamesList = [...gamesList];
    this.saveSettingsToFile(this.currentSettings);
    return this.getSettings();
  }

  public updatePollingRates(
    gameRate: number,
    defaultRate: number
  ): AppSettings {
    this.currentSettings.gamePollingRate = gameRate;
    this.currentSettings.defaultPollingRate = defaultRate;
    this.saveSettingsToFile(this.currentSettings);
    return this.getSettings();
  }

  public resetToDefaults(): AppSettings {
    this.currentSettings = { ...this.defaultSettings };
    this.saveSettingsToFile(this.currentSettings);
    console.log("Settings reset to defaults");
    return this.getSettings();
  }

  public getSettingsPath(): string {
    return this.settingsPath;
  }

  public exportSettings(): string {
    return JSON.stringify(this.currentSettings, null, 2);
  }

  public importSettings(jsonString: string): AppSettings {
    try {
      const importedSettings = JSON.parse(jsonString);
      // Validate and merge with defaults
      const validatedSettings = {
        ...this.defaultSettings,
        ...importedSettings,
      };
      this.currentSettings = validatedSettings;
      this.saveSettingsToFile(this.currentSettings);
      console.log("Settings imported successfully");
      return this.getSettings();
    } catch (error) {
      console.error("Failed to import settings:", error);
      throw new Error("Invalid settings format");
    }
  }
}
