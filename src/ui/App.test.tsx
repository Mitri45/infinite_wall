// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  AppSettingsPatch,
  CodexDiagnostics,
  ScheduleStatus,
  WallpaperLibraryItem,
  WallpaperPreview,
} from '../shared/contracts';
import type { InfiniteWallApi } from '../shared/ipc';
import { App } from './App';

const readyDiagnostics: CodexDiagnostics = {
  installed: true,
  authenticated: true,
  version: '0.144.6',
  authMethod: 'chatgpt',
  issue: null,
  message: 'Codex is installed and ready.',
};
const DEFAULT_TEST_SETTINGS = {
  quality: 'standard' as const,
  scheduleHours: null,
  schedulePaused: false,
  launchAtLogin: false,
  libraryLimit: 100,
  applyToAllDisplays: true as const,
};

beforeEach(() => installBridge(readyDiagnostics));

afterEach(cleanup);

const preview: WallpaperPreview = {
  record: {
    id: 'test-wallpaper',
    filename: 'wallpaper.png',
    prompt: 'A quiet geometric landscape composed for a wide desktop wallpaper.',
    title: 'Quiet Geometry',
    themeId: 'minimal',
    sceneSummary: 'A restrained geometric landscape with ample negative space.',
    width: 1920,
    height: 1080,
    createdAt: '2026-07-19T00:00:00.000Z',
    applied: false,
    favorite: false,
  },
  previewUrl: 'infinite-wall-media://wallpaper/test-wallpaper',
  durationMs: 1_200,
};

function installBridge(
  diagnostics: CodexDiagnostics,
  overrides: Partial<InfiniteWallApi> = {},
) {
  Object.defineProperty(window, 'infiniteWall', {
    configurable: true,
    value: {
      platform: 'linux',
      checkCodex: async () => diagnostics,
      getPrimaryDisplay: async () => ({ width: 1920, height: 1080 }),
      generateWallpaper: async () => ({
        ok: false,
        error: {
          code: 'process-failed',
          message: 'Not used in this test.',
          retryable: false,
        },
      }),
      cancelGeneration: async () => false,
      listWallpapers: async () => ({ ok: true, value: [] }),
      applyWallpaper: async () => ({
        ok: false,
        error: {
          code: 'wallpaper-apply',
          message: 'Not used in this test.',
          retryable: false,
        },
      }),
      deleteWallpaper: async () => ({ ok: true, value: false }),
      setWallpaperFavorite: async () => ({
        ok: false,
        error: {
          code: 'library-operation',
          message: 'Not used in this test.',
          retryable: false,
        },
      }),
      getSettings: async () => ({
        ok: true,
        value: DEFAULT_TEST_SETTINGS,
      }),
      getScheduleStatus: async () => ({
        ok: true,
        value: {
          state: 'manual', intervalHours: null, nextRunAt: null,
        },
      }),
      runScheduleNow: async () => ({ ok: true, value: true }),
      updateSettings: async (patch: AppSettingsPatch) => ({
        ok: true,
        value: {
          ...DEFAULT_TEST_SETTINGS,
          ...patch,
        },
      }),
      signalRendererReady: () => undefined,
      onAppCommand: () => () => undefined,
      onLibraryChanged: () => () => undefined,
      onSettingsChanged: () => () => undefined,
      onScheduleStatusChanged: () => () => undefined,
      onGenerationProgress: () => () => undefined,
      ...overrides,
    },
  });
}

async function chooseSetting(
  user: ReturnType<typeof userEvent.setup>,
  label: RegExp,
  option: RegExp,
) {
  await user.click(screen.getByRole('button', { name: label }));
  await user.click(screen.getByRole('option', { name: option }));
}

