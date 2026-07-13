import type { ReactNode } from "react";

/**
 * A compact, dependency-free markdown → JSX renderer for the briefs reader.
 * No markdown lib in package.json (and the brief bodies are trusted, operator-
 * only content), so this hand-rolls the blocks we actually use: ATX headings,
 * ordered/unordered lists, fenced + inline code, blockquotes, rules, and
 * paragraphs, with inline **bold**, *italic*, `code`, [links](url) and bare
 * URLs. Links open in a new tab. Everything renders in the console theme.
 */

/** Inline spans: code (literal), then bold, italic, markdown links, bare URLs. */
function renderInline(text: string, keyPrefix: string): ReactNode[] {
  const nodes: ReactNode[] = [];
  const re =
    /`([^`]+)`|\*\*([^*]+)\*\*|\*([^*\n]+)\*|\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)|(https?:\/\/[^\s)]+)/g;
  let last = 0;
  let k = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) nodes.push(text.slice(last, m.index));
    if (m[1] !== undefined) {
      nodes.push(
        <code
          key={`${keyPrefix}-${k++}`}
          className="rounded bg-black/40 px-1.5 py-0.5 font-mono text-[0.85em] text-neon"
        >
          {m[1]}
        </code>,
      );
    } else if (m[2] !== undefined) {
      nodes.push(
        <strong key={`${keyPrefix}-${k++}`} className="font-semibold text-white">
          {m[2]}
        </strong>,
      );
    } else if (m[3] !== undefined) {
      nodes.push(
        <em key={`${keyPrefix}-${k++}`} className="italic text-white/80">
          {m[3]}
        </em>,
      );
    } else if (m[4] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-${k++}`}
          href={m[5]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-words text-cyan underline underline-offset-2 hover:text-white"
        >
          {m[4]}
        </a>,
      );
    } else if (m[6] !== undefined) {
      nodes.push(
        <a
          key={`${keyPrefix}-${k++}`}
          href={m[6]}
          target="_blank"
          rel="noopener noreferrer"
          className="break-words text-cyan underline underline-offset-2 hover:text-white"
        >
          {m[6]}
        </a>,
      );
    }
    last = re.lastIndex;
  }
  if (last < text.length) nodes.push(text.slice(last));
  return nodes;
}

const BLOCK_START = /^(#{1,6}\s|```|>\s?|\s*[-*+]\s+|\s*\d+\.\s+)/;
const RULE = /^(-{3,}|\*{3,}|_{3,})$/;

/** Headings are demoted (the page already owns the h1); size steps down by
    level, all in the pixel/arcade console type. */
function Heading({ level, children }: { level: number; children: ReactNode }) {
  const cls =
    level <= 1
      ? "mt-5 font-arcade text-xl text-cyan glow-cyan"
      : level === 2
        ? "mt-5 font-pixel text-base uppercase leading-snug text-cyan"
        : level === 3
          ? "mt-4 font-pixel text-sm uppercase text-white/80"
          : "mt-3 font-pixel text-xs uppercase text-white/60";
  if (level <= 1) return <h2 className={cls}>{children}</h2>;
  if (level === 2) return <h3 className={cls}>{children}</h3>;
  if (level === 3) return <h4 className={cls}>{children}</h4>;
  return <h5 className={cls}>{children}</h5>;
}

export default function Markdown({ source }: { source: string }) {
  const lines = source.replace(/\r\n/g, "\n").split("\n");
  const blocks: ReactNode[] = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // fenced code block
    if (/^```/.test(line.trim())) {
      const buf: string[] = [];
      i++;
      while (i < lines.length && !/^```/.test(lines[i].trim())) {
        buf.push(lines[i]);
        i++;
      }
      i++; // skip the closing fence
      blocks.push(
        <pre
          key={key++}
          className="overflow-x-auto rounded-lg border border-edge bg-black/40 p-3 font-mono text-[12px] leading-relaxed text-white/80"
        >
          <code>{buf.join("\n")}</code>
        </pre>,
      );
      continue;
    }

    // blank line
    if (line.trim() === "") {
      i++;
      continue;
    }

    // heading
    const h = line.match(/^(#{1,6})\s+(.+?)\s*#*\s*$/);
    if (h) {
      blocks.push(
        <Heading key={key} level={h[1].length}>
          {renderInline(h[2], `h${key++}`)}
        </Heading>,
      );
      i++;
      continue;
    }

    // horizontal rule
    if (RULE.test(line.trim())) {
      blocks.push(<hr key={key++} className="my-4 border-edge" />);
      i++;
      continue;
    }

    // blockquote
    if (/^>\s?/.test(line)) {
      const buf: string[] = [];
      while (i < lines.length && /^>\s?/.test(lines[i])) {
        buf.push(lines[i].replace(/^>\s?/, ""));
        i++;
      }
      blocks.push(
        <blockquote
          key={key}
          className="border-l-2 border-cyan/50 pl-3 font-body text-sm italic text-white/70"
        >
          {renderInline(buf.join(" "), `bq${key++}`)}
        </blockquote>,
      );
      continue;
    }

    // unordered list
    if (/^\s*[-*+]\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*[-*+]\s+/, ""));
        i++;
      }
      const listKey = key++;
      blocks.push(
        <ul key={listKey} className="ml-5 list-disc space-y-1 font-body text-sm text-white/75 marker:text-cyan/60">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ul${listKey}-${j}`)}</li>
          ))}
        </ul>,
      );
      continue;
    }

    // ordered list
    if (/^\s*\d+\.\s+/.test(line)) {
      const items: string[] = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, ""));
        i++;
      }
      const listKey = key++;
      blocks.push(
        <ol key={listKey} className="ml-5 list-decimal space-y-1 font-body text-sm text-white/75 marker:text-cyan/60">
          {items.map((it, j) => (
            <li key={j}>{renderInline(it, `ol${listKey}-${j}`)}</li>
          ))}
        </ol>,
      );
      continue;
    }

    // paragraph — gather consecutive lines until a blank line or a block start
    const buf: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !BLOCK_START.test(lines[i]) &&
      !RULE.test(lines[i].trim())
    ) {
      buf.push(lines[i]);
      i++;
    }
    blocks.push(
      <p key={key} className="font-body text-sm leading-relaxed text-white/75">
        {renderInline(buf.join(" "), `p${key++}`)}
      </p>,
    );
  }

  return <div className="space-y-3">{blocks}</div>;
}
