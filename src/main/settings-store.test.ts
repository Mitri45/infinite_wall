import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { SettingsStore } from './settings-store';

const roots: string[] = [];
afterEach(async () => Promise.all(roots.splice(0).map((root) => rm(root, { recursive: true, force: true }))));

describe('SettingsStore', () => {
  it('loads defaults and atomically persists validated updates', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-settings-'));
    roots.push(root);
    const store = new SettingsStore(root);
    await expect(store.load()).resolves.toMatchObject({ scheduleHours: null, quality: 'standard' });
    await store.update({ scheduleHours: 3 });
    await store.update({ launchAtLogin: true });
    const persisted = JSON.parse(await readFile(path.join(root, 'settings.json'), 'utf8'));
    expect(persisted).toMatchObject({ scheduleHours: 3, launchAtLogin: true });
  });

  it('falls back from malformed data and rejects unknown keys', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-settings-'));
    roots.push(root);
    await writeFile(path.join(root, 'settings.json'), '{broken');
    const store = new SettingsStore(root);
    await expect(store.load()).resolves.toMatchObject({ scheduleHours: null });
    await expect(store.update({ secret: true } as never)).rejects.toThrow();
  });

  it('propagates settings read failures other than a missing file', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-settings-'));
    roots.push(root);
    const failure = Object.assign(new Error('permission denied'), { code: 'EACCES' });
    const store = new SettingsStore(root, {
      readText: async () => { throw failure; },
    });

    await expect(store.load()).rejects.toBe(failure);
  });
});
