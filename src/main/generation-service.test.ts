import { mkdtemp, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { afterEach, describe, expect, it } from 'vitest';

import type { GenerationRequest } from '../shared/contracts';
import { GenerationJobRunner } from './generation-job-runner';
import { GenerationService } from './generation-service';
import { WallpaperLibrary } from './wallpaper-library';

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
};

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('GenerationService', () => {
  it('runs fake Codex, imports atomically, and removes the temporary job', async () => {
    const { service, jobRoot, library } = await createService('success');
    const phases: string[] = [];

    const preview = await service.generate(request, undefined, (progress) => {
      phases.push(progress.phase);
    });

    expect(preview.record.title).toBe('Quiet Geometry');
    await expect(library.resolveImage(preview.record.id)).resolves.not.toBeNull();
    await expect(readdir(jobRoot)).resolves.toEqual([]);
    expect(phases).toEqual(expect.arrayContaining(['generating', 'importing', 'complete']));
  });

  it('cancels the fake process without importing a library item', async () => {
    const { service, jobRoot, libraryRoot } = await createService('timeout', 5_000);
    const controller = new AbortController();
    const pending = service.generate(request, controller.signal);
    setTimeout(() => controller.abort(), 30);

    await expect(pending).rejects.toMatchObject({ code: 'cancelled' });
    await expect(readdir(jobRoot)).resolves.toEqual([]);
    await expect(readdir(path.join(libraryRoot, 'items'))).rejects.toThrow();
  });
});

async function createService(scenario: string, timeoutMs = 2_000) {
  const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-service-'));
  temporaryRoots.push(root);
  const jobRoot = path.join(root, 'jobs');
  const libraryRoot = path.join(root, 'library');
  const inspectImage = async () => ({ width: 1920, height: 1080 });
  const runner = new GenerationJobRunner({
    jobRoot,
    inspectImage,
    command: process.execPath,
    commandArgsPrefix: [fakeCodexPath, scenario],
    timeoutMs,
  });
  const library = new WallpaperLibrary({ root: libraryRoot, inspectImage });
  return {
    jobRoot,
    libraryRoot,
    library,
    service: new GenerationService({ runner, library }),
  };
}
