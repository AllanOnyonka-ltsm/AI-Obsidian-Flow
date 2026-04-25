import type { Conversation, Message } from "./parsers";
import { extractKeywords, toTag, toTitleCase } from "./topics";

export interface ExportOptions {
  includeBacklinks: boolean;
  includeTopicNotes: boolean;
  includeMOC: boolean;
  folder: string;
  topicFolder: string;
  maxTopicsPerConversation: number;
  includeSystemMessages: boolean;
  collapseAssistantHeaders: boolean;
  authorLabels: { user: string; assistant: string; system: string };
}

export const defaultOptions: ExportOptions = {
  includeBacklinks: true,
  includeTopicNotes: true,
  includeMOC: true,
  folder: "Conversations",
  topicFolder: "Topics",
  maxTopicsPerConversation: 6,
  includeSystemMessages: false,
  collapseAssistantHeaders: false,
  authorLabels: { user: "User", assistant: "Assistant", system: "System" },
};

export interface ObsidianFile {
  path: string;
  content: string;
}

export interface ConversationPlan {
  conv: Conversation;
  topics: string[];
  filename: string;
}

function pad(n: number): string {
  return n.toString().padStart(2, "0");
}

function fmtDate(ms?: number): string {
  if (!ms || Number.isNaN(ms)) return new Date().toISOString().split("T")[0]!;
  const d = new Date(ms);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtDateTime(ms?: number): string {
  if (!ms || Number.isNaN(ms)) return "";
  const d = new Date(ms);
  return `${fmtDate(ms)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Sanitize a filename to be safe for Obsidian / most filesystems.
 * Obsidian forbids: # ^ [ ] | \ / : ? "
 */
export function sanitizeFilename(name: string): string {
  const cleaned = name
    .replace(/[#^\[\]|\\\/:?"<>*]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  const truncated = cleaned.length > 80 ? cleaned.slice(0, 80).trim() : cleaned;
  return truncated || "Untitled";
}

function escapeYamlString(s: string): string {
  if (s === "") return '""';
  if (/[:#&*!|>%@`'"\n\r]/.test(s) || /^[-?]/.test(s)) {
    return `"${s.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }
  return s;
}

function buildFrontmatter(props: Record<string, unknown>): string {
  const lines: string[] = ["---"];
  for (const [key, value] of Object.entries(props)) {
    if (value == null) continue;
    if (Array.isArray(value)) {
      if (value.length === 0) continue;
      lines.push(`${key}:`);
      for (const v of value) {
        lines.push(`  - ${escapeYamlString(String(v))}`);
      }
    } else {
      lines.push(`${key}: ${escapeYamlString(String(value))}`);
    }
  }
  lines.push("---", "");
  return lines.join("\n");
}

function renderMessage(
  msg: Message,
  opts: ExportOptions,
): string {
  const label =
    msg.role === "user"
      ? opts.authorLabels.user
      : msg.role === "assistant"
        ? opts.authorLabels.assistant
        : msg.role === "system"
          ? opts.authorLabels.system
          : "Tool";

  const time = msg.createdAt ? `  · ${fmtDateTime(msg.createdAt)}` : "";

  if (opts.collapseAssistantHeaders && msg.role === "assistant") {
    return msg.content.trim() + "\n";
  }

  return `### ${label}${time}\n\n${msg.content.trim()}\n`;
}

function planFilenames(plans: ConversationPlan[]): void {
  const used = new Map<string, number>();
  for (const plan of plans) {
    const datePrefix = fmtDate(plan.conv.createdAt ?? plan.conv.updatedAt);
    const base = `${datePrefix} ${sanitizeFilename(plan.conv.title)}`;
    const count = used.get(base) ?? 0;
    used.set(base, count + 1);
    plan.filename = count === 0 ? base : `${base} (${count + 1})`;
  }
}

export function planConversations(
  conversations: Conversation[],
  opts: ExportOptions,
): ConversationPlan[] {
  const plans: ConversationPlan[] = conversations.map((conv) => ({
    conv,
    topics: extractKeywords(conv, opts.maxTopicsPerConversation),
    filename: "",
  }));
  planFilenames(plans);
  return plans;
}

function buildConversationNote(
  plan: ConversationPlan,
  opts: ExportOptions,
  topicLinkTargets: Map<string, string>,
): string {
  const { conv, topics } = plan;

  const tags = ["ai-conversation", `source/${conv.source}`];
  if (conv.model) tags.push(`model/${toTag(conv.model)}`);

  const linkedTopics = topics.map((t) => `[[${topicLinkTargets.get(toTag(t)) ?? toTitleCase(t)}]]`);
  const aliasList = topics.slice(0, 3).map((t) => toTitleCase(t));

  const fm = buildFrontmatter({
    title: conv.title,
    source: conv.source,
    model: conv.model,
    created: fmtDateTime(conv.createdAt),
    updated: fmtDateTime(conv.updatedAt),
    message_count: conv.messages.length,
    aliases: aliasList,
    tags: [...tags, ...topics.map((t) => `topic/${toTag(t)}`)],
  });

  const header = `# ${conv.title}\n`;

  const meta: string[] = [];
  if (conv.source) meta.push(`**Source:** ${conv.source}`);
  if (conv.model) meta.push(`**Model:** ${conv.model}`);
  if (conv.createdAt) meta.push(`**Date:** ${fmtDateTime(conv.createdAt)}`);
  meta.push(`**Messages:** ${conv.messages.length}`);
  const metaBlock = meta.join("  ·  ") + "\n";

  const topicsBlock = linkedTopics.length
    ? `\n**Topics:** ${linkedTopics.join(" · ")}\n`
    : "";

  const messagesBlock = conv.messages
    .filter((m) => opts.includeSystemMessages || m.role !== "system")
    .map((m) => renderMessage(m, opts))
    .join("\n");

  return `${fm}${header}\n${metaBlock}${topicsBlock}\n---\n\n${messagesBlock}\n`;
}

function buildTopicNote(
  topic: string,
  conversations: ConversationPlan[],
  opts: ExportOptions,
): string {
  const fm = buildFrontmatter({
    title: toTitleCase(topic),
    type: "topic",
    aliases: [toTitleCase(topic), topic],
    tags: ["topic", `topic/${toTag(topic)}`],
  });

  const intro = `# ${toTitleCase(topic)}\n\nA topic that surfaced across ${conversations.length} AI conversation${conversations.length === 1 ? "" : "s"}.\n`;

  const list = conversations
    .map(
      (p) =>
        `- [[${opts.folder}/${p.filename}|${p.conv.title}]]${p.conv.createdAt ? `  · *${fmtDate(p.conv.createdAt)}*` : ""}`,
    )
    .join("\n");

  return `${fm}${intro}\n## Conversations\n\n${list}\n`;
}

function buildMOC(plans: ConversationPlan[], opts: ExportOptions): string {
  const fm = buildFrontmatter({
    title: "AI Conversations Index",
    type: "moc",
    aliases: ["AI Conversations", "Index"],
    tags: ["moc", "ai-conversation"],
  });

  const bySource = new Map<string, ConversationPlan[]>();
  for (const plan of plans) {
    const arr = bySource.get(plan.conv.source) ?? [];
    arr.push(plan);
    bySource.set(plan.conv.source, arr);
  }

  let body = `# AI Conversations Index\n\nGenerated index of **${plans.length}** conversations exported to your vault.\n`;

  for (const [source, list] of bySource) {
    body += `\n## ${toTitleCase(source)} (${list.length})\n\n`;
    const sorted = [...list].sort(
      (a, b) => (b.conv.createdAt ?? 0) - (a.conv.createdAt ?? 0),
    );
    for (const p of sorted) {
      const dateStr = p.conv.createdAt ? `*${fmtDate(p.conv.createdAt)}* · ` : "";
      body += `- ${dateStr}[[${opts.folder}/${p.filename}|${p.conv.title}]]\n`;
    }
  }

  return `${fm}${body}\n`;
}

export function buildVault(
  conversations: Conversation[],
  opts: ExportOptions,
): ObsidianFile[] {
  const plans = planConversations(conversations, opts);

  // Build topic -> conversations map
  const topicMap = new Map<string, { topic: string; plans: ConversationPlan[] }>();
  for (const plan of plans) {
    for (const topic of plan.topics) {
      const tag = toTag(topic);
      const entry = topicMap.get(tag) ?? { topic, plans: [] };
      entry.plans.push(plan);
      topicMap.set(tag, entry);
    }
  }

  // Map topic-tag to its filename target so conversation notes link to the
  // exact file path Obsidian will resolve.
  const topicLinkTargets = new Map<string, string>();
  for (const [tag, { topic }] of topicMap) {
    if (opts.includeTopicNotes) {
      topicLinkTargets.set(tag, `${opts.topicFolder}/${toTitleCase(topic)}`);
    } else {
      topicLinkTargets.set(tag, toTitleCase(topic));
    }
  }

  const files: ObsidianFile[] = [];

  for (const plan of plans) {
    files.push({
      path: `${opts.folder}/${plan.filename}.md`,
      content: buildConversationNote(plan, opts, topicLinkTargets),
    });
  }

  if (opts.includeTopicNotes) {
    for (const { topic, plans: linked } of topicMap.values()) {
      // Only emit topic notes that link >=2 conversations or have a backlinkable
      // unique value. Keeps the vault clean.
      if (linked.length === 0) continue;
      files.push({
        path: `${opts.topicFolder}/${toTitleCase(topic)}.md`,
        content: buildTopicNote(topic, linked, opts),
      });
    }
  }

  if (opts.includeMOC && plans.length) {
    files.push({
      path: `AI Conversations Index.md`,
      content: buildMOC(plans, opts),
    });
  }

  return files;
}
