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

  it('passes macOS paths directly to the bundled native helper', async () => {
    const runProcess = vi.fn<WallpaperProcessRunner>(async () => ({
      ...SUCCESS,
      stdout: '{"ok":true,"displayCount":2}\n',
    }));
    const adapter = createWallpaperAdapter({
      platform: 'darwin',
      macOsHelperPath: '/Applications/Infinite Wall.app/Contents/Resources/InfiniteWallWallpaperHelper',
      runProcess,
    });
    const imagePath = '/Users/alice/Pictures/wall;$(unsafe).png';

    await adapter.apply(imagePath);

    expect(runProcess).toHaveBeenCalledWith({
      command: '/Applications/Infinite Wall.app/Contents/Resources/InfiniteWallWallpaperHelper',
      args: [imagePath],
      timeoutMs: 15_000,
      maxOutputBytes: 65_536,
    });
  });

  it('preserves structured NSError details from the macOS helper', async () => {
    const runProcess = vi.fn<WallpaperProcessRunner>(async () => ({
      ...SUCCESS,
      exitCode: 1,
      stderr: JSON.stringify({
        ok: false,
        domain: 'NSCocoaErrorDomain',
        code: 513,
        description: 'You do not have permission to save the file.',
        failureReason: 'The file is locked.',
        displayIndex: 2,
        displayName: 'Studio Display',
        completedDisplayCount: 1,
        totalDisplayCount: 2,
      }),
    }));
    const adapter = createWallpaperAdapter({
      platform: 'darwin',
      macOsHelperPath: '/tmp/InfiniteWallWallpaperHelper',
      runProcess,
    });

    await expect(adapter.apply('/tmp/wallpaper.png')).rejects.toMatchObject({
      message:
        'macOS could not apply this wallpaper on Studio Display: You do not have permission to save the file. (NSCocoaErrorDomain 513).',
      details: {
        domain: 'NSCocoaErrorDomain',
        code: 513,
        failureReason: 'The file is locked.',
        displayIndex: 2,
        completedDisplayCount: 1,
        totalDisplayCount: 2,
      },
    });
  });

  it('rejects a successful macOS helper process with an invalid response', async () => {
    const runProcess = vi.fn<WallpaperProcessRunner>(async () => SUCCESS);
    const adapter = createWallpaperAdapter({
      platform: 'darwin',
      macOsHelperPath: '/tmp/InfiniteWallWallpaperHelper',
      runProcess,
    });

    await expect(adapter.apply('/tmp/wallpaper.png')).rejects.toThrow(
      'returned an invalid response',
    );
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
    expect(options.environmentOverrides).toEqual({
      INFINITE_WALL_IMAGE_PATH: imagePath,
    });
    expect(options.args.at(-1)).toContain('$imagePath = $env:INFINITE_WALL_IMAGE_PATH');
    expect(options.args.at(-1)).toContain("$ErrorActionPreference = 'Stop'");
    expect(options.args.at(-1)).toContain("throw 'SystemParametersInfo failed'");
    expect(options.args.join(' ')).not.toContain(imagePath);
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
