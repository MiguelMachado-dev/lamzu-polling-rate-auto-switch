# Lamzu HID Mouse Polling Rate Automator

Automatically adjusts mouse polling rate based on running applications with a modern Electron-based GUI. Switches to high-performance mode when games are detected and reverts to standard mode when games are closed.

## Features

### 🖱️ Core Functionality
- **Automatic Detection**: Monitors running processes and adjusts polling rate accordingly
- **Game-Specific Configuration**: Customizable game process detection
- **Configurable Rates**: Set custom polling rates for gaming and standard use
- **HID Direct Communication**: Direct hardware communication without requiring manufacturer software

### 🖥️ Desktop Application
- **System Tray Integration**: Runs minimized in system tray with quick access controls
- **Modern GUI**: User-friendly Electron-based interface for easy configuration
- **Real-time Status**: Live display of current mode (Gaming/Normal/Manual) and polling rate
- **Instant Controls**: Quick polling rate adjustment via tray menu or GUI

### ⚙️ Advanced Features
- **Manual Override**: Temporarily set specific polling rates (500Hz to 8000Hz)
- **Auto/Manual Toggle**: Switch between automatic game detection and manual control
- **Desktop Notifications**: Optional system notifications for mode changes
- **Settings Persistence**: All configurations automatically saved and restored
- **Import/Export**: Backup and restore your settings configuration
- **Start Minimized**: Option to launch directly to system tray

## Requirements

- **Windows Operating System**: Windows 10/11 recommended
- **Administrator Privileges**: Required for HID device access
- **Compatible Mouse**: Currently configured for Lamzu mice (configurable for other models)
- **Node.js**: Only required for development/building from source

## Quick Start (End Users)

### Option 1: Pre-built Application (Recommended)
1. **Download** the latest release from the GitHub releases page
2. **Extract** the zip file to your desired location
3. **Right-click** on `Lamzu Mouse Automator.exe` and select "Run as administrator"
4. **Configure** your mouse and games using the GUI interface
5. The application will start in your system tray and run automatically

### Option 2: Build from Source
1. **Install Node.js** LTS version (v20.x recommended)
2. **Clone or download** the project
3. **Open PowerShell as Administrator** in the project directory
4. **Install dependencies:**
   ```bash
   npm install
   ```
5. **Build and start:**
   ```bash
   npm run start-electron
   ```

## Using the Application

### System Tray Interface
- **Double-click** the tray icon to open the main settings window
- **Right-click** the tray icon for quick controls:
  - View current status (Gaming/Normal/Manual mode)
  - Set manual polling rates (500Hz to 8000Hz)
  - Toggle between Auto and Manual modes
  - Access settings window
  - Quit application

### Settings Window
The GUI provides easy configuration for:
- **Mouse Hardware Settings**: Vendor ID, Product ID, Interface Number
- **Game Detection**: Add/remove games from the monitoring list
- **Polling Rates**: Set rates for gaming and normal modes
- **Notifications**: Enable/disable desktop notifications
- **Startup Options**: Configure to start minimized
- **Import/Export**: Backup and restore settings

## Configuration

### First-Time Setup

1. **Launch the application** as Administrator
2. **Open Settings** by double-clicking the tray icon or right-click → Settings
3. **Configure your mouse** in the Hardware Settings section
4. **Add your games** to the detection list
5. **Set preferred polling rates** for gaming and normal use
6. **Save settings** - they will be automatically loaded on next startup

### Mouse Hardware Settings

If you're using a non-Lamzu mouse or experiencing issues, configure these values in the Settings window:

- **Vendor ID**: Your mouse manufacturer ID
- **Product ID**: Your specific mouse model ID
- **Interface Number**: HID interface number (usually 0, 1, or 2)

**Finding Your Mouse Parameters:**
- Visit https://www.lamzu.net/#/project/items
- Check Local Storage for device JSON data
- Extract the required values from the JSON
  - You can send JSON to AI and ask for the Vendor ID, Product ID, and Interface Number

### Game Detection

**Adding Games via GUI:**
1. Open Settings window
2. Go to "Game Detection" section
3. Enter the process name (e.g., "cs2.exe")
4. Click "Add Game"

