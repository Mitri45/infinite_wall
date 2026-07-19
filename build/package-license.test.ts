import { mkdtemp, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, describe, expect, it } from 'vitest';

import { includeApplicationLicense } from './package-license';

const temporaryRoots: string[] = [];

afterEach(async () => {
  await Promise.all(
    temporaryRoots.splice(0).map((root) => rm(root, { recursive: true, force: true })),
  );
});

describe('includeApplicationLicense', () => {
  it('preserves the Electron notice and appends the application license once', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'infinite-wall-license-'));
    temporaryRoots.push(root);
    const outputPath = path.join(root, 'Infinite Wall-linux-x64');
    const applicationLicensePath = path.join(root, 'APP-LICENSE');
    await mkdir(outputPath);
    await writeFile(
      path.join(outputPath, 'LICENSE'),
      'Copyright (c) Electron contributors\n',
    );
    await writeFile(
      applicationLicensePath,
      'MIT License\n\nCopyright (c) 2026 Mitri45\n',
    );

    await includeApplicationLicense([outputPath], applicationLicensePath);
    await includeApplicationLicense([outputPath], applicationLicensePath);

    const packagedLicense = await readFile(
      path.join(outputPath, 'LICENSE'),
      'utf8',
    );
    expect(packagedLicense).toContain('Copyright (c) Electron contributors');
    expect(packagedLicense).toContain('Infinite Wall application license');
    expect(packagedLicense.match(/Copyright \(c\) 2026 Mitri45/g)).toHaveLength(1);
  });
});
