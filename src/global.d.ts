import type { InfiniteWallApi } from './preload';

declare global {
  interface Window {
    infiniteWall: InfiniteWallApi;
  }
}

export {};
