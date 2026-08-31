import type {
  WallpaperLibraryItem,
  WallpaperRecord,
} from '../shared/contracts';
import type { WallpaperAdapter } from './wallpaper-adapter';
import {
  WallpaperLibraryError,
  type WallpaperLibrary,
} from './wallpaper-library';

interface WallpaperServiceOptions {
  readonly library: WallpaperLibrary;
  readonly adapter: WallpaperAdapter;
}

export class WallpaperService {
  readonly #library: WallpaperLibrary;
  readonly #adapter: WallpaperAdapter;
  #operationTail: Promise<void> = Promise.resolve();
  #disposed = false;

  constructor(options: WallpaperServiceOptions) {
    this.#library = options.library;
    this.#adapter = options.adapter;
  }

  list(): Promise<WallpaperLibraryItem[]> {
    return this.#library.list();
  }

  setFavorite(recordId: string, favorite: boolean): Promise<WallpaperRecord> {
    return this.#runOperation(() =>
      this.#library.setFavorite(recordId, favorite),
    );
  }

  delete(recordId: string): Promise<boolean> {
    return this.#runOperation(() => this.#library.delete(recordId));
  }

  apply(recordId: string): Promise<WallpaperRecord> {
    return this.#runOperation(async () => {
      const asset = await this.#library.resolveAsset(recordId);
      if (!asset) {
        throw new WallpaperLibraryError('The wallpaper could not be found.');
      }
      if (asset.record.kind === 'live-bundle' && asset.bundlePath) {
        if (this.#adapter.applyLiveBundle) {
          await this.#adapter.applyLiveBundle(asset.bundlePath, asset.imagePath);
        } else {
          // Non-Cinnamon platforms and explicitly native adapters retain the
          // static fallback instead of trying to keep Electron alive for live
          // playback.
          await this.#adapter.apply(asset.imagePath);
        }
      } else {
        await this.#adapter.apply(asset.imagePath);
      }
      return this.#library.markApplied(recordId);
    });
  }

  dispose(): Promise<void> {
    this.#disposed = true;
    return this.#operationTail;
  }

  #runOperation<T>(operation: () => Promise<T>): Promise<T> {
    if (this.#disposed) {
      return Promise.reject(
        new WallpaperLibraryError('Infinite Wall is shutting down.'),
      );
    }
    const result = this.#operationTail.then(operation);
    this.#operationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }
}
