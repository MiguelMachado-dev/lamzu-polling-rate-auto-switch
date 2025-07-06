import { HID, devices, Device } from "node-hid";
import { logBattery, logError, logDebug } from "./utils/logger.js";

export interface BatteryInfo {
  level: number; // 0-100 percentage
  isCharging: boolean;
  isLow: boolean;
  isAvailable: boolean;
}

export class BatteryMonitor {
  private device: HID | null = null;
  private vendorId: number;
  private productId: number;
  private interfaceNumber: number;
  private onBatteryUpdate?: (battery: BatteryInfo) => void;
  private monitoringInterval?: NodeJS.Timeout;

  constructor(vendorId: number, productId: number, interfaceNumber: number = 2) {
    this.vendorId = vendorId;
    this.productId = productId;
    this.interfaceNumber = interfaceNumber; // Default to Interface 2 (working interface)
  }

  setUpdateCallback(callback: (battery: BatteryInfo) => void) {
    this.onBatteryUpdate = callback;
  }

  async startMonitoring(): Promise<boolean> {
    try {
      // Find the specific LAMZU interface that works for battery (Interface 2)
      const deviceInfo = devices().find(
        (d: Device) =>
          d.vendorId === this.vendorId &&
          d.productId === this.productId &&
          d.interface === 2 // Use Interface 2 (the working one)
      );

      if (!deviceInfo || !deviceInfo.path) {
        logBattery("Battery monitoring: LAMZU Interface 2 not found");
        return false;
      }

      this.device = new HID(deviceInfo.path);
      logBattery("✅ Connected to LAMZU Interface 2 for battery monitoring");

      // Test the LAMZU battery command immediately
      const batteryInfo = await this.requestLamzuBatteryInfo();
      if (batteryInfo.isAvailable && this.onBatteryUpdate) {
        this.onBatteryUpdate(batteryInfo);
      }

      // Set up periodic battery requests (every 30 minutes)
      this.monitoringInterval = setInterval(async () => {
        const battery = await this.requestLamzuBatteryInfo();
        if (battery.isAvailable && this.onBatteryUpdate) {
          this.onBatteryUpdate(battery);
        }
      }, 1800000); // 30 minutes = 30 * 60 * 1000 = 1,800,000ms

      logBattery("🔋 LAMZU battery monitoring started successfully");
      return true;

    } catch (error) {
      logError("Failed to start LAMZU battery monitoring:", error);
      return false;
    }
  }

  stopMonitoring() {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
    }

