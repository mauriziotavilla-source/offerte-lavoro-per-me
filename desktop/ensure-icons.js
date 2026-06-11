const fs = require('fs');
const path = require('path');
const os = require('os');
const { execSync } = require('child_process');

const BUILD = path.join(__dirname, 'build');
const ICON_PNG = path.join(BUILD, 'icon.png');
const ICON_ICO = path.join(BUILD, 'icon.ico');
const MASTER_SOURCE = path.join(__dirname, '..', 'assets', 'icon-master.png');
const FALLBACK_SOURCE = path.join(__dirname, '..', 'assets', 'icon.png');
const SOURCE = fs.existsSync(MASTER_SOURCE) ? MASTER_SOURCE : FALLBACK_SOURCE;
const GENERATE = path.join(__dirname, '..', 'scripts', 'generate-icons.js');
const SAFE_DIR = path.join(os.homedir(), 'AppData', 'Local', 'LavoroConcorsiBuild');

function fail(msg) {
  console.error('ERRORE icone:', msg);
  process.exit(1);
}

if (!fs.existsSync(SOURCE)) fail('Manca assets/icon-master.png o assets/icon.png');

console.log('Generazione icone da:', SOURCE);
execSync(`node "${GENERATE}"`, { stdio: 'inherit', cwd: path.join(__dirname, '..', 'scripts') });

if (!fs.existsSync(ICON_PNG)) fail('Non creato build/icon.png');
if (!fs.existsSync(ICON_ICO) || fs.statSync(ICON_ICO).size < 1024) fail('Non creato build/icon.ico');

fs.mkdirSync(SAFE_DIR, { recursive: true });
fs.copyFileSync(ICON_ICO, path.join(SAFE_DIR, 'icon.ico'));
fs.copyFileSync(ICON_PNG, path.join(SAFE_DIR, 'icon.png'));
fs.copyFileSync(ICON_ICO, path.join(BUILD, 'installerIcon.ico'));
fs.writeFileSync(path.join(__dirname, 'icon-build-path.txt'), path.join(SAFE_DIR, 'icon.ico'), 'utf8');

console.log('Icone OK:', ICON_ICO);
