import { ipcMain, nativeImage, protocol, screen } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  generationRequestSchema,
  type GenerationProgress,
  type OperationResult,
  type WallpaperPreview,
} from '../shared/contracts';
import { IPC_CHANNELS } from '../shared/ipc';
import { CodexDiagnosticsService } from './codex-diagnostics';
import { resolveCodexCommand } from './codex-command';
import { physicalDisplayDimensions } from './display-dimensions';
import {
  GenerationJobError,
  GenerationJobRunner,
} from './generation-job-runner';
import { GenerationService } from './generation-service';
import { GenerationSessionController } from './generation-session';
import {
  WallpaperLibrary,
  WallpaperLibraryError,
} from './wallpaper-library';

interface RegisterIpcHandlersOptions {
  readonly jobRoot: string;
  readonly libraryRoot: string;
}

export function registerIpcHandlers(
  options: RegisterIpcHandlersOptions,
): () => Promise<void> {
  const commandResolver = () => resolveCodexCommand();
  const diagnostics = new CodexDiagnosticsService({ commandResolver });
  const inspectImage = async (imagePath: string) => {
    const image = nativeImage.createFromPath(imagePath);
    if (image.isEmpty()) {
      throw new Error('Image could not be decoded.');
    }
    return image.getSize();
  };
  const runner = new GenerationJobRunner({
    jobRoot: options.jobRoot,
    inspectImage,
    commandResolver,
  });
  const library = new WallpaperLibrary({
    root: options.libraryRoot,
    inspectImage,
  });
  const generationService = new GenerationService({ runner, library });
  const generationSessions = new GenerationSessionController();

  registerMediaProtocol(library);

  ipcMain.handle(IPC_CHANNELS.checkCodex, () => diagnostics.check());
  ipcMain.handle(IPC_CHANNELS.getPrimaryDisplay, () => {
    return physicalDisplayDimensions(screen.getPrimaryDisplay());
  });
  ipcMain.handle(
    IPC_CHANNELS.generateWallpaper,
    async (event, rawRequest): Promise<OperationResult<WallpaperPreview>> => {
      if (generationSessions.busy) {
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

      const controller = generationSessions.start();
      const sendProgress = (progress: GenerationProgress) => {
        if (progress.phase === 'importing') {
          generationSessions.lockCancellation(controller);
        }
        if (!event.sender.isDestroyed()) {
          event.sender.send(IPC_CHANNELS.generationProgress, progress);
        }
      };
      try {
        const preview = await generationService.generate(
          parsedRequest.data,
          controller.signal,
          sendProgress,
        );
        return {
          ok: true,
          value: preview,
        };
      } catch (error) {
        if (error instanceof GenerationJobError) {
          return { ok: false, error: error.toPublicError() };
        }
        if (error instanceof WallpaperLibraryError) {
          return {
            ok: false,
            error: {
              code: 'library-import',
              message: error.message,
              retryable: true,
            },
          };
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
        generationSessions.finish(controller);
      }
    },
  );
  ipcMain.handle(IPC_CHANNELS.cancelGeneration, () => {
    return generationSessions.cancel();
  });

  return async () => {
    generationSessions.dispose();
    await generationSessions.waitForIdle();
  };
}

function registerMediaProtocol(library: WallpaperLibrary): void {
  void protocol.handle('infinite-wall-media', async (request) => {
    const url = new URL(request.url);
    if (url.hostname !== 'wallpaper') {
      return new Response('Not found', { status: 404 });
    }
    const recordId = url.pathname.slice(1);
    if (!recordId || recordId.includes('/')) {
      return new Response('Not found', { status: 404 });
    }
    const imagePath = await library.resolveImage(recordId);
    if (!imagePath) {
      return new Response('Not found', { status: 404 });
    }

    const body = await readFile(imagePath).catch(() => null);
    if (!body) {
      return new Response('Not found', { status: 404 });
    }
    return new Response(body, {
      headers: {
        'Cache-Control': 'private, no-store',
        'Content-Type': mimeTypeFor(imagePath),
        'X-Content-Type-Options': 'nosniff',
      },
    });
  });
}

function mimeTypeFor(imagePath: string): string {
  switch (path.extname(imagePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.webp':
      return 'image/webp';
    default:
      return 'image/png';
  }
}
