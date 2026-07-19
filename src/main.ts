import { app, BrowserWindow, session, shell } from 'electron';
import path from 'node:path';

import { registerIpcHandlers } from './main/ipc';
import { CODEX_SETUP_URL } from './shared/app-info';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

const registerContentSecurityPolicy = (): void => {
  const development = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  const policy = [
    "default-src 'self'",
    "script-src 'self'",
    `style-src 'self'${development ? " 'unsafe-inline'" : ''}`,
    "img-src 'self' data: blob:",
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
  registerIpcHandlers({
    jobRoot: path.join(app.getPath('userData'), 'generation-jobs'),
  });
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
