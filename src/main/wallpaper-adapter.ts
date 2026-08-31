import path from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  runCapturedProcess,
  type CapturedProcessOptions,
  type CapturedProcessResult,
} from './codex-process';

const APPLY_TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 64 * 1024;
const DESKTOP_SESSION_ENVIRONMENT_KEYS = [
  'DBUS_SESSION_BUS_ADDRESS',
  'DISPLAY',
  'WAYLAND_DISPLAY',
  'XDG_RUNTIME_DIR',
] as const;

export type WallpaperProcessRunner = (
  options: CapturedProcessOptions,
) => Promise<CapturedProcessResult>;

export interface WallpaperAdapter {
  apply(imagePath: string): Promise<void>;
  /** Apply a Wallloop live bundle, with a native fallback if unavailable. */
  applyLiveBundle?(bundlePath: string, fallbackImagePath: string): Promise<void>;
}

export interface WallpaperAdapterOptions {
  readonly platform?: NodeJS.Platform;
  readonly environment?: NodeJS.ProcessEnv;
  readonly runProcess?: WallpaperProcessRunner;
  readonly macOsHelperPath?: string;
  /** Override the local wallloopctl executable for Linux/Cinnamon. */
  readonly wallloopCommand?: string;
  /** Override the Wallloop socket passed to wallloopctl. */
  readonly wallloopSocket?: string;
  /** Enable the optional Wallloop path; defaults on only for real processes. */
  readonly enableWallloop?: boolean;
}

export interface WallpaperAdapterErrorDetails {
  readonly domain: string;
  readonly code: number;
  readonly description: string;
  readonly failureReason?: string;
  readonly displayIndex?: number;
  readonly displayName?: string;
  readonly completedDisplayCount: number;
  readonly totalDisplayCount: number;
}

export class WallpaperAdapterError extends Error {
  constructor(
    message: string,
    readonly details?: WallpaperAdapterErrorDetails,
  ) {
    super(message);
    this.name = 'WallpaperAdapterError';
  }
}

export class WallloopUnavailableError extends WallpaperAdapterError {
  constructor(message = 'Wallloop is unavailable.') {
    super(message);
    this.name = 'WallloopUnavailableError';
  }
}

export class WallloopTransactionError extends WallpaperAdapterError {
  constructor(message: string) {
    super(message);
    this.name = 'WallloopTransactionError';
  }
}

export function createWallpaperAdapter(
  options: WallpaperAdapterOptions = {},
): WallpaperAdapter {
  const platform = options.platform ?? process.platform;
  const runProcess = options.runProcess ?? runCapturedProcess;

  switch (platform) {
    case 'linux':
      {
        const native = new LinuxWallpaperAdapter(
          options.environment ?? process.env,
          runProcess,
        );
        const environment = options.environment ?? process.env;
        const desktop = [
          environment.XDG_CURRENT_DESKTOP,
          environment.DESKTOP_SESSION,
        ]
          .filter(Boolean)
          .join(':')
          .toLowerCase();
        // Tests inject a process runner to record native commands. Keep that
        // fixture path deterministic; production uses the optional adapter by
        // default and may still opt out with enableWallloop: false.
        const enableWallloop =
          options.enableWallloop ?? options.runProcess === undefined;
        if (!enableWallloop || !desktop.includes('cinnamon')) {
          return native;
        }
        return new WallloopWallpaperAdapter(
          native,
          new WallloopWallpaperClient({
            command:
              options.wallloopCommand ?? environment.WALLLOOPCTL ?? 'wallloopctl',
            socket: options.wallloopSocket ?? environment.WALLLOOP_SOCKET,
            runProcess,
          }),
        );
      }
    case 'darwin':
      return new MacOsWallpaperAdapter(
        options.macOsHelperPath ?? 'InfiniteWallWallpaperHelper',
        runProcess,
      );
    case 'win32':
      return new WindowsWallpaperAdapter(runProcess);
    default:
      return new UnsupportedWallpaperAdapter();
  }
}

class LinuxWallpaperAdapter implements WallpaperAdapter {
  readonly #environment: NodeJS.ProcessEnv;
  readonly #runProcess: WallpaperProcessRunner;

  constructor(
    environment: NodeJS.ProcessEnv,
    runProcess: WallpaperProcessRunner,
  ) {
    this.#environment = environment;
    this.#runProcess = runProcess;
  }

