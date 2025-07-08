import { HID, devices, Device } from "node-hid";
import { BatteryMonitor, BatteryInfo } from "./batteryMonitor.js";
import { logHID, logPolling, logError, logDebug } from "./utils/logger.js";

const VENDOR_ID = 14142;
const PRODUCT_ID = 30;
const INTERFACE_NUMBER = 2;

const POLLING_RATE_MAP: { [key: string]: number } = {
  "500": 2,
  "1000": 1,
  "2000": 32,
  "4000": 64,
  "8000": 128,
};

export class MouseController {
  private static batteryMonitor: BatteryMonitor | null = null;
  private static onBatteryChange?: (battery: BatteryInfo) => void;
  private static deviceConnection: HID | null = null;
  private static devicePath: string | null = null;
  private static lastConnectionTime = 0;
  private static readonly CONNECTION_TIMEOUT_MS = 30000; // 30 seconds
  private static async getDeviceConnection(): Promise<HID | null> {
    const now = Date.now();
    
    // Check if existing connection is still valid
    if (this.deviceConnection && this.devicePath && 
        (now - this.lastConnectionTime) < this.CONNECTION_TIMEOUT_MS) {
      try {
        // Test if connection is still alive by checking device info
        const deviceInfo = devices().find(d => d.path === this.devicePath);
        if (deviceInfo) {
          return this.deviceConnection;
        }
      } catch (error) {
        // Connection is stale, will reconnect below
      }
    }

    // Close stale connection
    this.closeDeviceConnection();

    // Find and connect to device
    try {
      const deviceInfo = devices().find(
        (d: Device) =>
          d.vendorId === VENDOR_ID &&
          d.productId === PRODUCT_ID &&
          d.interface === INTERFACE_NUMBER
      );

      if (!deviceInfo || !deviceInfo.path) {
        logError("LAMZU device not found");
        return null;
      }

      this.deviceConnection = new HID(deviceInfo.path);
      this.devicePath = deviceInfo.path;
      this.lastConnectionTime = now;
      
      logHID(`Connected to LAMZU device: ${this.devicePath}`);
      return this.deviceConnection;
    } catch (error) {
      logError("Failed to connect to LAMZU device:", error);
      this.closeDeviceConnection();
      return null;
    }
  }

  private static closeDeviceConnection() {
    if (this.deviceConnection) {
      try {
        this.deviceConnection.close();
      } catch (error) {
        // Ignore errors when closing
      }
      this.deviceConnection = null;
      this.devicePath = null;
    }
  }

  static async setPollingRate(rate: string | number): Promise<boolean> {
    const rateValue = POLLING_RATE_MAP[rate.toString()];
    if (rateValue === undefined) {
      throw new Error(`Invalid Polling Rate: ${rate}`);
    }

    try {
      const device = await this.getDeviceConnection();
      if (!device) {
        throw new Error("Device not found.");
      }

      const command = new Array(65).fill(0);
      command[0] = 0x00;
      command[2 + 1] = 0x02;
      command[3 + 1] = 0x02;
      command[4 + 1] = 0x01;
      command[5 + 1] = 0x00;
      command[6 + 1] = 1;
      command[7 + 1] = rateValue;

      device.sendFeatureReport(command);
      logPolling(`Polling Rate set to ${rate}Hz`);
      return true;
    } catch (err) {
      logError("Error setting polling rate:", err);
      this.closeDeviceConnection(); // Close connection on error to force reconnect
      throw err;
    }
  }

  static async startBatteryMonitoring(
    callback: (battery: BatteryInfo) => void
  ): Promise<boolean> {
    try {
      if (this.batteryMonitor) {
        this.batteryMonitor.stopMonitoring();
      }

      // Use Interface 2 for LAMZU battery monitoring (the working interface)
      this.batteryMonitor = new BatteryMonitor(
        VENDOR_ID,
        PRODUCT_ID,
        2  // Interface 2 is the working interface for battery
      );

      this.onBatteryChange = callback;
      
      this.batteryMonitor.setUpdateCallback((battery: BatteryInfo) => {
        if (this.onBatteryChange) {
          this.onBatteryChange(battery);
        }
      });

      const success = await this.batteryMonitor.startMonitoring();
      if (!success) {
        logDebug("LAMZU battery monitoring not available");
      }
      return success;
    } catch (error) {
      logError("Failed to start LAMZU battery monitoring:", error);
      return false;
    }
  }

