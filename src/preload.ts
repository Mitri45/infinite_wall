import { contextBridge } from 'electron';

export interface InfiniteWallApi {
  readonly platform: NodeJS.Platform;
}

const api: InfiniteWallApi = Object.freeze({
  platform: process.platform,
});

contextBridge.exposeInMainWorld('infiniteWall', api);
