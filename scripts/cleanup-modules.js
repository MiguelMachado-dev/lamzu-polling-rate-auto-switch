const fs = require('fs');
const path = require('path');

exports.default = async function(context) {
  console.log('🧹 Cleaning up unnecessary files for smaller build...');
  
  // Get the actual app directory from context
  const appDir = context.outDir || context.appDir || process.cwd();
  const nodeModulesPath = path.join(appDir, 'node_modules');
  
  console.log(`  App directory: ${appDir}`);
  console.log(`  Node modules: ${nodeModulesPath}`);
  
  if (!fs.existsSync(nodeModulesPath)) {
    console.log('⚠️  node_modules not found, skipping cleanup');
    return;
  }
  
  // Cleanup node-hid: remove unnecessary prebuilds
  const nodeHidPath = path.join(nodeModulesPath, 'node-hid');
  if (fs.existsSync(nodeHidPath)) {
    const prebuildsPath = path.join(nodeHidPath, 'prebuilds');
    if (fs.existsSync(prebuildsPath)) {
      const dirs = fs.readdirSync(prebuildsPath);
      for (const dir of dirs) {
        if (!dir.startsWith('HID-win32-x64')) {
          const dirPath = path.join(prebuildsPath, dir);
          console.log(`  Removing ${dir}...`);
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      }
    }
    
    // Remove hidapi source code and docs
    const hidapiPath = path.join(nodeHidPath, 'hidapi');
    if (fs.existsSync(hidapiPath)) {
      const keepDirs = ['windows']; // Only keep Windows-specific files
      const dirs = fs.readdirSync(hidapiPath);
      for (const dir of dirs) {
        if (!keepDirs.includes(dir) && fs.statSync(path.join(hidapiPath, dir)).isDirectory()) {
          const dirPath = path.join(hidapiPath, dir);
          console.log(`  Removing hidapi/${dir}...`);
          fs.rmSync(dirPath, { recursive: true, force: true });
        }
      }
      
      // Remove documentation files
      const docFiles = ['README.md', 'BUILD.*.md', 'HACKING.txt', 'LICENSE-*'];
      const files = fs.readdirSync(hidapiPath);
      for (const file of files) {
        if (docFiles.some(pattern => file.match(pattern.replace('*', '.*')))) {
          const filePath = path.join(hidapiPath, file);
          console.log(`  Removing hidapi/${file}...`);
          fs.rmSync(filePath, { force: true });
        }
      }
    }
  }
  
  console.log('✅ Cleanup completed!');
};
