import { chmod, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { resolveCodexCommand } from './codex-command';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('resolveCodexCommand', () => {
  it('honors an explicit absolute path for desktop-session configuration', async () => {
    await expect(
      resolveCodexCommand({
        environment: {
          INFINITE_WALL_CODEX_PATH: '/opt/infinite-wall/codex',
          PATH: '',
        },
        platform: 'linux',
      }),
    ).resolves.toBe('/opt/infinite-wall/codex');
  });

  it('finds Codex installed by nvm even when the GUI PATH omits it', async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-home-'));
    temporaryRoots.push(home);
    const executable = path.join(
      home,
      '.nvm',
      'versions',
      'node',
      'v24.5.0',
      'bin',
      'codex',
    );
    await mkdir(path.dirname(executable), { recursive: true });
    await writeFile(executable, '#!/bin/sh\n');
    await chmod(executable, 0o700);

    await expect(
      resolveCodexCommand({ environment: { HOME: home, PATH: '' }, platform: 'linux' }),
    ).resolves.toBe(executable);
  });

  it('finds Codex installed by fnm even when the GUI PATH omits it', async () => {
    const home = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-home-'));
    temporaryRoots.push(home);
    const dataHome = path.join(home, '.local', 'share');
    const executable = path.join(
      dataHome,
      'fnm',
      'node-versions',
      'v24.11.1',
      'installation',
      'bin',
      'codex',
    );
    await mkdir(path.dirname(executable), { recursive: true });
    await writeFile(executable, '#!/usr/bin/env node\n');
    await chmod(executable, 0o700);

    await expect(
      resolveCodexCommand({
        environment: { HOME: home, XDG_DATA_HOME: dataHome, PATH: '' },
        platform: 'linux',
      }),
    ).resolves.toBe(executable);
  });
});
