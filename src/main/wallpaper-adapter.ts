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
}

export interface WallpaperAdapterOptions {
  readonly platform?: NodeJS.Platform;
  readonly environment?: NodeJS.ProcessEnv;
  readonly runProcess?: WallpaperProcessRunner;
  readonly macOsHelperPath?: string;
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

export function createWallpaperAdapter(
  options: WallpaperAdapterOptions = {},
): WallpaperAdapter {
  const platform = options.platform ?? process.platform;
  const runProcess = options.runProcess ?? runCapturedProcess;

  switch (platform) {
    case 'linux':
      return new LinuxWallpaperAdapter(
        options.environment ?? process.env,
        runProcess,
      );
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
