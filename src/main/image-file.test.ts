import { Buffer } from 'node:buffer';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { verifiedImageMime } from './image-file';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('verifiedImageMime', () => {
  it('accepts supported signatures only when the extension matches', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-image-'));
    temporaryRoots.push(root);
    const png = path.join(root, 'wallpaper.png');
    const disguised = path.join(root, 'wallpaper.jpg');
    const bytes = Buffer.from([
      0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0,
    ]);
    await Promise.all([writeFile(png, bytes), writeFile(disguised, bytes)]);

    await expect(verifiedImageMime(png)).resolves.toBe('image/png');
    await expect(verifiedImageMime(disguised)).resolves.toBeNull();
  });

  it('rejects empty or unknown files', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-image-'));
    temporaryRoots.push(root);
    const unknown = path.join(root, 'unknown.webp');
    await writeFile(unknown, 'not an image');

    await expect(verifiedImageMime(unknown)).resolves.toBeNull();
    await expect(verifiedImageMime(path.join(root, 'missing.png'))).resolves.toBeNull();
  });
});
