/**
 * Copia i file web in mobile/www per l'APK Android
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const DEST = path.join(__dirname, 'www');

const COPY = ['index.html', 'css', 'js', 'data', 'assets'];

function copyRecursive(src, dest) {
  const stat = fs.statSync(src);
  if (stat.isDirectory()) {
    fs.mkdirSync(dest, { recursive: true });
    for (const name of fs.readdirSync(src)) {
      copyRecursive(path.join(src, name), path.join(dest, name));
    }
  } else {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    fs.copyFileSync(src, dest);
  }
}

function rmDir(dir) {
  if (!fs.existsSync(dir)) return;
  for (const name of fs.readdirSync(dir)) {
    const p = path.join(dir, name);
    if (fs.statSync(p).isDirectory()) rmDir(p);
    else fs.unlinkSync(p);
  }
  fs.rmdirSync(dir);
}

rmDir(DEST);
fs.mkdirSync(DEST, { recursive: true });

for (const item of COPY) {
  const src = path.join(ROOT, item);
  if (!fs.existsSync(src)) continue;
  copyRecursive(src, path.join(DEST, item));
  console.log('Copiato:', item);
}

console.log('www pronta per Android');
