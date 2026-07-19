import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it, vi } from 'vitest';

import { LaunchAtLoginController } from './launch-at-login';

const roots: string[] = [];

afterEach(async () => {
  await Promise.all(
    roots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('LaunchAtLoginController', () => {
  it('writes and removes a private Linux autostart entry', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-login-'));
    roots.push(root);
    const setNativeLoginItem = vi.fn();
    const controller = new LaunchAtLoginController({
      platform: 'linux',
      configRoot: root,
      executablePath: '/opt/Infinite Wall/infinite-wall',
      setNativeLoginItem,
    });
    const entryPath = path.join(root, 'autostart', 'infinite-wall.desktop');

    await controller.setEnabled(true);

    expect(await readFile(entryPath, 'utf8')).toContain(
      'Exec="/opt/Infinite Wall/infinite-wall"',
    );
    expect((await stat(entryPath)).mode & 0o777).toBe(0o600);
    expect(setNativeLoginItem).not.toHaveBeenCalled();

    await controller.setEnabled(false);
    await expect(stat(entryPath)).rejects.toThrow();
  });

  it('uses Electron login items on macOS and Windows', async () => {
    const setNativeLoginItem = vi.fn();
    const controller = new LaunchAtLoginController({
      platform: 'darwin',
      configRoot: '/unused',
      executablePath: '/Applications/Infinite Wall.app',
      setNativeLoginItem,
    });

    await controller.setEnabled(true);

    expect(setNativeLoginItem).toHaveBeenCalledWith(true);
  });
});
