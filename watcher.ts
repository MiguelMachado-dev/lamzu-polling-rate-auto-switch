import { exec } from "child_process";
import psList from "ps-list";

const GAMES_LIST = [
  "cs2.exe", // Counter-Strike 2
  "r5apex_dx12.exe", // Apex Legends
  "dota2.exe",
];

const GAME_POLLING_RATE = 2000;
const DEFAULT_POLLING_RATE = 1000;
const CHECK_INTERVAL_MS = 5000;

let isGameRunning = false;

function executeCommand(rate: number) {
  const command = `node dist/set-rate.js ${rate}`;
  console.log(`[LOG] Running: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      console.error(`[ERROR] Failed to run the script: ${error.message}`);
      return;
    }
    if (stderr) {
      console.error(`[ERROR] The script returned an error: ${stderr}`);
      return;
    }
    console.log(`[LOG] Script output: ${stdout.trim()}`);
  });
}

async function checkProcesses() {
  const processes = await psList();
  const gameRunning = processes.some((process) =>
    GAMES_LIST.includes(process.name)
  );

  if (gameRunning && !isGameRunning) {
    console.log(
      `[STATUS] Game detected! Activating mode ${GAME_POLLING_RATE}Hz.`
    );
    isGameRunning = true;
    executeCommand(GAME_POLLING_RATE);
  } else if (!gameRunning && isGameRunning) {
    console.log(
      `[STATUS] No game detected. Returning to default mode ${DEFAULT_POLLING_RATE}Hz.`
    );
    isGameRunning = false;
    executeCommand(DEFAULT_POLLING_RATE);
  }
}

console.log("✅ Game watcher started. Press Ctrl+C to stop.");
console.log(`Checking processes every ${CHECK_INTERVAL_MS / 1000} seconds...`);
setInterval(checkProcesses, CHECK_INTERVAL_MS);
