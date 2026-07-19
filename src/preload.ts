import { contextBridge, ipcRenderer } from 'electron';

import type { GenerationRequest } from './shared/contracts';
import type { InfiniteWallApi } from './shared/ipc';
import { IPC_CHANNELS } from './shared/ipc';

const api: InfiniteWallApi = Object.freeze({
  platform: process.platform,
  checkCodex: () => ipcRenderer.invoke(IPC_CHANNELS.checkCodex),
  generateWallpaper: (request: GenerationRequest) =>
    ipcRenderer.invoke(IPC_CHANNELS.generateWallpaper, request),
  cancelGeneration: () => ipcRenderer.invoke(IPC_CHANNELS.cancelGeneration),
});

contextBridge.exposeInMainWorld('infiniteWall', api);
