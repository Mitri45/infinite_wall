// @vitest-environment jsdom

import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import type {
  CodexDiagnostics,
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
      onGenerationProgress: () => () => undefined,
      ...overrides,
    },
  });
}

describe('theme selection experience', () => {
  it('switches themes and curated scenes', async () => {
    const user = userEvent.setup();
    render(<App />);

    expect(
      screen.getByRole('heading', { name: 'Where should we go?' }),
    ).toBeTruthy();

    await user.click(
      screen.getByRole('button', { name: 'Nature — Wild Distance' }),
    );
    expect(screen.getByRole('heading', { name: 'Nature', level: 2 })).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Curated' }));
    const tidalMirror = screen.getByRole('button', { name: /Tidal Mirror/ });
    await user.click(tidalMirror);

    expect(tidalMirror.getAttribute('aria-pressed')).toBe('true');
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
