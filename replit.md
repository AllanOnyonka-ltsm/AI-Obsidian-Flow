# Workspace

## Overview

pnpm workspace monorepo using TypeScript. Each package manages its own dependencies.

## Stack

- **Monorepo tool**: pnpm workspaces
- **Node.js version**: 24
- **Package manager**: pnpm
- **TypeScript version**: 5.9
- **API framework**: Express 5
- **Database**: PostgreSQL + Drizzle ORM
- **Validation**: Zod (`zod/v4`), `drizzle-zod`
- **API codegen**: Orval (from OpenAPI spec)
- **Build**: esbuild (CJS bundle)

## Key Commands

- `pnpm run typecheck` — full typecheck across all packages
- `pnpm run build` — typecheck + build all packages
- `pnpm --filter @workspace/api-spec run codegen` — regenerate API hooks and Zod schemas from OpenAPI spec
- `pnpm --filter @workspace/db run push` — push DB schema changes (dev only)
- `pnpm --filter @workspace/api-server run dev` — run API server locally

See the `pnpm-workspace` skill for workspace structure, TypeScript setup, and package details.

## Artifacts

- `artifacts/obsidian-exporter` — React + Vite web app at `/`. Client-side tool that imports ChatGPT/Claude/generic JSON exports (or pasted transcripts) and produces a downloadable ZIP of Obsidian markdown notes with YAML frontmatter, `[[wikilinks]]`, topic notes, and a master index, all wired so the Obsidian graph view shows real connections. Includes a live force-graph preview of conversations and topics. Also serves the bundled MCP server at `/mcp-obsidian-server.mjs` and a setup page at `/mcp` with copy-paste configs for Claude Desktop, Cursor, and Continue. Pure frontend, no backend.

## Shared Libraries

- `lib/obsidian-core` — shared composite TS lib with the conversation parsers, topic extractor, and Obsidian markdown/vault generator. Used by both the web exporter and the MCP server so the output format stays in sync.

## Standalone Packages

- `lib/mcp-obsidian-server` — Model Context Protocol server (Node.js, stdio transport). Runs locally on the user's machine and lets MCP-aware AI clients (Claude Desktop, Cursor, Continue, etc.) save the current chat directly into the user's Obsidian vault without exporting. Tools: `save_brainstorm`, `append_to_brainstorm`, `list_brainstorms`, `search_brainstorms`, `read_brainstorm`, `list_topics`, `regenerate_vault`, `update_options`. Vault path is read from `OBSIDIAN_VAULT_PATH`. State is tracked in `<vault>/.obsidian-mcp/state.json`. Build with `pnpm --filter @workspace/mcp-obsidian-server run build` — bundles to a single `dist/index.mjs` and copies it to `artifacts/obsidian-exporter/public/mcp-obsidian-server.mjs` for download.
