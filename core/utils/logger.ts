import log from 'electron-log';
import path from 'path';
import { app } from 'electron';

// Configure electron-log
export class Logger {
    private static instance: Logger;
    private electronLog: typeof log;
    private isDevelopment: boolean;
    private enableConsole: boolean;

    private constructor() {
        this.electronLog = log;
        this.isDevelopment = process.env.NODE_ENV === 'development' || process.env.ELECTRON_IS_DEV === 'true';
        this.enableConsole = this.isDevelopment;
        
        this.configureLog();
    }

    public static getInstance(): Logger {
        if (!Logger.instance) {
            Logger.instance = new Logger();
        }
        return Logger.instance;
    }

    private configureLog(): void {
        // Configure file logging
        if (app && app.isReady()) {
            this.electronLog.transports.file.resolvePathFn = () => path.join(app.getPath('userData'), 'logs', 'lamzu-automator.log');
        } else {
            // Fallback for when app is not ready
            this.electronLog.transports.file.resolvePathFn = () => path.join(process.cwd(), 'logs', 'lamzu-automator.log');
        }
        
        // Set log levels
        if (this.isDevelopment) {
            this.electronLog.transports.file.level = 'debug';
            this.electronLog.transports.console.level = 'debug';
        } else {
            this.electronLog.transports.file.level = 'info';
            this.electronLog.transports.console.level = false; // Disable console in production
        }

        // Format configuration
        this.electronLog.transports.file.format = '{y}-{m}-{d} {h}:{i}:{s}.{ms} [{level}] {text}';
        this.electronLog.transports.console.format = '[{level}] {text}';
        
        // Maximum file size (10MB)
        this.electronLog.transports.file.maxSize = 10 * 1024 * 1024;
        
        // Keep last 5 log files
        this.electronLog.transports.file.archiveLogFn = (oldLogFile) => {
            const fs = require('fs');
            const newLogFile = oldLogFile.toString().replace('.log', `.${Date.now()}.log`);
            fs.renameSync(oldLogFile, newLogFile);
        };
    }

    // Development-only console logging
    public console(level: 'debug' | 'info' | 'warn' | 'error', message: string, ...args: any[]): void {
        if (this.enableConsole) {
            console[level === 'debug' ? 'log' : level](message, ...args);
        }
    }

    // File + conditional console logging
    public debug(message: string, ...args: any[]): void {
        this.electronLog.debug(message, ...args);
        this.console('debug', `[DEBUG] ${message}`, ...args);
    }

    public info(message: string, ...args: any[]): void {
        this.electronLog.info(message, ...args);
        this.console('info', `[INFO] ${message}`, ...args);
    }

    public warn(message: string, ...args: any[]): void {
        this.electronLog.warn(message, ...args);
        this.console('warn', `[WARN] ${message}`, ...args);
    }

    public error(message: string, error?: any, ...args: any[]): void {
        this.electronLog.error(message, error, ...args);
        this.console('error', `[ERROR] ${message}`, error, ...args);
    }

    // Special methods for specific components
    public hid(message: string, ...args: any[]): void {
        this.debug(`[HID] ${message}`, ...args);
    }

    public battery(message: string, ...args: any[]): void {
        this.debug(`[BATTERY] ${message}`, ...args);
    }

    public game(message: string, ...args: any[]): void {
        this.debug(`[GAME] ${message}`, ...args);
    }

    public polling(message: string, ...args: any[]): void {
        this.info(`[POLLING] ${message}`, ...args);
    }

    public ui(message: string, ...args: any[]): void {
        this.debug(`[UI] ${message}`, ...args);
    }

    // Configuration methods
    public setConsoleEnabled(enabled: boolean): void {
        this.enableConsole = enabled;
    }

    public isConsoleEnabled(): boolean {
        return this.enableConsole;
    }

    public isDev(): boolean {
        return this.isDevelopment;
    }

    // Get raw electron-log instance if needed
    public getRawLogger(): typeof log {
        return this.electronLog;
    }
}

// Export singleton instance
export const logger = Logger.getInstance();

// Export convenience methods
export const logDebug = (message: string, ...args: any[]) => logger.debug(message, ...args);
export const logInfo = (message: string, ...args: any[]) => logger.info(message, ...args);
export const logWarn = (message: string, ...args: any[]) => logger.warn(message, ...args);
export const logError = (message: string, error?: any, ...args: any[]) => logger.error(message, error, ...args);

// Component-specific loggers
export const logHID = (message: string, ...args: any[]) => logger.hid(message, ...args);
export const logBattery = (message: string, ...args: any[]) => logger.battery(message, ...args);
export const logGame = (message: string, ...args: any[]) => logger.game(message, ...args);
export const logPolling = (message: string, ...args: any[]) => logger.polling(message, ...args);
export const logUI = (message: string, ...args: any[]) => logger.ui(message, ...args);
