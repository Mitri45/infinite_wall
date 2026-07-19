import type { CodexDiagnostics } from '../shared/contracts';
import { GenerationJobError } from './generation-job-runner';

export function assertCodexReadyForGeneration(
  diagnostics: CodexDiagnostics,
): void {
  if (diagnostics.authenticated) {
    return;
  }

  switch (diagnostics.issue) {
    case 'not-installed':
      throw new GenerationJobError(
        'not-installed',
        diagnostics.message,
        false,
      );
    case 'not-authenticated':
      throw new GenerationJobError(
        'not-authenticated',
        diagnostics.message,
        false,
      );
    case 'check-failed':
      throw new GenerationJobError(
        'process-failed',
        diagnostics.message,
        true,
      );
    default:
      throw new GenerationJobError(
        'process-failed',
        diagnostics.message,
        false,
      );
  }
}
