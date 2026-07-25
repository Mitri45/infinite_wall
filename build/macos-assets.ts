import { execFile } from 'node:child_process';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);

export const MACOS_BUILD_ROOT = path.resolve('.build/macos');
export const MACOS_HELPER_OUTPUT = path.join(
  MACOS_BUILD_ROOT,
  'InfiniteWallWallpaperHelper',
);
export const MACOS_ICON_OUTPUT = path.join(MACOS_BUILD_ROOT, 'icon.icns');

const MACOS_DEPLOYMENT_TARGET = '12.0';

export async function buildMacOsAssets(arch: string): Promise<void> {
  const targetArch = macOsTargetArch(arch);
  const iconsetPath = path.join(MACOS_BUILD_ROOT, 'InfiniteWall.iconset');

  await rm(MACOS_BUILD_ROOT, { recursive: true, force: true });
  await mkdir(MACOS_BUILD_ROOT, { recursive: true });

  await runXcrun([
    'swiftc',
    '-parse-as-library',
    '-O',
    '-target',
    `${targetArch}-apple-macos${MACOS_DEPLOYMENT_TARGET}`,
    '-framework',
    'AppKit',
    path.resolve('native/macos/WallpaperHelper.swift'),
    '-o',
    MACOS_HELPER_OUTPUT,
  ]);
  await runXcrun([
    'swift',
    path.resolve('native/macos/IconGenerator.swift'),
    path.resolve('assets/icon.svg'),
    path.resolve('assets/icon.png'),
    iconsetPath,
  ]);
  await runXcrun([
    'iconutil',
    '--convert',
    'icns',
    '--output',
    MACOS_ICON_OUTPUT,
    iconsetPath,
  ]);
}

function macOsTargetArch(arch: string): 'arm64' | 'x86_64' {
  switch (arch) {
    case 'arm64':
      return 'arm64';
    case 'x64':
      return 'x86_64';
    default:
      throw new Error(`Unsupported macOS build architecture: ${arch}`);
  }
}

async function runXcrun(args: readonly string[]): Promise<void> {
  await execFileAsync('xcrun', [...args], {
    maxBuffer: 4 * 1024 * 1024,
  });
}
