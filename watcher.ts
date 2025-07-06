import { exec } from "child_process";
import psList from "ps-list";
import { simpleLogger } from "./core/utils/simpleLogger.js";

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
  simpleLogger.debug(`[LOG] Running: ${command}`);

  exec(command, (error, stdout, stderr) => {
    if (error) {
      simpleLogger.error(`[ERROR] Failed to run the script: ${error.message}`);
      return;
    }
    if (stderr) {
      simpleLogger.error(`[ERROR] The script returned an error: ${stderr}`);
      return;
    }
    simpleLogger.debug(`[LOG] Script output: ${stdout.trim()}`);
  });
}

async function checkProcesses() {
  const processes = await psList();
  const gameRunning = processes.some((process) =>
    GAMES_LIST.includes(process.name)
  );

  if (gameRunning && !isGameRunning) {
    simpleLogger.game(
      `[STATUS] Game detected! Activating mode ${GAME_POLLING_RATE}Hz.`
    );
    isGameRunning = true;
    executeCommand(GAME_POLLING_RATE);
  } else if (!gameRunning && isGameRunning) {
    simpleLogger.game(
      `[STATUS] No game detected. Returning to default mode ${DEFAULT_POLLING_RATE}Hz.`
    );
    isGameRunning = false;
    executeCommand(DEFAULT_POLLING_RATE);
  }
}

simpleLogger.info("✅ Game watcher started. Press Ctrl+C to stop.");
simpleLogger.info(`Checking processes every ${CHECK_INTERVAL_MS / 1000} seconds...`);
setInterval(checkProcesses, CHECK_INTERVAL_MS);
