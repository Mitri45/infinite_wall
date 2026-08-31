# Infinite Wall

Infinite Wall is a desktop app that creates original wallpapers with Codex,
keeps them in a private local library, and applies them to your desktop.

## OpenAI Build Week submission

Infinite Wall was created during OpenAI Build Week, with
Codex juggling two distinct roles: it collaborated with me throughout product
development, and it is the runtime engine that powers the art generation.

### How I collaborated with Codex

Codex (GPT 5.6 Sol) was used from the very start planning phase of the project to packaged desktop
application. It helped turn the initial direction into desktop app architecture, prototype and refine the interface, implement the
generation, library, scheduling, and tray workflows with decent test coverage. Additionally Codex Code Review was used on each PR to make sure the quality of the application stays sharp.

### How Codex and GPT contribute to the result

For every generation, Infinite Wall starts an isolated, ephemeral Codex CLI
session. The app supplies the selected visual world,
mode, composition guidance, display dimensions, and recent concepts. GPT
turns that direction into the final image prompt, uses Codex's image-generation
capability to create one original wallpaper, and returns structured metadata.
Infinite Wall then validates the file type, decoded image, aspect ratio, output
location, and metadata before atomically importing the result into the private
local library. This makes Codex and GPT part of the shipped product rather
than only tools used to write its code.

## What it does

- Offers 13 visual categories, from Minimal and Nature to Cosmic and Illustrated.
- Generates a fresh concept, uses a curated scene, or follows your custom prompt.
- Shows the finished wallpaper before you apply or remove it.
- Keeps generated wallpapers, favorites, and history on your computer.
- Can generate and apply wallpapers automatically on a schedule.
- Provides tray controls for quick generation, scheduling, and library actions.

On Linux/Cinnamon, Infinite Wall can use the optional local Wallloop engine
when `wallloopctl` is installed and its user service is reachable. Static
images use Wallloop's short-lived `apply-file` command; live-bundle records use
short-lived import/apply commands, so Electron is not part of playback. If
Wallloop is unavailable, the existing Cinnamon `gsettings` adapter remains the
fallback. A reachable Wallloop rejection or malformed response is reported as
an apply failure instead of being silently claimed as success.

## How generation works

Infinite Wall uses the **Codex CLI installed on your computer** and your existing
Codex sign-in. It does not call the OpenAI Image API directly, does not ask for
an API key, and does not store one.

Infinite Wall gives Codex your selected visual direction and display size.
Codex turns that direction into a final image prompt and generates the wallpaper
in the same run. Infinite Wall then validates the result and saves it to your
private local library.

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
sudo apt install ./infinite-wall_0.1.3_amd64.deb
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

The Wallloop integration is covered by the adapter, library migration, and
static/live dispatch tests in the verification suite. The packaged Linux
Wallloop apply path and the Wallpaper generation/resource handoff have also
been exercised as live product checks. The owner has confirmed the Cinnamon
wallpaper fit, usable desktop icons, working right-click desktop menu, and
unaffected workspace switching; M5 is fully accepted, with that owner-attended
judgment kept distinct from automated test claims.

## Build from source

Building uses the same prerequisites as running from source. Create a
packaged, runnable app with:

```bash
pnpm package
```

The unpacked build is written to out/Infinite Wall-linux-x64/; launch it
directly with:

```bash
"./out/Infinite Wall-linux-x64/infinite-wall"
```

To build the distributable installers (.deb and portable ZIP):

```bash
pnpm make
```

Installers land in out/make/, named after the version in package.json.
Builds target the host platform, so Windows and macOS artifacts must be
built on those operating systems. The CI workflow packages Linux x64,
Windows x64, and both macOS x64 and arm64 artifacts.

On macOS, packaging compiles the bundled AppKit wallpaper helper and generates
the native `.icns` application icon before Electron Forge signs the bundle.
Ordinary CI packaging remains unsigned so pull requests do not receive release
credentials. Tagged releases require these GitHub Actions secrets:

- `MACOS_CERTIFICATE_P12_BASE64`
- `MACOS_CERTIFICATE_PASSWORD`
- `MACOS_KEYCHAIN_PASSWORD`
- `APPLE_API_KEY_P8_BASE64`
- `APPLE_API_KEY_ID`
- `APPLE_API_ISSUER`
- `MACOS_SIGN_IDENTITY` (optional when the Developer ID identity is unambiguous)

The release workflow imports the Developer ID certificate into an ephemeral
keychain, signs the app and bundled helper with hardened runtime, notarizes the
app, verifies it with `codesign`, Gatekeeper, and `stapler`, then publishes
separate x64 and arm64 DMG and ZIP assets alongside the Linux release.

## License

Infinite Wall is open source under the [MIT License](LICENSE).