  static stopBatteryMonitoring() {
    if (this.batteryMonitor) {
      this.batteryMonitor.stopMonitoring();
      this.batteryMonitor = null;
    }
  }

  static cleanup() {
    this.stopBatteryMonitoring();
    this.closeDeviceConnection();
  }

  static async getCurrentBatteryInfo(): Promise<BatteryInfo | null> {
    // Try to get immediate battery reading
    let device: HID | null = null;
    try {
      const deviceInfo = devices().find(
        (d: Device) =>
          d.vendorId === VENDOR_ID &&
          d.productId === PRODUCT_ID &&
          d.interface === INTERFACE_NUMBER
      );

      if (!deviceInfo || !deviceInfo.path) {
        return null;
      }

      device = new HID(deviceInfo.path);
      
      // Try to get battery info via feature report
      try {
        const batteryReport = device.getFeatureReport(0x07, 8); // Common battery report ID
        if (batteryReport && batteryReport.length >= 3) {
          const reportBuffer = Buffer.from(batteryReport);
          return {
            level: Math.min(100, Math.max(0, reportBuffer[2])),
            isCharging: (reportBuffer[1] & 0x01) !== 0,
            isLow: reportBuffer[2] < 20,
            isAvailable: true
          };
        }
      } catch (error) {
        // Feature report might not be supported
      }

      return {
        level: 0,
        isCharging: false,
        isLow: false,
        isAvailable: false
      };
    } catch (error) {
      logError("Error getting battery info:", error);
      return null;
    } finally {
      if (device) {
        device.close();
      }
    }
  }

  // Utility method to help discover battery data patterns
  static async discoverBatteryData(): Promise<void> {
    if (this.batteryMonitor) {
      await this.batteryMonitor.discoverBatteryPattern();
    } else {
      logDebug("Start battery monitoring first to discover patterns");
    }
  }

  // Check if device supports battery monitoring
  static async checkBatterySupport(): Promise<boolean> {
    try {
      // List all interfaces for this device
      const allDeviceInterfaces = devices().filter(
        (d: Device) =>
          d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID
      );

      logHID("Available device interfaces:");
      allDeviceInterfaces.forEach(d => {
        logHID(`  Interface ${d.interface}: ${d.product || 'Unknown'} - ${d.path}`);
      });

      // Wireless mice typically have multiple HID interfaces
      const hasMultipleInterfaces = allDeviceInterfaces.length > 1;
      
      if (!hasMultipleInterfaces) {
        logDebug("Single interface device - battery monitoring may not be available");
      }

      return allDeviceInterfaces.length > 0; // At least try if device is present
    } catch (error) {
      logError("Error checking battery support:", error);
      return false;
    }
  }

  // List all HID devices for debugging
  static listAllDevices() {
    try {
      const allDevices = devices();
      const lamzuDevices = allDevices.filter(d => 
        d.vendorId === VENDOR_ID && d.productId === PRODUCT_ID
      );
      
      logHID("\n=== ALL LAMZU DEVICES ===");
      lamzuDevices.forEach(d => {
        logHID(`Interface ${d.interface}: ${d.product || 'Unknown'}`);
        logHID(`  VID: ${d.vendorId}, PID: ${d.productId}`);
        logHID(`  Path: ${d.path}`);
        logHID(`  Usage: ${d.usage}, UsagePage: ${d.usagePage}`);
        logHID("---");
      });
      
      return lamzuDevices;
    } catch (error) {
      logError("Error listing devices:", error);
      return [];
    }
  }
}
