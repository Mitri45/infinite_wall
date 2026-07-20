# Infinite Wall

Infinite Wall is a desktop app that creates original wallpapers with Codex,
keeps them in a private local library, and applies them to your desktop.

## What it does

- Offers 13 visual categories, from Minimal and Nature to Cosmic and Illustrated.
- Generates a fresh concept, uses a curated scene, or follows your custom prompt.
- Shows the finished wallpaper before you apply or remove it.
- Keeps generated wallpapers, favorites, and history on your computer.
- Can generate and apply wallpapers automatically on a schedule.
- Provides tray controls for quick generation, scheduling, and library actions.

## How generation works

Infinite Wall uses the **Codex CLI installed on your computer** and your existing
Codex sign-in. It does not call the OpenAI Image API directly, does not ask for
an API key, and does not store one.

The app gives Codex the selected visual direction and your display size. Codex
creates the image, then Infinite Wall validates it and saves it to the local
wallpaper library.

## Requirements

- Linux with Cinnamon or GNOME.
- [Codex CLI](https://developers.openai.com/codex/cli/) installed and up to date.
- A signed-in Codex session for the same desktop user running Infinite Wall.

Check Codex before installing Infinite Wall:

```bash
codex --version
codex login status
```

## Install on Linux

1. Open [GitHub Releases](https://github.com/Mitri45/infinite_wall/releases).
2. Download the latest `infinite-wall_<version>_amd64.deb` file.
3. Install and launch it from your Downloads directory:

```bash
cd ~/Downloads
sudo apt install ./infinite-wall_0.1.2_amd64.deb
infinite-wall
```

After installation, Infinite Wall is also available from the desktop Start or
Applications menu.

For a portable installation, download the Linux ZIP from the same release,
extract it, and run the `infinite-wall` executable inside.

## First use

1. Confirm the header says Codex is ready.
2. Choose a visual category and generation mode.
3. Select **Generate wallpaper** and allow roughly one to two minutes.
4. Review the result and apply it to the desktop.
5. Use **Settings** to configure quality, automatic scheduling, or launch at login.

Infinite Wall stores generated images, prompts, settings, and history only in
its local app data. Codex sends generation requests to OpenAI using your signed-in
session; Infinite Wall adds no analytics, advertising, or separate cloud backend.

## Run from source

Source development additionally requires Node.js 22 or newer, pnpm 11.13.0,
and Git.

```bash
git clone https://github.com/Mitri45/infinite_wall.git
cd infinite_wall
pnpm install --frozen-lockfile
pnpm start
```

Run the verification suite with:

```bash
pnpm verify
```

## License

Infinite Wall is open source under the [MIT License](LICENSE).
