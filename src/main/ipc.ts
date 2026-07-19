import { ipcMain, nativeImage } from 'electron';

import {
  generationRequestSchema,
  type GenerationResult,
  type OperationResult,
} from '../shared/contracts';
import { IPC_CHANNELS } from '../shared/ipc';
import { CodexDiagnosticsService } from './codex-diagnostics';
import {
  GenerationJobError,
  GenerationJobRunner,
} from './generation-job-runner';

interface RegisterIpcHandlersOptions {
  readonly jobRoot: string;
}

export function registerIpcHandlers(options: RegisterIpcHandlersOptions): void {
  const diagnostics = new CodexDiagnosticsService();
  const runner = new GenerationJobRunner({
    jobRoot: options.jobRoot,
    inspectImage: async (imagePath) => {
      const image = nativeImage.createFromPath(imagePath);
      if (image.isEmpty()) {
        throw new Error('Image could not be decoded.');
      }
      return image.getSize();
    },
  });
  let activeGeneration: AbortController | null = null;

  ipcMain.handle(IPC_CHANNELS.checkCodex, () => diagnostics.check());
  ipcMain.handle(
    IPC_CHANNELS.generateWallpaper,
    async (_event, rawRequest): Promise<OperationResult<GenerationResult>> => {
      if (activeGeneration) {
        return {
          ok: false,
          error: {
            code: 'busy',
            message: 'Another wallpaper is already being generated.',
            retryable: true,
          },
        };
      }

      const parsedRequest = generationRequestSchema.safeParse(rawRequest);
      if (!parsedRequest.success) {
        return {
          ok: false,
          error: {
            code: 'invalid-request',
            message: 'The wallpaper request is incomplete or invalid.',
            retryable: false,
          },
        };
      }

      const controller = new AbortController();
      activeGeneration = controller;
      try {
        return {
          ok: true,
          value: await runner.run(parsedRequest.data, controller.signal),
        };
      } catch (error) {
        if (error instanceof GenerationJobError) {
          return { ok: false, error: error.toPublicError() };
        }
        return {
          ok: false,
          error: {
            code: 'process-failed',
            message: 'Wallpaper generation failed unexpectedly.',
            retryable: true,
          },
        };
      } finally {
        if (activeGeneration === controller) {
          activeGeneration = null;
        }
      }
    },
  );
  ipcMain.handle(IPC_CHANNELS.cancelGeneration, () => {
    if (!activeGeneration) {
      return false;
    }

    activeGeneration.abort();
    return true;
  });
}
