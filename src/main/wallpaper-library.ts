import { randomUUID } from 'node:crypto';
import {
  chmod,
  copyFile,
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  realpath,
  rename,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import path from 'node:path';

import {
  identifierSchema,
  type GenerationResult,
  type WallpaperLibraryItem,
  type WallpaperPreview,
  type WallpaperRecord,
  wallpaperRecordSchema,
} from '../shared/contracts';
import type { ImageDimensions } from './generation-job-runner';
import { verifiedImageMime } from './image-file';

const METADATA_FILENAME = 'record.json';
const MAX_IMAGE_BYTES = 64 * 1024 * 1024;
const SUPPORTED_IMAGE_EXTENSIONS = new Set(['.jpeg', '.jpg', '.png', '.webp']);

interface WallpaperLibraryOptions {
  readonly root: string;
  readonly inspectImage: (imagePath: string) => Promise<ImageDimensions>;
}

export class WallpaperLibraryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WallpaperLibraryError';
  }
}

export class WallpaperLibrary {
  readonly #root: string;
  readonly #itemsRoot: string;
  readonly #inspectImage: WallpaperLibraryOptions['inspectImage'];
  #itemsRootPreparation: Promise<void> | null = null;
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(options: WallpaperLibraryOptions) {
    this.#root = path.resolve(options.root);
    this.#itemsRoot = path.join(this.#root, 'items');
    this.#inspectImage = options.inspectImage;
  }

