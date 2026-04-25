import { useMemo, useState } from "react";
import { Download, Github, Sparkles, Network, FolderTree, Tags } from "lucide-react";
import JSZip from "jszip";
import { saveAs } from "file-saver";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { Separator } from "@/components/ui/separator";

import { Uploader } from "@/components/Uploader";
import { OptionsPanel } from "@/components/OptionsPanel";
import { ConversationList } from "@/components/ConversationList";
import { GraphPreview } from "@/components/GraphPreview";
import { PreviewPane } from "@/components/PreviewPane";

import {
  parseExport,
  parsePastedConversation,
  type Conversation,
} from "@/lib/parsers";
import {
  buildVault,
  defaultOptions,
  planConversations,
  type ExportOptions,
} from "@/lib/obsidian";
import { buildTopicGraph } from "@/lib/topics";

const SAMPLE_URL = `${import.meta.env.BASE_URL}sample-conversations.json`;

export default function Home() {
  const { toast } = useToast();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [options, setOptions] = useState<ExportOptions>(defaultOptions);
  const [detectedFormat, setDetectedFormat] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const plans = useMemo(
    () => (conversations.length ? planConversations(conversations, options) : []),
    [conversations, options],
  );

  const files = useMemo(
    () => (conversations.length ? buildVault(conversations, options) : []),
    [conversations, options],
  );

  const graph = useMemo(
    () =>
      buildTopicGraph(
        plans.map((p) => ({ conv: p.conv, topics: p.topics })),
      ),
    [plans],
  );

  const totalMessages = useMemo(
    () => conversations.reduce((sum, c) => sum + c.messages.length, 0),
    [conversations],
  );
  const topicCount = useMemo(
    () => graph.nodes.filter((n) => n.type === "topic").length,
    [graph],
  );

  function handleLoadJson(raw: string, source: string) {
    const result = parseExport(raw);
    if (result.conversations.length === 0) {
      toast({
        title: "Could not load file",
        description:
          result.warnings[0] ??
          "No conversations were detected in the file. Make sure it's a ChatGPT or Claude export.",
        variant: "destructive",
      });
      return;
    }
    setConversations(result.conversations);
    setDetectedFormat(result.detectedFormat);
    toast({
      title: "Loaded successfully",
      description: `${result.conversations.length} conversation(s) detected from ${source} (${result.detectedFormat}).`,
    });
  }

  function handleLoadPasted(text: string, title: string) {
    const conv = parsePastedConversation(text, title);
    if (conv.messages.length === 0) {
      toast({
        title: "Nothing to load",
        description: "Paste at least one message before loading.",
        variant: "destructive",
      });
      return;
    }
    setConversations([conv]);
    setDetectedFormat("pasted");
    toast({
      title: "Conversation loaded",
      description: `${conv.messages.length} message(s) ready to export.`,
    });
  }

  async function handleLoadSample() {
    try {
      setBusy(true);
      const res = await fetch(SAMPLE_URL);
      if (!res.ok) throw new Error(`Sample file not found (${res.status})`);
      const text = await res.text();
      handleLoadJson(text, "sample-conversations.json");
    } catch (err) {
      toast({
        title: "Could not load sample",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  async function handleExport() {
    if (files.length === 0) return;
    setBusy(true);
    try {
      const zip = new JSZip();
      for (const file of files) {
        zip.file(file.path, file.content);
      }
      const blob = await zip.generateAsync({ type: "blob" });
      const stamp = new Date().toISOString().split("T")[0];
      saveAs(blob, `obsidian-export-${stamp}.zip`);
      toast({
        title: "Export ready",
        description: `${files.length} markdown file(s) packaged. Drop the unzipped folder into your Obsidian vault.`,
      });
    } catch (err) {
      toast({
        title: "Export failed",
        description: (err as Error).message,
        variant: "destructive",
      });
    } finally {
      setBusy(false);
    }
  }

  function handleReset() {
    setConversations([]);
    setDetectedFormat(null);
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="grid-bg absolute inset-0 -z-10 opacity-60 pointer-events-none" />

      <header className="border-b border-border bg-background/70 backdrop-blur sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="size-9 rounded-lg bg-primary text-primary-foreground grid place-items-center shadow-md">
              <Network className="size-5" />
            </div>
            <div>
              <h1 className="text-base font-semibold leading-tight">
                AI &rarr; Obsidian
              </h1>
              <p className="text-xs text-muted-foreground leading-tight">
                Turn ChatGPT &amp; Claude exports into a linked knowledge graph
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadSample}
              disabled={busy}
              data-testid="button-load-sample"
            >
              <Sparkles className="mr-1.5 size-4" />
              Try sample
            </Button>
            <Button
              variant="ghost"
              size="icon"
              asChild
              aria-label="Open project on GitHub"
            >
              <a
                href="https://help.obsidian.md/Plugins/Graph+view"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="size-4" />
              </a>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-8 space-y-8">
        {/* Hero */}
        <section className="grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 items-start">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Export your AI conversations into{" "}
              <span className="text-primary">a real graph</span>.
            </h2>
            <p className="mt-3 text-muted-foreground max-w-xl">
              Drop in a ChatGPT or Claude export and get a folder of Obsidian
              markdown notes with frontmatter, tags, and{" "}
              <code className="text-foreground">[[wikilinks]]</code> connecting
              every conversation through shared topics. Open the unzipped folder
              in your vault and your graph view fills with structure.
            </p>

            <div className="mt-5 flex flex-wrap gap-2">
              <Feature icon={<FolderTree className="size-3.5" />} label="Folder structure" />
              <Feature icon={<Tags className="size-3.5" />} label="Tags & frontmatter" />
              <Feature icon={<Network className="size-3.5" />} label="Topic backlinks" />
              <Feature icon={<Sparkles className="size-3.5" />} label="Master index (MOC)" />
            </div>
          </div>

          <Card className="border-card-border">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-medium">
                Step 1 · Load your conversations
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Uploader
                onLoadJson={handleLoadJson}
                onLoadPasted={handleLoadPasted}
              />
            </CardContent>
          </Card>
        </section>

        {/* Stats / status bar */}
        {conversations.length > 0 && (
          <section className="rounded-xl border border-card-border bg-card p-4 flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-6">
              <Stat label="Conversations" value={conversations.length} />
              <Stat label="Messages" value={totalMessages} />
              <Stat label="Topics" value={topicCount} />
              <Stat label="Files generated" value={files.length} />
              {detectedFormat && (
                <Badge variant="secondary" className="uppercase tracking-wide text-[10px]">
                  Format: {detectedFormat}
                </Badge>
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                onClick={handleReset}
                data-testid="button-reset"
              >
                Start over
              </Button>
              <Button
                onClick={handleExport}
                disabled={busy || files.length === 0}
                data-testid="button-export"
              >
                <Download className="mr-2 size-4" />
                Download Obsidian vault
              </Button>
            </div>
          </section>
        )}

        {/* Body */}
        <section className="grid grid-cols-1 lg:grid-cols-[360px_1fr] gap-6 items-start">
          <Card className="border-card-border">
            <CardHeader>
              <CardTitle className="text-sm font-medium">
                Step 2 · Tune your export
              </CardTitle>
              <CardDescription>
                Settings update the preview, graph, and downloaded files in real
                time.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <OptionsPanel options={options} onChange={setOptions} />
              <Separator className="my-5" />
              <div className="text-xs text-muted-foreground leading-relaxed">
                <p className="font-medium text-foreground mb-1">How to install</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>Click <strong>Download Obsidian vault</strong>.</li>
                  <li>Unzip the archive.</li>
                  <li>
                    Drag the <code>{options.folder}</code> and{" "}
                    {options.includeTopicNotes ? (
                      <><code>{options.topicFolder}</code> folders</>
                    ) : (
                      <><code>AI Conversations Index.md</code></>
                    )}{" "}
                    into your vault.
                  </li>
                  <li>Open Graph view — the connections will be there.</li>
                </ol>
              </div>
            </CardContent>
          </Card>

          <Tabs defaultValue="graph" className="w-full">
            <TabsList>
              <TabsTrigger value="graph" data-testid="tab-graph">
                Graph preview
              </TabsTrigger>
              <TabsTrigger value="conversations" data-testid="tab-conversations">
                Conversations ({conversations.length})
              </TabsTrigger>
              <TabsTrigger value="files" data-testid="tab-files">
                Files ({files.length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="graph" className="mt-4">
              <div className="h-[480px]">
                <GraphPreview graph={graph} />
              </div>
              <p className="mt-2 text-xs text-muted-foreground">
                Purple nodes are conversations, blue nodes are extracted topics.
                In Obsidian, links are created via wikilinks in each note's
                frontmatter and body.
              </p>
            </TabsContent>

            <TabsContent value="conversations" className="mt-4">
              <ConversationList plans={plans} />
            </TabsContent>

            <TabsContent value="files" className="mt-4">
              <PreviewPane files={files} />
            </TabsContent>
          </Tabs>
        </section>

        <footer className="pt-6 pb-2 text-center text-xs text-muted-foreground">
          Everything runs locally in your browser — your conversations never
          leave this page.
        </footer>
      </main>
    </div>
  );
}

function Feature({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-2.5 py-1 text-xs text-muted-foreground">
      <span className="text-primary">{icon}</span>
      {label}
    </span>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex flex-col">
      <span className="text-xs uppercase tracking-wide text-muted-foreground">
        {label}
      </span>
      <span
        className="text-xl font-semibold tabular-nums"
        data-testid={`stat-${label.toLowerCase().replace(/\s+/g, "-")}`}
      >
        {value.toLocaleString()}
      </span>
    </div>
  );
}
