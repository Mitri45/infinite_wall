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

## 2026-07-19 — Wallpaper application and local history

- Added a main-process `WallpaperAdapter` boundary with Linux Cinnamon/GNOME
  support and fixture-tested macOS and Windows commands.
- Kept wallpaper paths out of renderer IPC and passed them to fixed operating
  system commands only as separate arguments.
- Added local-library listing, atomic favorite/applied metadata updates,
  confined rejection/removal, and protection for the currently applied image.
- Added preview apply/reject actions and a responsive local history with
  preview, apply, favorite, and removal controls.
- Expanded adapter, filesystem, and renderer coverage to 84 tests without live
  Codex calls or wallpaper changes.
- Kept D-Bus, X11, Wayland, and runtime-directory capabilities scoped only to
  Linux wallpaper commands rather than the Codex generation environment.
- Serialized wallpaper mutations through operating-system application and
  metadata persistence, and made shutdown wait for that queue to drain.
- Hardened Windows failure propagation and allowed older GNOME installations
  without the optional dark-wallpaper setting.
- Derived history preview labels from persisted record provenance rather than
  the currently selected generation direction.

## 2026-07-19 — Settings, scheduling, and tray controls

- Added atomic private settings persistence for quality, schedule state, and
  launch-at-login preferences.
- Added one-shot schedule coordination for 1/3/6/12/24-hour intervals; failures
  notify once and wait until the next interval instead of retrying.
- Scheduled runs choose a varied theme, use the primary display and configured
  quality, import safely, and apply through the existing serialized adapter.
- Added tray actions for Generate, Surprise Me, Apply Random Existing, opening
  the window, pausing/resuming the schedule, and quitting cleanly.
- Added a responsive settings panel and typed, runtime-validated preload IPC.
- Expanded deterministic coverage to 90 tests without changing the desktop or
  invoking live Codex generation.

## 2026-07-19 — First live Linux acceptance run

- Verified Codex CLI 0.144.6 with the existing ChatGPT-managed login and found
  that the generic `gpt-5.6` alias is rejected while `gpt-5.6-sol` succeeds.
- Updated and regression-tested the runtime pin to the concrete
  ChatGPT-compatible GPT-5.6 SOL model.
- Generated and atomically imported an original 3440x1440 Minimal wallpaper,
  visually inspected the decoded image, previewed it in the app, and applied it
  successfully through Cinnamon.
- Cancelled a second live generation and verified that it imported no library
  item and left no private job directory behind.
- Disabled renderer HMR to avoid Vite's React preamble startup race, keeping
  scripts strict in both development and production with focused policy tests.
- Restarted the app and confirmed the generated library record and applied
  state persisted.
