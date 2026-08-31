import { Buffer } from 'node:buffer';
import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import type { GenerationResult } from '../shared/contracts';
import type { WallpaperAdapter } from './wallpaper-adapter';
import { WallpaperLibrary } from './wallpaper-library';
import { WallpaperService } from './wallpaper-service';

const temporaryRoots: string[] = [];
const fakePngBytes = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x66, 0x61, 0x6b, 0x65,
]);

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('WallpaperService', () => {
  it('serializes OS application and applied-state persistence', async () => {
    const { library, firstId, secondId } = await createLibraryWithTwoItems();
    const firstGate = deferred<void>();
    const secondGate = deferred<void>();
    const adapter: WallpaperAdapter = {
      apply: vi
        .fn()
        .mockImplementationOnce(() => firstGate.promise)
        .mockImplementationOnce(() => secondGate.promise),
    };
    const service = new WallpaperService({ library, adapter });

    const firstApply = service.apply(firstId);
    const secondApply = service.apply(secondId);
    await vi.waitFor(() => expect(adapter.apply).toHaveBeenCalledTimes(1));

    firstGate.resolve();
    await firstApply;
    await vi.waitFor(() => expect(adapter.apply).toHaveBeenCalledTimes(2));

    secondGate.resolve();
    await secondApply;

    const items = await library.list();
    expect(items.find((item) => item.record.id === firstId)?.record.applied).toBe(false);
    expect(items.find((item) => item.record.id === secondId)?.record.applied).toBe(true);
  });

  it('waits for active mutations and rejects new ones during disposal', async () => {
    const { library, firstId } = await createLibraryWithTwoItems();
    const applyGate = deferred<void>();
    const adapter: WallpaperAdapter = { apply: () => applyGate.promise };
    const service = new WallpaperService({ library, adapter });
    const applying = service.apply(firstId);
    await vi.waitFor(async () => {
      expect(await library.resolveImage(firstId)).not.toBeNull();
    });

    let disposed = false;
    const disposal = service.dispose().then(() => {
      disposed = true;
    });
    await expect(service.setFavorite(firstId, true)).rejects.toThrow(
      'shutting down',
    );
    expect(disposed).toBe(false);

    applyGate.resolve();
    await applying;
    await disposal;
    expect(disposed).toBe(true);
  });

  it('does not mark a library item applied when an OS adapter fails', async () => {
    const { library, firstId } = await createLibraryWithTwoItems();
    const adapter: WallpaperAdapter = {
      apply: () => Promise.reject(new Error('display 2 failed')),
    };
    const service = new WallpaperService({ library, adapter });

    await expect(service.apply(firstId)).rejects.toThrow('display 2 failed');

    const item = (await library.list()).find(
      (candidate) => candidate.record.id === firstId,
    );
    expect(item?.record.applied).toBe(false);
  });

  it('dispatches live records to the Wallloop adapter and preserves their fallback path', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-live-service-'));
    temporaryRoots.push(root);
    const sourceImage = path.join(root, 'source.png');
    await writeFile(sourceImage, fakePngBytes);
    const bundlePath = path.join(root, 'live-bundle');
    await mkdir(bundlePath);
    const library = new WallpaperLibrary({
      root: path.join(root, 'library'),
      inspectImage: async () => ({ width: 1920, height: 1080 }),
    });
    const live = await library.importLiveBundle(
      {
        imagePath: sourceImage,
        finalPrompt: 'A quiet geometric landscape composed for a wide desktop wallpaper.',
        title: 'Quiet Geometry',
        themeId: 'minimal',
        sceneSummary: 'A restrained geometric landscape with ample negative space.',
        durationMs: 1_200,
      },
      bundlePath,
    );
    const apply = vi.fn(async () => undefined);
    const applyLiveBundle = vi.fn(async () => undefined);
    const service = new WallpaperService({
      library,
      adapter: { apply, applyLiveBundle },
    });

    const applied = await service.apply(live.record.id);

    expect(applyLiveBundle).toHaveBeenCalledWith(
      bundlePath,
      expect.stringContaining(path.join('items', live.record.id, 'wallpaper.png')),
    );
    expect(apply).not.toHaveBeenCalled();
    expect(applied.kind).toBe('live-bundle');
    expect(applied.applied).toBe(true);
  });
});

async function createLibraryWithTwoItems() {
  const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-service-'));
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
  const library = new WallpaperLibrary({
    root: path.join(root, 'library'),
    inspectImage: async () => ({ width: 1920, height: 1080 }),
  });
  const first = await library.importGeneration(generation);
  const second = await library.importGeneration({
    ...generation,
    title: 'Second Geometry',
    sceneSummary: 'A second restrained landscape with a different central form.',
  });
  return { library, firstId: first.record.id, secondId: second.record.id };
}

function deferred<T>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  const promise = new Promise<T>((resolver) => {
    resolve = resolver;
  });
  return { promise, resolve };
}