  async importGeneration(result: GenerationResult): Promise<WallpaperPreview> {
    await this.#prepareItemsRoot();

    const sourceStats = await stat(result.imagePath).catch(() => null);
    const extension = path.extname(result.imagePath).toLowerCase();
    if (
      !sourceStats?.isFile() ||
      sourceStats.size === 0 ||
      sourceStats.size > MAX_IMAGE_BYTES ||
      !SUPPORTED_IMAGE_EXTENSIONS.has(extension)
    ) {
      throw new WallpaperLibraryError('The generated image is no longer available.');
    }

    const id = randomUUID();
    const finalDirectory = path.join(this.#itemsRoot, id);
    const stagingDirectory = await mkdtemp(path.join(this.#itemsRoot, '.import-'));
    await chmod(stagingDirectory, 0o700);
    const filename = `wallpaper${extension}`;
    const stagedImagePath = path.join(stagingDirectory, filename);

    try {
      await copyFile(result.imagePath, stagedImagePath);
      await chmod(stagedImagePath, 0o600);
      if (!(await verifiedImageMime(stagedImagePath))) {
        throw new WallpaperLibraryError(
          'The imported wallpaper contents do not match its file type.',
        );
      }
      const dimensions = await this.#inspectImage(stagedImagePath).catch(() => null);
      if (
        !dimensions ||
        !Number.isInteger(dimensions.width) ||
        !Number.isInteger(dimensions.height) ||
        dimensions.width < 1 ||
        dimensions.height < 1 ||
        dimensions.width > 16_384 ||
        dimensions.height > 16_384
      ) {
        throw new WallpaperLibraryError(
          'The imported wallpaper could not be decoded safely.',
        );
      }

      const record = wallpaperRecordSchema.parse({
        id,
        filename,
        prompt: result.finalPrompt,
        title: result.title,
        themeId: result.themeId,
        sceneSummary: result.sceneSummary,
        width: dimensions.width,
        height: dimensions.height,
        createdAt: new Date().toISOString(),
        applied: false,
        favorite: false,
      });
      await writeFile(
        path.join(stagingDirectory, METADATA_FILENAME),
        `${JSON.stringify(record, null, 2)}\n`,
        { encoding: 'utf8', mode: 0o600 },
      );

      await rename(stagingDirectory, finalDirectory);
      return {
        record,
        previewUrl: previewUrlFor(id),
        durationMs: result.durationMs,
      };
    } catch (error) {
      await rm(stagingDirectory, { recursive: true, force: true });
      if (error instanceof WallpaperLibraryError) {
        throw error;
      }
      throw new WallpaperLibraryError('Infinite Wall could not import the wallpaper.');
    }
  }

  async #prepareItemsRoot(): Promise<void> {
    if (!this.#itemsRootPreparation) {
      const preparation = this.#initializeItemsRoot();
      this.#itemsRootPreparation = preparation;
      try {
        await preparation;
      } catch (error) {
        if (this.#itemsRootPreparation === preparation) {
          this.#itemsRootPreparation = null;
        }
        throw error;
      }
      return;
    }
    await this.#itemsRootPreparation;
  }

  async #initializeItemsRoot(): Promise<void> {
    await mkdir(this.#itemsRoot, { recursive: true, mode: 0o700 });
    await chmod(this.#root, 0o700);
    await chmod(this.#itemsRoot, 0o700);
    await this.#assertItemsRootConfined();
    const entries = await readdir(this.#itemsRoot, { withFileTypes: true });
    await Promise.all(
      entries
        .filter((entry) => entry.isDirectory() && entry.name.startsWith('.import-'))
        .map((entry) =>
          rm(path.join(this.#itemsRoot, entry.name), { recursive: true, force: true }),
        ),
    );
  }

  async resolveImage(recordId: string): Promise<string | null> {
    try {
      await this.#prepareItemsRoot();
    } catch {
      return null;
    }
    const parsedId = identifierSchema.safeParse(recordId);
    if (!parsedId.success) {
      return null;
    }

    const itemDirectory = path.join(this.#itemsRoot, parsedId.data);
    const record = await readRecord(itemDirectory);
    if (!record || record.id !== parsedId.data || path.basename(record.filename) !== record.filename) {
      return null;
    }

    const candidate = path.join(itemDirectory, record.filename);
    const [resolvedItemsRoot, resolvedDirectory, resolvedCandidate] = await Promise.all([
      realpath(this.#itemsRoot).catch(() => null),
      realpath(itemDirectory).catch(() => null),
      realpath(candidate).catch(() => null),
    ]);
    if (!resolvedItemsRoot || !resolvedDirectory || !resolvedCandidate) {
      return null;
    }
    if (
      path.dirname(resolvedDirectory) !== resolvedItemsRoot ||
      path.dirname(resolvedCandidate) !== resolvedDirectory
    ) {
      return null;
    }
    const candidateStats = await stat(resolvedCandidate).catch(() => null);
    return candidateStats?.isFile() &&
      candidateStats.size > 0 &&
      candidateStats.size <= MAX_IMAGE_BYTES
      ? resolvedCandidate
      : null;
  }

  async getRecentConcepts(limit = 20): Promise<string[]> {
    const [resolvedRoot, resolvedItemsRoot] = await Promise.all([
      realpath(this.#root).catch(() => null),
      realpath(this.#itemsRoot).catch(() => null),
    ]);
    if (
      !resolvedRoot ||
      !resolvedItemsRoot ||
      path.dirname(resolvedItemsRoot) !== resolvedRoot
    ) {
      return [];
    }
    const entries = await readdir(this.#itemsRoot, { withFileTypes: true }).catch(
      () => [],
    );
    const records = (
      await Promise.all(
        entries
          .filter((entry) => entry.isDirectory() && identifierSchema.safeParse(entry.name).success)
          .map((entry) => readRecord(path.join(this.#itemsRoot, entry.name))),
      )
    ).filter((record): record is WallpaperRecord => record !== null);

    return records
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .slice(0, Math.max(0, Math.min(limit, 20)))
      .map((record) => record.sceneSummary);
  }

  async list(): Promise<WallpaperLibraryItem[]> {
    await this.#prepareItemsRoot();
    const entries = await readdir(this.#itemsRoot, { withFileTypes: true });
    const records = (
      await Promise.all(
        entries
          .filter(
            (entry) =>
              entry.isDirectory() && identifierSchema.safeParse(entry.name).success,
          )
          .map(async (entry) => {
            const record = await readRecord(path.join(this.#itemsRoot, entry.name));
            if (
              !record ||
              record.id !== entry.name ||
              !(await this.resolveImage(record.id))
            ) {
              return null;
            }
            return record;
          }),
      )
    ).filter((record): record is WallpaperRecord => record !== null);

    return records
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
      .map((record) => ({ record, previewUrl: previewUrlFor(record.id) }));
  }

  async setFavorite(recordId: string, favorite: boolean): Promise<WallpaperRecord> {
    return this.#runMutation(async () => {
      const item = await this.#resolveItem(recordId);
      if (!item) {
        throw new WallpaperLibraryError('The wallpaper could not be found.');
      }
      const record = wallpaperRecordSchema.parse({ ...item.record, favorite });
      await writeRecordAtomically(item.directory, record);
      return record;
    });
  }

  async markApplied(recordId: string): Promise<WallpaperRecord> {
    return this.#runMutation(async () => {
      const selected = await this.#resolveItem(recordId);
      if (!selected) {
        throw new WallpaperLibraryError('The wallpaper could not be found.');
      }

      const selectedRecord = wallpaperRecordSchema.parse({
        ...selected.record,
        applied: true,
      });
      await writeRecordAtomically(selected.directory, selectedRecord);

      const entries = await readdir(this.#itemsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (
          entry.name === selectedRecord.id ||
          !entry.isDirectory() ||
          !identifierSchema.safeParse(entry.name).success
        ) {
          continue;
        }
        const item = await this.#resolveItem(entry.name);
        if (item?.record.applied) {
          await writeRecordAtomically(
            item.directory,
            wallpaperRecordSchema.parse({ ...item.record, applied: false }),
          );
        }
      }
      return selectedRecord;
    });
  }

  async delete(recordId: string): Promise<boolean> {
    return this.#runMutation(async () => {
      const item = await this.#resolveItem(recordId);
      if (!item) {
        return false;
      }
      if (item.record.applied) {
        throw new WallpaperLibraryError(
          'Apply another wallpaper before removing the current one.',
        );
      }
      await rm(item.directory, { recursive: true, force: false });
      return true;
    });
  }

  async #resolveItem(
    recordId: string,
  ): Promise<{ readonly directory: string; readonly record: WallpaperRecord } | null> {
    await this.#prepareItemsRoot();
    const parsedId = identifierSchema.safeParse(recordId);
    if (!parsedId.success) {
      return null;
    }
    const itemDirectory = path.join(this.#itemsRoot, parsedId.data);
    const [resolvedItemsRoot, resolvedDirectory] = await Promise.all([
      realpath(this.#itemsRoot).catch(() => null),
      realpath(itemDirectory).catch(() => null),
    ]);
    if (
      !resolvedItemsRoot ||
      !resolvedDirectory ||
      path.dirname(resolvedDirectory) !== resolvedItemsRoot
    ) {
      return null;
    }
    const record = await readRecord(resolvedDirectory);
    return record?.id === parsedId.data
      ? { directory: resolvedDirectory, record }
      : null;
  }

  #runMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation, operation);
    this.#mutationTail = result.then(
      () => undefined,
      () => undefined,
    );
    return result;
  }

  async #assertItemsRootConfined(): Promise<void> {
    const [resolvedRoot, resolvedItemsRoot] = await Promise.all([
      realpath(this.#root),
      realpath(this.#itemsRoot),
    ]);
    if (path.dirname(resolvedItemsRoot) !== resolvedRoot) {
      throw new WallpaperLibraryError(
        'The wallpaper library path is not safely confined.',
      );
    }
  }
}

function previewUrlFor(recordId: string): string {
  return `infinite-wall-media://wallpaper/${recordId}`;
}

async function readRecord(itemDirectory: string): Promise<WallpaperRecord | null> {
  const text = await readFile(path.join(itemDirectory, METADATA_FILENAME), 'utf8').catch(
    () => null,
  );
  if (!text) {
    return null;
  }
  try {
    return wallpaperRecordSchema.parse(JSON.parse(text));
  } catch {
    return null;
  }
}

async function writeRecordAtomically(
  itemDirectory: string,
  record: WallpaperRecord,
): Promise<void> {
  const temporaryPath = path.join(
    itemDirectory,
    `.record-${randomUUID()}.tmp`,
  );
  try {
    await writeFile(temporaryPath, `${JSON.stringify(record, null, 2)}\n`, {
      encoding: 'utf8',
      mode: 0o600,
    });
    await rename(temporaryPath, path.join(itemDirectory, METADATA_FILENAME));
  } catch {
    await rm(temporaryPath, { force: true });
    throw new WallpaperLibraryError('The wallpaper library could not be updated.');
  }
}
