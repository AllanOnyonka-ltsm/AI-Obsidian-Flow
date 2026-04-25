import type { Conversation } from "./parsers";

const STOP_WORDS = new Set([
  "a","an","and","are","as","at","be","but","by","for","from","has","have","i","if",
  "in","into","is","it","its","of","on","or","that","the","to","was","were","will",
  "with","you","your","this","they","them","their","these","those","there","then",
  "than","what","when","where","which","who","whom","why","how","do","does","did",
  "doing","done","not","no","yes","can","could","should","would","may","might","must",
  "shall","also","just","like","such","only","very","much","many","more","most","some",
  "any","all","each","every","other","another","one","two","three","new","my","me",
  "we","our","us","i'm","i've","i'll","you're","it's","we're","they're","we've",
  "didn't","don't","doesn't","isn't","aren't","wasn't","weren't","won't","wouldn't",
  "use","using","used","get","got","make","made","need","want","know","think","sure",
  "really","actually","kind","stuff","thing","things","way","ways","ok","okay","yeah",
  "let","lets","let's","also","still","yet","because","while","about","over","under",
  "between","through","into","onto","without","within","across","upon","off","again",
  "back","here","ago","now","up","down","out","in","so","too","up","down","then",
  "before","after","good","great","bad","better","best","help","please","thanks",
  "thank","hello","hi","hey","right","wrong","true","false","does","did","done",
  "going","go","goes","went","gone","get","gets","getting","got","said","say","says",
  "saying","tell","tells","told","ask","asks","asked","find","found","look","looks",
  "looked","looking","seem","seems","seemed","seen","see","saw",
  "i'm","i'd","i'll","i've","you'd","you'll","you've","we'd","we'll","we've",
  "they'd","they'll","they've","that's","there's","here's","what's",
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/```[\s\S]*?```/g, " ") // strip code blocks
    .replace(/`[^`]*`/g, " ") // strip inline code
    .replace(/[^a-z0-9'\-\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean);
}

/**
 * Extract the most representative content keywords for a conversation.
 * Excludes stop words and very short tokens.
 */
export function extractKeywords(conv: Conversation, max = 8): string[] {
  const text = [conv.title, ...conv.messages.map((m) => m.content)].join("\n");
  const tokens = tokenize(text);
  const counts = new Map<string, number>();

  for (const tok of tokens) {
    if (tok.length < 4) continue;
    if (STOP_WORDS.has(tok)) continue;
    if (/^\d+$/.test(tok)) continue;
    counts.set(tok, (counts.get(tok) ?? 0) + 1);
  }

  // Also extract bigrams for richer topics.
  for (let i = 0; i < tokens.length - 1; i++) {
    const a = tokens[i];
    const b = tokens[i + 1];
    if (!a || !b) continue;
    if (a.length < 3 || b.length < 3) continue;
    if (STOP_WORDS.has(a) || STOP_WORDS.has(b)) continue;
    if (/^\d+$/.test(a) || /^\d+$/.test(b)) continue;
    const bigram = `${a} ${b}`;
    counts.set(bigram, (counts.get(bigram) ?? 0) + 2); // weight bigrams higher
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, max * 3)
    .map(([k]) => k)
    // dedupe overlapping unigrams that are already part of a higher-ranked bigram
    .reduce<string[]>((acc, term) => {
      if (acc.length >= max) return acc;
      const isSubsumed = acc.some(
        (existing) =>
          existing.includes(" ") &&
          existing.split(" ").includes(term),
      );
      if (!isSubsumed) acc.push(term);
      return acc;
    }, []);
}

export function toTitleCase(s: string): string {
  return s
    .split(/[\s\-]+/)
    .map((w) => (w.length ? w[0]!.toUpperCase() + w.slice(1) : ""))
    .join(" ");
}

export function toTag(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s\-]/g, "")
    .trim()
    .replace(/\s+/g, "-");
}

export interface TopicGraph {
  nodes: { id: string; label: string; type: "conversation" | "topic"; weight: number }[];
  links: { source: string; target: string }[];
}

/**
 * Build a graph mapping conversations <-> topics so the user gets a real
 * preview of what the Obsidian graph will look like.
 */
export function buildTopicGraph(
  enriched: { conv: Conversation; topics: string[] }[],
): TopicGraph {
  const nodes = new Map<string, TopicGraph["nodes"][number]>();
  const links: TopicGraph["links"][number][] = [];

  for (const { conv, topics } of enriched) {
    const convId = `conv:${conv.id}`;
    nodes.set(convId, {
      id: convId,
      label: conv.title,
      type: "conversation",
      weight: conv.messages.length,
    });
    for (const topic of topics) {
      const topicId = `topic:${toTag(topic)}`;
      const existing = nodes.get(topicId);
      if (existing) {
        existing.weight += 1;
      } else {
        nodes.set(topicId, {
          id: topicId,
          label: toTitleCase(topic),
          type: "topic",
          weight: 1,
        });
      }
      links.push({ source: convId, target: topicId });
    }
  }

  return { nodes: [...nodes.values()], links };
}
