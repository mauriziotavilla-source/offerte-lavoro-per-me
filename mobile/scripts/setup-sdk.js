/**
 * Crea android/local.properties con il percorso dell'Android SDK
 * Copyright © 2026 Maurizio Tavilla
 */
const fs = require('fs');
const path = require('path');

const candidates = [
  process.env.ANDROID_HOME,
  process.env.ANDROID_SDK_ROOT,
  path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'),
  path.join(process.env.USERPROFILE || '', 'AppData', 'Local', 'Android', 'Sdk'),
].filter(Boolean);

let sdkPath = null;
for (const c of candidates) {
  if (fs.existsSync(c)) {
    sdkPath = c;
    break;
  }
}

if (!sdkPath) {
  console.error('');
  console.error('  Android SDK non trovato.');
  console.error('  1. Installa Android Studio: https://developer.android.com/studio');
  console.error('  2. Apri Android Studio > SDK Manager > installa Android SDK');
  console.error('  3. Riesegui BUILD_APK.bat');
  console.error('');
  process.exit(1);
}

// Gradle accetta anche slash normali su Windows
const sdkForGradle = sdkPath.replace(/\\/g, '/');
const dest = path.join(__dirname, '..', 'android', 'local.properties');
const content = `## Generato automaticamente - non modificare a mano\nsdk.dir=${sdkForGradle}\n`;

fs.mkdirSync(path.dirname(dest), { recursive: true });
fs.writeFileSync(dest, content, 'utf8');

console.log('  SDK configurato:', sdkPath);
console.log('  File creato: android/local.properties');
