import { chmod, mkdtemp, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import {
  createSanitizedEnvironment,
  requiresShell,
  runCapturedProcess,
} from './codex-process';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('runCapturedProcess', () => {
  it('does not spawn a child for a signal that is already aborted', async () => {
    const controller = new AbortController();
    controller.abort();

    const result = await runCapturedProcess({
      command: path.join(path.sep, 'definitely-missing', 'codex'),
      args: [],
      timeoutMs: 100,
      signal: controller.signal,
    });

    expect(result).toMatchObject({
      aborted: true,
      spawnError: null,
      exitCode: null,
    });
  });

  it('prepends an absolute discovered command directory to the child PATH', () => {
    const environment = createSanitizedEnvironment(
      { PATH: '/usr/bin' },
      '/home/test/.nvm/versions/node/v24.5.0/bin/codex',
      'linux',
    );

    expect(environment.PATH).toBe(
      '/home/test/.nvm/versions/node/v24.5.0/bin:/usr/bin',
    );
  });

  it('runs an env-node launcher found outside the desktop PATH', async () => {
    const binDirectory = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-bin-'));
    temporaryRoots.push(binDirectory);
    const command = path.join(binDirectory, 'codex');
    await writeFile(
      command,
      '#!/usr/bin/env node\nprocess.stdout.write("ready\\n");\n',
    );
    await chmod(command, 0o700);
    await symlink(process.execPath, path.join(binDirectory, 'node'));

    await expect(
      runCapturedProcess({ command, args: [], timeoutMs: 1_000 }),
    ).resolves.toMatchObject({ exitCode: 0, stdout: 'ready\n' });
  });

  it('uses a shell only for Windows command shims', () => {
    expect(requiresShell('C:\\Users\\test\\codex.cmd', 'win32')).toBe(true);
    expect(requiresShell('C:\\Users\\test\\codex.exe', 'win32')).toBe(false);
    expect(requiresShell('/usr/local/bin/codex.cmd', 'linux')).toBe(false);
  });
});
