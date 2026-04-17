// electron/main.js
const { app, BrowserWindow, shell, dialog } = require('electron');
const { spawn } = require('child_process');
const path = require('path');
const http = require('http');
const os = require('os');
const fs = require('fs');

require('./ipc.js');

const userDataPath = path.join(os.homedir(), 'AppData', 'Local', 'RXTerm');
/** Writable dir for backend SQLite + session recordings (avoid Program Files / read-only install dirs). */
const rxtermDataDir = path.join(userDataPath, 'data');
try {
  fs.mkdirSync(userDataPath, { recursive: true });
  fs.mkdirSync(rxtermDataDir, { recursive: true });
  app.setPath('userData', userDataPath);
  app.setPath('cache', path.join(userDataPath, 'Cache'));
  app.commandLine.appendSwitch('disk-cache-dir', path.join(userDataPath, 'Cache'));
} catch {
  // fallback to Electron defaults
}

app.on('browser-window-created', (_, window) => {
  window.webContents.session.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(true);
  });
});

let mainWindow, backend;
/** Serves built renderer over http://127.0.0.1 so WebSocket/fetch to the API work (file:// is treated as a non-standard origin and often cannot reach loopback). */
let rendererStaticServer;

function contentTypeForPath(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json',
    '.png': 'image/png',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff2': 'font/woff2',
    '.webp': 'image/webp',
    '.map': 'application/json',
  };
  return map[ext] || 'application/octet-stream';
}

function startRendererStaticServer(distDir) {
  const root = path.resolve(distDir);
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      if (req.method !== 'GET' && req.method !== 'HEAD') {
        res.writeHead(405);
        res.end();
        return;
      }
      let pathname;
      try {
        pathname = new URL(req.url || '/', 'http://127.0.0.1').pathname;
      } catch {
        res.writeHead(400);
        res.end();
        return;
      }
      if (pathname === '/' || pathname === '') pathname = '/index.html';
      const rel = pathname.replace(/^\/+/, '');
      const filePath = path.normalize(path.resolve(root, rel));
      const relativeToRoot = path.relative(root, filePath);
      if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
        res.writeHead(403);
        res.end();
        return;
      }
      fs.stat(filePath, (err, st) => {
        if (err || !st.isFile()) {
          res.writeHead(404);
          res.end();
          return;
        }
        res.setHeader('Content-Type', contentTypeForPath(filePath));
        res.writeHead(200);
        if (req.method === 'HEAD') {
          res.end();
          return;
        }
        fs.createReadStream(filePath).pipe(res);
      });
    });
    server.listen(0, '127.0.0.1', () => {
      rendererStaticServer = server;
      const addr = server.address();
      const port = addr && typeof addr === 'object' ? addr.port : 0;
      if (!port) {
        reject(new Error('Renderer static server: no port'));
        return;
      }
      resolve(port);
    });
    server.on('error', reject);
  });
}

function getRendererDistDir() {
  const candidates = [
    path.join(__dirname, '../renderer/dist'),
    path.join(app.getAppPath(), 'renderer', 'dist'),
  ];
  for (const dir of candidates) {
    try {
      if (fs.existsSync(path.join(dir, 'index.html'))) return dir;
    } catch {
      /* noop */
    }
  }
  return candidates[0];
}

function spawnBackend() {
  const useVite = process.env.NODE_ENV === 'development';
  const childEnv = { ...process.env, RXTERM_DATA_DIR: rxtermDataDir };
  const spawnOpts = { env: childEnv };
  if (useVite) {
    spawnOpts.cwd = path.join(__dirname, '..');
    return spawn('python', [path.join(__dirname, '../backend/main.py')], spawnOpts);
  }

  const exeName = process.platform === 'win32' ? 'backend.exe' : 'backend';
  const resourceRoot = process.resourcesPath || path.join(__dirname, '..');
  const exePath = path.join(resourceRoot, 'backend', exeName);
  spawnOpts.cwd = path.dirname(exePath);
  if (process.platform === 'win32' && app.isPackaged) spawnOpts.windowsHide = true;
  return spawn(exePath, [], spawnOpts);
}

