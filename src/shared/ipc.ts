import type {
  CodexDiagnostics,
  GenerationRequest,
  GenerationResult,
  OperationResult,
} from './contracts';

export const IPC_CHANNELS = {
  cancelGeneration: 'generation:cancel',
  checkCodex: 'codex:diagnostics',
  generateWallpaper: 'generation:start',
} as const;

export interface InfiniteWallApi {
  readonly platform: NodeJS.Platform;
  readonly checkCodex: () => Promise<CodexDiagnostics>;
  readonly generateWallpaper: (
    request: GenerationRequest,
  ) => Promise<OperationResult<GenerationResult>>;
  readonly cancelGeneration: () => Promise<boolean>;
}
