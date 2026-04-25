import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import type { ExportOptions } from "@/lib/obsidian";

interface Props {
  options: ExportOptions;
  onChange: (next: ExportOptions) => void;
}

export function OptionsPanel({ options, onChange }: Props) {
  const update = (patch: Partial<ExportOptions>) =>
    onChange({ ...options, ...patch });

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="folder">Conversations folder</Label>
          <Input
            id="folder"
            value={options.folder}
            onChange={(e) => update({ folder: e.target.value || "Conversations" })}
            data-testid="input-folder"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="topic-folder">Topics folder</Label>
          <Input
            id="topic-folder"
            value={options.topicFolder}
            onChange={(e) => update({ topicFolder: e.target.value || "Topics" })}
            data-testid="input-topic-folder"
          />
        </div>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label>Topics per conversation</Label>
          <span className="text-sm font-mono tabular-nums text-muted-foreground">
            {options.maxTopicsPerConversation}
          </span>
        </div>
        <Slider
          value={[options.maxTopicsPerConversation]}
          min={2}
          max={12}
          step={1}
          onValueChange={(v) => update({ maxTopicsPerConversation: v[0] ?? 6 })}
          data-testid="slider-topics"
        />
        <p className="text-xs text-muted-foreground">
          More topics means a denser graph and more cross-links between notes.
        </p>
      </div>

      <div className="space-y-3 border-t border-border pt-4">
        <ToggleRow
          id="opt-topic-notes"
          label="Generate topic notes"
          description="Each extracted topic gets its own note that backlinks to all conversations mentioning it."
          checked={options.includeTopicNotes}
          onCheckedChange={(v) => update({ includeTopicNotes: v })}
        />
        <ToggleRow
          id="opt-moc"
          label="Create master index (MOC)"
          description={`A single "AI Conversations Index" note grouping every chat by source.`}
          checked={options.includeMOC}
          onCheckedChange={(v) => update({ includeMOC: v })}
        />
        <ToggleRow
          id="opt-system"
          label="Include system messages"
          description="Useful when you want to keep model instructions/prompts for reference."
          checked={options.includeSystemMessages}
          onCheckedChange={(v) => update({ includeSystemMessages: v })}
        />
        <ToggleRow
          id="opt-collapse"
          label="Hide assistant headers"
          description="Render assistant replies as plain prose without role labels."
          checked={options.collapseAssistantHeaders}
          onCheckedChange={(v) => update({ collapseAssistantHeaders: v })}
        />
      </div>
    </div>
  );
}

interface ToggleRowProps {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (v: boolean) => void;
}

function ToggleRow({ id, label, description, checked, onCheckedChange }: ToggleRowProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex-1">
        <Label htmlFor={id} className="cursor-pointer">
          {label}
        </Label>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <Switch
        id={id}
        checked={checked}
        onCheckedChange={onCheckedChange}
        data-testid={`switch-${id}`}
      />
    </div>
  );
}
