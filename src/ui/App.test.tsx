// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { CodexDiagnostics } from '../shared/contracts';
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

function installBridge(diagnostics: CodexDiagnostics) {
  Object.defineProperty(window, 'infiniteWall', {
    configurable: true,
    value: {
      platform: 'linux',
      checkCodex: async () => diagnostics,
      generateWallpaper: async () => ({
        ok: false,
        error: {
          code: 'process-failed',
          message: 'Not used in this test.',
          retryable: false,
        },
      }),
      cancelGeneration: async () => false,
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

  it('accepts a custom direction and confirms it locally', async () => {
    const user = userEvent.setup();
    render(<App />);

    await user.click(screen.getByRole('tab', { name: 'Custom' }));
    const prompt = screen.getByRole('textbox', {
      name: 'What do you want to see?',
    });
    await user.type(prompt, 'A silent observatory above a cloud sea');
    await user.click(screen.getByRole('button', { name: /Use this direction/ }));

    expect(screen.getByText('Direction ready: Custom · Minimal')).toBeTruthy();
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
});
