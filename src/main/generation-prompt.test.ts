import { describe, expect, it } from 'vitest';

import type { GenerationRequest } from '../shared/contracts';
import { buildGenerationPrompt } from './generation-prompt';

describe('buildGenerationPrompt', () => {
  it('includes display constraints and recent-concept exclusions', () => {
    const request: GenerationRequest = {
      themeId: 'minimal',
      mode: 'infinite',
      display: { width: 3440, height: 1440 },
      quality: 'high',
      recentConcepts: ['A concrete arch in fog'],
    };

    const prompt = buildGenerationPrompt(request);

    expect(prompt).toContain('Target display: 3440x1440');
    expect(prompt).toContain('- A concrete arch in fog');
    expect(prompt).toContain('Do not write outside it.');
    expect(prompt).toContain('Do not include named fictional characters');
  });

  it('rejects a curated scene that does not belong to the selected theme', () => {
    const request: GenerationRequest = {
      themeId: 'minimal',
      mode: 'curated',
      sceneId: 'enchanted-library',
      display: { width: 1920, height: 1080 },
      quality: 'standard',
      recentConcepts: [],
    };

    expect(() => buildGenerationPrompt(request)).toThrow(
      'does not belong to theme minimal',
    );
  });
});
