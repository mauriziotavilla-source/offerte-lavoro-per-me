/**
 * Genera icone per APK Android (mipmap) da assets/icon-master.png
 * Uso: node scripts/generate-icons.js
 */
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..');
const MASTER_SOURCE = path.join(ROOT, 'assets', 'icon-master.png');
const FALLBACK_SOURCE = path.join(ROOT, 'assets', 'icon.png');
const SOURCE = fs.existsSync(MASTER_SOURCE) ? MASTER_SOURCE : FALLBACK_SOURCE;
const ANDROID_RES = path.join(ROOT, 'mobile', 'android', 'app', 'src', 'main', 'res');

const ANDROID_SIZES = {
  'mipmap-mdpi': 48,
  'mipmap-hdpi': 72,
  'mipmap-xhdpi': 96,
  'mipmap-xxhdpi': 144,
  'mipmap-xxxhdpi': 192,
};

const FOREGROUND_SIZES = {
  'mipmap-mdpi': 108,
  'mipmap-hdpi': 162,
  'mipmap-xhdpi': 216,
  'mipmap-xxhdpi': 324,
  'mipmap-xxxhdpi': 432,
};

const ANDROID_LEGACY_ICON_SCALE = 0.84;
const ANDROID_FOREGROUND_SCALE = 0.68;

function roundedMaskSvg(size, radius) {
  return Buffer.from(
    `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <rect x="0" y="0" width="${size}" height="${size}" rx="${radius}" ry="${radius}" fill="#ffffff"/>
    </svg>`
  );
}

async function main() {
  if (!fs.existsSync(SOURCE)) {
    console.error('Manca assets/icon-master.png o assets/icon.png');
    process.exit(1);
  }

  let sharp;
  try {
    sharp = require('sharp');
  } catch {
    console.error('Installa: cd scripts && npm install sharp png-to-ico');
    process.exit(1);
  }

  const master = sharp(SOURCE);
  const meta = await master.metadata();
  const side = Math.min(meta.width || 1024, meta.height || 1024);
  const extractLeft = Math.max(0, Math.floor(((meta.width || side) - side) / 2));
  const extractTop = Math.max(0, Math.floor(((meta.height || side) - side) / 2));

  async function buildContainedIcon(size, scale = 1, radiusRatio = 0.23) {
    const innerSize = Math.max(8, Math.round(size * scale));
    const innerRadius = Math.max(4, Math.round(innerSize * radiusRatio));
    const mask = roundedMaskSvg(innerSize, innerRadius);
    const icon = await sharp(SOURCE)
      .extract({ left: extractLeft, top: extractTop, width: side, height: side })
      .resize(innerSize, innerSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .ensureAlpha()
      .composite([{ input: mask, blend: 'dest-in' }])
      .png()
      .toBuffer();

    const offset = Math.floor((size - innerSize) / 2);
    return sharp({
      create: {
        width: size,
        height: size,
        channels: 4,
        background: { r: 0, g: 0, b: 0, alpha: 0 },
      },
    })
      .composite([{ input: icon, left: offset, top: offset }])
      .png()
      .toBuffer();
  }

  for (const [folder, size] of Object.entries(ANDROID_SIZES)) {
    const dir = path.join(ANDROID_RES, folder);
    fs.mkdirSync(dir, { recursive: true });
    const buf = await buildContainedIcon(size, ANDROID_LEGACY_ICON_SCALE);
    fs.writeFileSync(path.join(dir, 'ic_launcher.png'), buf);
    fs.writeFileSync(path.join(dir, 'ic_launcher_round.png'), buf);
    console.log('Android', folder, size + 'px');
  }

  for (const [folder, size] of Object.entries(FOREGROUND_SIZES)) {
    const dir = path.join(ANDROID_RES, folder);
    fs.mkdirSync(dir, { recursive: true });
    const buf = await buildContainedIcon(size, ANDROID_FOREGROUND_SCALE);
    fs.writeFileSync(path.join(dir, 'ic_launcher_foreground.png'), buf);
  }

  const bgColor = path.join(ANDROID_RES, 'values', 'ic_launcher_background.xml');
  fs.writeFileSync(
    bgColor,
    `<?xml version="1.0" encoding="utf-8"?>
<resources>
    <color name="ic_launcher_background">#0f1419</color>
</resources>
`
  );

  console.log('Icone Android aggiornate.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
