import type {
  AppCommand,
  AppSettings,
  AppSettingsPatch,
  CodexDiagnostics,
  DisplayDimensions,
  GenerationProgress,
  GenerationRequest,
  OperationResult,
  WallpaperLibraryItem,
  WallpaperPreview,
  WallpaperRecord,
} from './contracts';

export const IPC_CHANNELS = {
  cancelGeneration: 'generation:cancel',
  checkCodex: 'codex:diagnostics',
  generationProgress: 'generation:progress',
  generateWallpaper: 'generation:start',
  getPrimaryDisplay: 'display:primary',
  applyWallpaper: 'wallpaper:apply',
  deleteWallpaper: 'wallpaper:delete',
  listWallpapers: 'wallpaper:list',
  setWallpaperFavorite: 'wallpaper:set-favorite',
  getSettings: 'settings:get',
  updateSettings: 'settings:update',
  appCommand: 'app:command',
} as const;

export interface InfiniteWallApi {
  readonly platform: NodeJS.Platform;
  readonly checkCodex: () => Promise<CodexDiagnostics>;
  readonly getPrimaryDisplay: () => Promise<DisplayDimensions>;
  readonly generateWallpaper: (
    request: GenerationRequest,
  ) => Promise<OperationResult<WallpaperPreview>>;
  readonly cancelGeneration: () => Promise<boolean>;
  readonly listWallpapers: () => Promise<OperationResult<WallpaperLibraryItem[]>>;
  readonly applyWallpaper: (
    recordId: string,
  ) => Promise<OperationResult<WallpaperRecord>>;
  readonly deleteWallpaper: (
    recordId: string,
  ) => Promise<OperationResult<boolean>>;
  readonly setWallpaperFavorite: (
    recordId: string,
    favorite: boolean,
  ) => Promise<OperationResult<WallpaperRecord>>;
  readonly getSettings: () => Promise<OperationResult<AppSettings>>;
  readonly updateSettings: (
    patch: AppSettingsPatch,
  ) => Promise<OperationResult<AppSettings>>;
  readonly onAppCommand: (listener: (command: AppCommand) => void) => () => void;
  readonly onGenerationProgress: (
    listener: (progress: GenerationProgress) => void,
  ) => () => void;
}
