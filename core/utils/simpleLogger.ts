// Simple console logger for CLI tools and non-Electron contexts
export class SimpleLogger {
    private static instance: SimpleLogger;
    private isDevelopment: boolean;
    private enableConsole: boolean;

    private constructor() {
        this.isDevelopment = process.env.NODE_ENV === 'development';
        this.enableConsole = this.isDevelopment;
    }

    public static getInstance(): SimpleLogger {
        if (!SimpleLogger.instance) {
            SimpleLogger.instance = new SimpleLogger();
        }
        return SimpleLogger.instance;
    }

    public debug(message: string, ...args: any[]): void {
        if (this.enableConsole) {
            console.log(`[DEBUG] ${message}`, ...args);
        }
    }

    public info(message: string, ...args: any[]): void {
        if (this.enableConsole) {
            console.log(`[INFO] ${message}`, ...args);
        }
    }

    public warn(message: string, ...args: any[]): void {
        console.warn(`[WARN] ${message}`, ...args);
    }

    public error(message: string, error?: any, ...args: any[]): void {
        console.error(`[ERROR] ${message}`, error, ...args);
    }

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

    public setConsoleEnabled(enabled: boolean): void {
        this.enableConsole = enabled;
    }

    public isConsoleEnabled(): boolean {
        return this.enableConsole;
    }

    public isDev(): boolean {
        return this.isDevelopment;
    }
}

// Export singleton instance
export const simpleLogger = SimpleLogger.getInstance();
