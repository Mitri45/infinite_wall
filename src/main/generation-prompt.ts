import type { GenerationRequest } from '../shared/contracts';
import { getThemePack } from '../shared/themes';

export type GenerationJobRequest = GenerationRequest & {
  readonly recentConcepts: readonly string[];
};

export function buildGenerationPrompt(request: GenerationJobRequest): string {
  const theme = getThemePack(request.themeId);
  const direction = getDirection(request);
  const recentConcepts =
    request.recentConcepts.length > 0
      ? request.recentConcepts.map((concept) => `- ${concept}`).join('\n')
      : '- None yet';

  return `Create exactly one original, SFW desktop wallpaper using the stable image-generation capability available to Codex.

Theme: ${theme.name} / ${theme.collection}
Theme description: ${theme.description}
Mood: ${theme.mood.join(', ')}
Palette: ${theme.palette.join(', ')}
Suggested subjects: ${theme.subjects.join('; ')}
Composition guidance: ${theme.composition}
Direction: ${direction}
Target display: ${request.display.width}x${request.display.height}
Quality: ${request.quality}

Avoid repeating these recent concepts:
${recentConcepts}

Safety and output requirements:
- Use only original subjects. Do not include named fictional characters, protected logos, text, signatures, or watermarks.
- Compose for the target aspect ratio with a visually quiet area suitable for desktop icons.
- Save exactly one PNG, JPEG, or WebP image inside the current working directory. Do not write outside it.
- Return a relative imagePath plus the final prompt, a short title, themeId "${theme.id}", and a concise sceneSummary.
- Do not return Markdown or any fields outside the supplied output schema.`;
}

function getDirection(request: GenerationRequest): string {
  const theme = getThemePack(request.themeId);
  if (request.mode === 'infinite') {
    return 'Invent a fresh scene within this theme that is meaningfully distinct from the recent concepts.';
  }

  if (request.mode === 'custom') {
    return `Adapt this user request to the theme and wallpaper constraints: ${request.customPrompt}`;
  }

  const scene = theme.sceneSeeds.find((candidate) => candidate.id === request.sceneId);
  if (!scene) {
    throw new Error(`Scene ${request.sceneId} does not belong to theme ${theme.id}.`);
  }

  return `${scene.title}: ${scene.prompt}`;
}
