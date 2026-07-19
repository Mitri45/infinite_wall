import { describe, expect, it } from 'vitest';

import { THEME_IDS, themePackSchema } from './contracts';
import { getThemePack, selectWeightedScene, THEME_PACKS } from './themes';

describe('theme packs', () => {
  it('defines every public theme exactly once', () => {
    expect(THEME_PACKS).toHaveLength(THEME_IDS.length);
    expect(new Set(THEME_PACKS.map((theme) => theme.id))).toEqual(
      new Set(THEME_IDS),
    );
  });

  it.each(THEME_PACKS)('$name satisfies the public contract', (theme) => {
    expect(() => themePackSchema.parse(theme)).not.toThrow();
    expect(theme.sceneSeeds.length).toBeGreaterThanOrEqual(4);
    expect(new Set(theme.sceneSeeds.map((scene) => scene.id)).size).toBe(
      theme.sceneSeeds.length,
    );
  });

  it('retrieves a theme by its stable identifier', () => {
    expect(getThemePack('cosmic').name).toBe('Cosmic');
  });
});

describe('weighted scene selection', () => {
  const theme = getThemePack('minimal');

  it('maps the random value across scene weights', () => {
    expect(selectWeightedScene(theme, [], () => 0).id).toBe(
      'minimal-folded-light',
    );
    expect(selectWeightedScene(theme, [], () => 0.999).id).toBe(
      'minimal-glass-orbit',
    );
  });

  it('excludes recent concepts while unseen seeds remain', () => {
    const recent = theme.sceneSeeds.slice(0, 3).map((scene) => scene.summary);
    expect(selectWeightedScene(theme, recent, () => 0).id).toBe(
      'minimal-glass-orbit',
    );
  });

  it('falls back to the full pack after every seed has been seen', () => {
    const recent = theme.sceneSeeds.map((scene) => scene.summary);
    expect(selectWeightedScene(theme, recent, () => 0).id).toBe(
      'minimal-folded-light',
    );
  });
});
