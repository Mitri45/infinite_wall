import { contextBridge, ipcRenderer } from 'electron';

import type {
  AppCommand,
  AppSettings,
  AppSettingsPatch,
  GenerationProgress,
  GenerationRequest,
  ScheduleStatus,
} from './shared/contracts';
import {
  appCommandSchema,
  appSettingsSchema,
  appSettingsPatchSchema,
  generationProgressSchema,
  identifierSchema,
  scheduleStatusSchema,
} from './shared/contracts';
import type { InfiniteWallApi } from './shared/ipc';
import { IPC_CHANNELS } from './shared/ipc';

const api: InfiniteWallApi = Object.freeze({
  platform: process.platform,
  checkCodex: () => ipcRenderer.invoke(IPC_CHANNELS.checkCodex),
  getPrimaryDisplay: () => ipcRenderer.invoke(IPC_CHANNELS.getPrimaryDisplay),
  generateWallpaper: (request: GenerationRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.generateWallpaper, request),
  cancelGeneration: () => ipcRenderer.invoke(IPC_CHANNELS.cancelGeneration),
  listWallpapers: () => ipcRenderer.invoke(IPC_CHANNELS.listWallpapers),
  applyWallpaper: (recordId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.applyWallpaper, identifierSchema.parse(recordId)),
  deleteWallpaper: (recordId: string) =>
    ipcRenderer.invoke(IPC_CHANNELS.deleteWallpaper, identifierSchema.parse(recordId)),
  setWallpaperFavorite: (recordId: string, favorite: boolean) =>
    ipcRenderer.invoke(
      IPC_CHANNELS.setWallpaperFavorite,
      identifierSchema.parse(recordId),
      favorite,
    ),
  getSettings: () => ipcRenderer.invoke(IPC_CHANNELS.getSettings),
  getScheduleStatus: () => ipcRenderer.invoke(IPC_CHANNELS.getScheduleStatus),
  runScheduleNow: () => ipcRenderer.invoke(IPC_CHANNELS.runScheduleNow),
  updateSettings: (patch: AppSettingsPatch) =>
    ipcRenderer.invoke(IPC_CHANNELS.updateSettings, appSettingsPatchSchema.parse(patch)),
  signalRendererReady: () => ipcRenderer.send(IPC_CHANNELS.rendererReady),
  onAppCommand: (listener: (command: AppCommand) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, command: unknown) => {
      const parsed = appCommandSchema.safeParse(command);
      if (parsed.success) {
        listener(parsed.data);
      }
    };
    ipcRenderer.on(IPC_CHANNELS.appCommand, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.appCommand, handler);
  },
  onGenerationProgress: (
    listener: (progress: GenerationProgress) => void,
  ) => {
    const handler = (_event: Electron.IpcRendererEvent, progress: unknown) => {
      const parsed = generationProgressSchema.safeParse(progress);
      if (parsed.success) {
        listener(parsed.data);
      }
    };
    ipcRenderer.on(IPC_CHANNELS.generationProgress, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.generationProgress, handler);
  },
  onLibraryChanged: (listener: () => void) => {
    const handler = () => listener();
    ipcRenderer.on(IPC_CHANNELS.libraryChanged, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.libraryChanged, handler);
  },
  onSettingsChanged: (listener: (settings: AppSettings) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, settings: unknown) => {
      const parsed = appSettingsSchema.safeParse(settings);
      if (parsed.success) listener(parsed.data);
    };
    ipcRenderer.on(IPC_CHANNELS.settingsChanged, handler);
    return () => ipcRenderer.removeListener(IPC_CHANNELS.settingsChanged, handler);
  },
  onScheduleStatusChanged: (listener: (status: ScheduleStatus) => void) => {
    const handler = (_event: Electron.IpcRendererEvent, status: unknown) => {
      const parsed = scheduleStatusSchema.safeParse(status);
      if (parsed.success) listener(parsed.data);
    };
    ipcRenderer.on(IPC_CHANNELS.scheduleStatusChanged, handler);
    return () =>
      ipcRenderer.removeListener(IPC_CHANNELS.scheduleStatusChanged, handler);
  },
});

contextBridge.exposeInMainWorld('infiniteWall', api);
