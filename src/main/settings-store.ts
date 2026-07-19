import { randomUUID } from 'node:crypto';
import { chmod, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  appSettingsPatchSchema,
  appSettingsSchema,
  type AppSettings,
  type AppSettingsPatch,
} from '../shared/contracts';

const SETTINGS_FILENAME = 'settings.json';

interface SettingsStoreOptions {
  readonly readText?: (filePath: string) => Promise<string>;
}

export class SettingsStore {
  readonly #root: string;
  readonly #settingsPath: string;
  readonly #readText: (filePath: string) => Promise<string>;
  #cached: AppSettings | null = null;
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(root: string, options: SettingsStoreOptions = {}) {
    this.#root = path.resolve(root);
    this.#settingsPath = path.join(this.#root, SETTINGS_FILENAME);
    this.#readText = options.readText ?? ((filePath) => readFile(filePath, 'utf8'));
  }

  async load(): Promise<AppSettings> {
    if (this.#cached) {
      return this.#cached;
    }
    let text: string | null;
    try {
      text = await this.#readText(this.#settingsPath);
    } catch (error) {
      if (isNodeError(error) && error.code === 'ENOENT') {
        text = null;
      } else {
        throw error;
      }
    }
    if (text) {
      try {
        this.#cached = appSettingsSchema.parse(JSON.parse(text));
        return this.#cached;
      } catch {
        // Invalid local settings fall back safely and are replaced on next update.
      }
    }
    this.#cached = appSettingsSchema.parse({});
    return this.#cached;
  }

  update(patch: AppSettingsPatch): Promise<AppSettings> {
    return this.#runMutation(async () => {
      const validatedPatch = appSettingsPatchSchema.parse(patch);
      const settings = appSettingsSchema.parse({
        ...(await this.load()),
        ...validatedPatch,
      });
      await mkdir(this.#root, { recursive: true, mode: 0o700 });
      await chmod(this.#root, 0o700);
      const temporaryPath = path.join(this.#root, `.settings-${randomUUID()}.tmp`);
      try {
        await writeFile(temporaryPath, `${JSON.stringify(settings, null, 2)}\n`, {
          encoding: 'utf8',
          mode: 0o600,
        });
        await rename(temporaryPath, this.#settingsPath);
      } catch (error) {
        await rm(temporaryPath, { force: true });
        throw error;
      }
      this.#cached = settings;
      return settings;
    });
  }

  #runMutation<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#mutationTail.then(operation);
    this.#mutationTail = result.then(() => undefined, () => undefined);
    return result;
  }
}

function isNodeError(error: unknown): error is NodeJS.ErrnoException {
  return error instanceof Error && 'code' in error;
}
