import { useState } from "react";
import { Link } from "wouter";
import {
  ArrowLeft,
  Check,
  Copy,
  Download,
  FolderOpen,
  Network,
  Plug,
  Sparkles,
  Terminal,
  Wrench,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const SERVER_URL = `${import.meta.env.BASE_URL}mcp-obsidian-server.mjs`;

const TOOLS = [
  {
    name: "save_brainstorm",
    desc: "Save the current chat as a properly formatted Obsidian note with [[wikilinks]] and tags.",
  },
  {
    name: "append_to_brainstorm",
    desc: "Add new messages onto a previously saved note.",
  },
  {
    name: "list_brainstorms",
    desc: "List recent saved notes, most recently updated first.",
  },
  {
    name: "search_brainstorms",
    desc: "Search by title, topic, or message text. Returns matching notes with snippets.",
  },
  {
    name: "read_brainstorm",
    desc: "Read the full markdown of a saved note to bring prior context into this chat.",
  },
  {
    name: "list_topics",
    desc: "Get every topic in your vault with how many conversations reference it.",
  },
  {
    name: "regenerate_vault",
    desc: "Rebuild every note, topic, and the index from saved state.",
  },
  {
    name: "update_options",
    desc: "Change folder names, topic count, and other formatting preferences.",
  },
];

const EXAMPLE_PROMPTS = [
  "Save this brainstorm to my Obsidian vault as 'Espresso shot tuning'.",
  "What did we discuss about pgvector last week? Pull up that note.",
  "Add this new follow-up to yesterday's note on sourdough hydration.",
  "List my recent brainstorms.",
  "What topics have I been thinking about most?",
];

function CodeBlock({ children, id }: { children: string; id: string }) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);

  const onCopy = async () => {
    try {
      await navigator.clipboard.writeText(children);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast({ title: "Copy failed", description: "Select and copy manually.", variant: "destructive" });
    }
  };

  return (
    <div className="relative group" data-testid={`code-${id}`}>
      <pre className="rounded-md border border-border bg-muted/40 p-4 text-xs overflow-x-auto font-mono leading-relaxed">
        <code>{children}</code>
      </pre>
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={onCopy}
        aria-label="Copy"
        data-testid={`button-copy-${id}`}
      >
        {copied ? <Check className="size-4 text-primary" /> : <Copy className="size-4" />}
      </Button>
    </div>
  );
}

