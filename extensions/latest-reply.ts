import { readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { Key, Markdown, matchesKey, sliceByColumn, truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";
import { copyToClipboard, getMarkdownTheme } from "@earendil-works/pi-coding-agent";

let replies: string[] = [];

function loadBindings(): Record<string, string[]> {
  try {
    const dir = process.env.PI_CODING_AGENT_DIR || join(homedir(), ".pi", "agent");
    const config = JSON.parse(readFileSync(join(dir, "keybindings.json"), "utf8"));
    return Object.fromEntries(
      Object.entries(config)
        .filter(([name]) => name.startsWith("pi.latestReply."))
        .map(([name, value]) => [name, Array.isArray(value) ? value : [value]]),
    ) as Record<string, string[]>;
  } catch {
    return {};
  }
}

const bindings = loadBindings();
const keysFor = (name: string, fallback: string[]) => bindings[name] ?? fallback;
const matchesBinding = (data: string, name: string, fallback: string[]) =>
  keysFor(name, fallback).some((key) => matchesKey(data, key));

function textOf(message: any): string {
  if (typeof message?.content === "string") return message.content;
  return (message?.content ?? [])
    .filter((part: any) => part.type === "text")
    .map((part: any) => part.text)
    .join("\n");
}

function addReply(message: any): void {
  if (message?.role !== "assistant") return;
  const text = textOf(message);
  if (text && replies.at(-1) !== text) replies.push(text);
}

function stripAnsi(text: string): string {
  return text.replace(/\x1B\[[0-?]*[ -/]*[@-~]/g, "");
}

function fuzzySpan(text: string, query: string): [number, number] | undefined {
  let index = 0;
  let start = -1;
  let end = -1;
  for (const char of query.toLowerCase()) {
    index = text.toLowerCase().indexOf(char, index);
    if (index < 0) return undefined;
    if (start < 0) start = index;
    end = index + 1;
    index++;
  }
  return start < 0 ? undefined : [start, end];
}

function fuzzyIncludes(text: string, query: string): boolean {
  return fuzzySpan(text, query) !== undefined;
}

class ReplyViewer {
  private offset = 0;
  private markdown: any;
  private status = "";
  private searchMode = false;
  private searchQuery = "";
  private searchMatches: number[] = [];

  constructor(
    private readonly replies: string[],
    private index: number,
    private readonly theme: any,
    private readonly borderColor: string,
    private readonly done: () => void,
    private readonly onCopy: (text: string, index: number) => void,
  ) {
    this.markdown = new Markdown(replies[index], 0, 0, getMarkdownTheme());
  }

  setStatus(status: string): void {
    this.status = status;
  }

  private select(index: number): void {
    this.index = Math.max(0, Math.min(this.replies.length - 1, index));
    this.offset = 0;
    this.searchMatches = [];
    this.status = this.searchQuery ? `Search: ${this.searchQuery}` : "";
    this.markdown = new Markdown(this.replies[this.index], 0, 0, getMarkdownTheme());
  }

  private latest(): void {
    this.select(this.replies.length - 1);
  }

  private nextMatch(direction: number): void {
    if (!this.searchMatches.length) {
      this.status = this.searchQuery ? `No matches for: ${this.searchQuery}` : "Search is empty";
      return;
    }
    const current = this.searchMatches.findIndex((line) => line > this.offset);
    const position = current < 0 ? (direction > 0 ? 0 : this.searchMatches.length - 1) : current;
    const index = direction > 0 ? position : (position - 1 + this.searchMatches.length) % this.searchMatches.length;
    this.offset = this.searchMatches[index];
    this.status = `Search: ${this.searchQuery}  (${index + 1}/${this.searchMatches.length})`;
  }

  handleInput(data: string): void {
    if (this.searchMode) {
      if (matchesKey(data, Key.escape) || matchesKey(data, "escape") || data === "\x1b") {
        this.searchMode = false;
        this.status = this.searchQuery ? `Search: ${this.searchQuery}` : "";
      } else if (matchesKey(data, Key.enter)) {
        this.searchMode = false;
        this.nextMatch(1);
      } else if (matchesKey(data, Key.backspace)) {
        this.searchQuery = this.searchQuery.slice(0, -1);
      } else if (data.length === 1 && data.charCodeAt(0) >= 32) {
        this.searchQuery += data;
      }
      return;
    }

    if (matchesBinding(data, "pi.latestReply.search", ["/"])) {
      this.searchMode = true;
      this.searchQuery = "";
      this.status = "Search: ";
      return;
    }
    if (matchesBinding(data, "pi.latestReply.searchNext", ["n"])) {
      this.nextMatch(1);
      return;
    }
    if (matchesBinding(data, "pi.latestReply.searchPrevious", ["shift+n"])) {
      this.nextMatch(-1);
      return;
    }

    if (matchesKey(data, Key.escape) || matchesKey(data, "escape") || data === "\x1b" || matchesBinding(data, "pi.latestReply.close", ["q"]) || matchesBinding(data, "pi.latestReply.open", ["alt+v"])) {
      this.done();
      return;
    }

    if (matchesBinding(data, "pi.latestReply.copy", ["ctrl+c"])) {
      this.onCopy(this.replies[this.index], this.index);
      return;
    }
    if (matchesBinding(data, "pi.latestReply.latest", ["shift+l"])) this.latest();
    else if (matchesBinding(data, "pi.latestReply.previous", ["h"])) this.select(this.index - 1);
    else if (matchesBinding(data, "pi.latestReply.next", ["l"])) this.select(this.index + 1);
    else if (data === "g") this.offset = 0;
    else if (data === "G") this.offset = Number.MAX_SAFE_INTEGER;
    else if (matchesKey(data, Key.up) || data === "k") this.offset--;
    else if (matchesKey(data, Key.down) || data === "j") this.offset++;
    else if (matchesKey(data, Key.ctrl("u")) || matchesKey(data, "pageUp")) this.offset -= 12;
    else if (matchesKey(data, Key.ctrl("d")) || matchesKey(data, "pageDown")) this.offset += 12;
  }

  render(width: number): string[] {
    const contentWidth = Math.max(10, width - 4);
    const rendered = this.markdown.render(contentWidth);
    const terminalRows = process.stdout.rows || 24;
    const pageSize = Math.max(6, Math.min(32, Math.floor(terminalRows * 0.65) - 4));
    const maxOffset = Math.max(0, rendered.length - pageSize);
    this.offset = Math.max(0, Math.min(this.offset, maxOffset));
    this.searchMatches = this.searchQuery
      ? rendered.map((line, index) => fuzzyIncludes(stripAnsi(line), this.searchQuery) ? index : -1).filter((index) => index >= 0)
      : [];

    const border = (line: string) => this.theme.fg(this.borderColor, line);
    const body = (line: string, row = -1) => {
      let content = truncateToWidth(line, contentWidth);
      if (this.searchQuery) {
        const span = fuzzySpan(stripAnsi(content), this.searchQuery);
        if (span) {
          const before = sliceByColumn(content, 0, span[0], true);
          const match = sliceByColumn(content, span[0], span[1] - span[0], true);
          const after = sliceByColumn(content, span[1], contentWidth, true);
          const style = row === this.offset ? "selectedBg" : "searchMatchBg";
          content = before + this.theme.bg(style, match) + after;
        }
      }
      return border("│") + " " + content + " ".repeat(Math.max(0, contentWidth - visibleWidth(content))) + " " + border("│");
    };
    const top = border("╭" + "─".repeat(Math.max(0, width - 2)) + "╮");
    const bottom = border("╰" + "─".repeat(Math.max(0, width - 2)) + "╯");
    const header = body(
      this.searchMode
        ? this.theme.fg("accent", `Search: ${this.searchQuery}_  [Enter] find  [Esc] cancel`)
        : this.theme.fg("accent", `Reply ${this.index + 1}/${this.replies.length}`) +
          `  [${keysFor("pi.latestReply.previous", ["h"])[0]}/${keysFor("pi.latestReply.next", ["l"])[0]}] previous/next  [${keysFor("pi.latestReply.latest", ["shift+l"])[0]}] latest  [/] search  [n/N] next/prev  [j/k] move  [${keysFor("pi.latestReply.close", ["q"])[0]}] close`,
    );
    const footerText = this.status || `${this.offset + 1}-${Math.min(this.offset + pageSize, rendered.length)} / ${rendered.length}  •  [${keysFor("pi.latestReply.copy", ["ctrl+c"])[0]}] copy  •  close and use /copy`;
    const footer = body(this.theme.fg(this.status ? "warning" : "dim", footerText));

    return [
      top,
      header,
      ...rendered.slice(this.offset, this.offset + pageSize).map((line, index) => body(line, this.offset + index)),
      footer,
      bottom,
    ];
  }

  invalidate(): void {}
}

export default function (pi: any) {
  pi.on("session_start", (_event: any, ctx: any) => {
    replies = [];
    for (const entry of ctx.sessionManager.getBranch()) addReply(entry.message);
  });
  pi.on("message_end", (event: any) => addReply(event.message));

  const showLatest = async (ctx: any) => {
    if (!replies.length) {
      for (const entry of ctx.sessionManager.getBranch()) addReply(entry.message);
    }
    if (!replies.length) {
      ctx.ui.notify("No assistant response yet", "warning");
      return;
    }

    const borderColor = pi.getThinkingLevel?.() === "off"
      ? "dim"
      : `thinking${String(pi.getThinkingLevel?.() ?? "medium")[0].toUpperCase()}${String(pi.getThinkingLevel?.() ?? "medium").slice(1)}`;

    await ctx.ui.custom(
      (tui: any, theme: any, _keybindings: any, done: () => void) => {
        let viewer: ReplyViewer;
        viewer = new ReplyViewer(
          replies,
          replies.length - 1,
          theme,
          borderColor,
          done,
          async (text: string, index: number) => {
            if (index !== replies.length - 1) {
              viewer.setStatus("Copy is only enabled for the latest reply");
              tui.requestRender();
              return;
            }
            try {
              await copyToClipboard(text);
              viewer.setStatus("Latest reply copied");
            } catch (error: any) {
              viewer.setStatus(`Copy failed: ${error?.message || "clipboard unavailable"}`);
            }
            tui.requestRender();
          },
        );
        return {
          render: (width: number) => viewer.render(width),
          handleInput: (data: string) => {
            viewer.handleInput(data);
            tui.requestRender();
          },
          invalidate: () => viewer.invalidate(),
        };
      },
      {
        overlay: true,
        overlayOptions: { width: "85%", maxHeight: "80%", anchor: "center", margin: 0 },
      },
    );
  };

  for (const shortcut of keysFor("pi.latestReply.open", ["alt+v"])) {
    pi.registerShortcut(shortcut, {
      description: "Open latest assistant response (toggle)",
      handler: showLatest,
    });
  }
  pi.registerCommand("latest-reply", {
    description: "Open the latest assistant response",
    handler: async (_args: string, ctx: any) => showLatest(ctx),
  });
}
