type VisibleSegment = { text: string; start: number; end: number };

function decodeEntity(entity: string) {
  const lower = entity.toLowerCase();
  if (lower === "&nbsp;" || lower === "&#160;" || lower === "&#xa0;") return " ";
  if (lower === "&amp;") return "&";
  if (lower === "&quot;") return '"';
  if (lower === "&apos;" || lower === "&#39;") return "'";
  if (lower === "&lt;") return "<";
  if (lower === "&gt;") return ">";
  const decimal = /^&#(\d+);$/.exec(lower);
  if (decimal) return String.fromCodePoint(Number(decimal[1]));
  const hex = /^&#x([0-9a-f]+);$/.exec(lower);
  if (hex) return String.fromCodePoint(parseInt(hex[1], 16));
  return " ";
}

function normalizeText(value: string) {
  return value
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pl-PL");
}

function isParagraphBoundary(tag: string) {
  return /^<br\b/i.test(tag) || /^<\/(?:p|div|li|blockquote|h[1-6])\b/i.test(tag);
}

function extractVisibleSegments(html: string) {
  const segments: VisibleSegment[] = [];
  let text = "";
  let start = -1;
  let end = -1;
  let pendingSpace = false;

  const flush = () => {
    const normalized = normalizeText(text);
    if (normalized && start >= 0 && end >= start) segments.push({ text: normalized, start, end });
    text = "";
    start = -1;
    end = -1;
    pendingSpace = false;
  };

  const append = (raw: string, rawStart: number, rawEnd: number) => {
    const visible = raw.replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "");
    if (!visible) return;
    for (const char of visible) {
      if (/\s/u.test(char)) {
        if (text) pendingSpace = true;
        continue;
      }
      if (start < 0) start = rawStart;
      if (pendingSpace && text && !text.endsWith(" ")) text += " ";
      pendingSpace = false;
      text += char.toLocaleLowerCase("pl-PL");
      end = rawEnd;
    }
  };

  let i = 0;
  while (i < html.length) {
    if (html[i] === "<") {
      const tagEnd = html.indexOf(">", i + 1);
      if (tagEnd < 0) break;
      const tag = html.slice(i, tagEnd + 1);
      if (isParagraphBoundary(tag)) flush();
      i = tagEnd + 1;
      continue;
    }

    if (html[i] === "&") {
      const entityEnd = html.indexOf(";", i + 1);
      if (entityEnd > i && entityEnd - i <= 12) {
        append(decodeEntity(html.slice(i, entityEnd + 1)), i, entityEnd + 1);
        i = entityEnd + 1;
        continue;
      }
    }

    append(html[i], i, i + 1);
    i += 1;
  }

  flush();
  return segments;
}

function sameRun(segments: VisibleSegment[], first: number, second: number, length: number) {
  for (let offset = 0; offset < length; offset += 1) {
    if (segments[first + offset]?.text !== segments[second + offset]?.text) return false;
  }
  return true;
}

function findImmediateRepeatedRun(segments: VisibleSegment[]) {
  for (let start = 0; start < segments.length; start += 1) {
    const maxLength = Math.min(12, Math.floor((segments.length - start) / 2));
    for (let length = maxLength; length >= 1; length -= 1) {
      if (!sameRun(segments, start, start + length, length)) continue;
      const repeatedChars = segments.slice(start, start + length).reduce((sum, segment) => sum + segment.text.length, 0);
      // One paragraph must be long enough to be unmistakable. Multi-paragraph
      // runs can be shorter, but still need enough text to avoid removing
      // intentional short headings, labels or repeated list items.
      if (length === 1 && repeatedChars < 120) continue;
      if (length > 1 && repeatedChars < 100) continue;
      return {
        start: segments[start + length].start,
        end: segments[start + length * 2 - 1].end,
      };
    }
  }
  return null;
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

function stripEmptyTextBlocks(html: string) {
  const opener = /<div\b[^>]*class=(['"])[^'"]*\btext-block\b[^'"]*\1[^>]*>/gi;
  const removals: Array<{ start: number; end: number }> = [];
  let match: RegExpExecArray | null;

  while ((match = opener.exec(html))) {
    const start = match.index;
    const end = findMatchingDivEnd(html, start);
    if (end <= start) continue;
    const block = html.slice(start, end);
    if (!normalizeText(block.replace(/<br\s*\/?>/gi, " ").replace(/<[^>]+>/g, " ").replace(/&nbsp;|&#160;/gi, " ")) && !/<(?:img|video|iframe|svg|hr)\b/i.test(block)) {
      removals.push({ start, end });
    }
    opener.lastIndex = end;
  }

  let output = html;
  removals.sort((a, b) => b.start - a.start).forEach(range => {
    output = output.slice(0, range.start) + output.slice(range.end);
  });
  return output;
}

export function dedupeArticleTextBlocks(html: string) {
  if (!html) return html;

  let output = html;
  // Remove only immediate A+A or A+B+C+A+B+C runs. The old implementation
  // removed any matching paragraph anywhere in the article, which was too
  // aggressive and could delete legitimate repeated wording.
  for (let pass = 0; pass < 20; pass += 1) {
    const segments = extractVisibleSegments(output);
    const duplicate = findImmediateRepeatedRun(segments);
    if (!duplicate) break;
    output = output.slice(0, duplicate.start) + output.slice(duplicate.end);
  }

  output = output.replace(/<p\b[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p\s*>/gi, "");
  return stripEmptyTextBlocks(output);
}
