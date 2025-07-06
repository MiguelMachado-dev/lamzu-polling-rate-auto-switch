import { exec } from "child_process";
import { promisify } from "util";
import { MouseController } from "./mouseController.js";
import { logGame, logError, logDebug } from "./utils/logger.js";

const execAsync = promisify(exec);

export interface GameWatcherConfig {
  gamesList: string[];
  gamePollingRate: number;
  defaultPollingRate: number;
  checkIntervalMs: number;
}

export class GameWatcher {
  private config: GameWatcherConfig;
  private isGameRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private onStatusChange?: (isGameRunning: boolean, rate: number) => void;

  constructor(config: GameWatcherConfig) {
    this.config = config;
  }

  setStatusChangeCallback(
    callback: (isGameRunning: boolean, rate: number) => void
  ) {
    this.onStatusChange = callback;
  }

  async start() {
    logGame("Game watcher started");
    this.intervalId = setInterval(
      () => this.checkProcesses(),
      this.config.checkIntervalMs
    );
  }

  stop() {
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async getRunningProcesses(): Promise<string[]> {
    try {
      // Use Windows tasklist command to get running processes
      const { stdout } = await execAsync("tasklist /fo csv /nh");

      // Parse CSV output and extract process names
      const lines = stdout.split("\n");
      const processNames: string[] = [];

      for (const line of lines) {
        if (line.trim()) {
          // Parse CSV line - process name is the first field
          const match = line.match(/^"([^"]+)"/);
          if (match) {
            processNames.push(match[1]);
          }
        }
      }

      return processNames;
    } catch (error) {
      console.error("Error getting running processes:", error);
      return [];
    }
  }

  private async checkProcesses() {
    try {
      const runningProcesses = await this.getRunningProcesses();
      const gameRunning = runningProcesses.some((processName) =>
        this.config.gamesList.includes(processName)
      );

      if (gameRunning && !this.isGameRunning) {
        logGame(
          `[STATUS] Game detected! Activating mode ${this.config.gamePollingRate}Hz.`
        );
        this.isGameRunning = true;
        await MouseController.setPollingRate(this.config.gamePollingRate);
        this.onStatusChange?.(true, this.config.gamePollingRate);
      } else if (!gameRunning && this.isGameRunning) {
        logGame(
          `[STATUS] No game detected. Returning to default mode ${this.config.defaultPollingRate}Hz.`
        );
        this.isGameRunning = false;
        await MouseController.setPollingRate(this.config.defaultPollingRate);
        this.onStatusChange?.(false, this.config.defaultPollingRate);
      }
    } catch (error) {
      logError("Error checking processes:", error);
    }
  }

  async setManualRate(rate: number) {
    try {
      await MouseController.setPollingRate(rate);
      return true;
    } catch (error) {
      logError("Error setting manual rate:", error);
      return false;
    }
  }

  getCurrentStatus() {
    return {
      isGameRunning: this.isGameRunning,
      currentRate: this.isGameRunning
        ? this.config.gamePollingRate
        : this.config.defaultPollingRate,
    };
  }
}
