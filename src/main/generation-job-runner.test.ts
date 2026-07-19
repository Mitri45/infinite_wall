import { mkdtemp, realpath, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { GenerationRequest } from '../shared/contracts';
import { GenerationJobRunner } from './generation-job-runner';

const fakeCodexPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../test/fixtures/fake-codex.mjs',
);
const temporaryRoots: string[] = [];
const request: GenerationRequest = {
  themeId: 'minimal',
  mode: 'infinite',
  display: { width: 1920, height: 1080 },
  quality: 'standard',
  recentConcepts: [],
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('GenerationJobRunner', () => {
  it('accepts one schema-valid image confined to its private job directory', async () => {
    const { runner, root } = await createRunner('success');

    const result = await runner.run(request);
    const resolvedRoot = await realpath(root);

    expect(result).toMatchObject({
      title: 'Quiet Geometry',
      themeId: 'minimal',
      sceneSummary: 'A restrained geometric landscape with ample negative space.',
    });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
    expect(path.dirname(path.dirname(result.imagePath))).toBe(resolvedRoot);
  });

  it.each([
    ['malformed-jsonl', 'malformed-output'],
    ['malformed-output', 'malformed-output'],
    ['missing-image', 'missing-image'],
    ['outside', 'outside-job-directory'],
    ['two-images', 'malformed-output'],
    ['moderation', 'moderation'],
    ['network', 'network'],
    ['not-authenticated', 'not-authenticated'],
  ] as const)('maps %s failures to %s', async (scenario, code) => {
    const { runner } = await createRunner(scenario);

    await expect(runner.run(request)).rejects.toMatchObject({ code });
  });

  it('terminates and classifies a timed-out Codex job', async () => {
    const { runner } = await createRunner('timeout', 80);

    await expect(runner.run(request)).rejects.toMatchObject({ code: 'timeout' });
  });

  it('rejects an image that the production decoder cannot read', async () => {
    const { runner } = await createRunner('success', 2_000, async () => {
      throw new Error('invalid image');
    });

    await expect(runner.run(request)).rejects.toMatchObject({
      code: 'missing-image',
    });
  });

  it('supports explicit cancellation without leaving a successful job', async () => {
    const { runner } = await createRunner('timeout', 5_000);
    const controller = new AbortController();
    const pending = runner.run(request, controller.signal);
    setTimeout(() => controller.abort(), 30);

    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });
});

async function createRunner(
  scenario: string,
  timeoutMs = 2_000,
  inspectImage = async () => ({ width: 1920, height: 1080 }),
) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-runner-'));
  temporaryRoots.push(root);
  return {
    root,
    runner: new GenerationJobRunner({
      jobRoot: root,
      inspectImage,
      command: process.execPath,
      commandArgsPrefix: [fakeCodexPath, scenario],
      timeoutMs,
    }),
  };
}
