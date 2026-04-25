import type { ConversationPlan } from "@/lib/obsidian";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import { MessageSquare, Tag, Calendar } from "lucide-react";

interface Props {
  plans: ConversationPlan[];
}

function fmtDate(ms?: number): string {
  if (!ms) return "—";
  const d = new Date(ms);
  return d.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

export function ConversationList({ plans }: Props) {
  if (plans.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
        Conversations will be listed here once you load an export.
      </div>
    );
  }

  const sorted = [...plans].sort(
    (a, b) => (b.conv.createdAt ?? 0) - (a.conv.createdAt ?? 0),
  );

  return (
    <ScrollArea className="h-[420px] rounded-lg border border-card-border bg-card">
      <ul className="divide-y divide-border">
        {sorted.map((plan) => (
          <li
            key={plan.conv.id}
            className="px-4 py-3 hover-elevate"
            data-testid={`row-conversation-${plan.conv.id}`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <p
                  className="font-medium truncate"
                  data-testid={`text-conversation-title-${plan.conv.id}`}
                >
                  {plan.conv.title}
                </p>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Calendar className="size-3" />
                    {fmtDate(plan.conv.createdAt)}
                  </span>
                  <span className="flex items-center gap-1">
                    <MessageSquare className="size-3" />
                    {plan.conv.messages.length} msgs
                  </span>
                  <Badge
                    variant="outline"
                    className="text-[10px] uppercase tracking-wide"
                  >
                    {plan.conv.source}
                  </Badge>
                </div>
                {plan.topics.length > 0 && (
                  <div className="mt-2 flex flex-wrap items-center gap-1.5">
                    <Tag className="size-3 text-muted-foreground" />
                    {plan.topics.slice(0, 5).map((t) => (
                      <span
                        key={t}
                        className="text-[11px] px-1.5 py-0.5 rounded bg-accent text-accent-foreground"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </li>
        ))}
      </ul>
    </ScrollArea>
  );
}
