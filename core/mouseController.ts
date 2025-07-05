import { HID, devices, Device } from "node-hid";

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
}
