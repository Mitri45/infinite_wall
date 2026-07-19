import { contextBridge, ipcRenderer } from 'electron';

import type {
  GenerationProgress,
  GenerationRequest,
} from './shared/contracts';
import { generationProgressSchema, identifierSchema } from './shared/contracts';
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
});

contextBridge.exposeInMainWorld('infiniteWall', api);
