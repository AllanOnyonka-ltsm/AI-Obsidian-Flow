export type Role = "user" | "assistant" | "system" | "tool";

export interface Message {
  role: Role;
  content: string;
  createdAt?: number;
}

export interface Conversation {
  id: string;
  title: string;
  source: "chatgpt" | "claude" | "generic" | "pasted";
  model?: string;
  createdAt?: number;
  updatedAt?: number;
  messages: Message[];
}

export interface ParseResult {
  conversations: Conversation[];
  detectedFormat: "chatgpt" | "claude" | "generic" | "unknown";
  warnings: string[];
}

function safeString(v: unknown): string {
  if (v == null) return "";
  if (typeof v === "string") return v;
  if (Array.isArray(v)) {
    return v
      .map((part) => {
        if (typeof part === "string") return part;
        if (part && typeof part === "object") {
          const obj = part as Record<string, unknown>;
          if (typeof obj.text === "string") return obj.text;
          if (typeof obj.content === "string") return obj.content;
        }
        return "";
      })
      .filter(Boolean)
      .join("\n");
  }
  if (typeof v === "object") {
    const obj = v as Record<string, unknown>;
    if (typeof obj.text === "string") return obj.text;
    if (Array.isArray(obj.parts)) return safeString(obj.parts);
  }
  return "";
}

function normalizeRole(r: unknown): Role {
  const s = String(r ?? "").toLowerCase();
  if (s === "user" || s === "human") return "user";
  if (s === "assistant" || s === "ai" || s === "model") return "assistant";
  if (s === "system") return "system";
  return "tool";
}

/**
 * ChatGPT export format: array of conversations with `mapping` graph.
 */
function parseChatGPT(data: unknown): Conversation[] {
  const arr = Array.isArray(data) ? data : [data];
  const out: Conversation[] = [];

  for (const convo of arr) {
    if (!convo || typeof convo !== "object") continue;
    const c = convo as Record<string, unknown>;
    const mapping = c.mapping as
      | Record<string, { message?: Record<string, unknown>; parent?: string; children?: string[] }>
      | undefined;
    if (!mapping || typeof mapping !== "object") continue;

    type MapNode = {
      message?: Record<string, unknown>;
      parent?: string;
      children?: string[];
    };

    // Walk the tree from the root following the first child each time.
    const root: MapNode | undefined = Object.values(mapping).find(
      (n) => !n.parent,
    );
    if (!root) continue;

    const messages: Message[] = [];
    let cursor: MapNode | undefined = root;
    const seen = new Set<string>();

    while (cursor) {
      const msg = cursor.message as Record<string, unknown> | undefined;
      if (msg) {
        const author = msg.author as Record<string, unknown> | undefined;
        const role = normalizeRole(author?.role);
        const content = msg.content as Record<string, unknown> | undefined;
        const text = safeString(content?.parts ?? content);
        if (text.trim() && role !== "tool") {
          messages.push({
            role,
            content: text,
            createdAt:
              typeof msg.create_time === "number"
                ? msg.create_time * 1000
                : undefined,
          });
        }
      }

      const childIds: string[] = cursor.children ?? [];
      const next: string | undefined = childIds.find(
        (id: string) => !seen.has(id),
      );
      if (!next) break;
      seen.add(next);
      cursor = mapping[next];
    }

    if (messages.length === 0) continue;

    const createTime = typeof c.create_time === "number" ? c.create_time * 1000 : undefined;
    const updateTime = typeof c.update_time === "number" ? c.update_time * 1000 : undefined;
    const id = String(c.conversation_id ?? c.id ?? cryptoRandomId());

    out.push({
      id,
      title: String(c.title || "Untitled conversation").trim() || "Untitled conversation",
      source: "chatgpt",
      model: typeof c.default_model_slug === "string" ? c.default_model_slug : undefined,
      createdAt: createTime,
      updatedAt: updateTime,
      messages,
    });
  }

  return out;
}

/**
 * Claude export format: { conversations: [{ name, chat_messages: [...] }] }
 * or array of conversations directly.
 */
