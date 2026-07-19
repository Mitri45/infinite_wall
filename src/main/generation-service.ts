import type {
  GenerationProgress,
  GenerationRequest,
  WallpaperPreview,
} from '../shared/contracts';
import {
  GenerationJobRunner,
  type GenerationProgressReporter,
} from './generation-job-runner';
import { WallpaperLibrary } from './wallpaper-library';

interface GenerationServiceOptions {
  readonly runner: GenerationJobRunner;
  readonly library: WallpaperLibrary;
}

export class GenerationService {
  readonly #runner: GenerationJobRunner;
  readonly #library: WallpaperLibrary;

  constructor(options: GenerationServiceOptions) {
    this.#runner = options.runner;
    this.#library = options.library;
  }

  async generate(
    request: GenerationRequest,
    signal?: AbortSignal,
    onProgress?: GenerationProgressReporter,
  ): Promise<WallpaperPreview> {
    let generationImagePath: string | null = null;
    try {
      const generation = await this.#runner.run(
        {
          ...request,
          recentConcepts: await this.#library.getRecentConcepts(),
        },
        signal,
        onProgress,
      );
      generationImagePath = generation.imagePath;
      report(onProgress, {
        phase: 'importing',
        message: 'Saving the wallpaper to your private library…',
        percent: 94,
      });
      const preview = await this.#library.importGeneration(generation);
      report(onProgress, {
        phase: 'complete',
        message: 'Wallpaper ready to preview.',
        percent: 100,
      });
      return preview;
    } finally {
      if (generationImagePath) {
        await this.#runner
          .removeCompletedJob(generationImagePath)
          .catch(() => undefined);
      }
    }
  }
}

function report(
  reporter: GenerationProgressReporter | undefined,
  progress: GenerationProgress,
): void {
  try {
    reporter?.(progress);
  } catch {
    // UI progress is observational and cannot affect persistence.
  }
}
