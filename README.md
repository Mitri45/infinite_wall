# Infinite Wall

Infinite Wall is a desktop wallpaper app that uses the user's installed Codex
CLI and existing ChatGPT/Codex login to create original, varied wallpapers. It
is being built for the OpenAI Build Week **Apps for Your Life** track.

The first five product slices are implemented: 13 validated theme packs, a
responsive direction library, Codex installation/login diagnostics, isolated
generation with live progress and cancellation, atomic local-library import,
wallpaper preview, desktop application, and local library history. Linux
Cinnamon and GNOME are supported directly; macOS and Windows integrations are
implemented behind the same adapter contract and covered by command-fixture
tests pending platform acceptance runs.
Settings now persist locally, optional 1/3/6/12/24-hour schedules generate and
apply a new wallpaper without retry loops, launch-at-login is supported, and
the tray provides generation, surprise, random-library, schedule, window, and
quit actions.

## Prerequisites

- Node.js 22 or newer
- pnpm 11.13.0
- Git
- [Codex CLI](https://developers.openai.com/codex/cli/), installed, signed in,
  and current enough to support Infinite Wall's required `codex exec` options

Infinite Wall searches the desktop session `PATH` and common platform-specific
install locations, including npm installations managed by nvm. If Codex lives
elsewhere, set `INFINITE_WALL_CODEX_PATH` to its absolute executable path before
launching the app.

## Development

```bash
pnpm install --frozen-lockfile
pnpm start
```

Useful checks:

```bash
pnpm verify
pnpm package
pnpm make
```

## Install on Linux

Download the `.deb` or portable ZIP from the repository's
[GitHub Releases](https://github.com/Mitri45/infinite_wall/releases). Infinite
Wall still requires the Codex CLI to be installed and signed in for the same
desktop user.

Debian, Ubuntu, Linux Mint, and related distributions:

```bash
sudo apt install ./infinite-wall_0.1.0_amd64.deb
infinite-wall
```

Portable archive:

```bash
unzip 'Infinite Wall-linux-x64-0.1.0.zip'
cd 'Infinite Wall-linux-x64'
./infinite-wall
```

To build the same artifacts locally:

```bash
pnpm install --frozen-lockfile
pnpm make -- --platform linux --arch x64
```

Forge writes the `.deb` and portable ZIP under `out/make/`. Pull requests and
main-branch builds also retain Linux, macOS, and Windows packages as GitHub
Actions artifacts for 14 days. Pushing a version tag such as `v0.1.0` publishes
the Linux `.deb`, portable ZIP, and `SHA256SUMS.txt` to GitHub Releases.

## Architecture and privacy

The app uses Electron Forge, Vite, React, and TypeScript. The renderer is
sandboxed, has no Node.js access, and talks to the main process only through a
narrow typed preload API.

Shared Zod contracts define theme packs, Codex diagnostics, generation requests
and results, public error responses, wallpaper records, and application
settings. Theme content is validated at module load, and each curated pack
contains at least four original SFW scenes.

The generation runner invokes the user's local Codex CLI with an ephemeral
session, pinned `gpt-5.6-sol` model, `workspace-write` sandbox, strict output
schema, capped process output, and a private per-job directory under Electron's local
`userData` directory. It accepts only one schema-valid, decodable image confined
to that directory, verifies that its file signature and aspect ratio match the
request, and maps Codex JSONL event types to sanitized progress phases without
forwarding raw
model or process output. Prompts are delivered over stdin instead of process
arguments. Child processes receive an allowlisted environment rather than the
renderer or the app's complete environment, and stale private job directories
from interrupted sessions are pruned before the first new job. Diagnostics probe
the required non-interactive capabilities before marking Codex ready, and a
discovered executable's directory is added to the child `PATH` so nvm-managed
launchers can find their adjacent Node runtime.

Successful jobs are copied into a private staging directory with validated
metadata and atomically renamed into the local library. Temporary Codex job
files are then removed, and staging directories left by interrupted application
sessions are pruned before the next import. The renderer previews imported
images through a record-ID-only custom protocol; absolute local paths are never
exposed through the preload API. Favorite and applied state use atomic metadata
replacement, rejected items are removed only after direct-child confinement
checks, and the currently applied item is protected from deletion.

Wallpaper application is owned by the main process. Cinnamon and GNOME use
`gsettings`, macOS uses a fixed AppleScript, and Windows uses a fixed PowerShell
script. Image paths are supplied as separate process arguments rather than
interpolated into executable command text. The renderer can request operations
only by validated library record ID.

Settings are stored in a private atomic JSON file under Electron `userData` and
opened from a dedicated header drawer rather than appended to the main page.
The main process owns scheduling and tray commands. A failed scheduled run
produces one local notification and waits for the next configured interval;
it never performs an immediate or costly retry.
The settings drawer and tray also expose **Run Schedule Now**, which exercises
the same random-theme generation, atomic import, and automatic wallpaper apply
path immediately without waiting for the configured timer.
Linux launch-at-login uses a private XDG autostart entry; macOS and Windows use
Electron's native login-item integration.

Generated images, prompts, settings, and history stay local. Infinite Wall does
not add analytics, telemetry, a third-party cloud backend, or a direct API-key
fallback. Integration tests use a fake Codex process and do not consume credits.

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the complete product,
testing, and delivery plan.

## Built with Codex

Codex is being used to implement, test, review, and document Infinite Wall.
Product and design decisions are directed by the repository owner. A dated
build log is kept in [docs/BUILD_LOG.md](docs/BUILD_LOG.md).

## License

Infinite Wall is available under the [MIT License](LICENSE).