**Finding Process Names:**
1. Open Task Manager (`Ctrl+Shift+Esc`)
2. Go to **Details** tab
3. Launch your game
4. Note the process name in the **Name** column
5. Add the exact name to the application

### Polling Rate Configuration

Set your preferred rates in the Settings window:
- **Gaming Mode Rate**: High-performance rate when games are detected (default: 2000Hz)
- **Normal Mode Rate**: Standard rate for general use (default: 1000Hz)

**Supported Rates:** 500, 1000, 2000, 4000, 8000 Hz

## Advanced Usage

### Manual Control
- **Tray Menu**: Right-click tray icon → Manual Control → Select rate
- **Settings Window**: Use the manual control section
- **Auto Mode Toggle**: Switch between automatic detection and manual control

### CLI Mode (Advanced Users)
For command-line usage without GUI:

```bash
# Build the project
npm run build

# Start CLI watcher (no GUI)
npm run start-cli

# Set manual polling rate
node dist/set-rate.js 8000
```

## Development & Building

### Development Mode
```bash
# Run in development mode with hot reload
npm run dev
```

### Building Distribution
```bash
# Build TypeScript and create executable
npm run build-electron
```

### NPM Scripts Available
- `npm run build` - Compile TypeScript
- `npm run start-cli` - Start CLI version (no GUI)
- `npm run start-electron` - Start GUI application
- `npm run dev` - Development mode
- `npm run build-electron` - Build distribution package

## Auto-Startup Setup

### Windows Startup (Recommended)
1. **Open Settings** in the application
2. **Enable "Start with Windows"** option (if available)
3. **Or manually**: Copy shortcut to `shell:startup` folder

### Alternative: Task Scheduler
1. Open **Task Scheduler**
2. Create **Basic Task**
3. Set trigger to **When the computer starts**
4. Set action to start the application executable
5. **Check "Run with highest privileges"**

## Troubleshooting

### Common Issues

| Issue | Solution |
|-------|----------|
| **Application won't start** | Ensure you're running as Administrator |
| **Device not found** | Check mouse hardware settings (Vendor ID, Product ID, Interface Number) |
| **Could not send feature report** | Try different Interface Number values (0, 1, 2, etc.) in Settings |
| **Polling rate unchanged** | Verify your mouse model is compatible or adjust hardware settings |
| **Permission denied** | Always run as Administrator - required for HID access |
| **Tray icon missing** | Check Windows notification settings and hidden icons |
| **Games not detected** | Verify exact process names in Task Manager Details tab |
| **Settings not saving** | Ensure application has write access to user data directory |

### Settings File Location
- **Windows**: `%APPDATA%/lamzu-automator/settings.json`
- **Access via GUI**: Settings → Advanced → "Open Settings File Location"

### Reset to Defaults
- **GUI Method**: Settings → Advanced → "Reset to Defaults"
- **Manual Method**: Delete the settings file and restart the application

### Debug Mode
- Launch with `--dev` flag to see console output for troubleshooting
- Check the developer console in the Settings window (Ctrl+Shift+I)

## Features Overview

### System Tray Controls
- **Status Display**: Current mode and polling rate
- **Quick Rate Setting**: 500Hz to 8000Hz instant adjustment
- **Auto/Manual Toggle**: Switch detection modes
- **Settings Access**: Open configuration window

### Settings Window Sections
- **Hardware Configuration**: Mouse device parameters
- **Game Detection**: Add/remove monitored games
- **Polling Rates**: Gaming and normal mode rates
- **Notifications**: Desktop notification preferences
- **Startup Options**: Minimized start and auto-launch
- **Advanced**: Import/export, reset, file locations

## Technical Notes

- **HID Communication**: Direct hardware access for optimal performance and minimal latency
- **Process Monitoring**: Efficient game detection with configurable check intervals
- **Settings Persistence**: JSON-based configuration with automatic backup
- **Cross-compatibility**: Works with most gaming mice (configuration may be required)
- **Resource Usage**: Minimal system impact with intelligent polling intervals
- **Manufacturer Software**: Close official mouse software to prevent conflicts

## License

This project is provided as-is for educational and personal use.