import { app, BrowserWindow, protocol, session, shell } from 'electron';
import path from 'node:path';

import { registerIpcHandlers } from './main/ipc';
import { CODEX_SETUP_URL } from './shared/app-info';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let disposeIpcHandlers: (() => Promise<void>) | null = null;
let shutdownStarted = false;
let shutdownReady = false;

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'infinite-wall-media',
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  },
]);

const registerContentSecurityPolicy = (): void => {
  const development = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self'${development ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data: blob: infinite-wall-media:",
    "font-src 'self' data:",
    `connect-src 'self'${development ? ' http://localhost:* ws://localhost:*' : ''}`,
    "object-src 'none'",
    "base-uri 'none'",
    "frame-ancestors 'none'",
  ].join('; ');

  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [policy],
      },
    });
  });
};

const createWindow = (): void => {
  const mainWindow = new BrowserWindow({
    width: 1180,
    height: 760,
    minWidth: 880,
    minHeight: 620,
    backgroundColor: '#0b1020',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (url === CODEX_SETUP_URL) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });
  mainWindow.webContents.on('will-navigate', (event) => event.preventDefault());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void mainWindow.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
};

app.whenReady().then(() => {
  registerContentSecurityPolicy();
  disposeIpcHandlers = registerIpcHandlers({
    jobRoot: path.join(app.getPath('userData'), 'generation-jobs'),
    libraryRoot: path.join(app.getPath('userData'), 'library'),
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('before-quit', (event) => {
  if (shutdownReady) {
    return;
  }
  event.preventDefault();
  if (shutdownStarted) {
    return;
  }
  shutdownStarted = true;
  void (disposeIpcHandlers?.() ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => {
      disposeIpcHandlers = null;
      shutdownReady = true;
      app.quit();
    });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
