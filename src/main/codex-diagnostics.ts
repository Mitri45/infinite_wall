import type { CodexDiagnostics } from '../shared/contracts';
import { runCapturedProcess } from './codex-process';

interface CodexDiagnosticsOptions {
  readonly command?: string;
  readonly commandArgsPrefix?: readonly string[];
  readonly timeoutMs?: number;
}

export class CodexDiagnosticsService {
  readonly #command: string;
  readonly #commandArgsPrefix: readonly string[];
  readonly #timeoutMs: number;

  constructor(options: CodexDiagnosticsOptions = {}) {
    this.#command = options.command ?? 'codex';
    this.#commandArgsPrefix = options.commandArgsPrefix ?? [];
    this.#timeoutMs = options.timeoutMs ?? 5_000;
  }

  async check(): Promise<CodexDiagnostics> {
    const versionResult = await runCapturedProcess({
      command: this.#command,
      args: [...this.#commandArgsPrefix, '--version'],
      timeoutMs: this.#timeoutMs,
    });

    if (versionResult.spawnError?.code === 'ENOENT') {
      return {
        installed: false,
        authenticated: false,
        version: null,
        authMethod: null,
        issue: 'not-installed',
        message: 'Install the Codex CLI to generate wallpapers.',
      };
    }

    if (
      versionResult.spawnError ||
      versionResult.timedOut ||
      versionResult.exitCode !== 0
    ) {
      return {
        installed: false,
        authenticated: false,
        version: null,
        authMethod: null,
        issue: 'check-failed',
        message: 'Infinite Wall could not verify the Codex CLI installation.',
      };
    }

    const version = parseVersion(versionResult.stdout || versionResult.stderr);
    const loginResult = await runCapturedProcess({
      command: this.#command,
      args: [...this.#commandArgsPrefix, 'login', 'status'],
      timeoutMs: this.#timeoutMs,
    });
    const loginOutput = `${loginResult.stdout}\n${loginResult.stderr}`;

    if (
      loginResult.spawnError ||
      loginResult.timedOut ||
      loginResult.exitCode !== 0
    ) {
      return {
        installed: true,
        authenticated: false,
        version,
        authMethod: null,
        issue: 'not-authenticated',
        message: 'Sign in with Codex before generating a wallpaper.',
      };
    }

    return {
      installed: true,
      authenticated: true,
      version,
      authMethod: parseAuthMethod(loginOutput),
      issue: null,
      message: 'Codex is installed and ready.',
    };
  }
}

function parseVersion(output: string): string | null {
  const match = output.match(/codex(?:-cli)?\s+([^\s]+)/i);
  return match?.[1] ?? null;
}

function parseAuthMethod(
  output: string,
): CodexDiagnostics['authMethod'] {
  const normalized = output.toLocaleLowerCase();
  if (normalized.includes('chatgpt')) {
    return 'chatgpt';
  }
  if (normalized.includes('access token')) {
    return 'access-token';
  }
  if (normalized.includes('api key')) {
    return 'api-key';
  }
  return 'unknown';
}
