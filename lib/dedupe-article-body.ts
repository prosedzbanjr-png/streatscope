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
      const value = Number(code);
      return Number.isFinite(value) ? String.fromCodePoint(value) : " ";
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

type BlockRange = { start: number; end: number; fingerprint: string };

export function dedupeArticleTextBlocks(html: string) {
  if (!html || !html.includes("text-block")) return html;

  const opener = /<div\b[^>]*class=(['"])[^'"]*\btext-block\b[^'"]*\1[^>]*>/gi;
  const blocks: BlockRange[] = [];
  let match: RegExpExecArray | null;

  while ((match = opener.exec(html))) {
    const start = match.index;
    const end = findMatchingDivEnd(html, start);
    if (end <= start) continue;
    const fingerprint = normalizeBlockText(html.slice(start, end));
    blocks.push({ start, end, fingerprint });
    opener.lastIndex = end;
  }

  const seen = new Set<string>();
  const duplicates: BlockRange[] = [];

  for (const block of blocks) {
    // Long free-text fields should never occur twice verbatim in one article.
    // This deliberately ignores their editor coordinates: an overlapping copy
    // can look like one field in the editor but becomes a second paragraph in
    // the reader, especially inside LB-Phone/CEF.
    if (block.fingerprint.length < 80) continue;
    if (seen.has(block.fingerprint)) duplicates.push(block);
    else seen.add(block.fingerprint);
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