  async apply(imagePath: string): Promise<void> {
    assertAbsoluteImagePath(imagePath, path.posix);
    const desktop = [
      this.#environment.XDG_CURRENT_DESKTOP,
      this.#environment.DESKTOP_SESSION,
    ]
      .filter(Boolean)
      .join(':')
      .toLowerCase();
    const imageUrl = pathToFileURL(imagePath, { windows: false }).href;
    const environmentOverrides = desktopSessionEnvironment(this.#environment);

    if (desktop.includes('cinnamon')) {
      await runChecked(
        this.#runProcess,
        'gsettings',
        [
          'set',
          'org.cinnamon.desktop.background',
          'picture-uri',
          imageUrl,
        ],
        environmentOverrides,
      );
      return;
    }
    if (desktop.includes('gnome')) {
      await runChecked(
        this.#runProcess,
        'gsettings',
        [
          'set',
          'org.gnome.desktop.background',
          'picture-uri',
          imageUrl,
        ],
        environmentOverrides,
      );
      if (
        await gSettingsKeyExists(
          this.#runProcess,
          'org.gnome.desktop.background',
          'picture-uri-dark',
          environmentOverrides,
        )
      ) {
        await runChecked(
          this.#runProcess,
          'gsettings',
          [
            'set',
            'org.gnome.desktop.background',
            'picture-uri-dark',
            imageUrl,
          ],
          environmentOverrides,
        );
      }
      return;
    }
    throw new WallpaperAdapterError(
      'Wallpaper application currently supports Cinnamon and GNOME on Linux.',
    );
  }
}

/**
 * Linux/Cinnamon composition that keeps Wallloop's renderer independent from
 * Electron.  Every operation is a bounded, short-lived wallloopctl process.
 */
export class WallloopWallpaperAdapter implements WallpaperAdapter {
  readonly #native: WallpaperAdapter;
  readonly #wallloop: WallloopWallpaperClient;

  constructor(native: WallpaperAdapter, wallloop: WallloopWallpaperClient) {
    this.#native = native;
    this.#wallloop = wallloop;
  }

  async apply(imagePath: string): Promise<void> {
    try {
      await this.#wallloop.applyFile(imagePath);
    } catch (error) {
      if (error instanceof WallloopUnavailableError) {
        await this.#native.apply(imagePath);
        return;
      }
      throw error;
    }
  }

  async applyLiveBundle(
    bundlePath: string,
    fallbackImagePath: string,
  ): Promise<void> {
    try {
      await this.#wallloop.applyBundle(bundlePath);
    } catch (error) {
      if (error instanceof WallloopUnavailableError) {
        await this.#native.apply(fallbackImagePath);
        return;
      }
      throw error;
    }
  }
}

class WallloopWallpaperClient {
  readonly #command: string;
  readonly #socket: string | undefined;
  readonly #runProcess: WallpaperProcessRunner;

  constructor(options: {
    readonly command: string;
    readonly socket?: string;
    readonly runProcess: WallpaperProcessRunner;
  }) {
    this.#command = options.command;
    this.#socket = options.socket;
    this.#runProcess = options.runProcess;
  }

  async suspendGeneration(): Promise<number> {
    const result = await this.#invoke(
      ['suspend', '--reason', 'generation', '--release-resources'],
      'generation suspension',
    );
    const token = result.token;
    if (
      typeof token !== 'number' ||
      !Number.isSafeInteger(token) ||
      token <= 0 ||
      result.reason !== 'generation' ||
      result.releaseResources !== true
    ) {
      throw new WallloopTransactionError(
        'Wallloop returned an invalid generation lease response.',
      );
    }
    return token;
  }

  async releaseGeneration(token: number): Promise<void> {
    if (!Number.isSafeInteger(token) || token <= 0) {
      throw new WallloopTransactionError(
        'Wallloop generation lease token is invalid.',
      );
    }
    const result = await this.#invoke(
      ['resume', '--token', String(token)],
      'generation lease release',
    );
    if (result.released !== true) {
      throw new WallloopTransactionError(
        'Wallloop did not release the generation lease token.',
      );
    }
  }

  async applyFile(imagePath: string): Promise<void> {
    assertAbsoluteImagePath(imagePath, path.posix);
    const result = await this.#invoke(
      ['apply-file', imagePath],
      'static wallpaper apply',
    );
    assertWallloopRuntimeResponse(result, 'static wallpaper apply');
  }

  async applyBundle(bundlePath: string): Promise<void> {
    assertAbsoluteImagePath(bundlePath, path.posix);
    const imported = await this.#invoke(
      ['import', bundlePath],
      'live bundle import',
    );
    if (typeof imported.id !== 'string' || imported.id.length === 0) {
      throw new WallloopTransactionError(
        'Wallloop returned an invalid live bundle import response.',
      );
    }
    const result = await this.#invoke(
      ['apply', imported.id],
      'live bundle apply',
    );
    assertWallloopRuntimeResponse(result, 'live bundle apply');
  }

  async #invoke(
    arguments_: readonly string[],
    operation: string,
  ): Promise<Record<string, unknown>> {
    const args = [
      ...(this.#socket ? ['--socket', this.#socket] : []),
      '--json',
      ...arguments_,
    ];
    const result = await this.#runProcess({
      command: this.#command,
      args,
      timeoutMs: APPLY_TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });
    if (
      result.spawnError?.code === 'ENOENT' ||
      (result.exitCode !== 0 &&
        looksLikeWallloopUnavailable(`${result.stderr}\n${result.stdout}`))
    ) {
      throw new WallloopUnavailableError(
        `Wallloop is unavailable during ${operation}.`,
      );
    }
    if (
      result.exitCode !== 0 ||
      result.spawnError ||
      result.timedOut ||
      result.aborted ||
      result.overflowed
    ) {
      throw new WallloopTransactionError(
        `Wallloop ${operation} failed${lastOutputLine(result.stderr || result.stdout) ? `: ${lastOutputLine(result.stderr || result.stdout)}` : '.'}`,
      );
    }
    let payload: unknown;
    try {
      payload = JSON.parse(result.stdout);
    } catch {
      throw new WallloopTransactionError(
        `Wallloop returned malformed JSON for ${operation}.`,
      );
    }
    if (!isObject(payload)) {
      throw new WallloopTransactionError(
        `Wallloop returned a non-object response for ${operation}.`,
      );
    }
    return payload;
  }
}

