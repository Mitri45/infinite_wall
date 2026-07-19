import { chmod, mkdir, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

const AUTOSTART_FILENAME = 'infinite-wall.desktop';

export interface LaunchAtLoginOptions {
  readonly platform: NodeJS.Platform;
  readonly configRoot: string;
  readonly executablePath: string;
  readonly developmentAppPath?: string;
  readonly setNativeLoginItem: (enabled: boolean) => void;
}

export class LaunchAtLoginController {
  readonly #platform: NodeJS.Platform;
  readonly #configRoot: string;
  readonly #executablePath: string;
  readonly #developmentAppPath: string | undefined;
  readonly #setNativeLoginItem: (enabled: boolean) => void;

  constructor(options: LaunchAtLoginOptions) {
    const pathApi = options.platform === 'win32' ? path.win32 : path.posix;
    this.#platform = options.platform;
    this.#configRoot = path.resolve(options.configRoot);
    this.#executablePath = pathApi.resolve(options.executablePath);
    this.#developmentAppPath = options.developmentAppPath
      ? pathApi.resolve(options.developmentAppPath)
      : undefined;
    this.#setNativeLoginItem = options.setNativeLoginItem;
  }

  async setEnabled(enabled: boolean): Promise<void> {
    if (this.#platform !== 'linux') {
      this.#setNativeLoginItem(enabled);
      return;
    }

    const autostartRoot = path.join(this.#configRoot, 'autostart');
    const autostartPath = path.join(autostartRoot, AUTOSTART_FILENAME);
    if (!enabled) {
      await rm(autostartPath, { force: true });
      return;
    }

    await mkdir(autostartRoot, { recursive: true, mode: 0o700 });
    await chmod(autostartRoot, 0o700);
    const temporaryPath = path.join(
      autostartRoot,
      `.${AUTOSTART_FILENAME}-${process.pid}.tmp`,
    );
    const command = [this.#executablePath, this.#developmentAppPath]
      .filter((value): value is string => Boolean(value))
      .map(quoteDesktopExecArgument)
      .join(' ');
    const entry = [
      '[Desktop Entry]',
      'Type=Application',
      'Name=Infinite Wall',
      'Comment=Private Codex-powered desktop wallpapers',
      `Exec=${command}`,
      'Terminal=false',
      'X-GNOME-Autostart-enabled=true',
      '',
    ].join('\n');

    try {
      await writeFile(temporaryPath, entry, { encoding: 'utf8', mode: 0o600 });
      await rename(temporaryPath, autostartPath);
    } catch (error) {
      await rm(temporaryPath, { force: true });
      throw error;
    }
  }
}

function quoteDesktopExecArgument(argument: string): string {
  if (/[\n\r\0]/.test(argument)) {
    throw new Error('Launch command paths cannot contain control characters.');
  }
  const escaped = argument
    .replace(/%/g, '%%')
    .replace(/[\\`"$]/g, '\\$&');
  return `"${escaped}"`;
}
