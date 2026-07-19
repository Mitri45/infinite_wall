import { describe, expect, it } from 'vitest';

import type { CodexDiagnostics } from '../shared/contracts';
import { GenerationJobError } from './generation-job-runner';
import { assertCodexReadyForGeneration } from './codex-readiness';

const readyDiagnostics: CodexDiagnostics = {
  installed: true,
  authenticated: true,
  version: '0.144.6',
  authMethod: 'chatgpt',
  issue: null,
  message: 'Codex is installed and ready.',
};

describe('assertCodexReadyForGeneration', () => {
  it('accepts authenticated diagnostics', () => {
    expect(() => assertCodexReadyForGeneration(readyDiagnostics)).not.toThrow();
  });

  it.each([
    ['not-installed', 'not-installed'],
    ['not-authenticated', 'not-authenticated'],
  ] as const)('preserves the %s diagnostic code', (issue, code) => {
    expect(() =>
      assertCodexReadyForGeneration({
        ...readyDiagnostics,
        installed: issue !== 'not-installed',
        authenticated: false,
        issue,
        message: `Codex readiness failed: ${issue}.`,
      }),
    ).toThrow(
      expect.objectContaining<Partial<GenerationJobError>>({
        code,
        retryable: false,
      }),
    );
  });

  it('keeps transient diagnostics failures retryable', () => {
    expect(() =>
      assertCodexReadyForGeneration({
        ...readyDiagnostics,
        authenticated: false,
        issue: 'check-failed',
        message: 'Infinite Wall could not verify Codex.',
      }),
    ).toThrow(
      expect.objectContaining<Partial<GenerationJobError>>({
        code: 'process-failed',
        retryable: true,
      }),
    );
  });
});
