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
  fastCheckIntervalMs?: number; // Fast interval when games might start
  slowCheckIntervalMs?: number; // Slow interval when system is idle
}

export class GameWatcher {
  private config: GameWatcherConfig;
  private isGameRunning = false;
  private intervalId: NodeJS.Timeout | null = null;
  private onStatusChange?: (isGameRunning: boolean, rate: number) => void;
  private currentInterval: number;
  private consecutiveNoGameChecks = 0;
  private cachedProcesses: string[] = [];
  private lastProcessCacheTime = 0;
  private static readonly PROCESS_CACHE_DURATION_MS = 2000; // Cache processes for 2 seconds

  constructor(config: GameWatcherConfig) {
    this.config = {
      ...config,
      fastCheckIntervalMs: config.fastCheckIntervalMs || 1000, // Default: 1 second when active
      slowCheckIntervalMs: config.slowCheckIntervalMs || 10000, // Default: 10 seconds when idle
    };
    this.currentInterval = this.config.checkIntervalMs;
  }

  setStatusChangeCallback(
    callback: (isGameRunning: boolean, rate: number) => void
  ) {
    this.onStatusChange = callback;
  }

  async start() {
    logGame("Game watcher started with smart polling");
    this.scheduleNextCheck();
  }

  private scheduleNextCheck() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
    }
    
    this.intervalId = setTimeout(() => {
      this.checkProcesses().then(() => {
        this.scheduleNextCheck(); // Schedule next check after current one completes
      });
    }, this.currentInterval);
  }

  stop() {
    if (this.intervalId) {
      clearTimeout(this.intervalId);
      this.intervalId = null;
    }
  }

  private async getRunningProcesses(): Promise<string[]> {
    // Use cached processes if still fresh
    const now = Date.now();
    if (this.cachedProcesses.length > 0 && 
        (now - this.lastProcessCacheTime) < GameWatcher.PROCESS_CACHE_DURATION_MS) {
      logDebug("Using cached process list");
      return this.cachedProcesses;
    }

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

      // Cache the results
      this.cachedProcesses = processNames;
      this.lastProcessCacheTime = now;
      
      return processNames;
    } catch (error) {
      logError("Error getting running processes:", error);
      return this.cachedProcesses; // Return cached results on error
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
        this.consecutiveNoGameChecks = 0;
        this.currentInterval = this.config.fastCheckIntervalMs!; // Fast polling when game is running
        await MouseController.setPollingRate(this.config.gamePollingRate);
        this.onStatusChange?.(true, this.config.gamePollingRate);
      } else if (!gameRunning && this.isGameRunning) {
        logGame(
          `[STATUS] No game detected. Returning to default mode ${this.config.defaultPollingRate}Hz.`
        );
        this.isGameRunning = false;
        this.consecutiveNoGameChecks = 0;
        this.currentInterval = this.config.checkIntervalMs; // Return to normal polling
        await MouseController.setPollingRate(this.config.defaultPollingRate);
        this.onStatusChange?.(false, this.config.defaultPollingRate);
      } else if (!gameRunning && !this.isGameRunning) {
        // No game running - implement adaptive polling
        this.consecutiveNoGameChecks++;
        
        // After 5 consecutive checks with no games, slow down polling
        if (this.consecutiveNoGameChecks >= 5 && this.currentInterval < this.config.slowCheckIntervalMs!) {
          this.currentInterval = this.config.slowCheckIntervalMs!;
          logDebug(`Switching to slow polling (${this.currentInterval}ms) - no games detected for ${this.consecutiveNoGameChecks} checks`);
        }
      } else if (gameRunning && this.isGameRunning) {
        // Game still running - keep fast polling
        this.consecutiveNoGameChecks = 0;
        this.currentInterval = this.config.fastCheckIntervalMs!;
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
