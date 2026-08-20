/** Parses editor.js post content (admin: header/list/paragraph, SPEC §5.10). */

export type InlineSpan = {
  text: string;
  bold?: boolean;
  italic?: boolean;
  link?: string;
};

export type PostBlock =
  | { kind: 'header'; level: 1 | 2 | 3; spans: InlineSpan[] }
  | { kind: 'paragraph'; spans: InlineSpan[] }
  | { kind: 'list'; ordered: boolean; items: InlineSpan[][] }
  | { kind: 'image'; url: string; caption: string | null };

const ENTITIES: Record<string, string> = {
  '&nbsp;': ' ',
  '&amp;': '&',
  '&lt;': '<',
  '&gt;': '>',
  '&quot;': '"',
  '&#39;': "'",
  '&apos;': "'",
};

export function decodeEntities(s: string): string {
  return s
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENTITIES[m.toLowerCase()] ?? m);
}

const INLINE_RX = /<(\/?)(b|strong|i|em|a)(?:\s[^>]*?)?>|<br\s*\/?>|<[^>]+>/gi;

/** editor.js inline HTML (<b>/<i>/<a>, <br>) → flat spans; other tags are stripped. */
export function parseInline(html: string): InlineSpan[] {
  const spans: InlineSpan[] = [];
  let bold = 0;
  let italic = 0;
  const links: string[] = [];
  let last = 0;

  const push = (text: string) => {
    if (!text) return;
    spans.push({
      text: decodeEntities(text),
      ...(bold > 0 && { bold: true }),
      ...(italic > 0 && { italic: true }),
      ...(links.length > 0 && { link: links[links.length - 1] }),
    });
  };

  for (const m of html.matchAll(INLINE_RX)) {
    push(html.slice(last, m.index));
    last = (m.index ?? 0) + m[0].length;
    const tag = m[2]?.toLowerCase();
    if (!tag) {
      if (/^<br/i.test(m[0])) push('\n');
      continue;
    }
    const closing = m[1] === '/';
    if (tag === 'b' || tag === 'strong') bold += closing ? -1 : 1;
    else if (tag === 'i' || tag === 'em') italic += closing ? -1 : 1;
    else if (tag === 'a') {
      if (closing) links.pop();
      else links.push(/href="([^"]*)"/i.exec(m[0])?.[1] ?? '');
    }
  }
  push(html.slice(last));
  return spans;
}

type RawListItem = string | { content?: string; items?: RawListItem[] };

function flattenListItems(items: RawListItem[], out: InlineSpan[][] = []): InlineSpan[][] {
  for (const item of items) {
    if (typeof item === 'string') out.push(parseInline(item));
    else {
      if (item.content) out.push(parseInline(item.content));
      if (Array.isArray(item.items)) flattenListItems(item.items, out);
    }
  }
  return out;
}

export function parsePostBlocks(contentJson: string | null | undefined): PostBlock[] {
  if (!contentJson) return [];
  let raw: { blocks?: { type?: string; data?: Record<string, unknown> }[] };
  try {
    raw = JSON.parse(contentJson);
  } catch {
    return [];
  }
  const out: PostBlock[] = [];
  for (const block of raw.blocks ?? []) {
    const data = (block.data ?? {}) as Record<string, unknown>;
    switch (block.type) {
      case 'header': {
        const level = Math.min(Math.max(Number(data.level) || 2, 1), 3) as 1 | 2 | 3;
        out.push({ kind: 'header', level, spans: parseInline(String(data.text ?? '')) });
        break;
      }
      case 'paragraph':
        out.push({ kind: 'paragraph', spans: parseInline(String(data.text ?? '')) });
        break;
      case 'list':
        out.push({
          kind: 'list',
          ordered: data.style === 'ordered',
          items: flattenListItems((data.items ?? []) as RawListItem[]),
        });
        break;
      case 'image': {
        const url = String(
          (data.file as { url?: string } | undefined)?.url ?? data.url ?? '',
        );
        if (url) {
          out.push({
            kind: 'image',
            url,
            caption: data.caption ? decodeEntities(String(data.caption)) : null,
          });
        }
        break;
      }
      default:
        break;
    }
  }
  return out;
}
