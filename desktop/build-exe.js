const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const iconPathFile = path.join(__dirname, 'icon-build-path.txt');
if (!fs.existsSync(iconPathFile)) {
  console.error('Esegui prima: npm run prebuild');
  process.exit(1);
}

const safeIcon = fs.readFileSync(iconPathFile, 'utf8').trim().replace(/\\/g, '/');
const config = [
  `--config.win.icon=${safeIcon}`,
  `--config.icon=${safeIcon}`,
  `--config.directories.buildResources=${path.dirname(safeIcon).replace(/\\/g, '/')}`,
].join(' ');

console.log('Build con icona:', safeIcon);
execSync(`electron-builder --win portable ${config}`, {
  stdio: 'inherit',
  cwd: __dirname,
  env: { ...process.env, CSC_IDENTITY_AUTO_DISCOVERY: 'false' },
});
