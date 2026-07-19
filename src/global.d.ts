import type { InfiniteWallApi } from './shared/ipc';

declare global {
  interface Window {
    infiniteWall: InfiniteWallApi;
  }
}

export {};
