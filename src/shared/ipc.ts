import type {
  CodexDiagnostics,
  DisplayDimensions,
  GenerationProgress,
  GenerationRequest,
  OperationResult,
  WallpaperPreview,
} from './contracts';

export const IPC_CHANNELS = {
  cancelGeneration: 'generation:cancel',
  checkCodex: 'codex:diagnostics',
  generationProgress: 'generation:progress',
  generateWallpaper: 'generation:start',
  getPrimaryDisplay: 'display:primary',
} as const;

export interface InfiniteWallApi {
  readonly platform: NodeJS.Platform;
  readonly checkCodex: () => Promise<CodexDiagnostics>;
  readonly getPrimaryDisplay: () => Promise<DisplayDimensions>;
  readonly generateWallpaper: (
    request: GenerationRequest,
  ) => Promise<OperationResult<WallpaperPreview>>;
  readonly cancelGeneration: () => Promise<boolean>;
  readonly onGenerationProgress: (
    listener: (progress: GenerationProgress) => void,
  ) => () => void;
}
