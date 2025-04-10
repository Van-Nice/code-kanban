const fs = require('fs');
const os = require('os');
const path = require('path');

// Path to VS Code global state
const statePath = path.join(os.homedir(), 'Library/Application Support/Code/User/globalStorage/');

console.log(`Searching for extension data in: ${statePath}`);

// List all directories in the globalStorage folder
if (fs.existsSync(statePath)) {
  const dirs = fs.readdirSync(statePath);
  
  // Find directories that might contain 'boogie'
  const possibleDirs = dirs.filter(dir => dir.includes('boogie') || dir.includes('kanban'));
  
  if (possibleDirs.length > 0) {
    console.log('Found possible extension data directories:');
    possibleDirs.forEach(dir => {
      const fullPath = path.join(statePath, dir);
      console.log(`- ${dir} (${fullPath})`);
      fs.rmdirSync(fullPath, { recursive: true });
      console.log(`  ✅ Deleted`);
    });
  } else {
    // List all directories if no match found
    console.log('No matching directories found. Here are all available directories:');
    dirs.forEach(dir => console.log(`- ${dir}`));
  }
} else {
  console.log('globalStorage directory not found');
}