function assertWallloopRuntimeResponse(
  value: Record<string, unknown>,
  operation: string,
): void {
  if (!isObject(value.runtime)) {
    throw new WallloopTransactionError(
      `Wallloop returned an invalid response for ${operation}.`,
    );
  }
}

function looksLikeWallloopUnavailable(output: string): boolean {
  const normalized = output.toLowerCase();
  return [
    'connection refused',
    'no such file or directory',
    'cannot connect',
    'failed to connect',
    'could not connect',
    'wallloop.sock',
    'command not found',
    'executable file not found',
  ].some((marker) => normalized.includes(marker));
}

function lastOutputLine(output: string): string {
  return output
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .at(-1)
    ?.slice(0, 500) ?? '';
}

class MacOsWallpaperAdapter implements WallpaperAdapter {
  readonly #helperPath: string;
  readonly #runProcess: WallpaperProcessRunner;

  constructor(
    helperPath: string,
    runProcess: WallpaperProcessRunner,
  ) {
    this.#helperPath = helperPath;
    this.#runProcess = runProcess;
  }

  async apply(imagePath: string): Promise<void> {
    assertAbsoluteImagePath(imagePath, path.posix);
    const result = await this.#runProcess({
      command: this.#helperPath,
      args: [imagePath],
      timeoutMs: APPLY_TIMEOUT_MS,
      maxOutputBytes: MAX_OUTPUT_BYTES,
    });
    if (
      result.exitCode !== 0 ||
      result.spawnError ||
      result.timedOut ||
      result.aborted ||
      result.overflowed
    ) {
      const details = parseMacOsHelperFailure(result.stderr);
      throw new WallpaperAdapterError(
        details
          ? macOsHelperErrorMessage(details)
          : 'macOS could not apply this wallpaper.',
        details,
      );
    }
    if (!isMacOsHelperSuccess(result.stdout)) {
      throw new WallpaperAdapterError(
        'The macOS wallpaper helper returned an invalid response.',
      );
    }
  }
}

class WindowsWallpaperAdapter implements WallpaperAdapter {
  readonly #runProcess: WallpaperProcessRunner;

  constructor(runProcess: WallpaperProcessRunner) {
    this.#runProcess = runProcess;
  }

  async apply(imagePath: string): Promise<void> {
    assertAbsoluteImagePath(imagePath, path.win32);
    await runChecked(
      this.#runProcess,
      'powershell.exe',
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        WINDOWS_APPLY_SCRIPT,
      ],
      { INFINITE_WALL_IMAGE_PATH: imagePath },
    );
  }
}

class UnsupportedWallpaperAdapter implements WallpaperAdapter {
  async apply(): Promise<void> {
    throw new WallpaperAdapterError(
      'Wallpaper application is not supported on this operating system.',
    );
  }
}

const WINDOWS_APPLY_SCRIPT = [
  "$ErrorActionPreference = 'Stop'",
  '$imagePath = $env:INFINITE_WALL_IMAGE_PATH',
  "if ([string]::IsNullOrEmpty($imagePath)) { throw 'Missing wallpaper path' }",
  "Set-ItemProperty -Path 'HKCU:\\Control Panel\\Desktop' -Name Wallpaper -Value $imagePath -ErrorAction Stop",
  "Add-Type -TypeDefinition 'using System.Runtime.InteropServices; public static class NativeWallpaper { [DllImport(\"user32.dll\", CharSet=CharSet.Unicode)] public static extern bool SystemParametersInfo(int action, int parameter, string value, int flags); }'",
  "if (-not [NativeWallpaper]::SystemParametersInfo(20, 0, $imagePath, 3)) { throw 'SystemParametersInfo failed' }",
].join('; ');