function parseClaude(data: unknown): Conversation[] {
  const root = data as Record<string, unknown>;
  const list: unknown[] = Array.isArray(data)
    ? (data as unknown[])
    : Array.isArray(root.conversations)
      ? (root.conversations as unknown[])
      : [];

  const out: Conversation[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const rawMessages = (c.chat_messages ?? c.messages) as unknown[] | undefined;
    if (!Array.isArray(rawMessages)) continue;

    const messages: Message[] = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const obj = m as Record<string, unknown>;
      const role = normalizeRole(obj.sender ?? obj.role);
      const text = safeString(obj.text ?? obj.content);
      if (!text.trim()) continue;
      const created =
        typeof obj.created_at === "string" ? Date.parse(obj.created_at) : undefined;
      messages.push({ role, content: text, createdAt: created });
    }

    if (messages.length === 0) continue;

    const created = typeof c.created_at === "string" ? Date.parse(c.created_at) : undefined;
    const updated = typeof c.updated_at === "string" ? Date.parse(c.updated_at) : undefined;

    out.push({
      id: String(c.uuid ?? c.id ?? cryptoRandomId()),
      title:
        String(c.name || c.title || "Untitled conversation").trim() ||
        "Untitled conversation",
      source: "claude",
      createdAt: created,
      updatedAt: updated,
      messages,
    });
  }

  return out;
}

/**
 * Generic format: { title, messages: [{ role, content }] }
 */
function parseGeneric(data: unknown): Conversation[] {
  const list = Array.isArray(data) ? data : [data];
  const out: Conversation[] = [];

  for (const item of list) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const rawMessages = c.messages as unknown[] | undefined;
    if (!Array.isArray(rawMessages)) continue;

    const messages: Message[] = [];
    for (const m of rawMessages) {
      if (!m || typeof m !== "object") continue;
      const obj = m as Record<string, unknown>;
      const role = normalizeRole(obj.role ?? obj.sender);
      const text = safeString(obj.content ?? obj.text);
      if (!text.trim()) continue;
      messages.push({ role, content: text });
    }

    if (messages.length === 0) continue;

    out.push({
      id: String(c.id ?? cryptoRandomId()),
      title: String(c.title || "Untitled conversation"),
      source: "generic",
      messages,
    });
  }

  return out;
}

function cryptoRandomId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2, 12);
}

export function parseExport(raw: string): ParseResult {
  const warnings: string[] = [];
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch (err) {
    warnings.push(`Could not parse JSON: ${(err as Error).message}`);
    return { conversations: [], detectedFormat: "unknown", warnings };
  }

  // ChatGPT detection
  const sample = Array.isArray(data) ? data[0] : data;
  if (sample && typeof sample === "object" && "mapping" in (sample as object)) {
    const conversations = parseChatGPT(data);
    return { conversations, detectedFormat: "chatgpt", warnings };
  }

  // Claude detection
  const claudeCheck =
    sample && typeof sample === "object" &&
    ("chat_messages" in (sample as object) || "uuid" in (sample as object));
  const claudeWrapper =
    !Array.isArray(data) && data && typeof data === "object" &&
    Array.isArray((data as Record<string, unknown>).conversations);
  if (claudeCheck || claudeWrapper) {
    const conversations = parseClaude(data);
    return { conversations, detectedFormat: "claude", warnings };
  }

  // Generic
  const generic = parseGeneric(data);
  if (generic.length) {
    return { conversations: generic, detectedFormat: "generic", warnings };
  }

  warnings.push("Could not detect a known format. Expected ChatGPT, Claude, or generic JSON.");
  return { conversations: [], detectedFormat: "unknown", warnings };
}

export function parsePastedConversation(text: string, title?: string): Conversation {
  // Parse a transcript of "User:" / "Assistant:" lines.
  const lines = text.split(/\r?\n/);
  const messages: Message[] = [];
  let role: Role | null = null;
  let buf: string[] = [];

  const flush = () => {
    if (role && buf.length) {
      const content = buf.join("\n").trim();
      if (content) messages.push({ role, content });
    }
    buf = [];
  };

  const roleRegex = /^(user|you|human|assistant|ai|chatgpt|claude|gpt|model|system)\s*[:>-]\s*/i;

  for (const line of lines) {
    const m = line.match(roleRegex);
    if (m) {
      flush();
      role = normalizeRole(m[1]);
      buf.push(line.slice(m[0].length));
    } else {
      buf.push(line);
    }
  }
  flush();

  if (messages.length === 0 && text.trim()) {
    messages.push({ role: "user", content: text.trim() });
  }

  return {
    id: cryptoRandomId(),
    title: title?.trim() || "Pasted conversation",
    source: "pasted",
    messages,
    createdAt: Date.now(),
  };
}
