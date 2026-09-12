# pi-latest-reply-viewer

Open Pi assistant responses in a centered, keyboard-navigable popup with Markdown rendering and Vim-like navigation.

Useful when Pi is running in a small terminal, over SSH, or inside tmux and scrolling through the terminal with a mouse is inconvenient.

## Install

From a Git repository:

```bash
pi install git:github.com/YOUR_USERNAME/pi-latest-reply-viewer
```

Or try a local checkout:

```bash
pi install /path/to/pi-latest-reply-viewer
```

Restart Pi, or run `/reload` if the extension is already installed.

## Usage

After Pi has produced a response, press:

```text
Alt+V
```

You can also open it with:

```text
/latest-reply
```

`Alt+V` toggles the popup: press it again while the popup is open to close it.

Pi's built-in `/copy` command continues to copy the complete latest assistant response, including its Markdown/code fences.

The popup renders Markdown with Pi's normal colors and uses a lightweight thinking-color border rather than an opaque fill.

The popup supports:

| Key | Action |
|---|---|
| `h` / `l` | Show the previous/next assistant response |
| `Shift+L` | Jump to the most recent response |
| `/` | Start fuzzy search |
| `n` / `Shift+N` | Next/previous fuzzy match |
| `Ctrl+C` | Copy the latest reply; disabled on older replies |
| `j` / `k` | Move down/up one line |
| `Ctrl+D` / `Ctrl+U` | Move down/up by a page |
| `g` | Jump to the beginning |
| `G` | Jump to the end |
| `PageUp` / `PageDown` | Scroll by a page |
| `q` / `Escape` / `Alt+V` | Close the popup |

The border follows the currently selected Pi thinking level (`thinkingLow`, `thinkingMedium`, `thinkingHigh`, etc.). The popup keeps the textual assistant replies from the active session branch, so previous replies remain available while Pi is running. Copying is intentionally limited to the latest reply; `/copy` remains Pi's built-in command.

## Keybindings

The defaults are stored in `~/.pi/agent/keybindings.json` and can be changed there:

```json
{
  "pi.latestReply.open": "alt+v",
  "pi.latestReply.close": "q",
  "pi.latestReply.previous": "h",
  "pi.latestReply.next": "l",
  "pi.latestReply.latest": "shift+l",
  "pi.latestReply.copy": "ctrl+c",
  "pi.latestReply.search": "/",
  "pi.latestReply.searchNext": "n",
  "pi.latestReply.searchPrevious": "shift+n"
}
```

Run `/reload` after changing them.

The response is captured from Pi's finalized `message_end` event. It is not written to a separate temporary Markdown file.

## Configuration

The shortcut defaults to `Alt+V` and is configurable through the `pi.latestReply.*` entries shown above.

Pi's normal editor binding for `Ctrl+U` can be disabled separately in `~/.pi/agent/keybindings.json`:

```json
{
  "tui.editor.deleteToLineStart": []
}
```

## Terminal notes

- The popup is an overlay, so it works in regular and fullscreen Pi TUI modes.
- Pi must receive `Alt+V`; terminal and tmux key mappings can intercept modified keys.
- The viewer is read-only. Search is intentionally lightweight: `/` starts a case-insensitive whole-word search, `n`/`Shift+N` cycle matches, and `Escape` cancels search without closing the popup. Moving between replies with `h`/`l` exits search and clears its highlights so stale matches cannot carry over. It does not attempt to implement full Vim counts or modes.
- Copying deliberately uses Pi's exported clipboard utility; it does not duplicate Pi's `/copy` command.
- `/latest-reply` is useful for testing when a terminal or tmux setup intercepts `Alt+V`.

## Demo checklist

For a short screenshot or GIF:

1. Use a compact terminal window or tmux pane.
2. Ask Pi for a long Markdown response with a heading, a Python code block, a list, and a quote.
3. Open the viewer with `Alt+V`.
4. Show `h`/`l` reply history, `Shift+L` latest, `/` search, and `j`/`k` scrolling.
5. Close with `q`, then run `/copy` to demonstrate Pi's native copy command.

Keep the recording under 15 seconds and crop out unrelated terminal tabs, usernames, paths, and environment details.

## Development

The extension is a single TypeScript file:

```text
extensions/latest-reply.ts
```

Pi provides `@earendil-works/pi-tui` when loading extensions, so it is listed as a peer dependency rather than bundled into this package.

## Publishing

1. Create a public GitHub repository named `pi-latest-reply-viewer`.
2. Copy this package into the repository.
3. Replace `YOUR_USERNAME` in this README with your GitHub username.
4. Commit and push:

```bash
git init
git add .
git commit -m "Initial release"
git branch -M main
git remote add origin git@github.com:YOUR_USERNAME/pi-latest-reply-viewer.git
git push -u origin main
```

5. Test the published package:

```bash
pi install git:github.com/YOUR_USERNAME/pi-latest-reply-viewer
```

Pi's package gallery discovers packages with the `pi-package` keyword and a `pi` manifest in `package.json`.
