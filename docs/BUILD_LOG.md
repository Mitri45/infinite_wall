# Build log

## 2026-07-19 — Repository foundation

- Reviewed and adopted the implementation plan.
- Initialized a new Git repository with `main` as the default branch.
- Bootstrapped Electron Forge, Vite, React, TypeScript, pnpm 11, and Vitest.
- Added hardened Electron renderer defaults and explicit pnpm supply-chain
  controls.
- Added cross-platform packaging configuration and public-repository hygiene.

Product direction and acceptance criteria were supplied by the repository
owner. Codex authored the initial project scaffold and verification setup.

## 2026-07-19 — Theme library and public contracts

- Defined runtime-validated contracts for themes, generation, wallpaper
  records, and settings.
- Authored 12 original theme packs with four curated scene seeds per pack.
- Added weighted scene selection with recent-concept exclusion.
- Built the responsive Infinite, Curated, and Custom direction-selection UI.
- Moved CSP enforcement into Electron response headers so production stays
  strict while local Vite development remains usable.
- Validated desktop and narrow-window layouts, renderer interactions, the
  Electron development launch, and the production package.

## 2026-07-19 — Codex diagnostics and isolated job runner

- Added startup diagnostics for the installed Codex version and local login
  state, with actionable installation and sign-in onboarding states.
- Added typed renderer-to-main IPC for diagnostics, generation, and
  cancellation while keeping the renderer sandboxed.
- Built a one-job-at-a-time Codex runner with ephemeral sessions, pinned
  GPT-5.6 selection, an allowlisted child environment, output limits, timeout
  and cancellation handling, and private per-job directories.
- Added strict JSONL/metadata parsing, path confinement, single-file checks,
  supported-format checks, and production image decoding/dimension validation.
- Added a fake Codex integration fixture covering success, malformed output,
  missing or escaped images, timeouts, cancellation, moderation, network, and
  authentication failures without using generation credits.
- Re-ran lint, strict TypeScript checks, 39 automated tests, dependency audit,
  and Linux production packaging.

## 2026-07-19 — Generation progress, preview, and atomic import

- Streamed Codex JSONL events into a small set of sanitized progress phases;
  raw commands, prompts, reasoning, and model output never reach the renderer.
- Connected Infinite, Curated, and Custom requests to real generation with
  primary-display dimensions, actionable errors, and explicit cancellation.
- Added a private atomic library importer that stages the image and metadata
  together, decodes the copy, validates dimensions and file signatures, then
  renames the complete item into place.
- Added confined preview URLs backed by a custom Electron protocol so renderer
  code receives record IDs rather than absolute filesystem paths.
- Added renderer, image-signature, library, runner, and service-level fake
  Codex tests covering progress, preview, cancellation, import cleanup, and
  path confinement without consuming generation credits.
- Re-ran lint, strict TypeScript checks, 50 automated tests, dependency audit,
  and Linux production packaging.

## 2026-07-19 — Review-driven lifecycle hardening

- Made Codex discovery work with nvm-managed launchers outside the desktop
  session `PATH` and Windows npm command shims.
- Added diagnostics capability probing for every `codex exec` option required
  by the isolated generation runner.
- Disabled cancellation once atomic library persistence begins and added
  shutdown coordination that aborts active Codex work and awaits cleanup.
- Pruned interrupted library staging directories and made transient job-root
  initialization failures retryable without restarting the app.
- Expanded platform, diagnostics, lifecycle, renderer, and filesystem
  regression coverage without invoking live generation.
