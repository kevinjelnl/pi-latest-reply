# Contributing to pi-latest-reply

## Project shape

- `extensions/latest-reply.ts` is the complete Pi extension.
- `package.json` is the Pi package manifest and npm metadata.
- `assets/` contains README/gallery screenshots.

Keep the extension in `extensions/`; Pi discovers that directory by convention. Do not move it to `src/` unless the manifest is changed too.

## Runtime behavior

The extension records finalized user prompts and textual assistant replies from the active session branch, then opens a read-only Markdown viewer. Its public entry points are:

- `Alt+V`
- `/latest-reply`

User keybindings live in `~/.pi/agent/keybindings.json` under `pi.latestReply.*`. Viewer sizing lives in `~/.pi/agent/settings.json` under `piLatestReply`.

## Development

Install the local package for testing:

```bash
pi install .
```

Reload Pi after changes:

```text
/reload
```

Validate the package before publishing:

```bash
npm pack --dry-run
```

There are no runtime dependencies or build step. Keep changes small and prefer Pi/TUI APIs and platform primitives over new dependencies.

## Publishing

Update the version before publishing:

```bash
npm version patch
npm publish
```

The npm package includes the README, license, extension, and assets listed by `package.json.files`. Update the README when changing user-visible behavior or configuration.
