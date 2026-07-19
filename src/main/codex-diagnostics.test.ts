import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

import { CodexDiagnosticsService } from './codex-diagnostics';

const fakeCodexPath = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../test/fixtures/fake-codex.mjs',
);

describe('CodexDiagnosticsService', () => {
  it('reports the installed version and ChatGPT authentication', async () => {
    const service = createFakeService('diagnostics-chatgpt');

    await expect(service.check()).resolves.toEqual({
      installed: true,
      authenticated: true,
      version: '9.8.7',
      authMethod: 'chatgpt',
      issue: null,
      message: 'Codex is installed and ready.',
    });
  });

  it('distinguishes an installed CLI from a signed-out CLI', async () => {
    const service = createFakeService('diagnostics-logged-out');

    await expect(service.check()).resolves.toMatchObject({
      installed: true,
      authenticated: false,
      version: '9.8.7',
      issue: 'not-authenticated',
    });
  });

  it('reports a missing executable without exposing process details', async () => {
    const service = new CodexDiagnosticsService({
      command: path.join(path.sep, 'definitely-missing', 'codex'),
      timeoutMs: 500,
    });

    await expect(service.check()).resolves.toEqual({
      installed: false,
      authenticated: false,
      version: null,
      authMethod: null,
      issue: 'not-installed',
      message: 'Install the Codex CLI to generate wallpapers.',
    });
  });

  it('requires the Codex exec capabilities used by generation', async () => {
    const service = createFakeService('diagnostics-unsupported');

    await expect(service.check()).resolves.toEqual({
      installed: true,
      authenticated: false,
      version: '9.8.7',
      authMethod: 'chatgpt',
      issue: 'unsupported-version',
      message: 'Upgrade the Codex CLI before generating a wallpaper.',
    });
  });
});

function createFakeService(scenario: string): CodexDiagnosticsService {
  return new CodexDiagnosticsService({
    command: process.execPath,
    commandArgsPrefix: [fakeCodexPath, scenario],
    timeoutMs: 2_000,
  });
}
