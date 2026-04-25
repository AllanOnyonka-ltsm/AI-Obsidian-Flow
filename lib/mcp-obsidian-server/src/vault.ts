import { promises as fs } from "node:fs";
import { join, resolve } from "node:path";
import {
  buildVault,
  defaultOptions,
  sanitizeFilename,
  type Conversation,
  type ExportOptions,
  type Message,
  type Role,
} from "@workspace/obsidian-core";

export interface SavedConversation {
  id: string;
  filename: string;
  title: string;
  source: Conversation["source"];
  topics: string[];
  createdAt: number;
  updatedAt: number;
  messages: Message[];
}

export interface VaultState {
  version: 1;
  conversations: SavedConversation[];
  options: ExportOptions;
}

const STATE_FILE = ".obsidian-mcp/state.json";

export class Vault {
  constructor(public readonly root: string) {}

  private statePath(): string {
    return join(this.root, STATE_FILE);
  }

  async ensure(): Promise<void> {
    await fs.mkdir(this.root, { recursive: true });
    await fs.mkdir(join(this.root, ".obsidian-mcp"), { recursive: true });
  }

  async loadState(): Promise<VaultState> {
    try {
      const raw = await fs.readFile(this.statePath(), "utf-8");
      const parsed = JSON.parse(raw) as VaultState;
      if (parsed && parsed.version === 1 && Array.isArray(parsed.conversations)) {
        return {
          ...parsed,
          options: { ...defaultOptions, ...(parsed.options ?? {}) },
        };
      }
    } catch {
      // file missing - start fresh
    }
    return {
      version: 1,
      conversations: [],
      options: { ...defaultOptions },
    };
  }

  async saveState(state: VaultState): Promise<void> {
    await this.ensure();
    await fs.writeFile(
      this.statePath(),
      JSON.stringify(state, null, 2),
      "utf-8",
    );
  }

  /**
   * Regenerate every conversation note, topic note, and the MOC from the
   * current state. Removes stale topic notes from previous regenerations.
   */
  async regenerate(state: VaultState): Promise<{ written: number }> {
    await this.ensure();
    const conversations: Conversation[] = state.conversations.map((c) => ({
      id: c.id,
      title: c.title,
      source: c.source,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messages: c.messages,
    }));

    const files = buildVault(conversations, state.options);

    // Wipe the topic folder so removed topics don't linger
    const topicDir = join(this.root, state.options.topicFolder);
    try {
      const existing = await fs.readdir(topicDir);
      for (const name of existing) {
        if (name.endsWith(".md")) {
          await fs.unlink(join(topicDir, name)).catch(() => {});
        }
      }
    } catch {
      // dir doesn't exist yet
    }

    let written = 0;
    for (const file of files) {
      const fullPath = join(this.root, file.path);
      await fs.mkdir(join(fullPath, ".."), { recursive: true });
      await fs.writeFile(fullPath, file.content, "utf-8");
      written++;
    }

    return { written };
  }

  /**
   * Save a single new conversation: stores it in state, regenerates all
   * notes (so topic notes and MOC stay consistent), and returns the result.
   */
  async saveConversation(input: {
    title: string;
    messages: Message[];
    source?: Conversation["source"];
    topics?: string[];
    model?: string;
  }): Promise<{ filename: string; topics: string[]; vaultPath: string }> {
    const state = await this.loadState();

    const now = Date.now();
    const id = randomId();
    const conversation: Conversation = {
      id,
      title: input.title.trim() || "Untitled brainstorm",
      source: input.source ?? "generic",
      model: input.model,
      createdAt: now,
      updatedAt: now,
      messages: input.messages,
    };

    // Plan to compute filename + topics consistent with the rest of the vault
    const planFiles = buildVault([conversation], state.options);
    const note = planFiles.find((f) =>
      f.path.startsWith(`${state.options.folder}/`),
    );
    const filename = note
      ? note.path.replace(`${state.options.folder}/`, "").replace(/\.md$/, "")
      : `${fmtDate(now)} ${sanitizeFilename(conversation.title)}`;

    const topics = input.topics?.length
      ? input.topics
      : extractTopicsFromContent(planFiles);

    state.conversations.push({
      id,
      filename,
      title: conversation.title,
      source: conversation.source,
      topics,
      createdAt: now,
      updatedAt: now,
      messages: input.messages,
    });

    await this.regenerate(state);
    await this.saveState(state);

    return {
      filename,
      topics,
      vaultPath: join(state.options.folder, `${filename}.md`),
    };
  }

