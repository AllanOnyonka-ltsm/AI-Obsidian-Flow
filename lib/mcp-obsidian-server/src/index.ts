import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  type CallToolResult,
} from "@modelcontextprotocol/sdk/types.js";
import { z } from "zod";
import { resolve } from "node:path";
import { Vault } from "./vault.ts";

const VAULT_PATH = process.env.OBSIDIAN_VAULT_PATH;
if (!VAULT_PATH) {
  console.error(
    "[mcp-obsidian] OBSIDIAN_VAULT_PATH env var is required. " +
      "Set it to the absolute path of your Obsidian vault.",
  );
  process.exit(1);
}

const vault = new Vault(resolve(VAULT_PATH));

const messageSchema = z.object({
  role: z.enum(["user", "assistant", "system", "tool"]),
  content: z.string(),
});

const tools = [
  {
    name: "save_brainstorm",
    description:
      "Save the current conversation, brainstorm, or notes to the user's Obsidian vault as a properly formatted note. " +
      "Automatically extracts topics and creates [[wikilinks]] so the note appears in Obsidian's graph view. " +
      "Call this whenever the user says 'save this', 'add to my vault', 'note this', 'capture this', or similar.",
    inputSchema: {
      type: "object",
      properties: {
        title: {
          type: "string",
          description: "Short title for the note. Use a clear, descriptive title.",
        },
        messages: {
          type: "array",
          description:
            "Ordered list of messages in the conversation. Include the user's prompts and your responses.",
          items: {
            type: "object",
            properties: {
              role: {
                type: "string",
                enum: ["user", "assistant", "system", "tool"],
              },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
        },
        topics: {
          type: "array",
          description:
            "Optional list of topics/keywords for this note. If omitted, topics are auto-extracted.",
          items: { type: "string" },
        },
        source: {
          type: "string",
          enum: ["chatgpt", "claude", "generic", "pasted"],
          description: "Source AI assistant. Defaults to 'generic'.",
        },
        model: {
          type: "string",
          description: "Optional model name (e.g. 'claude-sonnet-4').",
        },
      },
      required: ["title", "messages"],
    },
  },
  {
    name: "append_to_brainstorm",
    description:
      "Add new messages to a previously saved conversation note. Use when the user says 'continue the X note', " +
      "'add this to yesterday's brainstorm about Y', or wants to extend an existing thread.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename of the saved note (without .md). Use list_brainstorms to find it.",
        },
        messages: {
          type: "array",
          items: {
            type: "object",
            properties: {
              role: { type: "string", enum: ["user", "assistant", "system", "tool"] },
              content: { type: "string" },
            },
            required: ["role", "content"],
          },
        },
      },
      required: ["filename", "messages"],
    },
  },
  {
    name: "list_brainstorms",
    description:
      "List recent saved conversations in the user's vault, most recently updated first.",
    inputSchema: {
      type: "object",
      properties: {
        limit: { type: "number", description: "Max results (default 20)" },
      },
    },
  },
  {
    name: "search_brainstorms",
    description:
      "Search saved conversations by title, topic, or message content. Returns matching notes with snippets. " +
      "Use this when the user asks 'what did we discuss about X' or 'find my notes on Y'.",
    inputSchema: {
      type: "object",
      properties: {
        query: { type: "string", description: "Search text" },
        limit: { type: "number", description: "Max results (default 10)" },
      },
      required: ["query"],
    },
  },
  {
    name: "read_brainstorm",
    description:
      "Read the full markdown content of a saved conversation note. Use this to bring prior context " +
      "into the current conversation before extending or referencing it.",
    inputSchema: {
      type: "object",
      properties: {
        filename: {
          type: "string",
          description: "Filename of the note (without .md).",
        },
      },
      required: ["filename"],
    },
  },
  {
    name: "list_topics",
    description:
      "List all topics in the vault with how many conversations reference each one. " +
      "Useful for showing the user what themes their brainstorms cover.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "regenerate_vault",
    description:
      "Rebuild every note, topic note, and the index from saved state. " +
      "Use this after the user changes export preferences via update_options.",
    inputSchema: { type: "object", properties: {} },
  },
  {
    name: "update_options",
    description:
      "Change how notes are formatted (folder names, topic count, etc.) and regenerate the vault.",
    inputSchema: {
      type: "object",
      properties: {
        folder: { type: "string" },
        topicFolder: { type: "string" },
        maxTopicsPerConversation: { type: "number" },
        includeTopicNotes: { type: "boolean" },
        includeMOC: { type: "boolean" },
        includeSystemMessages: { type: "boolean" },
        collapseAssistantHeaders: { type: "boolean" },
      },
    },
  },
] as const;

