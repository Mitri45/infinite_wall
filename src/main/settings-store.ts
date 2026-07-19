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

export class SettingsStore {
  readonly #root: string;
  readonly #settingsPath: string;
  #cached: AppSettings | null = null;
  #mutationTail: Promise<void> = Promise.resolve();

  constructor(root: string) {
    this.#root = path.resolve(root);
    this.#settingsPath = path.join(this.#root, SETTINGS_FILENAME);
  }

  async load(): Promise<AppSettings> {
    if (this.#cached) {
      return this.#cached;
    }
    const text = await readFile(this.#settingsPath, 'utf8').catch(() => null);
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