  async appendToConversation(
    filename: string,
    messages: Message[],
  ): Promise<{ filename: string; messageCount: number }> {
    const state = await this.loadState();
    const target = state.conversations.find(
      (c) => c.filename === filename || c.filename === stripMd(filename),
    );
    if (!target) {
      throw new Error(`No saved conversation matches filename "${filename}"`);
    }
    target.messages.push(...messages);
    target.updatedAt = Date.now();
    await this.regenerate(state);
    await this.saveState(state);
    return { filename: target.filename, messageCount: target.messages.length };
  }

  async listConversations(limit = 50): Promise<SavedConversation[]> {
    const state = await this.loadState();
    return [...state.conversations]
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit);
  }

  async readConversation(filename: string): Promise<string> {
    const state = await this.loadState();
    const fname = stripMd(filename);
    const target = state.conversations.find((c) => c.filename === fname);
    if (!target) throw new Error(`Conversation "${filename}" not found`);
    const path = join(this.root, state.options.folder, `${fname}.md`);
    return await fs.readFile(path, "utf-8");
  }

  async searchConversations(
    query: string,
    limit = 20,
  ): Promise<Array<{ filename: string; title: string; topics: string[]; snippet: string; score: number }>> {
    const state = await this.loadState();
    const q = query.toLowerCase().trim();
    if (!q) return [];

    const scored = state.conversations.map((c) => {
      let score = 0;
      const titleHit = c.title.toLowerCase().includes(q);
      if (titleHit) score += 5;
      const topicHit = c.topics.some((t) => t.toLowerCase().includes(q));
      if (topicHit) score += 3;
      let snippet = "";
      for (const m of c.messages) {
        const lc = m.content.toLowerCase();
        const idx = lc.indexOf(q);
        if (idx !== -1) {
          score += 1;
          if (!snippet) {
            const start = Math.max(0, idx - 60);
            const end = Math.min(m.content.length, idx + q.length + 60);
            snippet = (start > 0 ? "…" : "") +
              m.content.slice(start, end) +
              (end < m.content.length ? "…" : "");
          }
        }
      }
      return { c, score, snippet };
    });

    return scored
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit)
      .map(({ c, snippet, score }) => ({
        filename: c.filename,
        title: c.title,
        topics: c.topics,
        snippet,
        score,
      }));
  }

  async listTopics(): Promise<Array<{ topic: string; count: number; conversations: string[] }>> {
    const state = await this.loadState();
    const map = new Map<string, { topic: string; conversations: string[] }>();
    for (const c of state.conversations) {
      for (const t of c.topics) {
        const key = t.toLowerCase();
        const entry = map.get(key) ?? { topic: t, conversations: [] };
        entry.conversations.push(c.filename);
        map.set(key, entry);
      }
    }
    return [...map.values()]
      .map((e) => ({ topic: e.topic, count: e.conversations.length, conversations: e.conversations }))
      .sort((a, b) => b.count - a.count);
  }

  async updateOptions(partial: Partial<ExportOptions>): Promise<ExportOptions> {
    const state = await this.loadState();
    state.options = { ...state.options, ...partial };
    await this.regenerate(state);
    await this.saveState(state);
    return state.options;
  }

  async getOptions(): Promise<ExportOptions> {
    const state = await this.loadState();
    return state.options;
  }
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 12) + Date.now().toString(36);
}

function pad(n: number) {
  return n.toString().padStart(2, "0");
}

function fmtDate(ms: number): string {
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function stripMd(name: string): string {
  return name.replace(/\.md$/i, "");
}

/**
 * Pull topics from the generated topic-folder paths in a freshly-built vault
 * for a single conversation.
 */
function extractTopicsFromContent(
  files: Array<{ path: string; content: string }>,
): string[] {
  // Look at the conversation note's frontmatter "topic/<slug>" tags
  const conv = files.find((f) => !f.path.startsWith("Topics/") && f.path.endsWith(".md") && f.path !== "AI Conversations Index.md");
  if (!conv) return [];
  const fmMatch = conv.content.match(/^---\n([\s\S]*?)\n---/);
  if (!fmMatch) return [];
  const body = fmMatch[1] ?? "";
  const tagBlock = body.match(/tags:\n((?:\s+-\s+.+\n?)+)/);
  if (!tagBlock) return [];
  const lines = (tagBlock[1] ?? "").split("\n").map((l) => l.trim()).filter(Boolean);
  const topics: string[] = [];
  for (const line of lines) {
    const m = line.match(/topic\/(.+)$/);
    if (m && m[1]) {
      topics.push(m[1].replace(/-/g, " "));
    }
  }
  return topics;
}

export type { Role };