const server = new Server(
  {
    name: "obsidian-brainstorm",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  },
);

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools,
}));

function ok(text: string): CallToolResult {
  return { content: [{ type: "text", text }] };
}

function err(text: string): CallToolResult {
  return { isError: true, content: [{ type: "text", text }] };
}

server.setRequestHandler(CallToolRequestSchema, async (req) => {
  const { name, arguments: args = {} } = req.params;
  try {
    switch (name) {
      case "save_brainstorm": {
        const parsed = z
          .object({
            title: z.string().min(1),
            messages: z.array(messageSchema).min(1),
            topics: z.array(z.string()).optional(),
            source: z.enum(["chatgpt", "claude", "generic", "pasted"]).optional(),
            model: z.string().optional(),
          })
          .parse(args);

        const result = await vault.saveConversation(parsed);
        return ok(
          `Saved to ${result.vaultPath}\nTopics: ${
            result.topics.length ? result.topics.join(", ") : "(none extracted)"
          }`,
        );
      }
      case "append_to_brainstorm": {
        const parsed = z
          .object({
            filename: z.string(),
            messages: z.array(messageSchema).min(1),
          })
          .parse(args);
        const result = await vault.appendToConversation(parsed.filename, parsed.messages);
        return ok(
          `Appended ${parsed.messages.length} message(s) to "${result.filename}". Total messages: ${result.messageCount}.`,
        );
      }
      case "list_brainstorms": {
        const parsed = z
          .object({ limit: z.number().int().positive().optional() })
          .parse(args);
        const list = await vault.listConversations(parsed.limit ?? 20);
        if (!list.length) return ok("No saved conversations yet.");
        const out = list
          .map(
            (c) =>
              `- ${c.filename}\n  title: ${c.title}\n  topics: ${
                c.topics.join(", ") || "(none)"
              }\n  updated: ${new Date(c.updatedAt).toISOString()}`,
          )
          .join("\n\n");
        return ok(out);
      }
      case "search_brainstorms": {
        const parsed = z
          .object({
            query: z.string().min(1),
            limit: z.number().int().positive().optional(),
          })
          .parse(args);
        const matches = await vault.searchConversations(parsed.query, parsed.limit ?? 10);
        if (!matches.length) return ok(`No matches for "${parsed.query}".`);
        const out = matches
          .map(
            (m) =>
              `- ${m.filename} (score ${m.score})\n  title: ${m.title}\n  topics: ${
                m.topics.join(", ") || "(none)"
              }\n  snippet: ${m.snippet || "(matched in title/topics)"}`,
          )
          .join("\n\n");
        return ok(out);
      }
      case "read_brainstorm": {
        const parsed = z.object({ filename: z.string() }).parse(args);
        const md = await vault.readConversation(parsed.filename);
        return ok(md);
      }
      case "list_topics": {
        const list = await vault.listTopics();
        if (!list.length) return ok("No topics yet.");
        const out = list
          .map((t) => `- ${t.topic} (${t.count})`)
          .join("\n");
        return ok(out);
      }
      case "regenerate_vault": {
        const state = await vault.loadState();
        const r = await vault.regenerate(state);
        return ok(`Regenerated ${r.written} files in vault.`);
      }
      case "update_options": {
        const parsed = z
          .object({
            folder: z.string().optional(),
            topicFolder: z.string().optional(),
            maxTopicsPerConversation: z.number().int().positive().optional(),
            includeTopicNotes: z.boolean().optional(),
            includeMOC: z.boolean().optional(),
            includeSystemMessages: z.boolean().optional(),
            collapseAssistantHeaders: z.boolean().optional(),
          })
          .parse(args);
        const opts = await vault.updateOptions(parsed);
        return ok(`Updated options:\n${JSON.stringify(opts, null, 2)}`);
      }
      default:
        return err(`Unknown tool: ${name}`);
    }
  } catch (e) {
    return err(`Tool ${name} failed: ${(e as Error).message}`);
  }
});

const transport = new StdioServerTransport();
await server.connect(transport);
console.error(
  `[mcp-obsidian] ready · vault=${VAULT_PATH} · tools=${tools.map((t) => t.name).join(", ")}`,
);
