import { ipcMain, nativeImage, protocol, screen } from 'electron';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

import {
  generationRequestSchema,
  identifierSchema,
  appSettingsPatchSchema,
  THEME_IDS,
  type AppSettings,
  type AppSettingsPatch,
  type GenerationProgress,
  type OperationResult,
  type WallpaperLibraryItem,
  type WallpaperPreview,
  type WallpaperRecord,
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
import {
  createWallpaperAdapter,
  WallpaperAdapterError,
} from './wallpaper-adapter';
import { WallpaperService } from './wallpaper-service';
import { SettingsStore } from './settings-store';
import { ScheduleController } from './schedule-controller';

interface RegisterIpcHandlersOptions {
  readonly jobRoot: string;
  readonly libraryRoot: string;
  readonly settingsRoot: string;
  readonly setLaunchAtLogin: (enabled: boolean) => Promise<void>;
  readonly notify: (title: string, body: string) => void;
  readonly onSettingsChanged?: (settings: AppSettings) => void;
  readonly onLibraryChanged?: () => void;
  readonly onRendererReady?: () => void;
}

export interface InfiniteWallRuntime {
  readonly dispose: () => Promise<void>;
  readonly getSettings: () => Promise<AppSettings>;
  readonly updateSettings: (patch: AppSettingsPatch) => Promise<AppSettings>;
  readonly applyRandomExisting: () => Promise<boolean>;
}

export function registerIpcHandlers(
  options: RegisterIpcHandlersOptions,
): InfiniteWallRuntime {
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
  const wallpaperService = new WallpaperService({
    library,
    adapter: createWallpaperAdapter(),
  });
  const settingsStore = new SettingsStore(options.settingsRoot);

  const runScheduledGeneration = async () => {
    if (generationSessions.busy) {
      throw new Error('Generation is already active.');
    }
    const readiness = await diagnostics.check();
    if (!readiness.authenticated) {
      throw new Error('Codex is not ready.');
    }
    const settings = await settingsStore.load();
    const themeId = THEME_IDS[Math.floor(Math.random() * THEME_IDS.length)];
    const controller = generationSessions.start();
    try {
      const preview = await generationService.generate(
        {
          mode: 'infinite',
          themeId,
          display: physicalDisplayDimensions(screen.getPrimaryDisplay()),
          quality: settings.quality,
          recentConcepts: [],
        },
        controller.signal,
      );
      await wallpaperService.apply(preview.record.id);
      options.onLibraryChanged?.();
    } finally {
      generationSessions.finish(controller);
    }
  };
  const scheduler = new ScheduleController({
    run: runScheduledGeneration,
    onFailure: (message) => options.notify('Infinite Wall schedule', message),
  });
  const settingsReady = settingsStore.load().then(async (settings) => {
    scheduler.configure(settings);
    options.onSettingsChanged?.(settings);
    await options.setLaunchAtLogin(settings.launchAtLogin).catch(() => {
      options.notify(
        'Infinite Wall settings',
        'Launch at login could not be configured on this computer.',
      );
    });
    return settings;
  });
  let settingsMutationTail: Promise<void> = Promise.resolve();
  const updateSettings = (patch: AppSettingsPatch): Promise<AppSettings> => {
    const operation = settingsMutationTail.then(async () => {
      await settingsReady;
      const previous = await settingsStore.load();
      const settings = await settingsStore.update(patch);
      if (settings.launchAtLogin !== previous.launchAtLogin) {
        try {
          await options.setLaunchAtLogin(settings.launchAtLogin);
        } catch (error) {
          await settingsStore.update({ launchAtLogin: previous.launchAtLogin });
          throw error;
        }
      }
      scheduler.configure(settings);
      options.onSettingsChanged?.(settings);
      return settings;
    });
    settingsMutationTail = operation.then(() => undefined, () => undefined);
    return operation;
  };
  const getSettings = async (): Promise<AppSettings> => {
    await settingsReady;
    await settingsMutationTail;
    return settingsStore.load();
  };
  const applyRandomExisting = async () => {
    const items = (await wallpaperService.list()).filter(
      (item) => !item.record.applied,
    );
    if (items.length === 0) {
      return false;
    }
    const selected = items[Math.floor(Math.random() * items.length)];
    await wallpaperService.apply(selected.record.id);
    options.onLibraryChanged?.();
    return true;
  };

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
  ipcMain.on(IPC_CHANNELS.rendererReady, () => options.onRendererReady?.());
  ipcMain.handle(IPC_CHANNELS.getSettings, async (): Promise<OperationResult<AppSettings>> => {
    try {
      return { ok: true, value: await getSettings() };
    } catch {
      return settingsOperationFailure('Settings could not be loaded.');
    }
  });
  ipcMain.handle(
    IPC_CHANNELS.updateSettings,
    async (_event, rawPatch): Promise<OperationResult<AppSettings>> => {
      const patch = appSettingsPatchSchema.safeParse(rawPatch);
      if (!patch.success) {
        return invalidLibraryRequest();
      }
      try {
        return { ok: true, value: await updateSettings(patch.data) };
      } catch {
        return settingsOperationFailure('Settings could not be saved.');
      }
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.listWallpapers,
    async (): Promise<OperationResult<WallpaperLibraryItem[]>> => {
      try {
        return { ok: true, value: await wallpaperService.list() };
      } catch {
        return libraryOperationFailure(
          'The local wallpaper library could not be loaded.',
        );
      }
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.applyWallpaper,
    async (_event, rawRecordId): Promise<OperationResult<WallpaperRecord>> => {
      const recordId = identifierSchema.safeParse(rawRecordId);
      if (!recordId.success) {
        return invalidLibraryRequest();
      }
      try {
        return { ok: true, value: await wallpaperService.apply(recordId.data) };
      } catch (error) {
        if (error instanceof WallpaperAdapterError) {
          return {
            ok: false,
            error: {
              code: 'wallpaper-apply',
              message: error.message,
              retryable: true,
            },
          };
        }
        if (error instanceof WallpaperLibraryError) {
          return libraryOperationFailure(error.message);
        }
        return {
          ok: false,
          error: {
            code: 'wallpaper-apply',
            message: 'The wallpaper could not be applied.',
            retryable: true,
          },
        };
      }
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.deleteWallpaper,
    async (_event, rawRecordId): Promise<OperationResult<boolean>> => {
      const recordId = identifierSchema.safeParse(rawRecordId);
      if (!recordId.success) {
        return invalidLibraryRequest();
      }
      try {
        return { ok: true, value: await wallpaperService.delete(recordId.data) };
      } catch (error) {
        return libraryOperationFailure(
          error instanceof WallpaperLibraryError
            ? error.message
            : 'The wallpaper could not be removed.',
        );
      }
    },
  );
  ipcMain.handle(
    IPC_CHANNELS.setWallpaperFavorite,
    async (
      _event,
      rawRecordId,
      rawFavorite,
    ): Promise<OperationResult<WallpaperRecord>> => {
      const recordId = identifierSchema.safeParse(rawRecordId);
      if (!recordId.success || typeof rawFavorite !== 'boolean') {
        return invalidLibraryRequest();
      }
      try {
        return {
          ok: true,
          value: await wallpaperService.setFavorite(recordId.data, rawFavorite),
        };
      } catch (error) {
        return libraryOperationFailure(
          error instanceof WallpaperLibraryError
            ? error.message
            : 'The wallpaper could not be updated.',
        );
      }
    },
  );

  return {
    getSettings,
    updateSettings,
    applyRandomExisting,
    dispose: async () => {
      scheduler.dispose();
      generationSessions.dispose();
      await Promise.all([
        generationSessions.waitForIdle(),
        wallpaperService.dispose(),
        settingsReady.then(() => settingsMutationTail).catch(() => undefined),
      ]);
    },
  };
}

function invalidLibraryRequest<T>(): OperationResult<T> {
  return {
    ok: false,
    error: {
      code: 'invalid-request',
      message: 'The wallpaper request is invalid.',
      retryable: false,
    },
  };
}

function libraryOperationFailure<T>(message: string): OperationResult<T> {
  return {
    ok: false,
    error: {
      code: 'library-operation',
      message,
      retryable: true,
    },
  };
}

function settingsOperationFailure<T>(message: string): OperationResult<T> {
  return {
    ok: false,
    error: { code: 'settings-operation', message, retryable: true },
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
