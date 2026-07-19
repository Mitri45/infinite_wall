# Infinite Wall — OpenAI Build Week Desktop App

## Summary

Build a new clean public repository: a polished Electron + TypeScript tray application that creates endlessly varied, original desktop wallpapers through the user's installed Codex CLI and ChatGPT/Codex login.

Target the **Apps for Your Life** track. Ship a tested Linux `.deb` and portable archive by July 21, while keeping OS integrations modular and continuously tested on macOS and Windows.

## Product and architecture

- Use Electron, React, TypeScript, Vite, pnpm 11, and Electron Forge. Keep `contextIsolation` enabled, disable renderer Node access, expose a narrow typed preload API, and apply a strict Content Security Policy.
- Provide four primary experiences:
  - Theme grid with 12 packs: minimal, nature, architecture, cozy, cosmic, sci-fi, fantasy, noir, abstract, surreal, seasonal, and illustrated.
  - **Infinite** generation, where GPT-5.6 creates a new scene inside the selected theme while avoiding recent concepts.
  - Curated scene selection, with at least four hand-authored seeds per theme.
  - Custom prompt mode, still wrapped in wallpaper composition and safety constraints.
- Main window includes onboarding, theme/scene selection, generation progress, preview, apply/reject actions, history, custom prompt, and settings.
- Tray actions include Generate, Surprise Me, Apply Random Existing, Open Infinite Wall, pause/resume schedule, and Quit.
- Store images and metadata under Electron `userData`; preserve prompt, theme, scene summary, dimensions, creation time, and applied/favorite state. Keep the latest 20 concept summaries in diversity history.
- Default to manual generation. Optional schedules support 1/3/6/12/24-hour intervals and launch-at-login. Scheduled failures notify the user and wait until the next interval rather than triggering costly retry loops.
- Generate for the primary display's aspect ratio and apply the same image to all desktops/displays.
- Define a `WallpaperAdapter` with Linux, macOS, and Windows implementations. Validate Linux Cinnamon/GNOME live and test the other adapters through command fixtures.

## Codex generation interface

- Onboarding runs `codex --version` and `codex login status`; missing or unauthenticated installations receive official setup instructions. Codex remains an external prerequisite and no API-key backend is added.
- Each request creates an isolated job directory and invokes:

  ```text
  codex exec --ephemeral --model gpt-5.6 --sandbox workspace-write \
    --skip-git-repo-check --json --output-schema <schema> <prompt>
  ```

- The app never uses `danger-full-access`, inherits an arbitrary backend, or searches global generated-image directories.
- Supply GPT-5.6 with the selected theme definition, optional curated seed/custom request, primary-display dimensions, and recent concept exclusions.
- Require Codex to use the stable image-generation capability, save exactly one image inside the job directory, and return structured metadata.
- Validate the structured response, path confinement, file type, decoded image, and dimensions before atomically importing it into the library.
- Do not automatically retry moderation or user errors. Classify missing login, network, timeout, moderation, malformed output, and missing-image failures into actionable UI messages.

### Public contracts

- `ThemePack`: identity, collection, palette, mood, subjects, composition guidance, and scene seeds.
- `GenerationRequest`: theme, scene/custom input, display dimensions, quality, and diversity history.
- `GenerationResult`: confined image path, final prompt, title, theme, scene summary, and timing.
- `WallpaperRecord`: persisted generated-image metadata and user state.
- `AppSettings`: quality, schedule, launch-at-login, library, and display preferences.
- Typed preload methods for diagnostics, generation, cancellation, library actions, wallpaper application, scheduling, and folder opening.

## Testing and acceptance

- Unit-test theme validation, weighted scene selection, recent-history exclusion, settings persistence, output-schema parsing, filename/path confinement, and error classification.
- Integration-test against a fake Codex executable that emits success, malformed JSONL, timeout, moderation, network, and out-of-directory paths without consuming credits.
- Test OS adapters with recorded commands on Linux, macOS, and Windows; run renderer and packaging checks in a three-OS GitHub Actions matrix.
- Run Electron smoke tests for onboarding, theme generation, custom generation, cancellation, preview, apply/reject, history, and schedule controls.

### Live Linux acceptance

- Detect the current Codex login and pinned GPT-5.6 model.
- Generate distinct wallpapers from the same theme twice.
- Apply a generated wallpaper on Cinnamon.
- Complete a scheduled generation.
- Restart without losing settings or history.
- Install and run the packaged `.deb` and portable build on a clean Linux user profile.

## Hackathon delivery

- Start with a fresh dated Git history and keep production code Codex-authored while documenting the user's product and design decisions honestly.
- The README must include installation, supported platforms, Codex prerequisite, architecture, privacy/local-data behavior, test commands, and a clear **Built with Codex** account of where GPT-5.6 accelerated implementation.
- Document the old tray as pre-hackathon inspiration and explicitly identify Infinite Wall as the new work created after July 13.
- Preserve the primary Codex session ID for `/feedback`, dated commits, and a concise build log as provenance.
- Publish the Linux test build, repository, screenshots, and an under-three-minute narrated YouTube demo showing onboarding, theme-based novelty, custom generation, preview/apply, scheduling, and how Codex/GPT-5.6 power both development and runtime.
- Use only original SFW subjects and generated brand assets; include no named fictional characters, copyrighted music, third-party cloud backend, analytics, or telemetry.

## Assumptions and fixed decisions

- Working name: **Infinite Wall**. The name has received only a practical collision check, not trademark clearance.
- GPT-5.6 is pinned through the documented `gpt-5.6` alias, currently routing to `gpt-5.6-sol`.
- Codex CLI is external and uses the user's existing ChatGPT-managed authentication.
- Linux is the judged release platform. macOS and Windows remain implemented behind adapters and CI-tested but are not claimed as manually validated releases.
- The production app uses OpenAI through Codex CLI only. It has no direct API-key fallback and no non-OpenAI generation backend.
- Initial generation is SFW and uses original subjects only.

## References

- [OpenAI Build Week rules](https://openai.devpost.com/rules)
- [Codex non-interactive mode](https://learn.chatgpt.com/docs/non-interactive-mode)
- [OpenAI image generation](https://developers.openai.com/api/docs/guides/image-generation)
- [Electron packaging](https://www.electronjs.org/docs/latest/tutorial/tutorial-packaging)
