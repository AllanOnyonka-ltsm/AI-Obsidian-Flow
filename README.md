# AI Obsidian Flow

Turn your AI chat history into a linked [Obsidian](https://obsidian.md) vault.

## Two ways in

**1. Web exporter** (`artifacts/obsidian-exporter`)
Import a ChatGPT or Claude export, a generic JSON export or a pasted transcript, and download
a ZIP of Obsidian notes. Each note has YAML frontmatter and `[[wikilinks]]`, plus topic notes
and a master index, so Obsidian's graph view shows real connections. A live force-graph
preview shows conversations and topics before you export. It runs entirely in the browser,
with no backend.

**2. MCP server** (`lib/mcp-obsidian-server`)
A local Model Context Protocol server that lets Claude Desktop, Cursor, Continue and other
MCP clients save the current chat straight into your vault, without exporting. Its tools are
`save_brainstorm`, `append_to_brainstorm`, `list_brainstorms`, `search_brainstorms`,
`read_brainstorm`, `list_topics`, `regenerate_vault` and `update_options`.

Set the vault folder with the `OBSIDIAN_VAULT_PATH` environment variable. The web app's `/mcp`
page has copy-paste setup for each client.

Both parts share `lib/obsidian-core` (conversation parsers, topic extraction and the vault
generator), so they always produce the same note format.

## Develop

A pnpm workspace (Node.js 24, TypeScript 5.9):

```bash
pnpm install
pnpm run typecheck
pnpm run build
pnpm --filter @workspace/mcp-obsidian-server run build
```

More detail on the workspace layout is in `replit.md`.
