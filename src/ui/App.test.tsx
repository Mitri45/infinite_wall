// @vitest-environment jsdom

import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, describe, expect, it } from 'vitest';

import { App } from './App';

beforeAll(() => {
  Object.defineProperty(window, 'infiniteWall', {
    configurable: true,
    value: { platform: 'linux' },
  });
});

afterEach(cleanup);

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
});
