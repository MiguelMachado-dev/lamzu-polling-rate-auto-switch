import { HID, devices, Device } from "node-hid";
import { BatteryMonitor, BatteryInfo } from "./batteryMonitor.js";

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
  static setPollingRate(rate: string | number): Promise<boolean> {
    return new Promise((resolve, reject) => {
      const rateValue = POLLING_RATE_MAP[rate.toString()];
      if (rateValue === undefined) {
        reject(new Error(`Invalid Polling Rate: ${rate}`));
        return;
      }

      let device: HID | null = null;
      try {
        const deviceInfo = devices().find(
          (d: Device) =>
            d.vendorId === VENDOR_ID &&
            d.productId === PRODUCT_ID &&
            d.interface === INTERFACE_NUMBER
        );

        if (!deviceInfo || !deviceInfo.path) {
          throw new Error("Device not found.");
        }

        device = new HID(deviceInfo.path);

        const command = new Array(65).fill(0);
        command[0] = 0x00;
        command[2 + 1] = 0x02;
        command[3 + 1] = 0x02;
        command[4 + 1] = 0x01;
        command[5 + 1] = 0x00;
        command[6 + 1] = 1;
        command[7 + 1] = rateValue;

        device.sendFeatureReport(command);
        console.log(`Polling Rate set to ${rate}Hz`);
        resolve(true);
      } catch (err) {
        reject(err);
      } finally {
        if (device) {
          device.close();
        }
      }
    });
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
        console.log("LAMZU battery monitoring not available");
      }
      return success;
    } catch (error) {
      console.error("Failed to start LAMZU battery monitoring:", error);
      return false;
    }
  }

  static stopBatteryMonitoring() {
    if (this.batteryMonitor) {
      this.batteryMonitor.stopMonitoring();
      this.batteryMonitor = null;
    }
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
      console.error("Error getting battery info:", error);
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
      console.log("Start battery monitoring first to discover patterns");
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

      console.log("Available device interfaces:");
      allDeviceInterfaces.forEach(d => {
        console.log(`  Interface ${d.interface}: ${d.product || 'Unknown'} - ${d.path}`);
      });

      // Wireless mice typically have multiple HID interfaces
      const hasMultipleInterfaces = allDeviceInterfaces.length > 1;
      
      if (!hasMultipleInterfaces) {
        console.log("Single interface device - battery monitoring may not be available");
      }

      return allDeviceInterfaces.length > 0; // At least try if device is present
    } catch (error) {
      console.error("Error checking battery support:", error);
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
      
      console.log("\n=== ALL LAMZU DEVICES ===");
      lamzuDevices.forEach(d => {
        console.log(`Interface ${d.interface}: ${d.product || 'Unknown'}`);
        console.log(`  VID: ${d.vendorId}, PID: ${d.productId}`);
        console.log(`  Path: ${d.path}`);
        console.log(`  Usage: ${d.usage}, UsagePage: ${d.usagePage}`);
        console.log("---");
      });
      
      return lamzuDevices;
    } catch (error) {
      console.error("Error listing devices:", error);
      return [];
    }
  }
}