export default function McpSetup() {
  const claudeDesktop = `{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-obsidian-server.mjs"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/absolute/path/to/your/Obsidian Vault"
      }
    }
  }
}`;

  const cursorConfig = `{
  "mcpServers": {
    "obsidian": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-obsidian-server.mjs"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/absolute/path/to/your/Obsidian Vault"
      }
    }
  }
}`;

  const continueConfig = `// In ~/.continue/config.json under "experimental"
"modelContextProtocolServers": [
  {
    "transport": {
      "type": "stdio",
      "command": "node",
      "args": ["/absolute/path/to/mcp-obsidian-server.mjs"],
      "env": {
        "OBSIDIAN_VAULT_PATH": "/absolute/path/to/your/Obsidian Vault"
      }
    }
  }
]`;

  const macInstall = `# 1. Download the server (button above) into a folder you control
mkdir -p ~/mcp && mv ~/Downloads/mcp-obsidian-server.mjs ~/mcp/

# 2. Make it executable (optional)
chmod +x ~/mcp/mcp-obsidian-server.mjs

# 3. Find your vault path (open Obsidian → Settings → About → vault path)
#    e.g. /Users/you/Documents/MyVault

# 4. Add the config snippet below to your AI client and restart it.`;

  const winInstall = `:: 1. Download mcp-obsidian-server.mjs (button above) e.g. to C:\\mcp\\
:: 2. Make sure Node.js 18+ is installed: node --version
:: 3. Find your vault path in Obsidian → Settings → About
::    e.g. C:\\Users\\you\\Documents\\MyVault
:: 4. Add the config snippet below to your AI client and restart it.`;

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid-bg absolute inset-0 -z-10 opacity-60 pointer-events-none" />

      <header className="border-b border-border bg-background/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-md">
              <Network className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">AI &rarr; Obsidian</h1>
              <p className="text-xs text-muted-foreground leading-tight">MCP server setup</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" asChild data-testid="link-back">
            <Link href="/">
              <ArrowLeft className="mr-1.5 size-4" />
              Back to exporter
            </Link>
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-10 space-y-10">
        <section className="space-y-4">
          <Badge variant="secondary" className="gap-1.5">
            <Sparkles className="size-3" />
            Live capture · No exports needed
          </Badge>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
            Let your AI <span className="text-primary">save brainstorms</span> straight to Obsidian.
          </h2>
          <p className="text-base text-muted-foreground max-w-2xl">
            This is a small local server that plugs into any MCP-compatible AI client (Claude
            Desktop, Cursor, Continue, etc.). When you say <em>"save this"</em> or <em>"what did we
            decide about X"</em>, your AI calls the server directly — your notes appear in your
            vault with topic links and frontmatter, and your conversations never leave your
            machine.
          </p>

          <div className="flex flex-wrap items-center gap-3 pt-2">
            <Button asChild size="lg" data-testid="button-download-server">
              <a href={SERVER_URL} download="mcp-obsidian-server.mjs">
                <Download className="mr-2 size-4" />
                Download server (single file)
              </a>
            </Button>
            <span className="text-xs text-muted-foreground">
              Requires Node.js 18+ on your machine.
            </span>
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <FolderOpen className="size-5 text-primary" />
            Step 1 · Get the file in place
          </h3>
          <Tabs defaultValue="mac">
            <TabsList>
              <TabsTrigger value="mac" data-testid="tab-mac">macOS / Linux</TabsTrigger>
              <TabsTrigger value="win" data-testid="tab-win">Windows</TabsTrigger>
            </TabsList>
            <TabsContent value="mac" className="pt-3">
              <CodeBlock id="install-mac">{macInstall}</CodeBlock>
            </TabsContent>
            <TabsContent value="win" className="pt-3">
              <CodeBlock id="install-win">{winInstall}</CodeBlock>
            </TabsContent>
          </Tabs>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Plug className="size-5 text-primary" />
            Step 2 · Plug it into your AI client
          </h3>
          <p className="text-sm text-muted-foreground">
            Replace the two paths in the snippet below — one to the file you just downloaded, one
            to your Obsidian vault folder.
          </p>

          <Tabs defaultValue="claude">
            <TabsList>
              <TabsTrigger value="claude" data-testid="tab-claude">Claude Desktop</TabsTrigger>
              <TabsTrigger value="cursor" data-testid="tab-cursor">Cursor</TabsTrigger>
              <TabsTrigger value="continue" data-testid="tab-continue">Continue</TabsTrigger>
            </TabsList>
            <TabsContent value="claude" className="pt-3 space-y-3">
              <p className="text-sm">
                Edit{" "}
                <code className="text-xs px-1.5 py-0.5 rounded bg-muted">
                  ~/Library/Application Support/Claude/claude_desktop_config.json
                </code>{" "}
                (macOS) or{" "}
                <code className="text-xs px-1.5 py-0.5 rounded bg-muted">
                  %APPDATA%\Claude\claude_desktop_config.json
                </code>{" "}
                (Windows). Add this entry, then quit and reopen Claude Desktop.
              </p>
              <CodeBlock id="cfg-claude">{claudeDesktop}</CodeBlock>
            </TabsContent>
            <TabsContent value="cursor" className="pt-3 space-y-3">
              <p className="text-sm">
                In Cursor: <strong>Settings &rarr; Features &rarr; MCP &rarr; Add new MCP server</strong>{" "}
                — paste this and restart Cursor.
              </p>
              <CodeBlock id="cfg-cursor">{cursorConfig}</CodeBlock>
            </TabsContent>
            <TabsContent value="continue" className="pt-3 space-y-3">
              <p className="text-sm">Edit your Continue config and add this entry:</p>
              <CodeBlock id="cfg-continue">{continueConfig}</CodeBlock>
            </TabsContent>
          </Tabs>
        </section>

        <section className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Terminal className="size-5 text-primary" />
            Step 3 · Just talk to your AI
          </h3>
          <p className="text-sm text-muted-foreground">
            Once it's configured, your AI can call the server on its own. Here are prompts that
            will trigger it:
          </p>
          <div className="grid sm:grid-cols-2 gap-3">
            {EXAMPLE_PROMPTS.map((p, i) => (
              <Card key={i} className="bg-muted/30 hover-elevate" data-testid={`example-${i}`}>
                <CardContent className="p-4 text-sm italic">"{p}"</CardContent>
              </Card>
            ))}
          </div>
        </section>

        <Separator />

        <section className="space-y-4">
          <h3 className="text-xl font-semibold flex items-center gap-2">
            <Wrench className="size-5 text-primary" />
            What the AI can do
          </h3>
          <p className="text-sm text-muted-foreground">
            These are the actions the server exposes. Your AI picks the right one based on what
            you ask.
          </p>
          <div className="grid gap-3">
            {TOOLS.map((t) => (
              <Card key={t.name} data-testid={`tool-${t.name}`}>
                <CardContent className="p-4 flex items-start gap-4">
                  <code className="text-xs font-mono px-2 py-1 rounded bg-primary/10 text-primary whitespace-nowrap">
                    {t.name}
                  </code>
                  <p className="text-sm text-muted-foreground">{t.desc}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xl font-semibold">Notes</h3>
          <ul className="list-disc list-inside text-sm text-muted-foreground space-y-1.5 pl-1">
            <li>
              The server runs entirely on your computer — your conversations never go to a third
              party.
            </li>
            <li>
              Notes land in <code className="text-xs px-1.5 py-0.5 rounded bg-muted">Conversations/</code>,
              topic notes in <code className="text-xs px-1.5 py-0.5 rounded bg-muted">Topics/</code>, plus
              an <code className="text-xs px-1.5 py-0.5 rounded bg-muted">AI Conversations Index.md</code>{" "}
              master note. Topic notes link back to every conversation that mentions them, so
              Obsidian's graph view fills in automatically.
            </li>
            <li>
              The server keeps a small state file at{" "}
              <code className="text-xs px-1.5 py-0.5 rounded bg-muted">.obsidian-mcp/state.json</code>{" "}
              inside your vault to track what it has saved. Safe to back up; safe to delete to
              start over.
            </li>
            <li>
              Need to inspect or extend the server? It's a single bundled JS file you can read and
              edit.
            </li>
          </ul>
        </section>
      </main>
    </div>
  );
}