function assertAbsoluteImagePath(
  imagePath: string,
  pathApi: { isAbsolute(candidate: string): boolean },
): void {
  if (!pathApi.isAbsolute(imagePath)) {
    throw new WallpaperAdapterError('The wallpaper image path is invalid.');
  }
}

function parseMacOsHelperFailure(
  stderr: string,
): WallpaperAdapterErrorDetails | undefined {
  const line = stderr
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) {
    return undefined;
  }
  try {
    const value: unknown = JSON.parse(line);
    if (!isObject(value) || value.ok !== false) {
      return undefined;
    }
    if (
      typeof value.domain !== 'string' ||
      typeof value.code !== 'number' ||
      typeof value.description !== 'string' ||
      typeof value.completedDisplayCount !== 'number' ||
      typeof value.totalDisplayCount !== 'number'
    ) {
      return undefined;
    }
    return {
      domain: cleanHelperText(value.domain),
      code: value.code,
      description: cleanHelperText(value.description),
      ...(typeof value.failureReason === 'string'
        ? { failureReason: cleanHelperText(value.failureReason) }
        : {}),
      ...(typeof value.displayIndex === 'number'
        ? { displayIndex: value.displayIndex }
        : {}),
      ...(typeof value.displayName === 'string'
        ? { displayName: cleanHelperText(value.displayName) }
        : {}),
      completedDisplayCount: value.completedDisplayCount,
      totalDisplayCount: value.totalDisplayCount,
    };
  } catch {
    return undefined;
  }
}

function isMacOsHelperSuccess(stdout: string): boolean {
  const line = stdout
    .split(/\r?\n/)
    .map((candidate) => candidate.trim())
    .filter(Boolean)
    .at(-1);
  if (!line) {
    return false;
  }
  try {
    const value: unknown = JSON.parse(line);
    return (
      isObject(value) &&
      value.ok === true &&
      typeof value.displayCount === 'number' &&
      Number.isInteger(value.displayCount) &&
      value.displayCount > 0
    );
  } catch {
    return false;
  }
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function cleanHelperText(value: string): string {
  return Array.from(value, (character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || code === 127 ? ' ' : character;
  }).join('').trim().slice(0, 500);
}

function macOsHelperErrorMessage(
  details: WallpaperAdapterErrorDetails,
): string {
  const display = details.displayName
    ? ` on ${details.displayName}`
    : details.displayIndex
      ? ` on display ${details.displayIndex}`
      : '';
  return `macOS could not apply this wallpaper${display}: ${details.description} (${details.domain} ${details.code}).`;
}

async function runChecked(
  runProcess: WallpaperProcessRunner,
  command: string,
  args: readonly string[],
  environmentOverrides?: Readonly<NodeJS.ProcessEnv>,
): Promise<void> {
  const result = await runProcess({
    command,
    args,
    timeoutMs: APPLY_TIMEOUT_MS,
    maxOutputBytes: MAX_OUTPUT_BYTES,
    ...(environmentOverrides ? { environmentOverrides } : {}),
  });
  if (
    result.exitCode !== 0 ||
    result.spawnError ||
    result.timedOut ||
    result.aborted ||
    result.overflowed
  ) {
    throw new WallpaperAdapterError(
      'The operating system could not apply this wallpaper.',
    );
  }
}

async function gSettingsKeyExists(
  runProcess: WallpaperProcessRunner,
  schema: string,
  key: string,
  environmentOverrides: Readonly<NodeJS.ProcessEnv>,
): Promise<boolean> {
  const result = await runProcess({
    command: 'gsettings',
    args: ['range', schema, key],
    timeoutMs: APPLY_TIMEOUT_MS,
    maxOutputBytes: MAX_OUTPUT_BYTES,
    environmentOverrides,
  });
  if (
    result.spawnError ||
    result.timedOut ||
    result.aborted ||
    result.overflowed
  ) {
    throw new WallpaperAdapterError(
      'The operating system could not apply this wallpaper.',
    );
  }
  return result.exitCode === 0;
}

function desktopSessionEnvironment(
  source: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  const environment: NodeJS.ProcessEnv = {};
  for (const key of DESKTOP_SESSION_ENVIRONMENT_KEYS) {
    const value = source[key];
    if (value !== undefined) {
      environment[key] = value;
    }
  }
  return environment;
}
