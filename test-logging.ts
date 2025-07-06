#!/usr/bin/env node

// Test script to verify logging system functionality
import { logger, logInfo, logDebug, logError, logHID, logBattery, logGame, logPolling } from "./core/utils/logger.js";

async function testLoggingSystem() {
    console.log("🧪 Testing LAMZU Automator Logging System...\n");
    
    // Test environment detection
    console.log(`Environment: ${process.env.NODE_ENV || 'undefined'}`);
    console.log(`Development Mode: ${logger.isDev()}`);
    console.log(`Console Enabled: ${logger.isConsoleEnabled()}\n`);
    
    // Test different log levels
    logInfo("This is an INFO message - should appear in both dev and production");
    logDebug("This is a DEBUG message - should only appear in development");
    logError("This is an ERROR message", new Error("Test error"));
    
    // Test component-specific loggers
    logHID("Testing HID communication logging");
    logBattery("Testing battery monitoring logging");
    logGame("Testing game detection logging");
    logPolling("Testing polling rate change logging");
    
    // Test conditional logging
    logger.setConsoleEnabled(false);
    logInfo("This message should only go to file (console disabled)");
    
    logger.setConsoleEnabled(true);
    logInfo("This message should appear in both console and file (console re-enabled)");
    
    console.log("\n✅ Logging system test completed!");
    console.log("📁 Check log files in:", process.env.USERPROFILE ? 
        `${process.env.USERPROFILE}\\AppData\\Roaming\\lamzu-automator\\logs\\` : 
        './logs/');
}

// Run test
testLoggingSystem().catch(console.error);