    if (this.device) {
      try {
        this.device.close();
      } catch (error) {
        logError("Error closing battery monitor device:", error);
      }
      this.device = null;
    }
  }

  private parseBatteryData(data: Buffer): BatteryInfo {
    // This parsing logic depends on your specific mouse model
    // Different manufacturers use different report formats
    
    // Common patterns for gaming mice:
    
    // Method 1: Check for standard HID battery usage page
    if (data.length >= 3) {
      // Some mice put battery info in specific bytes
      const batteryByte = data[2]; // Common location
      
      if (batteryByte !== undefined) {
        // Check if this looks like battery data (0-100 range)
        if (batteryByte <= 100) {
          return {
            level: batteryByte,
            isCharging: (data[1] & 0x01) !== 0, // Common charging bit
            isLow: batteryByte < 20,
            isAvailable: true
          };
        }
      }
    }

    // Method 2: Look for specific byte patterns
    // Some mice use different report IDs for battery
    if (data[0] === 0x03 && data.length >= 4) { // Example report ID
      const level = data[3];
      const status = data[2];
      
      return {
        level: Math.min(100, Math.max(0, level)),
        isCharging: (status & 0x02) !== 0,
        isLow: level < 15,
        isAvailable: true
      };
    }

    // Method 3: Lamzu-specific pattern (you'll need to discover this)
    // Monitor the raw data to find the pattern:
    // console.log("Raw HID data:", data.toString('hex'));
    
    return {
      level: 0,
      isCharging: false,
      isLow: false,
      isAvailable: false
    };
  }

  private async requestBatteryInfo() {
    // Use the new LAMZU-specific method
    const battery = await this.requestLamzuBatteryInfo();
    if (battery.isAvailable && this.onBatteryUpdate) {
      this.onBatteryUpdate(battery);
    }
  }

  /**
   * Request battery info using LAMZU's official protocol
   */
  private async requestLamzuBatteryInfo(): Promise<BatteryInfo> {
    if (!this.device) {
      return { level: 0, isCharging: false, isLow: false, isAvailable: false };
    }

    try {
      // LAMZU battery command (same as working test)
      const command = new Array(65).fill(0);
      command[0] = 0;    // Report ID
      command[3] = 2;    // Shifted positions due to report ID
      command[4] = 2;    
      command[6] = 131;  // 0x83 in decimal
      
      // Send feature report
      this.device.sendFeatureReport(command);
      
      // Wait 100ms (same as LAMZU web interface)
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Read feature report response
      const response = this.device.getFeatureReport(0, 65);
      const responseBuffer = Buffer.from(response);
      
      // Parse using LAMZU's patterns
      return this.parseLamzuBatteryResponse(responseBuffer);
      
    } catch (error) {
      logError("Error requesting LAMZU battery info:", error);
      return { level: 0, isCharging: false, isLow: false, isAvailable: false };
    }
  }

  /**
   * Parse LAMZU battery response using their official patterns
   */
  private parseLamzuBatteryResponse(response: Buffer): BatteryInfo {
    if (response.length < 10) {
      return { level: 0, isCharging: false, isLow: false, isAvailable: false };
    }

    // LAMZU Pattern 1: response[1]==161 && response[4]==2 && response[6]==131
    if (response[1] === 161 && response[4] === 2 && response[6] === 131) {
      const batteryStatus = response[7];  // Status/charging info
      const batteryLevel = response[8];   // Actual battery percentage!
      
      logBattery(`🔋 LAMZU Pattern 1: Battery ${batteryLevel}%, Status ${batteryStatus}`);
      
      return {
        level: Math.min(100, Math.max(0, batteryLevel)),
        isCharging: batteryStatus === 1, // 0 = not charging, 1 = charging (adjust as needed)
        isLow: batteryLevel < 20,
        isAvailable: true
      };
    }
    
    // LAMZU Pattern 2: response[0]==161 && response[3]==2 && response[5]==131
    if (response[0] === 161 && response[3] === 2 && response[5] === 131) {
      const batteryStatus = response[6];  // Status/charging info
      const batteryLevel = response[7];   // Actual battery percentage!
      
      logBattery(`🔋 LAMZU Pattern 2: Battery ${batteryLevel}%, Status ${batteryStatus}`);
      
      return {
        level: Math.min(100, Math.max(0, batteryLevel)),
        isCharging: batteryStatus === 1,
        isLow: batteryLevel < 20,
        isAvailable: true
      };
    }

    logBattery("🔋 LAMZU battery patterns not matched");
    return { level: 0, isCharging: false, isLow: false, isAvailable: false };
  }

  private parseBatteryFeatureReport(data: Buffer): BatteryInfo {
    // Parse feature report response for battery information
    // This is highly device-specific
    
    if (data.length >= 3) {
      const level = data[2];
      const status = data[1];
      
      // Validate that this looks like battery data
      if (level <= 100 && level >= 0) {
        return {
          level: level,
          isCharging: (status & 0x01) !== 0,
          isLow: level < 20,
          isAvailable: true
        };
      }
    }

    return {
      level: 0,
      isCharging: false,
      isLow: false,
      isAvailable: false
    };
  }

  // Method to discover battery data patterns
  async discoverBatteryPattern(): Promise<void> {
    if (!this.device) return;

    logBattery("Starting battery pattern discovery...");
    logBattery("Move your mouse and watch for patterns in the data:");

    this.device.on("data", (data: Buffer) => {
      logBattery(`Data [${data.length}]:`, data.toString('hex'));
    });

    // Try all possible feature report IDs
    for (let reportId = 1; reportId <= 255; reportId++) {
      try {
        const response = this.device.getFeatureReport(reportId, 32);
        if (response && response.length > 1) {
          logBattery(`Feature Report ${reportId}:`, Buffer.from(response).toString('hex'));
        }
      } catch (error) {
        // Ignore unsupported report IDs
      }
    }
  }
}
