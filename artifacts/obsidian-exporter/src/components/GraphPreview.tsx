import { useEffect, useMemo, useRef, useState } from "react";
import ForceGraph2D, { type ForceGraphMethods } from "react-force-graph-2d";
import type { TopicGraph } from "@/lib/topics";

interface Node {
  id: string;
  label: string;
  type: "conversation" | "topic";
  weight: number;
  x?: number;
  y?: number;
}

interface Link {
  source: string | Node;
  target: string | Node;
}

interface Props {
  graph: TopicGraph;
}

export function GraphPreview({ graph }: Props) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const fgRef = useRef<ForceGraphMethods<Node, Link> | undefined>(undefined);
  const [size, setSize] = useState({ width: 600, height: 480 });
  const [hoverId, setHoverId] = useState<string | null>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const rect = el.getBoundingClientRect();
      setSize({
        width: Math.max(280, Math.floor(rect.width)),
        height: Math.max(360, Math.floor(rect.height)),
      });
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  const data = useMemo(
    () => ({
      nodes: graph.nodes.map((n) => ({ ...n })),
      links: graph.links.map((l) => ({ ...l })),
    }),
    [graph],
  );

  useEffect(() => {
    const fg = fgRef.current;
    if (!fg) return;
    const charge = fg.d3Force("charge") as
      | { strength?: (n: number) => unknown }
      | undefined;
    if (charge && typeof charge.strength === "function") {
      charge.strength(-120);
    }
    fg.zoomToFit(400, 60);
  }, [data]);

  const isEmpty = graph.nodes.length === 0;

  return (
    <div
      ref={containerRef}
      className="relative w-full h-full min-h-[420px] rounded-lg overflow-hidden bg-card border border-card-border"
      data-testid="graph-preview"
    >
      {isEmpty ? (
        <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
          The graph will appear once you load a conversation export.
        </div>
      ) : (
        <ForceGraph2D
          ref={fgRef}
          graphData={data}
          width={size.width}
          height={size.height}
          backgroundColor="transparent"
          nodeRelSize={4}
          linkColor={() => "rgba(124, 58, 237, 0.25)"}
          linkWidth={1}
          cooldownTicks={120}
          enableNodeDrag
          onNodeHover={(node) => setHoverId(node ? (node as Node).id : null)}
          nodeCanvasObject={(node, ctx, globalScale) => {
            const n = node as Node;
            const isConv = n.type === "conversation";
            const r = isConv ? 6 + Math.min(8, Math.log2(n.weight + 2)) : 4 + Math.min(6, n.weight);
            const fill = isConv
              ? "rgba(124, 58, 237, 0.95)"
              : "rgba(56, 189, 248, 0.9)";
            const stroke = isConv
              ? "rgba(255, 255, 255, 0.6)"
              : "rgba(255, 255, 255, 0.4)";

            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
            ctx.fillStyle = fill;
            ctx.fill();
            ctx.lineWidth = 1.2;
            ctx.strokeStyle = stroke;
            ctx.stroke();

            if (hoverId === n.id || globalScale > 2) {
              const label = n.label.length > 28 ? n.label.slice(0, 27) + "…" : n.label;
              const fontSize = Math.max(10, 12 / globalScale);
              ctx.font = `${fontSize}px Inter, sans-serif`;
              const textWidth = ctx.measureText(label).width;
              const padX = 4;
              const padY = 2;
              ctx.fillStyle = "rgba(20, 14, 38, 0.92)";
              ctx.fillRect(
                (n.x ?? 0) + r + 4,
                (n.y ?? 0) - fontSize / 2 - padY,
                textWidth + padX * 2,
                fontSize + padY * 2,
              );
              ctx.fillStyle = "rgba(245, 240, 255, 1)";
              ctx.textBaseline = "middle";
              ctx.fillText(label, (n.x ?? 0) + r + 4 + padX, n.y ?? 0);
            }
          }}
          nodePointerAreaPaint={(node, color, ctx) => {
            const n = node as Node;
            const r = n.type === "conversation" ? 12 : 8;
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(n.x ?? 0, n.y ?? 0, r, 0, 2 * Math.PI);
            ctx.fill();
          }}
        />
      )}

      <div className="pointer-events-none absolute bottom-3 left-3 flex items-center gap-3 text-xs text-muted-foreground bg-background/80 backdrop-blur px-3 py-2 rounded-md border border-card-border">
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-primary" />
          Conversation
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block size-2.5 rounded-full bg-chart-2" />
          Topic
        </span>
      </div>
    </div>
  );
}
