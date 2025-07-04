### **User Guide: Lamzu HID Mouse Polling Rate Automator**

This project contains a set of scripts to automate a mouse's polling rate, switching to a higher rate when a game is launched and reverting to a standard rate when it's closed.

### **What Does a New User Need to Change?**

Before running the project, a new user will need to check and possibly change three key things:

1.  **Mouse Information (File: `set-rate.ts`)**:

      * `VENDOR_ID`: The manufacturer ID of the mouse.
      * `PRODUCT_ID`: The specific model ID of the mouse.
      * `INTERFACE_NUMBER`: The communication "channel" for configuration.
      * **How to find these?**: If the user has a different mouse model, the `VENDOR_ID`, `PRODUCT_ID`, and `INTERFACE_NUMBER` will be different.
        * You can find these values in the web app: https://www.lamzu.net/#/project/items and get the json on Local Storage. Just paste it on AI and ask for the values.

2.  **Games List (File: `watcher.ts`)**:

      * The `GAMES_LIST` array contains the process names of your games. The new user must edit this list and add the executables for **their** games.
      * **How to find these?**: Open the Task Manager (Ctrl+Shift+Esc), go to the "Details" tab, find the game's process, and note the name in the "Name" column.

3.  **Polling Rates (File: `watcher.ts`)**:

      * The constants `GAME_POLLING_RATE` and `DEFAULT_POLLING_RATE` are set to 2000 and 1000, respectively. The user can adjust these values to their preference (e.g., 4000 for gaming, 500 for standard use).

-----

### **Full Installation and Setup Guide**

Here are the complete, step-by-step instructions for a new user to set up the project from scratch.

#### **1. Prerequisites**

  * **Node.js**: You must have Node.js installed. The latest LTS version is recommended (e.g., v20.x), as newer versions may have compatibility issues with native modules.
  * **Mouse Software**: The official mouse configuration software/website must be closed to prevent hardware access conflicts.

#### **2. Installation**

1.  Download and unzip the project folder.
2.  Open a terminal (PowerShell or CMD) **as an Administrator** inside the project folder.
3.  Run the following command to install all the necessary dependencies:
    ```powershell
    npm install
    ```

#### **3. Configuration**

1.  Open the `set-rate.ts` file and, if necessary, adjust the `VENDOR_ID`, `PRODUCT_ID`, and `INTERFACE_NUMBER` values for the target mouse.
2.  Open the `watcher.ts` file and customize the `GAMES_LIST` with the process names of your games. Also, adjust `GAME_POLLING_RATE` and `DEFAULT_POLLING_RATE` if desired.

#### **4. Compiling and Running**

1.  **Compile the code**: In your Administrator terminal, run the command to compile the TypeScript files into JavaScript:

    ```powershell
    npx tsc
    ```

    This will create a `dist` folder containing the `set-rate.js` and `watcher.js` files.

2.  **Start the watcher**: To begin the automation, execute the watcher script:

    ```powershell
    node dist/watcher.js
    ```

    The script will now start monitoring your running processes. You can leave this terminal open in the background.

#### **5. (Optional) Permanent Execution with PM2**

To have the script start automatically with your computer and run invisibly in the background, you can use PM2.

1.  Install PM2 globally: `npm install pm2 -g`
2.  Start the script with PM2: `pm2 start dist/watcher.js --name mouse-watcher`
3.  Set PM2 to launch on startup: `pm2 startup`
4.  Save the current process list: `pm2 save`

-----

### **Troubleshooting**

  * **"Device not found" error**: Check that the `VENDOR_ID`, `PRODUCT_ID`, and `INTERFACE_NUMBER` in `set-rate.ts` are correct for your mouse.
  * **"could not send feature report" error**: The `INTERFACE_NUMBER` is incorrect for *writing* commands. Try other values (0, 1, 2, etc.).
  * **Polling rate doesn't change (despite a success message)**: The command is being sent, but the firmware is ignoring it. This means the command `payload` (the sequence of bytes) or the values in the `POLLING_RATE_MAP` are incorrect for your specific mouse model. This would require a new investigation into the device's protocol.
