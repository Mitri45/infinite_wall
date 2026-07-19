import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Notification,
  protocol,
  session,
  shell,
  Tray,
} from 'electron';
import path from 'node:path';

import {
  registerIpcHandlers,
  type InfiniteWallRuntime,
} from './main/ipc';
import { CODEX_SETUP_URL } from './shared/app-info';
import { IPC_CHANNELS } from './shared/ipc';
import { THEME_IDS, type AppSettings } from './shared/contracts';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let runtime: InfiniteWallRuntime | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
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

const createWindow = (): BrowserWindow => {
  const window = new BrowserWindow({
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

  window.once('ready-to-show', () => window.show());
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on('closed', () => {
    if (mainWindow === window) mainWindow = null;
  });
  window.webContents.setWindowOpenHandler(({ url }) => {
    if (url === CODEX_SETUP_URL) {
      void shell.openExternal(url);
    }

    return { action: 'deny' };
  });
  window.webContents.on('will-navigate', (event) => event.preventDefault());

  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    void window.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    void window.loadFile(
      path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`),
    );
  }
  return window;
};

const showMainWindow = (): BrowserWindow => {
  mainWindow ??= createWindow();
  mainWindow.show();
  mainWindow.focus();
  return mainWindow;
};

const sendAppCommand = (command: unknown): void => {
  const window = showMainWindow();
  window.webContents.send(IPC_CHANNELS.appCommand, command);
};

const rebuildTrayMenu = (settings?: AppSettings): void => {
  if (!tray || !runtime) return;
  const scheduleEnabled = settings?.scheduleHours !== null;
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'Generate', click: () => sendAppCommand({ type: 'generate' }) },
    {
      label: 'Surprise Me',
      click: () => sendAppCommand({
        type: 'surprise',
        themeId: THEME_IDS[Math.floor(Math.random() * THEME_IDS.length)],
      }),
    },
    {
      label: 'Apply Random Existing',
      click: () => void runtime?.applyRandomExisting().then((applied) => {
        if (!applied) notify('Infinite Wall', 'No unapplied wallpaper is available yet.');
      }).catch(() => notify('Infinite Wall', 'The wallpaper could not be applied.')),
    },
    { type: 'separator' },
    { label: 'Open Infinite Wall', click: () => showMainWindow() },
    {
      label: settings?.schedulePaused ? 'Resume Schedule' : 'Pause Schedule',
      enabled: scheduleEnabled,
      click: () => void runtime?.getSettings().then((current) =>
        runtime?.updateSettings({ schedulePaused: !current.schedulePaused }),
      ).catch(() => notify('Infinite Wall', 'The schedule could not be updated.')),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
};

const notify = (title: string, body: string): void => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
};

app.whenReady().then(() => {
  registerContentSecurityPolicy();
  runtime = registerIpcHandlers({
    jobRoot: path.join(app.getPath('userData'), 'generation-jobs'),
    libraryRoot: path.join(app.getPath('userData'), 'library'),
    settingsRoot: path.join(app.getPath('userData'), 'preferences'),
    setLaunchAtLogin: (enabled) => app.setLoginItemSettings({ openAtLogin: enabled }),
    notify,
    onSettingsChanged: rebuildTrayMenu,
  });
  mainWindow = createWindow();
  const iconSvg = '<svg xmlns="http://www.w3.org/2000/svg" width="32" height="32"><rect width="32" height="32" rx="8" fill="#171b18"/><text x="16" y="23" text-anchor="middle" fill="#f0e4d4" font-size="25">∞</text></svg>';
  tray = new Tray(nativeImage.createFromDataURL(`data:image/svg+xml;base64,${Buffer.from(iconSvg).toString('base64')}`));
  tray.setToolTip('Infinite Wall');
  tray.on('click', () => showMainWindow());
  void runtime.getSettings().then(rebuildTrayMenu).catch(() =>
    notify('Infinite Wall', 'Settings could not be loaded.'),
  );

  app.on('activate', () => {
    showMainWindow();
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
  quitting = true;
  void (runtime?.dispose() ?? Promise.resolve())
    .catch(() => undefined)
    .then(() => {
      runtime = null;
      tray?.destroy();
      tray = null;
      shutdownReady = true;
      app.quit();
    });
});

app.on('window-all-closed', () => {
  // The tray keeps Infinite Wall available for schedules and quick actions.
});
