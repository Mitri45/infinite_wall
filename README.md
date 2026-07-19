# Infinite Wall

Infinite Wall is a desktop wallpaper app that uses the user's installed Codex
CLI and existing ChatGPT/Codex login to create original, varied wallpapers. It
is being built for the OpenAI Build Week **Apps for Your Life** track.

The first two product slices are implemented: 12 validated theme packs, a
responsive direction library, Codex installation/login diagnostics, and an
isolated generation-job runner. The renderer does not start real generation
yet; preview, library import, and wallpaper application are the next milestone.
The release target is Linux, with OS integrations kept modular for macOS and
Windows.

## Prerequisites

- Node.js 22 or newer
- pnpm 11.13.0
- Git
- [Codex CLI](https://developers.openai.com/codex/cli/), installed and signed in

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

Shared Zod contracts define theme packs, Codex diagnostics, generation requests
and results, public error responses, wallpaper records, and application
settings. Theme content is validated at module load, and each curated pack
contains at least four original SFW scenes.

The generation runner invokes the user's local Codex CLI with an ephemeral
session, pinned model, `workspace-write` sandbox, strict output schema, capped
process output, and a private per-job directory under Electron's local
`userData` directory. It accepts only one schema-valid, decodable image confined
to that directory. Child processes receive an allowlisted environment rather
than the renderer or the app's complete environment.

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

No open-source license has been selected yet. The source is publicly visible,
but no permission to copy, modify, or redistribute it is granted at this time.
