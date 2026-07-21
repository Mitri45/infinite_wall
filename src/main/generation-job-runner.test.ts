import { mkdir, mkdtemp, readdir, realpath, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import { GenerationJobRunner } from './generation-job-runner';
import type { GenerationJobRequest } from './generation-prompt';

const fakeCodexPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../test/fixtures/fake-codex.mjs',
);
const temporaryRoots: string[] = [];
const request: GenerationJobRequest = {
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
  it('pins the ChatGPT-compatible GPT-5.6 SOL model', async () => {
    const { runner } = await createRunner('assert-default-model');

    await expect(runner.run(request)).resolves.toMatchObject({
      title: 'Quiet Geometry',
    });
  });

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

  it('maps JSONL event types to progress without exposing raw event content', async () => {
    const { runner } = await createRunner('success');
    const progress: string[] = [];

    await runner.run(request, undefined, (update) => {
      progress.push(`${update.phase}:${update.message}`);
    });

    expect(progress).toEqual(
      expect.arrayContaining([
        expect.stringContaining('preparing:'),
        expect.stringContaining('starting:'),
        expect.stringContaining('generating:'),
        expect.stringContaining('validating:'),
      ]),
    );
    expect(progress.join('\n')).not.toContain('sensitive fake command content');
  });

  it('removes only a completed job beneath the configured job root', async () => {
    const { runner } = await createRunner('success');
    const result = await runner.run(request);

    await runner.removeCompletedJob(result.imagePath);

    await expect(realpath(result.imagePath)).rejects.toThrow();
    await expect(runner.removeCompletedJob('/tmp/outside.png')).rejects.toThrow();
  });

  it('tolerates non-JSON stdout lines when the structured result is valid', async () => {
    const { runner } = await createRunner('malformed-jsonl');

    await expect(runner.run(request)).resolves.toMatchObject({
      title: 'Quiet Geometry',
    });
  });

  it.each([
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

  it('rejects a decoded image whose aspect ratio does not match the display', async () => {
    const { runner } = await createRunner('success', 2_000, async () => ({
      width: 1_000,
      height: 1_000,
    }));

    await expect(runner.run(request)).rejects.toMatchObject({
      code: 'missing-image',
      message: expect.stringContaining('aspect ratio'),
    });
  });

  it('prunes stale private job directories before the first run', async () => {
    const { runner, root } = await createRunner('success');
    const staleDirectory = path.join(root, 'job-stale');
    await mkdir(staleDirectory);
    await writeFile(path.join(staleDirectory, 'prompt.txt'), 'private prompt');

    await runner.run(request);

    expect(await readdir(root)).not.toContain('job-stale');
  });

  it('retries job-root initialization after a transient failure', async () => {
    const parent = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-retry-'));
    temporaryRoots.push(parent);
    const jobRoot = path.join(parent, 'jobs');
    await writeFile(jobRoot, 'temporarily unavailable');
    const runner = new GenerationJobRunner({
      jobRoot,
      inspectImage: async () => ({ width: 1920, height: 1080 }),
      command: process.execPath,
      commandArgsPrefix: [fakeCodexPath, 'success'],
      timeoutMs: 2_000,
    });

    await expect(runner.run(request)).rejects.toThrow();
    await rm(jobRoot);
    await expect(runner.run(request)).resolves.toMatchObject({
      title: 'Quiet Geometry',
    });
  });

  it('supports explicit cancellation without leaving a successful job', async () => {
    const { runner } = await createRunner('timeout', 5_000);
    const controller = new AbortController();
    const pending = runner.run(request, controller.signal);
    setTimeout(() => controller.abort(), 30);

    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
  });

  it('honors cancellation before creating a workspace or spawning Codex', async () => {
    const { runner, root } = await createRunner('success');
    const controller = new AbortController();
    controller.abort();

    await expect(runner.run(request, controller.signal)).rejects.toMatchObject({
      code: 'cancelled',
    });
    await expect(readdir(root)).resolves.toEqual([]);
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
