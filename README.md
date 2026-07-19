# Infinite Wall

Infinite Wall is a desktop wallpaper app that uses the user's installed Codex
CLI and existing ChatGPT/Codex login to create original, varied wallpapers. It
is being built for the OpenAI Build Week **Apps for Your Life** track.

The repository is at foundation stage. The implementation target is a polished
Linux release, with OS-specific wallpaper integrations kept modular for macOS
and Windows.

## Prerequisites

- Node.js 22 or newer
- pnpm 11.13.0
- Git
- Codex CLI (generation work is not wired up yet)

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

## Architecture and privacy

The app uses Electron Forge, Vite, React, and TypeScript. The renderer is
sandboxed, has no Node.js access, and talks to the main process only through a
narrow typed preload API.

The planned generation path runs the user's local Codex CLI. Generated images,
prompts, settings, and history will stay under Electron's local `userData`
directory. Infinite Wall will not add analytics, telemetry, a third-party cloud
backend, or a direct API-key fallback.

See [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) for the complete product,
testing, and delivery plan.

## Built with Codex

Codex is being used to implement, test, review, and document Infinite Wall.
Product and design decisions are directed by the repository owner. A dated
build log is kept in [docs/BUILD_LOG.md](docs/BUILD_LOG.md).

## License

No open-source license has been selected yet. The source is publicly visible,
but no permission to copy, modify, or redistribute it is granted at this time.
