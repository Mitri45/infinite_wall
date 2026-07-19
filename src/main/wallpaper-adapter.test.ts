import { describe, expect, it, vi } from 'vitest';

import type { CapturedProcessResult } from './codex-process';
import {
  createWallpaperAdapter,
  WallpaperAdapterError,
  type WallpaperProcessRunner,
} from './wallpaper-adapter';

const SUCCESS: CapturedProcessResult = {
  exitCode: 0,
  signal: null,
  stdout: '',
  stderr: '',
  timedOut: false,
  aborted: false,
  overflowed: false,
  spawnError: null,
};

describe('wallpaper application adapters', () => {
  it('uses the Cinnamon gsettings fixture with a file URL argument', async () => {
    const runProcess = vi.fn<WallpaperProcessRunner>(async () => SUCCESS);
    const adapter = createWallpaperAdapter({
      platform: 'linux',
      environment: { XDG_CURRENT_DESKTOP: 'X-Cinnamon' },
      runProcess,
    });

    await adapter.apply('/tmp/Wall Paper.png');

    expect(runProcess).toHaveBeenCalledWith({
      command: 'gsettings',
      args: [
        'set',
        'org.cinnamon.desktop.background',
        'picture-uri',
        'file:///tmp/Wall%20Paper.png',
      ],
      timeoutMs: 15_000,
      maxOutputBytes: 65_536,
      environmentOverrides: {},
    });
  });

  it('updates both GNOME light and dark wallpaper settings', async () => {
    const runProcess = vi.fn<WallpaperProcessRunner>(async () => SUCCESS);
    const adapter = createWallpaperAdapter({
      platform: 'linux',
      environment: { XDG_CURRENT_DESKTOP: 'ubuntu:GNOME' },
      runProcess,
    });

    await adapter.apply('/tmp/wallpaper.png');

    expect(runProcess).toHaveBeenCalledTimes(3);
    expect(runProcess.mock.calls.map(([options]) => options.args)).toEqual([
      [
        'set',
        'org.gnome.desktop.background',
        'picture-uri',
        'file:///tmp/wallpaper.png',
      ],
      [
        'range',
        'org.gnome.desktop.background',
        'picture-uri-dark',
      ],
      [
        'set',
        'org.gnome.desktop.background',
        'picture-uri-dark',
        'file:///tmp/wallpaper.png',
      ],
    ]);
  });

  it('supports GNOME installations without a dark wallpaper key', async () => {
    const runProcess = vi.fn<WallpaperProcessRunner>(async (options) =>
      options.args[0] === 'range' ? { ...SUCCESS, exitCode: 1 } : SUCCESS,
    );
    const adapter = createWallpaperAdapter({
      platform: 'linux',
      environment: {
        XDG_CURRENT_DESKTOP: 'GNOME',
        DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus',
      },
      runProcess,
    });

    await expect(adapter.apply('/tmp/wallpaper.png')).resolves.toBeUndefined();

    expect(runProcess).toHaveBeenCalledTimes(2);
    expect(runProcess.mock.calls[0][0].environmentOverrides).toEqual({
      DBUS_SESSION_BUS_ADDRESS: 'unix:path=/run/user/1000/bus',
    });
    expect(runProcess.mock.calls.some(([options]) => options.args.includes('picture-uri-dark') && options.args[0] === 'set')).toBe(false);
  });

  it('passes macOS paths separately from the fixed AppleScript', async () => {
    const runProcess = vi.fn<WallpaperProcessRunner>(async () => SUCCESS);
    const adapter = createWallpaperAdapter({ platform: 'darwin', runProcess });
    const imagePath = '/Users/alice/Pictures/wall;$(unsafe).png';

    await adapter.apply(imagePath);

    const options = runProcess.mock.calls[0][0];
    expect(options.command).toBe('osascript');
    expect(options.args.at(-1)).toBe(imagePath);
    expect(options.args.at(-2)).toBe('--');
    expect(options.args.slice(0, -1).join(' ')).not.toContain(imagePath);
  });

  it('passes Windows paths as data to a fixed PowerShell command', async () => {
    const runProcess = vi.fn<WallpaperProcessRunner>(async () => SUCCESS);
    const adapter = createWallpaperAdapter({ platform: 'win32', runProcess });
    const imagePath = 'C:\\Users\\alice\\wall;$(unsafe).png';

    await adapter.apply(imagePath);

    const options = runProcess.mock.calls[0][0];
    expect(options.command).toBe('powershell.exe');
    expect(options.args.slice(0, 4)).toEqual([
      '-NoLogo',
      '-NoProfile',
      '-NonInteractive',
      '-Command',
    ]);
    expect(options.args.at(-1)).toBe(imagePath);
    expect(options.args.at(-2)).toContain('$imagePath = $args[0]');
    expect(options.args.at(-2)).toContain("$ErrorActionPreference = 'Stop'");
    expect(options.args.at(-2)).toContain("throw 'SystemParametersInfo failed'");
    expect(options.args.at(-2)).not.toContain(imagePath);
  });

  it('returns a safe error for unsupported desktops and command failures', async () => {
    const unsupported = createWallpaperAdapter({
      platform: 'linux',
      environment: { XDG_CURRENT_DESKTOP: 'KDE' },
    });
    await expect(unsupported.apply('/tmp/wallpaper.png')).rejects.toThrow(
      'supports Cinnamon and GNOME',
    );

    const runProcess = vi.fn<WallpaperProcessRunner>(async () => ({
      ...SUCCESS,
      exitCode: 1,
      stderr: 'private system details',
    }));
    const failing = createWallpaperAdapter({
      platform: 'linux',
      environment: { XDG_CURRENT_DESKTOP: 'GNOME' },
      runProcess,
    });
    await expect(failing.apply('/tmp/wallpaper.png')).rejects.toEqual(
      new WallpaperAdapterError(
        'The operating system could not apply this wallpaper.',
      ),
    );
  });
});
