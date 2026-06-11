/**
 * Lavoro & Concorsi per Me - Desktop (Electron)
 * Copyright © 2026 Maurizio Tavilla
 */

const { app, BrowserWindow, shell, dialog } = require('electron');
const path = require('path');
const http = require('http');
const fs = require('fs');

let mainWindow = null;
let staticServer = null;
let serverPort = null;

function getAppRoot() {
  if (app.isPackaged) {
    return path.join(process.resourcesPath, 'app');
  }
  return path.join(__dirname, 'app');
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.ico': 'image/x-icon',
    '.svg': 'image/svg+xml',
  };
  return types[ext] || 'application/octet-stream';
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatError(err) {
  if (!err) return 'Errore sconosciuto';
  return err.message || String(err);
}

function buildDesktopErrorHtml(title, message, detail = '') {
  return `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <title>${escapeHtml(title)}</title>
  <style>
    body { margin: 0; font-family: Segoe UI, Arial, sans-serif; background: #0f1419; color: #eef2ff;
      display: grid; place-items: center; min-height: 100vh; padding: 24px; box-sizing: border-box; }
    .panel { max-width: 760px; background: #1f2937; border: 1px solid #334155; border-radius: 16px;
      padding: 24px; box-shadow: 0 18px 45px rgba(0, 0, 0, 0.35); }
    h1 { margin-top: 0; font-size: 28px; }
    p, li { line-height: 1.6; }
    code { background: #111827; padding: 2px 6px; border-radius: 6px; }
    .detail { margin-top: 16px; padding: 12px; background: #111827; border-radius: 10px;
      color: #cbd5e1; white-space: pre-wrap; }
  </style>
</head>
<body>
  <section class="panel">
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <ul>
      <li>Controlla se antivirus o firewall bloccano l'app.</li>
      <li>Prova a copiare l'EXE in una cartella locale semplice, ad esempio <code>Desktop</code>.</li>
    </ul>
    ${detail ? `<div class="detail">${escapeHtml(detail)}</div>` : ''}
  </section>
</body>
</html>`;
}

function startStaticServer(root) {
  return new Promise((resolve, reject) => {
    staticServer = http.createServer((req, res) => {
      let urlPath = decodeURIComponent(req.url.split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const safePath = path.normalize(path.join(root, urlPath)).replace(/^(\.\.[/\\])+/, '');
      if (!safePath.startsWith(path.normalize(root))) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(safePath, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': getMimeType(safePath) });
        res.end(data);
      });
    });
    staticServer.on('error', reject);
    staticServer.listen(0, '127.0.0.1', () => {
      const address = staticServer.address();
      if (!address || typeof address === 'string' || !address.port) {
        reject(new Error('Impossibile ottenere la porta del server locale interno.'));
        return;
      }
      serverPort = address.port;
      resolve(serverPort);
    });
  });
}

function createWindow() {
  if (!serverPort) throw new Error('Server locale interno non avviato.');
  const iconMasterPath = path.join(getAppRoot(), 'assets', 'icon-master.png');
  const iconPath = fs.existsSync(iconMasterPath) ? iconMasterPath : path.join(getAppRoot(), 'assets', 'icon.png');
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 900,
    minHeight: 600,
    title: 'Lavoro & Concorsi per Me - Maurizio Tavilla',
    autoHideMenuBar: true,
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: { nodeIntegration: false, contextIsolation: true },
  });
  mainWindow.webContents.on('did-fail-load', (_event, errorCode, errorDescription, validatedURL) => {
    if (!mainWindow || mainWindow.isDestroyed() || String(validatedURL || '').startsWith('data:')) return;
    const html = buildDesktopErrorHtml(
      'Avvio non riuscito',
      'L\'app desktop non riesce a caricare l\'interfaccia locale interna.',
      `Dettagli: ${errorDescription || 'errore sconosciuto'} (codice ${errorCode})`
    );
    mainWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  });
  mainWindow.loadURL(`http://127.0.0.1:${serverPort}/index.html`);
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
  mainWindow.on('closed', () => { mainWindow = null; });
}

app.whenReady().then(async () => {
  const root = getAppRoot();
  if (!fs.existsSync(path.join(root, 'index.html'))) {
    const detail = `File app mancanti in:\n${root}`;
    dialog.showErrorBox('File app mancanti', detail);
    app.quit();
    return;
  }
  try {
    await startStaticServer(root);
    createWindow();
  } catch (err) {
    dialog.showErrorBox('Avvio EXE non riuscito', formatError(err));
    app.quit();
  }
});

app.on('window-all-closed', () => {
  if (staticServer) staticServer.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
