function normalizeBlockText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, code: string) => {
      const numeric = Number(code);
      return Number.isFinite(numeric) ? String.fromCodePoint(numeric) : " ";
    })
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pl-PL");
}

function findMatchingDivEnd(html: string, openStart: number) {
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = openStart;
  let depth = 0;
  let match: RegExpExecArray | null;

  while ((match = tags.exec(html))) {
    if (/^<\/div/i.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return match.index + match[0].length;
  }

  return -1;
}

type BlockRange = { start: number; end: number; fingerprint: string; kind: "text-block" | "paragraph" };

function findTextBlockRanges(html: string) {
  const opener = /<div\b[^>]*class=(['"])[^'"]*\btext-block\b[^'"]*\1[^>]*>/gi;
  const blocks: BlockRange[] = [];
  let match: RegExpExecArray | null;

  while ((match = opener.exec(html))) {
    const start = match.index;
    const end = findMatchingDivEnd(html, start);
    if (end <= start) continue;
    blocks.push({ start, end, fingerprint: normalizeBlockText(html.slice(start, end)), kind: "text-block" });
    opener.lastIndex = end;
  }

  return blocks;
}

function isInsideRange(index: number, ranges: BlockRange[]) {
  return ranges.some(range => index > range.start && index < range.end);
}

function findLegacyParagraphRanges(html: string, textBlocks: BlockRange[]) {
  const paragraphs: BlockRange[] = [];
  const regex = /<p\b[^>]*>[\s\S]*?<\/p\s*>/gi;
  let match: RegExpExecArray | null;

  while ((match = regex.exec(html))) {
    if (isInsideRange(match.index, textBlocks)) continue;
    const fingerprint = normalizeBlockText(match[0]);
    if (fingerprint.length < 80) continue;
    paragraphs.push({ start: match.index, end: match.index + match[0].length, fingerprint, kind: "paragraph" });
  }

  return paragraphs;
}

export function dedupeArticleTextBlocks(html: string) {
  if (!html) return html;

  const textBlocks = findTextBlockRanges(html);
  const legacyParagraphs = findLegacyParagraphRanges(html, textBlocks);
  const candidates = [...textBlocks, ...legacyParagraphs]
    .filter(block => block.fingerprint.length >= 80)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  if (candidates.length < 2) return html;

  const seen = new Map<string, BlockRange>();
  const duplicates: BlockRange[] = [];

  for (const block of candidates) {
    const previous = seen.get(block.fingerprint);
    if (!previous) {
      seen.set(block.fingerprint, block);
      continue;
    }

    // Do not treat nested markup from the same logical block as a duplicate.
    if (block.start >= previous.start && block.end <= previous.end) continue;
    duplicates.push(block);
  }

  if (!duplicates.length) return html;

  let output = html;
  duplicates
    .sort((a, b) => b.start - a.start)
    .forEach(block => {
      output = output.slice(0, block.start) + output.slice(block.end);
    });

  return output;
}
