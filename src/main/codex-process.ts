import { spawn } from 'node:child_process';

const DEFAULT_OUTPUT_LIMIT = 1024 * 1024;
const FORCE_KILL_DELAY_MS = 1_000;

const SAFE_ENVIRONMENT_KEYS = [
  'APPDATA',
  'CODEX_HOME',
  'COMSPEC',
  'HOME',
  'LANG',
  'LC_ALL',
  'LOCALAPPDATA',
  'PATH',
  'PATHEXT',
  'SYSTEMROOT',
  'TEMP',
  'TMP',
  'TMPDIR',
  'USERPROFILE',
  'WINDIR',
  'XDG_CACHE_HOME',
  'XDG_CONFIG_HOME',
] as const;

export interface CapturedProcessResult {
  readonly exitCode: number | null;
  readonly signal: NodeJS.Signals | null;
  readonly stdout: string;
  readonly stderr: string;
  readonly timedOut: boolean;
  readonly aborted: boolean;
  readonly overflowed: boolean;
  readonly spawnError: NodeJS.ErrnoException | null;
}

export interface CapturedProcessOptions {
  readonly command: string;
  readonly args: readonly string[];
  readonly cwd?: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly maxOutputBytes?: number;
}

export function createSanitizedEnvironment(
  source: NodeJS.ProcessEnv = process.env,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {
    FORCE_COLOR: '0',
    NO_COLOR: '1',
  };

  for (const key of SAFE_ENVIRONMENT_KEYS) {
    const value = source[key];
    if (value !== undefined) {
      environment[key] = value;
    }
  }

  return environment;
}

export function runCapturedProcess(
  options: CapturedProcessOptions,
): Promise<CapturedProcessResult> {
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_OUTPUT_LIMIT;

  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let outputBytes = 0;
    let timedOut = false;
    let aborted = options.signal?.aborted ?? false;
    let overflowed = false;
    let settled = false;
    let forceKillTimer: NodeJS.Timeout | undefined;

    const child = spawn(options.command, [...options.args], {
      cwd: options.cwd,
      env: createSanitizedEnvironment(),
      shell: false,
      stdio: ['ignore', 'pipe', 'pipe'],
      windowsHide: true,
    });

    const stopChild = () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }

      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), FORCE_KILL_DELAY_MS);
      forceKillTimer.unref();
    };

    const appendChunk = (target: Buffer[], chunk: Buffer) => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) {
        overflowed = true;
        stopChild();
        return;
      }

      target.push(chunk);
    };

    child.stdout.on('data', (chunk: Buffer) => appendChunk(stdoutChunks, chunk));
    child.stderr.on('data', (chunk: Buffer) => appendChunk(stderrChunks, chunk));

    const timeout = setTimeout(() => {
      timedOut = true;
      stopChild();
    }, options.timeoutMs);
    timeout.unref();

    const handleAbort = () => {
      aborted = true;
      stopChild();
    };
    options.signal?.addEventListener('abort', handleAbort, { once: true });

    const finish = (
      exitCode: number | null,
      signal: NodeJS.Signals | null,
      spawnError: NodeJS.ErrnoException | null,
    ) => {
      if (settled) {
        return;
      }

      settled = true;
      clearTimeout(timeout);
      if (forceKillTimer) {
        clearTimeout(forceKillTimer);
      }
      options.signal?.removeEventListener('abort', handleAbort);
      resolve({
        exitCode,
        signal,
        stdout: Buffer.concat(stdoutChunks).toString('utf8'),
        stderr: Buffer.concat(stderrChunks).toString('utf8'),
        timedOut,
        aborted,
        overflowed,
        spawnError,
      });
    };

    child.once('error', (error: NodeJS.ErrnoException) => {
      finish(null, null, error);
    });
    child.once('close', (exitCode, signal) => {
      finish(exitCode, signal, null);
    });
  });
}