describe('theme selection experience', () => {
  it('signals readiness after installing renderer event listeners', async () => {
    const signalRendererReady = vi.fn();
    installBridge(readyDiagnostics, { signalRendererReady });

    render(<App />);

    await waitFor(() => expect(signalRendererReady).toHaveBeenCalledOnce());
  });

  it('persists schedule and launch-at-login settings', async () => {
    const updateSettings = vi.fn(async (patch) => ({
      ok: true as const,
      value: {
        quality: 'standard' as const, scheduleHours: 3 as const,
        schedulePaused: false, launchAtLogin: Boolean(patch.launchAtLogin),
        libraryLimit: 100, applyToAllDisplays: true as const,
      },
    }));
    installBridge(readyDiagnostics, { updateSettings });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    await chooseSetting(user, /Wallpaper schedule.*Manual only/, /Every 3 hours/);
    await user.click(screen.getByLabelText('Launch Infinite Wall at login'));
    expect(updateSettings).toHaveBeenCalledWith({ scheduleHours: 3, schedulePaused: false });
    expect(updateSettings).toHaveBeenCalledWith({ launchAtLogin: true });
  });

  it('synchronizes settings changed from the tray', async () => {
    const settingsListener: {
      current: Parameters<InfiniteWallApi['onSettingsChanged']>[0] | null;
    } = { current: null };
    installBridge(readyDiagnostics, {
      onSettingsChanged: (listener) => {
        settingsListener.current = listener;
        return () => undefined;
      },
    });
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Settings' }));

    act(() => settingsListener.current?.({
      quality: 'high', scheduleHours: 3, schedulePaused: true,
      launchAtLogin: true, libraryLimit: 100, applyToAllDisplays: true,
    }));

    expect(screen.getByRole('button', { name: /Generation quality.*High/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: /Wallpaper schedule.*Every 3 hours/ })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Resume automatic changes' })).toBeTruthy();
  });

  it('opens settings in a dialog and runs the real schedule path on demand', async () => {
    const runScheduleNow = vi.fn(async () => ({ ok: true as const, value: true }));
    installBridge(readyDiagnostics, {
      getSettings: async () => ({
        ok: true,
        value: {
          quality: 'standard', scheduleHours: 1, schedulePaused: false,
          launchAtLogin: false, libraryLimit: 100, applyToAllDisplays: true,
        },
      }),
      runScheduleNow,
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    const runNow = await screen.findByRole('button', { name: /Generate & apply now/ });
    await user.click(runNow);

    expect(runScheduleNow).toHaveBeenCalledOnce();
    expect(await screen.findByText('New wallpaper generated and applied.')).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog', { name: 'Settings' })).toBeNull();
    await waitFor(() => {
      expect(document.activeElement).toBe(
        screen.getByRole('button', { name: 'Settings' }),
      );
    });
  });

  it('shows the real next deadline and explains pause and run-now behavior', async () => {
    const nextRunAt = new Date(Date.now() + 3 * 60 * 60 * 1000).toISOString();
    const statusListener: {
      current: ((status: ScheduleStatus) => void) | null;
    } = { current: null };
    installBridge(readyDiagnostics, {
      getSettings: async () => ({
        ok: true,
        value: {
          quality: 'standard', scheduleHours: 3, schedulePaused: false,
          launchAtLogin: false, libraryLimit: 100, applyToAllDisplays: true,
        },
      }),
      getScheduleStatus: async () => ({
        ok: true,
        value: { state: 'active', intervalHours: 3, nextRunAt },
      }),
      onScheduleStatusChanged: (listener) => {
        statusListener.current = listener;
        return () => undefined;
      },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: 'Settings' }));
    expect(await screen.findByText('Automatic changes active')).toBeTruthy();
    expect(screen.getByText(/Next wallpaper in 3 hr/)).toBeTruthy();
    expect(screen.getByText(/does not move your next automatic change/)).toBeTruthy();

    act(() => statusListener.current?.({
      state: 'paused', intervalHours: 3, nextRunAt: null,
    }));
    expect(screen.getByText('Automatic changes paused')).toBeTruthy();
    expect(screen.getByText(/Resume to start a new 3-hour countdown/)).toBeTruthy();
  });

  it('supports keyboard selection and restores focus to the settings control', async () => {
    const updateSettings = vi.fn(async (patch) => ({
      ok: true as const,
      value: {
        ...DEFAULT_TEST_SETTINGS,
        ...patch,
      },
    }));
    installBridge(readyDiagnostics, { updateSettings });
    const user = userEvent.setup();
    render(<App />);

    const settingsControl = screen.getByRole('button', { name: 'Settings' });
    await user.click(settingsControl);
    const quality = screen.getByRole('button', {
      name: /Generation quality.*Standard/,
    });
    quality.focus();
    await user.keyboard('{ArrowDown}{Enter}');
    expect(updateSettings).toHaveBeenCalledWith(
      { quality: 'high' },
    );
    await waitFor(() => expect(document.activeElement).toBe(quality));

    await user.keyboard('{Enter}{Escape}');
    expect(screen.getByRole('dialog', { name: 'Settings' })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(quality));

    await user.keyboard('{Escape}');
    await waitFor(() => expect(document.activeElement).toBe(settingsControl));
  });

  it('switches themes and curated scenes', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Where should we go?' }),
    ).toBeTruthy();

    const minimalCardArtwork = document.querySelector(
      '.theme-card[data-theme="minimal"] .theme-card-artwork',
    );
    const detailArtwork = document.querySelector('.direction-artwork');
    expect(minimalCardArtwork?.getAttribute('src')).toBe(
      detailArtwork?.getAttribute('src'),
    );

    await user.click(
      screen.getByRole('button', { name: 'Nature — Wild Distance' }),
    );
    expect(screen.getByRole('heading', { name: 'Nature', level: 2 })).toBeTruthy();
    const natureCardArtwork = document.querySelector(
      '.theme-card[data-theme="nature"] .theme-card-artwork',
    );
    expect(natureCardArtwork?.getAttribute('src')).toBe(
      document.querySelector('.direction-artwork')?.getAttribute('src'),
    );

    await user.click(screen.getByRole('tab', { name: 'Curated' }));
    const tidalMirror = screen.getByRole('button', { name: /Tidal Mirror/ });
    await user.click(tidalMirror);

    expect(tidalMirror.getAttribute('aria-pressed')).toBe('true');
    expect(
      screen.getByRole('button', { name: 'Anime Waifu — Original Heroines' }),
    ).toBeTruthy();
  });

  it('submits a custom direction and shows the imported preview', async () => {
    const generateWallpaper = vi.fn(async () => ({
      ok: true as const,
      value: preview,
    }));
    installBridge(readyDiagnostics, { generateWallpaper });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: 'Custom' }));
    const prompt = screen.getByRole('textbox', {
      name: 'What do you want to see?',
    });
    await user.type(prompt, 'A silent observatory above a cloud sea');
    await user.click(screen.getByRole('button', { name: /Generate wallpaper/ }));

    expect(
      await screen.findByRole('img', { name: 'Quiet Geometry wallpaper preview' }),
    ).toBeTruthy();
    expect(screen.getByText('Saved locally')).toBeTruthy();
    expect(generateWallpaper).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'custom',
        customPrompt: 'A silent observatory above a cloud sea',
        display: { width: 1920, height: 1080 },
      }),
    );
  });

  it('applies an imported preview and records it as the current wallpaper', async () => {
    const applyWallpaper = vi.fn(async () => ({
      ok: true as const,
      value: { ...preview.record, applied: true },
    }));
    installBridge(readyDiagnostics, {
      generateWallpaper: async () => ({ ok: true, value: preview }),
      applyWallpaper,
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Generate wallpaper/ }));
    await user.click(await screen.findByRole('button', { name: 'Apply wallpaper' }));

    expect(applyWallpaper).toHaveBeenCalledWith(preview.record.id);
    expect(
      (await screen.findByRole('button', { name: 'Applied to desktop' })).hasAttribute(
        'disabled',
      ),
    ).toBe(true);
  });

  it('rejects an imported preview and removes it from the local library', async () => {
    const deleteWallpaper = vi.fn(async () => ({ ok: true as const, value: true }));
    installBridge(readyDiagnostics, {
      generateWallpaper: async () => ({ ok: true, value: preview }),
      deleteWallpaper,
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Generate wallpaper/ }));
    await user.click(
      await screen.findByRole('button', { name: 'Reject and remove' }),
    );

    expect(deleteWallpaper).toHaveBeenCalledWith(preview.record.id);
    expect(screen.queryByText('Reject and remove')).toBeNull();
  });

  it('loads local history and toggles favorites without exposing file paths', async () => {
    const item: WallpaperLibraryItem = {
      record: preview.record,
      previewUrl: preview.previewUrl,
    };
    const setWallpaperFavorite = vi.fn(async () => ({
      ok: true as const,
      value: { ...preview.record, favorite: true },
    }));
    installBridge(readyDiagnostics, {
      listWallpapers: async () => ({ ok: true, value: [item] }),
      setWallpaperFavorite,
    });
    const user = userEvent.setup();
    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Quiet Geometry' })).toBeTruthy();
    await user.click(
      screen.getByRole('button', { name: 'Add Quiet Geometry to favorites' }),
    );

    expect(setWallpaperFavorite).toHaveBeenCalledWith(preview.record.id, true);
    expect(
      (
        await screen.findByRole('button', {
          name: 'Remove Quiet Geometry from favorites',
        })
      ).getAttribute('aria-pressed'),
    ).toBe('true');
    expect(document.body.textContent).not.toContain(preview.record.filename);
  });

  it('derives history preview provenance from the stored record', async () => {
    const natureItem: WallpaperLibraryItem = {
      record: { ...preview.record, themeId: 'nature' },
      previewUrl: preview.previewUrl,
    };
    installBridge(readyDiagnostics, {
      listWallpapers: async () => ({ ok: true, value: [natureItem] }),
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(
      await screen.findByRole('button', { name: 'Preview Quiet Geometry' }),
    );

    expect(screen.getByText('Library wallpaper')).toBeTruthy();
    expect(screen.getAllByText('1920 × 1080 · Nature')).toHaveLength(2);
    expect(screen.queryByText('1920 × 1080 · Infinite · Minimal')).toBeNull();
  });

  it('streams sanitized progress and cancels an active generation', async () => {
    const progressListener: {
      current: Parameters<InfiniteWallApi['onGenerationProgress']>[0] | null;
    } = { current: null };
    let resolveGeneration: (
      result: Awaited<ReturnType<InfiniteWallApi['generateWallpaper']>>,
    ) => void = () => undefined;
    const generateWallpaper = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<InfiniteWallApi['generateWallpaper']>>>(
          (resolve) => {
            resolveGeneration = resolve;
          },
        ),
    );
    const cancelGeneration = vi.fn(async () => true);
    installBridge(readyDiagnostics, {
      generateWallpaper,
      cancelGeneration,
      onGenerationProgress: (listener) => {
        progressListener.current = listener;
        return () => undefined;
      },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Generate wallpaper/ }));
    expect(await screen.findByText('Creating your wallpaper')).toBeTruthy();
    act(() => {
      progressListener.current?.({
        phase: 'generating',
        message: 'Generating the image locally through Codex…',
        percent: 52,
      });
    });
    expect(await screen.findByText('52%')).toBeTruthy();
    const progress = screen.getByRole('progressbar', {
      name: 'Wallpaper generation progress',
    });
    expect(progress.getAttribute('value')).toBe('52');
    expect(progress.getAttribute('style')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Cancel generation' }));
    expect(cancelGeneration).toHaveBeenCalledOnce();
    resolveGeneration({
      ok: false,
      error: {
        code: 'cancelled',
        message: 'Wallpaper generation was cancelled.',
        retryable: true,
      },
    });
    expect(
      await screen.findByText('Wallpaper generation was cancelled.'),
    ).toBeTruthy();
  });

  it('ignores tray generation commands while generation is active', async () => {
    const appCommandListener: {
      current: Parameters<InfiniteWallApi['onAppCommand']>[0] | null;
    } = { current: null };
    let resolveGeneration: (
      result: Awaited<ReturnType<InfiniteWallApi['generateWallpaper']>>,
    ) => void = () => undefined;
    const generateWallpaper = vi.fn(
      () =>
        new Promise<Awaited<ReturnType<InfiniteWallApi['generateWallpaper']>>>(
          (resolve) => {
            resolveGeneration = resolve;
          },
        ),
    );
    installBridge(readyDiagnostics, {
      generateWallpaper,
      onAppCommand: (listener) => {
        appCommandListener.current = listener;
        return () => undefined;
      },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Generate wallpaper/ }));
    expect(await screen.findByText('Creating your wallpaper')).toBeTruthy();
    act(() => appCommandListener.current?.({ type: 'generate' }));
    await waitFor(() => expect(generateWallpaper).toHaveBeenCalledOnce());
    expect(screen.getByText('Creating your wallpaper')).toBeTruthy();

    resolveGeneration({
      ok: false,
      error: {
        code: 'cancelled',
        message: 'Wallpaper generation was cancelled.',
        retryable: true,
      },
    });
    expect(
      await screen.findByText('Wallpaper generation was cancelled.'),
    ).toBeTruthy();
  });

  it('locks queued tray generation while waiting for startup diagnostics', async () => {
    const appCommandListener: {
      current: Parameters<InfiniteWallApi['onAppCommand']>[0] | null;
    } = { current: null };
    let resolveDiagnostics!: (diagnostics: CodexDiagnostics) => void;
    const checkCodex = vi.fn(() => new Promise<CodexDiagnostics>((resolve) => {
      resolveDiagnostics = resolve;
    }));
    const generateWallpaper = vi.fn(async () => ({
      ok: false as const,
      error: {
        code: 'cancelled' as const,
        message: 'Test complete.',
        retryable: true,
      },
    }));
    installBridge(readyDiagnostics, {
      checkCodex,
      generateWallpaper,
      onAppCommand: (listener) => {
        appCommandListener.current = listener;
        return () => undefined;
      },
    });
    render(<App />);
    await waitFor(() => expect(appCommandListener.current).not.toBeNull());

    act(() => {
      appCommandListener.current?.({ type: 'generate' });
      appCommandListener.current?.({ type: 'surprise', themeId: 'nature' });
    });
    expect(generateWallpaper).not.toHaveBeenCalled();
    resolveDiagnostics(readyDiagnostics);

    await waitFor(() => expect(generateWallpaper).toHaveBeenCalledOnce());
    expect(checkCodex).toHaveBeenCalledOnce();
  });

  it('refreshes history after a main-process library mutation', async () => {
    const libraryChangedListener: { current: (() => void) | null } = {
      current: null,
    };
    const item: WallpaperLibraryItem = {
      record: preview.record,
      previewUrl: preview.previewUrl,
    };
    const listWallpapers = vi
      .fn()
      .mockResolvedValueOnce({ ok: true as const, value: [] })
      .mockResolvedValue({ ok: true as const, value: [item] });
    installBridge(readyDiagnostics, {
      listWallpapers,
      onLibraryChanged: (listener) => {
        libraryChangedListener.current = listener;
        return () => undefined;
      },
    });
    render(<App />);
    await waitFor(() => expect(listWallpapers).toHaveBeenCalledOnce());

    act(() => libraryChangedListener.current?.());

    expect(await screen.findByRole('heading', { name: 'Quiet Geometry' })).toBeTruthy();
    expect(listWallpapers).toHaveBeenCalledTimes(2);
  });

  it('stops offering cancellation once the library import begins', async () => {
    const progressListener: {
      current: Parameters<InfiniteWallApi['onGenerationProgress']>[0] | null;
    } = { current: null };
    let resolveGeneration: (
      result: Awaited<ReturnType<InfiniteWallApi['generateWallpaper']>>,
    ) => void = () => undefined;
    installBridge(readyDiagnostics, {
      generateWallpaper: () =>
        new Promise<Awaited<ReturnType<InfiniteWallApi['generateWallpaper']>>>(
          (resolve) => {
            resolveGeneration = resolve;
          },
        ),
      onGenerationProgress: (listener) => {
        progressListener.current = listener;
        return () => undefined;
      },
    });
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('button', { name: /Generate wallpaper/ }));
    act(() => {
      progressListener.current?.({
        phase: 'importing',
        message: 'Saving the wallpaper to your private library…',
        percent: 94,
      });
    });

    expect(screen.queryByRole('button', { name: 'Cancel generation' })).toBeNull();
    expect(screen.getByText('Finishing the private library save…')).toBeTruthy();
    resolveGeneration({ ok: true, value: preview });
    expect(
      await screen.findByRole('img', { name: 'Quiet Geometry wallpaper preview' }),
    ).toBeTruthy();
  });

  it('shows official installation help when Codex is missing', async () => {
    installBridge({
      installed: false,
      authenticated: false,
      version: null,
      authMethod: null,
      issue: 'not-installed',
      message: 'Install the Codex CLI to generate wallpapers.',
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Install Codex to start generating' }),
    ).toBeTruthy();
    const setupLink = screen.getByRole('link', { name: 'Open setup guide' });
    expect(setupLink.getAttribute('href')).toBe(
      'https://developers.openai.com/codex/cli/',
    );
    expect(setupLink.getAttribute('target')).toBe('_blank');
    expect(screen.getByText('Generation unavailable')).toBeTruthy();
    const generateButton = screen.getByRole('button', { name: /Generate wallpaper/ });
    expect(generateButton.hasAttribute('disabled')).toBe(true);
    expect(generateButton.getAttribute('aria-describedby')).toBe(
      'generation-blocked-reason',
    );
  });

  it('shows the local login command when Codex is signed out', async () => {
    installBridge({
      installed: true,
      authenticated: false,
      version: '0.144.6',
      authMethod: null,
      issue: 'not-authenticated',
      message: 'Sign in with Codex before generating a wallpaper.',
    });

    render(<App />);

    expect(await screen.findByRole('heading', { name: 'Sign in to Codex' })).toBeTruthy();
    expect(screen.getByText('codex login')).toBeTruthy();
  });

  it('shows upgrade guidance when Codex lacks required exec capabilities', async () => {
    installBridge({
      installed: true,
      authenticated: false,
      version: '0.1.0',
      authMethod: 'chatgpt',
      issue: 'unsupported-version',
      message: 'Upgrade the Codex CLI before generating a wallpaper.',
    });

    render(<App />);

    expect(
      await screen.findByRole('heading', { name: 'Upgrade Codex to continue' }),
    ).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Open setup guide' })).toBeTruthy();
  });
});
