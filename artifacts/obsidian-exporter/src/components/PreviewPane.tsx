import { useState } from "react";
import type { ObsidianFile } from "@/lib/obsidian";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileText } from "lucide-react";

interface Props {
  files: ObsidianFile[];
}

export function PreviewPane({ files }: Props) {
  const [activePath, setActivePath] = useState<string | null>(
    files[0]?.path ?? null,
  );

  if (files.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Markdown previews will appear here once a conversation is loaded.
      </div>
    );
  }

  const active =
    files.find((f) => f.path === activePath) ?? files[0]!;

  return (
    <div className="grid grid-cols-1 md:grid-cols-[260px_1fr] gap-3 h-[480px]">
      <ScrollArea className="rounded-lg border border-card-border bg-card">
        <ul className="p-1 text-sm">
          {files.map((f) => (
            <li key={f.path}>
              <button
                type="button"
                onClick={() => setActivePath(f.path)}
                className={[
                  "w-full text-left px-2.5 py-2 rounded-md flex items-center gap-2 hover-elevate",
                  active.path === f.path ? "bg-accent text-accent-foreground" : "",
                ].join(" ")}
                data-testid={`button-preview-file-${f.path}`}
              >
                <FileText className="size-3.5 shrink-0" />
                <span className="truncate">{f.path}</span>
              </button>
            </li>
          ))}
        </ul>
      </ScrollArea>

      <div className="rounded-lg border border-card-border bg-card overflow-hidden flex flex-col">
        <div className="px-3 py-2 border-b border-border flex items-center justify-between text-xs font-mono text-muted-foreground">
          <span className="truncate">{active.path}</span>
          <span>{(active.content.length / 1024).toFixed(1)} KB</span>
        </div>
        <ScrollArea className="flex-1">
          <pre className="p-4 text-xs leading-relaxed font-mono whitespace-pre-wrap break-words">
            {active.content}
          </pre>
        </ScrollArea>
      </div>
    </div>
  );
}
