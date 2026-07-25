import type { ForgeConfig } from '@electron-forge/shared-types';
import { MakerDeb } from '@electron-forge/maker-deb';
import { MakerDMG } from '@electron-forge/maker-dmg';
import { MakerSquirrel } from '@electron-forge/maker-squirrel';
import { MakerZIP } from '@electron-forge/maker-zip';
import { AutoUnpackNativesPlugin } from '@electron-forge/plugin-auto-unpack-natives';
import { FusesPlugin } from '@electron-forge/plugin-fuses';
import { VitePlugin } from '@electron-forge/plugin-vite';
import { FuseV1Options, FuseVersion } from '@electron/fuses';
import path from 'node:path';

import {
  buildMacOsAssets,
  MACOS_HELPER_OUTPUT,
  MACOS_ICON_OUTPUT,
} from './build/macos-assets';
import { includeApplicationLicense } from './build/package-license';

const macOsSigningEnabled =
  process.platform === 'darwin' &&
  process.env.INFINITE_WALL_MACOS_SIGNING === 'true';

const macOsNotarizeConfig = () => {
  if (!macOsSigningEnabled) {
    return undefined;
  }
  const appleApiKey = process.env.APPLE_API_KEY_PATH;
  const appleApiKeyId = process.env.APPLE_API_KEY_ID;
  const appleApiIssuer = process.env.APPLE_API_ISSUER;
  if (!appleApiKey || !appleApiKeyId || !appleApiIssuer) {
    throw new Error(
      'Signed macOS builds require APPLE_API_KEY_PATH, APPLE_API_KEY_ID, and APPLE_API_ISSUER.',
    );
  }
  return { appleApiKey, appleApiKeyId, appleApiIssuer };
};

const applicationIcon = (): string | undefined => {
  switch (process.platform) {
    case 'darwin':
      return MACOS_ICON_OUTPUT;
    case 'win32':
      return path.resolve('assets/icon.ico');
    default:
      return undefined;
  }
};

const config: ForgeConfig = {
  packagerConfig: {
    asar: true,
    executableName: 'infinite-wall',
    extraResource: process.platform === 'darwin'
      ? ['assets', MACOS_HELPER_OUTPUT]
      : ['assets'],
    icon: applicationIcon(),
    osxSign: macOsSigningEnabled
      ? {
          ...(process.env.MACOS_SIGN_IDENTITY
            ? { identity: process.env.MACOS_SIGN_IDENTITY }
            : {}),
        }
      : undefined,
    osxNotarize: macOsNotarizeConfig(),
  },
  rebuildConfig: {},
  hooks: {
    generateAssets: async (_forgeConfig, platform, arch) => {
      if (platform === 'darwin') {
        await buildMacOsAssets(arch);
      }
    },
    postPackage: async (_forgeConfig, packageResult) => {
      await includeApplicationLicense(packageResult.outputPaths);
    },
  },
  makers: [
    new MakerSquirrel({}, ['win32']),
    new MakerDMG({}, ['darwin']),
    new MakerZIP({}, ['darwin', 'linux', 'win32']),
    new MakerDeb({
      options: {
        icon: path.resolve('assets/icon.png'),
        categories: ['Graphics'],
      },
    }, ['linux']),
  ],
  plugins: [
    new AutoUnpackNativesPlugin({}),
    new VitePlugin({
      build: [
        {
          entry: 'src/main.ts',
          config: 'vite.main.config.ts',
          target: 'main',
        },
        {
          entry: 'src/preload.ts',
          config: 'vite.preload.config.ts',
          target: 'preload',
        },
      ],
      renderer: [
        {
          name: 'main_window',
          config: 'vite.renderer.config.ts',
        },
      ],
    }),
    new FusesPlugin({
      version: FuseVersion.V1,
      [FuseV1Options.RunAsNode]: false,
      [FuseV1Options.EnableCookieEncryption]: true,
      [FuseV1Options.EnableNodeOptionsEnvironmentVariable]: false,
      [FuseV1Options.EnableNodeCliInspectArguments]: false,
      [FuseV1Options.EnableEmbeddedAsarIntegrityValidation]: true,
      [FuseV1Options.OnlyLoadAppFromAsar]: true,
    }),
  ],
};

export default config;
