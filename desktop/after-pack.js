const path = require('path');
const fs = require('fs');

exports.default = async function afterPack(context) {
  if (context.electronPlatformName !== 'win32') return;
  const icon =
    (await context.packager.getIconPath()) ||
    path.join(context.packager.projectDir, 'build', 'icon.ico');
  if (!icon || !fs.existsSync(icon)) {
    throw new Error('Icona mancante. Esegui: node ensure-icons.js');
  }
  const rcedit = require('rcedit');
  const exe = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.exe`);
  await rcedit(exe, { icon });
  console.log('Icona EXE interno applicata:', exe);
};
