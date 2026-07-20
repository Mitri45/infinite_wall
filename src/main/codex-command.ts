import { constants } from 'node:fs';
import { access, readdir } from 'node:fs/promises';
import path from 'node:path';

const CONFIGURED_CODEX_PATH = 'INFINITE_WALL_CODEX_PATH';

interface CodexCommandDiscoveryOptions {
  readonly command?: string;
  readonly environment?: NodeJS.ProcessEnv;
  readonly platform?: NodeJS.Platform;
}

export async function resolveCodexCommand(
  options: CodexCommandDiscoveryOptions = {},
): Promise<string> {
  if (options.command) {
    return options.command;
  }

  const environment = options.environment ?? process.env;
  const platform = options.platform ?? process.platform;
  const configuredPath = environment[CONFIGURED_CODEX_PATH]?.trim();
  if (configuredPath && path.isAbsolute(configuredPath)) {
    return configuredPath;
  }

  const executableNames = platform === 'win32' ? ['codex.cmd', 'codex.exe'] : ['codex'];
  const pathDirectories = (environment.PATH ?? '')
    .split(path.delimiter)
    .filter((directory) => path.isAbsolute(directory));
  const candidates = [
    ...pathDirectories.flatMap((directory) =>
      executableNames.map((name) => path.join(directory, name)),
    ),
    ...(await knownInstallCandidates(environment, platform, executableNames)),
  ];

  for (const candidate of candidates) {
    if (await isExecutable(candidate, platform)) {
      return candidate;
    }
  }

  return executableNames[0];
}

async function knownInstallCandidates(
  environment: NodeJS.ProcessEnv,
  platform: NodeJS.Platform,
  executableNames: readonly string[],
): Promise<string[]> {
  const home = environment.HOME ?? environment.USERPROFILE;
  const candidates: string[] = [];

  if (platform === 'win32') {
    if (environment.APPDATA) {
      candidates.push(
        ...executableNames.map((name) => path.join(environment.APPDATA!, 'npm', name)),
      );
    }
    return candidates;
  }

  if (home) {
    candidates.push(
      ...executableNames.flatMap((name) => [
        path.join(home, '.local', 'bin', name),
        path.join(home, '.npm-global', 'bin', name),
        path.join(home, 'bin', name),
      ]),
    );
    candidates.push(...(await nvmCandidates(home, executableNames)));
    candidates.push(...(await fnmCandidates(home, environment, executableNames)));
  }

  for (const directory of platform === 'darwin'
    ? ['/opt/homebrew/bin', '/usr/local/bin', '/usr/bin']
    : ['/usr/local/bin', '/usr/bin', '/snap/bin']) {
    candidates.push(...executableNames.map((name) => path.join(directory, name)));
  }

  return candidates;
}

async function fnmCandidates(
  home: string,
  environment: NodeJS.ProcessEnv,
  executableNames: readonly string[],
): Promise<string[]> {
  const configuredRoot = environment.FNM_DIR?.trim();
  const dataHome = environment.XDG_DATA_HOME?.trim() || path.join(home, '.local', 'share');
  const roots = [configuredRoot, path.join(dataHome, 'fnm'), path.join(home, '.fnm')]
    .filter((root): root is string => Boolean(root && path.isAbsolute(root)));
  const candidates: string[] = [];

  for (const root of new Set(roots)) {
    const versionsRoot = path.join(root, 'node-versions');
    const versions = await readdir(versionsRoot, { withFileTypes: true }).catch(() => []);
    candidates.push(
      ...versions
        .filter((entry) => entry.isDirectory())
        .map((entry) => entry.name)
        .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
        .flatMap((version) =>
          executableNames.map((name) =>
            path.join(versionsRoot, version, 'installation', 'bin', name),
          ),
        ),
    );
  }

  return candidates;
}

async function nvmCandidates(
  home: string,
  executableNames: readonly string[],
): Promise<string[]> {
  const versionsRoot = path.join(home, '.nvm', 'versions', 'node');
  const versions = await readdir(versionsRoot, { withFileTypes: true }).catch(() => []);
  return versions
    .filter((entry) => entry.isDirectory())
    .map((entry) => entry.name)
    .sort((left, right) => right.localeCompare(left, undefined, { numeric: true }))
    .flatMap((version) =>
      executableNames.map((name) => path.join(versionsRoot, version, 'bin', name)),
    );
}

async function isExecutable(
  candidate: string,
  platform: NodeJS.Platform,
): Promise<boolean> {
  return access(
    candidate,
    platform === 'win32' ? constants.F_OK : constants.X_OK,
  ).then(
    () => true,
    () => false,
  );
}