/** True only for our FastAPI app (avoids treating any HTTP 200 on :8765 as RXTerm). */
function checkRxtermBackendUp(port) {
  return new Promise((resolve) => {
    const req = http.get(`http://127.0.0.1:${port}/health`, (res) => {
      let raw = '';
      res.on('data', (c) => {
        raw += c;
      });
      res.on('end', () => {
        if (res.statusCode !== 200) {
          resolve(false);
          return;
        }
        try {
          const j = JSON.parse(raw);
          if (!j || j.status !== 'ok') {
            resolve(false);
            return;
          }
          // Current backend identifies itself; older builds only returned { status: 'ok' }.
          const legacy = !Object.prototype.hasOwnProperty.call(j, 'service');
          resolve(legacy || j.service === 'rxterm-backend');
        } catch {
          resolve(false);
        }
      });
    });
    req.on('error', () => resolve(false));
  });
}

function waitForPort(port, timeoutMs) {
  return new Promise((resolve, reject) => {
    const start = Date.now();
    const check = () => {
      checkRxtermBackendUp(port).then((ok) => {
        if (ok) resolve();
        else retry();
      });
    };
    const retry = () => {
      if (Date.now() - start > timeoutMs) reject(new Error('Backend timeout'));
      else setTimeout(check, 500);
    };
    check();
  });
}

function isPortHealthy(port) {
  return checkRxtermBackendUp(port);
}

app.whenReady().then(async () => {
  const useViteDevServer = process.env.NODE_ENV === 'development';
  const backendWaitMs = app.isPackaged ? 60000 : 15000;

  const backendAlreadyUp = await isPortHealthy(8765);
  if (!backendAlreadyUp) {
    backend = spawnBackend();
    backend.stderr.on('data', (d) => console.error('[backend]', d.toString()));
    backend.stdout?.on('data', (d) => console.log('[backend]', d.toString()));
    backend.on('error', (err) => console.error('[backend] spawn error', err));
    backend.on('exit', (code, signal) => {
      if (code != null && code !== 0) console.error('[backend] exited with code', code);
      if (signal) console.error('[backend] killed by signal', signal);
    });
  } else {
    backend = null;
    console.log('[backend] Reusing existing backend on 8765');
  }

  try {
    await waitForPort(8765, backendWaitMs);
  } catch {
    console.error('Backend failed to start');
    dialog.showErrorBox(
      'RXTerm — backend not reachable',
      [
        'The app could not confirm the API at http://127.0.0.1:8765/health.',
        '',
        'The terminal, metrics, and AI features need this local service.',
        '',
        'Try: close other RXTerm windows, free port 8765, and allow backend.exe in Windows Security.',
        'Then restart RXTerm.',
      ].join('\n'),
    );
  }

  const iconPath = path.join(__dirname, '../assets/icon.png');
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 900,
    minHeight: 600,
    frame: false, // Custom title bar
    backgroundColor: '#0A0E14',
    show: false, // Don't show until ready-to-show
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      // Packaged / dist loads are not served from Vite; relax security so loopback WS/fetch always work.
      webSecurity: useViteDevServer,
    },
  });

  // Show window only when content is ready (eliminates white flash)
  mainWindow.once('ready-to-show', () => mainWindow.show());

  const devUrl = process.env.RXTERM_DEV_URL || 'http://127.0.0.1:5173';
  if (useViteDevServer) {
    try {
      await mainWindow.loadURL(devUrl);
    } catch (err) {
      console.error('[renderer] loadURL failed', err);
      dialog.showErrorBox('RXTerm', `Could not open the dev UI.\n${err.message || err}`);
    }
  } else {
    const distDir = getRendererDistDir();
    const indexHtml = path.join(distDir, 'index.html');
    if (!fs.existsSync(indexHtml)) {
      dialog.showErrorBox(
        'RXTerm — missing UI files',
        `Could not find the built renderer:\n${indexHtml}\n\nReinstall RXTerm or rebuild the project.`,
      );
    } else {
      try {
        const port = await startRendererStaticServer(distDir);
        await mainWindow.loadURL(`http://127.0.0.1:${port}/`);
      } catch (err) {
        console.error('[renderer] static server failed, falling back to loadFile', err);
        try {
          await mainWindow.loadFile(indexHtml);
        } catch (e2) {
          dialog.showErrorBox('RXTerm', `Failed to load the UI.\n${e2.message || e2}`);
        }
      }
    }
  }
});

app.on('before-quit', () => {
  if (rendererStaticServer) {
    try {
      rendererStaticServer.close();
    } catch {
      /* noop */
    }
    rendererStaticServer = null;
  }
  if (backend) backend.kill('SIGTERM');
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
