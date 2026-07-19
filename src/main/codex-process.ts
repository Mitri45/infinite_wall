import { spawn } from 'node:child_process';
import { StringDecoder } from 'node:string_decoder';
import path from 'node:path';

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
  readonly stdin?: string;
  readonly cwd?: string;
  readonly timeoutMs: number;
  readonly signal?: AbortSignal;
  readonly maxOutputBytes?: number;
  readonly onStdoutLine?: (line: string) => void;
  readonly environmentOverrides?: Readonly<NodeJS.ProcessEnv>;
}

export function createSanitizedEnvironment(
  source: NodeJS.ProcessEnv = process.env,
  command?: string,
  platform: NodeJS.Platform = process.platform,
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

  const pathApi = platform === 'win32' ? path.win32 : path.posix;
  if (command && pathApi.isAbsolute(command)) {
    const commandDirectory = pathApi.dirname(command);
    environment.PATH = [commandDirectory, environment.PATH]
      .filter((value): value is string => Boolean(value))
      .join(pathApi.delimiter);
  }

  return environment;
}

export function requiresShell(
  command: string,
  platform: NodeJS.Platform = process.platform,
): boolean {
  return platform === 'win32' && /\.(?:bat|cmd)$/i.test(command);
}

export function runCapturedProcess(
  options: CapturedProcessOptions,
): Promise<CapturedProcessResult> {
  const maxOutputBytes = options.maxOutputBytes ?? DEFAULT_OUTPUT_LIMIT;

  if (options.signal?.aborted) {
    return Promise.resolve({
      exitCode: null,
      signal: null,
      stdout: '',
      stderr: '',
      timedOut: false,
      aborted: true,
      overflowed: false,
      spawnError: null,
    });
  }

  return new Promise((resolve) => {
    const stdoutChunks: Buffer[] = [];
    const stderrChunks: Buffer[] = [];
    let outputBytes = 0;
    let timedOut = false;
    let aborted = options.signal?.aborted ?? false;
    let overflowed = false;
    let settled = false;
    let forceKillTimer: NodeJS.Timeout | undefined;
    const stdoutDecoder = new StringDecoder('utf8');
    let stdoutLineBuffer = '';

    const environment = createSanitizedEnvironment(process.env, options.command);
    for (const [key, value] of Object.entries(
      options.environmentOverrides ?? {},
    )) {
      if (value !== undefined) {
        environment[key] = value;
      }
    }
    const shell = requiresShell(options.command)
      ? environment.COMSPEC ?? true
      : false;
    const child = spawn(options.command, [...options.args], {
      cwd: options.cwd,
      env: environment,
      shell,
      stdio: [options.stdin === undefined ? 'ignore' : 'pipe', 'pipe', 'pipe'],
      windowsHide: true,
    });

    if (child.stdin) {
      child.stdin.on('error', () => {
        // A child that exits early can close stdin before the prompt is flushed.
      });
      child.stdin.end(options.stdin, 'utf8');
    }

    const stopChild = () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        return;
      }

      child.kill('SIGTERM');
      forceKillTimer = setTimeout(() => child.kill('SIGKILL'), FORCE_KILL_DELAY_MS);
      forceKillTimer.unref();
    };

    const appendChunk = (target: Buffer[], chunk: Buffer): boolean => {
      outputBytes += chunk.byteLength;
      if (outputBytes > maxOutputBytes) {
        overflowed = true;
        stopChild();
        return false;
      }

      target.push(chunk);
      return true;
    };

    const emitStdoutLines = (text: string) => {
      stdoutLineBuffer += text;
      const lines = stdoutLineBuffer.split(/\r?\n/);
      stdoutLineBuffer = lines.pop() ?? '';
      for (const line of lines) {
        try {
          options.onStdoutLine?.(line);
        } catch {
          // Progress observers cannot alter the child-process lifecycle.
        }
      }
    };

    child.stdout!.on('data', (chunk: Buffer) => {
      if (appendChunk(stdoutChunks, chunk)) {
        emitStdoutLines(stdoutDecoder.write(chunk));
      }
    });
    child.stderr!.on('data', (chunk: Buffer) => appendChunk(stderrChunks, chunk));

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
      emitStdoutLines(stdoutDecoder.end());
      if (stdoutLineBuffer.length > 0) {
        try {
          options.onStdoutLine?.(stdoutLineBuffer);
        } catch {
          // Progress observers cannot alter the child-process lifecycle.
        }
        stdoutLineBuffer = '';
      }
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
