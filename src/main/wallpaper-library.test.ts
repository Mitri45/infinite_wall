import { Buffer } from 'node:buffer';
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  symlink,
  writeFile,
} from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import type { GenerationResult } from '../shared/contracts';
import { WallpaperLibrary } from './wallpaper-library';

const temporaryRoots: string[] = [];
const fakePngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x66, 0x61, 0x6b, 0x65,
]);

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('WallpaperLibrary', () => {
  it('atomically imports image bytes and validated metadata', async () => {
    const { library, root, generation } = await createLibrary();

    const preview = await library.importGeneration(generation);
    const resolvedImage = await library.resolveImage(preview.record.id);

    expect(preview.previewUrl).toBe(
      `infinite-wall-media://wallpaper/${preview.record.id}`,
    );
    expect(preview.record).toMatchObject({
      filename: 'wallpaper.png',
      width: 1920,
      height: 1080,
      applied: false,
      favorite: false,
    });
    expect(resolvedImage).not.toBeNull();
    await expect(readFile(resolvedImage!)).resolves.toEqual(fakePngBytes);

    const itemEntries = await readdir(path.join(root, 'library', 'items'));
    expect(itemEntries).toEqual([preview.record.id]);
    await expect(library.getRecentConcepts()).resolves.toEqual([
      generation.sceneSummary,
    ]);
  });

  it('removes staging data when the copied image cannot be decoded', async () => {
    const { root, generation } = await createLibrary();
    const library = new WallpaperLibrary({
      root: path.join(root, 'library'),
      inspectImage: async () => {
        throw new Error('decode failed');
      },
    });

    await expect(library.importGeneration(generation)).rejects.toThrow(
      'could not be decoded safely',
    );
    await expect(readdir(path.join(root, 'library', 'items'))).resolves.toEqual(
      [],
    );
  });

  it('rejects record identifiers that could escape the library', async () => {
    const { library } = await createLibrary();

    await expect(library.resolveImage('../outside')).resolves.toBeNull();
    await expect(library.resolveImage('not/a-record')).resolves.toBeNull();
  });

  it('does not follow a library item symlink outside the items root', async () => {
    const { library, root, generation } = await createLibrary();
    await library.importGeneration(generation);
    const outside = path.join(root, 'outside-item');
    await mkdir(outside);
    await writeFile(path.join(outside, 'wallpaper.png'), fakePngBytes);
    await writeFile(
      path.join(outside, 'record.json'),
      JSON.stringify({
        id: 'linked-record',
        filename: 'wallpaper.png',
        prompt: generation.finalPrompt,
        title: generation.title,
        themeId: generation.themeId,
        sceneSummary: generation.sceneSummary,
        width: 1920,
        height: 1080,
        createdAt: '2026-07-19T00:00:00.000Z',
        applied: false,
        favorite: false,
      }),
    );
    await symlink(
      outside,
      path.join(root, 'library', 'items', 'linked-record'),
      'dir',
    );

    await expect(library.resolveImage('linked-record')).resolves.toBeNull();
  });
});

async function createLibrary() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-library-'));
  temporaryRoots.push(root);
  const sourceImage = path.join(root, 'source.png');
  await writeFile(sourceImage, fakePngBytes);
  const generation: GenerationResult = {
    imagePath: sourceImage,
    finalPrompt: 'A quiet geometric landscape composed for a wide desktop wallpaper.',
    title: 'Quiet Geometry',
    themeId: 'minimal',
    sceneSummary: 'A restrained geometric landscape with ample negative space.',
    durationMs: 1_200,
  };
  return {
    root,
    generation,
    library: new WallpaperLibrary({
      root: path.join(root, 'library'),
      inspectImage: async () => ({ width: 1920, height: 1080 }),
    }),
  };
}
