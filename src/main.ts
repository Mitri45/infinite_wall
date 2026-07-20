import {
  app,
  BrowserWindow,
  Menu,
  nativeImage,
  Notification,
  protocol,
  screen,
  session,
  shell,
  Tray,
} from 'electron';
import path from 'node:path';

import {
  registerIpcHandlers,
  type InfiniteWallRuntime,
} from './main/ipc';
import { buildContentSecurityPolicy } from './main/content-security-policy';
import { LaunchAtLoginController } from './main/launch-at-login';
import { RendererEventQueue } from './main/renderer-event-queue';
import { CODEX_SETUP_URL } from './shared/app-info';
import { IPC_CHANNELS } from './shared/ipc';
import {
  THEME_IDS,
  type AppCommand,
  type AppSettings,
  type ScheduleStatus,
} from './shared/contracts';

declare const MAIN_WINDOW_VITE_DEV_SERVER_URL: string | undefined;
declare const MAIN_WINDOW_VITE_NAME: string;

let runtime: InfiniteWallRuntime | null = null;
let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let quitting = false;
let shutdownStarted = false;
let shutdownReady = false;
const appCommandQueue = new RendererEventQueue<AppCommand>();
const libraryRefreshQueue = new RendererEventQueue<true>();
const settingsChangedQueue = new RendererEventQueue<AppSettings>();
const scheduleStatusChangedQueue = new RendererEventQueue<ScheduleStatus>();
const appAssetPath = (filename: string): string => path.join(
  app.isPackaged ? process.resourcesPath : app.getAppPath(),
  'assets',
  filename,
);

protocol.registerSchemesAsPrivileged([
  {
    scheme: 'infinite-wall-media',
    privileges: { secure: true, standard: true, supportFetchAPI: true },
  },
]);

