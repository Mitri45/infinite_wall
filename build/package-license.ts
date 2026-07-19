import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const APPLICATION_LICENSE_HEADING = 'Infinite Wall application license';

export async function includeApplicationLicense(
  outputPaths: readonly string[],
  applicationLicensePath = path.resolve('LICENSE'),
): Promise<void> {
  const applicationLicense = (await readFile(applicationLicensePath, 'utf8')).trim();

  await Promise.all(
    outputPaths.map(async (outputPath) => {
      const packagedLicensePath = path.join(outputPath, 'LICENSE');
      const packagedLicense = await readFile(packagedLicensePath, 'utf8');
      if (packagedLicense.includes(applicationLicense)) {
        return;
      }
      await writeFile(
        packagedLicensePath,
        `${packagedLicense.trimEnd()}\n\n---\n\n${APPLICATION_LICENSE_HEADING}\n\n${applicationLicense}\n`,
        'utf8',
      );
    }),
  );
}
