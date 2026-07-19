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

  constructor(options: WallpaperServiceOptions) {
    this.#library = options.library;
    this.#adapter = options.adapter;
  }

  list(): Promise<WallpaperLibraryItem[]> {
    return this.#library.list();
  }

  setFavorite(recordId: string, favorite: boolean): Promise<WallpaperRecord> {
    return this.#library.setFavorite(recordId, favorite);
  }

  delete(recordId: string): Promise<boolean> {
    return this.#library.delete(recordId);
  }

  async apply(recordId: string): Promise<WallpaperRecord> {
    const imagePath = await this.#library.resolveImage(recordId);
    if (!imagePath) {
      throw new WallpaperLibraryError('The wallpaper could not be found.');
    }
    await this.#adapter.apply(imagePath);
    return this.#library.markApplied(recordId);
  }
}
