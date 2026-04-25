import { useCallback, useRef, useState } from "react";
import { Upload, FileJson, ClipboardPaste } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

interface Props {
  onLoadJson: (raw: string, source: string) => void;
  onLoadPasted: (text: string, title: string) => void;
}

export function Uploader({ onLoadJson, onLoadPasted }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [pasted, setPasted] = useState("");
  const [pastedTitle, setPastedTitle] = useState("");

  const handleFile = useCallback(
    async (file: File) => {
      const text = await file.text();
      onLoadJson(text, file.name);
    },
    [onLoadJson],
  );

  const onDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files?.[0];
      if (file) void handleFile(file);
    },
    [handleFile],
  );

  return (
    <Tabs defaultValue="file" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="file" data-testid="tab-file">
          <FileJson className="mr-2 size-4" /> Upload export
        </TabsTrigger>
        <TabsTrigger value="paste" data-testid="tab-paste">
          <ClipboardPaste className="mr-2 size-4" /> Paste transcript
        </TabsTrigger>
      </TabsList>

      <TabsContent value="file" className="mt-4">
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={[
            "rounded-xl border-2 border-dashed p-8 text-center transition-colors",
            dragOver
              ? "border-primary bg-accent"
              : "border-border bg-muted/30 hover:border-primary/50",
          ].join(" ")}
          data-testid="dropzone"
        >
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            <Upload className="size-6" />
          </div>
          <h3 className="mt-3 text-base font-semibold">
            Drop your AI export file here
          </h3>
          <p className="mt-1 text-sm text-muted-foreground">
            ChatGPT <code>conversations.json</code>, Claude{" "}
            <code>conversations.json</code>, or any JSON with{" "}
            <code>messages</code>.
          </p>
          <Button
            type="button"
            variant="default"
            className="mt-4"
            onClick={() => inputRef.current?.click()}
            data-testid="button-browse"
          >
            Browse files
          </Button>
          <input
            ref={inputRef}
            type="file"
            accept=".json,application/json,.txt"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void handleFile(file);
              e.target.value = "";
            }}
            data-testid="input-file"
          />
        </div>
      </TabsContent>

      <TabsContent value="paste" className="mt-4 space-y-3">
        <Input
          placeholder="Conversation title (optional)"
          value={pastedTitle}
          onChange={(e) => setPastedTitle(e.target.value)}
          data-testid="input-pasted-title"
        />
        <Textarea
          placeholder={`Paste a chat here, e.g.\n\nUser: Explain the difference between TCP and UDP\nAssistant: TCP is connection-oriented...`}
          rows={10}
          value={pasted}
          onChange={(e) => setPasted(e.target.value)}
          data-testid="input-pasted"
        />
        <div className="flex justify-end gap-2">
          <Button
            variant="outline"
            onClick={() => {
              setPasted("");
              setPastedTitle("");
            }}
            data-testid="button-clear-pasted"
          >
            Clear
          </Button>
          <Button
            onClick={() => onLoadPasted(pasted, pastedTitle)}
            disabled={!pasted.trim()}
            data-testid="button-load-pasted"
          >
            Load conversation
          </Button>
        </div>
      </TabsContent>
    </Tabs>
  );
}
