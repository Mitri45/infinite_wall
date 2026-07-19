import path from 'node:path';

import { describe, expect, it } from 'vitest';

import { runCapturedProcess } from './codex-process';

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
});
