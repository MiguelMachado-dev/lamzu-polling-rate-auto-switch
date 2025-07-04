# Lamzu HID Mouse Polling Rate Automator

Automatically adjusts mouse polling rate based on running applications. Switches to high-performance mode when games are detected and reverts to standard mode when games are closed.

## Features

- **Automatic Detection**: Monitors running processes and adjusts polling rate accordingly
- **Game-Specific Configuration**: Customizable game process detection
- **Configurable Rates**: Set custom polling rates for gaming and standard use
- **Background Operation**: Runs silently in the background
- **HID Direct Communication**: Direct hardware communication without requiring manufacturer software

## Requirements

- **Node.js**: LTS version (v20.x recommended)
- **Administrator Privileges**: Required for HID device access
- **Compatible Mouse**: Currently configured for Lamzu mice (configurable for other models)

## Installation

1. Clone or download the project
2. Open terminal as Administrator in the project directory
3. Install dependencies:
   ```bash
   npm install
   ```

## Configuration

### Mouse Settings

Configure your mouse parameters in `set-rate.ts`:

```typescript
const VENDOR_ID = 14142;        // Mouse manufacturer ID
const PRODUCT_ID = 30;          // Mouse model ID
const INTERFACE_NUMBER = 2;     // HID interface number
```

**Finding Your Mouse Parameters:**
- Visit https://www.lamzu.net/#/project/items
- Check Local Storage for device JSON data
- Extract `VENDOR_ID`, `PRODUCT_ID`, and `INTERFACE_NUMBER` values
  - Tip: Paste the JSON on AI and ask for the values

### Game Detection

Edit the games list in `watcher.ts`:

```typescript
const GAMES_LIST = [
  "cs2.exe",           // Counter-Strike 2
  "r5apex_dx12.exe",   // Apex Legends
  "dota2.exe",         // Dota 2
];
```

**Finding Process Names:**
1. Open Task Manager (`Ctrl+Shift+Esc`)
2. Go to **Details** tab
3. Launch your game
4. Note the process name in the **Name** column

### Polling Rates

Adjust polling rates in `watcher.ts`:

```typescript
const GAME_POLLING_RATE = 2000;     // Gaming mode (Hz)
const DEFAULT_POLLING_RATE = 1000;  // Standard mode (Hz)
```

**Supported Rates:** 500, 1000, 2000, 4000, 8000 Hz

## Usage

1. **Compile the project:**
   ```bash
   npx tsc
   ```

2. **Start the watcher:**
   ```bash
   node dist/watcher.js
   ```

3. **Manual polling rate change:**
   ```bash
   node dist/set-rate.js <rate>
   ```
   Example: `node dist/set-rate.js 8000`

## Production Deployment

For automatic startup and background operation, use PM2:

```bash
# Install PM2 globally
npm install pm2 -g

# Start the service
pm2 start dist/watcher.js --name mouse-watcher

# Enable startup on boot
pm2 startup

# Save current configuration
pm2 save
```

## Troubleshooting

| Issue | Solution |
|-------|----------|
| **Device not found** | Verify `VENDOR_ID`, `PRODUCT_ID`, and `INTERFACE_NUMBER` in `set-rate.ts` |
| **Could not send feature report** | Try different `INTERFACE_NUMBER` values (0, 1, 2, etc.) |
| **Polling rate unchanged** | Command payload or `POLLING_RATE_MAP` values may be incorrect for your mouse model |
| **Permission denied** | Run terminal as Administrator |
| **Module not found** | Ensure all dependencies are installed with `npm install` |

## Technical Notes

- Close manufacturer software before running to prevent hardware access conflicts
- The application uses direct HID communication for optimal performance
- Process checking interval is configurable via `CHECK_INTERVAL_MS` (default: 5 seconds)

## License

This project is provided as-is for educational and personal use.