const registerContentSecurityPolicy = (): void => {
  const development = Boolean(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  const policy = buildContentSecurityPolicy(development);

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
  const applicationIcon = nativeImage.createFromPath(appAssetPath('window-icon.png'));
  const workArea = screen.getPrimaryDisplay().workArea;
  const window = new BrowserWindow({
    x: workArea.x,
    y: workArea.y,
    width: workArea.width,
    height: workArea.height,
    minWidth: 880,
    minHeight: 620,
    backgroundColor: '#0b1020',
    icon: applicationIcon,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });
  window.setIcon(applicationIcon);
  window.maximize();

  window.once('ready-to-show', () => {
    window.show();
  });
  window.on('close', (event) => {
    if (!quitting) {
      event.preventDefault();
      window.hide();
    }
  });
  window.on('closed', () => {
    if (mainWindow === window) {
      mainWindow = null;
      appCommandQueue.markLoading();
      libraryRefreshQueue.markLoading();
      settingsChangedQueue.markLoading();
      scheduleStatusChangedQueue.markLoading();
    }
  });
  window.webContents.on('did-start-loading', () => {
    appCommandQueue.markLoading();
    libraryRefreshQueue.markLoading();
    settingsChangedQueue.markLoading();
    scheduleStatusChangedQueue.markLoading();
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

const sendToRenderer = <T,>(channel: string, value: T): void => {
  if (!mainWindow || mainWindow.webContents.isDestroyed()) {
    return;
  }
  mainWindow.webContents.send(channel, value);
};

const sendAppCommand = (command: AppCommand): void => {
  showMainWindow();
  appCommandQueue.sendOrQueue(command, (pending) => {
    sendToRenderer(IPC_CHANNELS.appCommand, pending);
  });
};

const notifyLibraryChanged = (): void => {
  libraryRefreshQueue.sendOrQueue(true, () => {
    sendToRenderer(IPC_CHANNELS.libraryChanged, true);
  });
};

const notifySettingsChanged = (settings: AppSettings): void => {
  rebuildTrayMenu(settings);
  settingsChangedQueue.sendOrQueue(settings, (pending) => {
    sendToRenderer(IPC_CHANNELS.settingsChanged, pending);
  });
};

const notifyScheduleStatusChanged = (status: ScheduleStatus): void => {
  scheduleStatusChangedQueue.sendOrQueue(status, (pending) => {
    sendToRenderer(IPC_CHANNELS.scheduleStatusChanged, pending);
  });
};

const markRendererReady = (): void => {
  appCommandQueue.markReady((pending) => {
    sendToRenderer(IPC_CHANNELS.appCommand, pending);
  });
  libraryRefreshQueue.markReady(() => {
    sendToRenderer(IPC_CHANNELS.libraryChanged, true);
  });
  settingsChangedQueue.markReady((pending) => {
    sendToRenderer(IPC_CHANNELS.settingsChanged, pending);
  });
  scheduleStatusChangedQueue.markReady((pending) => {
    sendToRenderer(IPC_CHANNELS.scheduleStatusChanged, pending);
  });
};

const rebuildTrayMenu = (settings?: AppSettings): void => {
  if (!tray || !runtime) return;
  const scheduleEnabled = settings?.scheduleHours !== null;
  tray.setContextMenu(Menu.buildFromTemplate([
    {
      label: 'Generate Current Direction',
      click: () => sendAppCommand({ type: 'generate' }),
    },
    {
      label: 'Surprise Me — Random Theme',
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
    {
      label: 'Run Schedule Now',
      enabled: scheduleEnabled,
      click: () => void runtime?.runScheduledGeneration()
        .then(() => notify('Infinite Wall schedule', 'A new wallpaper was generated and applied.'))
        .catch(() => notify('Infinite Wall schedule', 'The scheduled wallpaper could not be generated.')),
    },
    { type: 'separator' },
    { label: 'Quit', click: () => { quitting = true; app.quit(); } },
  ]));
};

const notify = (title: string, body: string): void => {
  if (Notification.isSupported()) new Notification({ title, body }).show();
};

const initializeApplication = async (): Promise<void> => {
  await app.whenReady();
  registerContentSecurityPolicy();
  const launchAtLogin = new LaunchAtLoginController({
    platform: process.platform,
    configRoot: app.getPath('appData'),
    executablePath: process.execPath,
    developmentAppPath: app.isPackaged ? undefined : app.getAppPath(),
    setNativeLoginItem: (enabled) => {
      app.setLoginItemSettings({ openAtLogin: enabled });
    },
  });
  runtime = registerIpcHandlers({
    jobRoot: path.join(app.getPath('userData'), 'generation-jobs'),
    libraryRoot: path.join(app.getPath('userData'), 'library'),
    settingsRoot: path.join(app.getPath('userData'), 'preferences'),
    setLaunchAtLogin: (enabled) => launchAtLogin.setEnabled(enabled),
    notify,
    onSettingsChanged: notifySettingsChanged,
    onScheduleStatusChanged: notifyScheduleStatusChanged,
    onLibraryChanged: notifyLibraryChanged,
    onRendererReady: markRendererReady,
  });
  mainWindow = createWindow();
  const trayImage = nativeImage
    .createFromPath(appAssetPath('tray-icon.png'))
    .resize({ width: 22, height: 22 });
  trayImage.setTemplateImage(process.platform === 'darwin');
  tray = new Tray(trayImage);
  tray.setToolTip('Infinite Wall');
  tray.on('click', () => showMainWindow());
  void runtime.getSettings().then(rebuildTrayMenu).catch(() =>
    notify('Infinite Wall', 'Settings could not be loaded.'),
  );

  app.on('activate', () => {
    showMainWindow();
  });
};

const hasSingleInstanceLock = app.requestSingleInstanceLock();
if (!hasSingleInstanceLock) {
  quitting = true;
  shutdownReady = true;
  app.quit();
} else {
  const applicationReady = initializeApplication();
  app.on('second-instance', () => {
    void applicationReady.then(() => showMainWindow());
  });
}

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
