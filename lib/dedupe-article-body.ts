type VisiblePoint = { char: string; start: number; end: number };
type VisibleSegment = { text: string; start: number; end: number };

const MIN_DUPLICATE_LENGTH = 100;
const MAX_PASSES = 200;

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

function visiblePoints(html: string) {
  const points: VisiblePoint[] = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] === "<") {
      const tagEnd = html.indexOf(">", i + 1);
      if (tagEnd < 0) break;
      const tag = html.slice(i, tagEnd + 1);
      if (isParagraphBoundary(tag)) points.push({ char: " ", start: i, end: tagEnd + 1 });
      i = tagEnd + 1;
      continue;
    }

    if (html[i] === "&") {
      const entityEnd = html.indexOf(";", i + 1);
      if (entityEnd > i && entityEnd - i <= 12) {
        const decoded = decodeEntity(html.slice(i, entityEnd + 1));
        for (const char of decoded) points.push({ char, start: i, end: entityEnd + 1 });
        i = entityEnd + 1;
        continue;
      }
    }

    points.push({ char: html[i], start: i, end: i + 1 });
    i += 1;
  }

  return points;
}

function normalizedMap(html: string) {
  const points = visiblePoints(html);
  let text = "";
  const map: VisiblePoint[] = [];
  let pendingSpace: VisiblePoint | null = null;

  for (const point of points) {
    const raw = point.char.replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "");
    if (!raw) continue;

    if (/\s/u.test(raw)) {
      if (text && !text.endsWith(" ") && !pendingSpace) pendingSpace = point;
      continue;
    }

    if (pendingSpace) {
      text += " ";
      map.push(pendingSpace);
      pendingSpace = null;
    }

    const lower = raw.toLocaleLowerCase("pl-PL");
    for (const char of lower) {
      text += char;
      map.push(point);
    }
  }

  return { text, map };
}

function extractVisibleSegments(html: string) {
  const segments: VisibleSegment[] = [];
  let text = "";
  let start = -1;
  let end = -1;
  let pendingSpace = false;

  const flush = () => {
    const normalized = normalizeText(text);
    if (normalized.length >= MIN_DUPLICATE_LENGTH && start >= 0 && end >= start) {
      segments.push({ text: normalized, start, end });
    }
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

function findDuplicatedParagraph(html: string) {
  const { text } = normalizedMap(html);
  const candidates = [...new Set(extractVisibleSegments(html).map(segment => segment.text))]
    .sort((a, b) => b.length - a.length);

  for (const candidate of candidates) {
    const first = text.indexOf(candidate);
    if (first < 0) continue;
    const second = text.indexOf(candidate, first + candidate.length);
    if (second >= 0) return candidate;
  }

  return null;
}

function removeOneLaterOccurrence(html: string, target: string) {
  const { text, map } = normalizedMap(html);
  const first = text.indexOf(target);
  if (first < 0) return { output: html, removed: false };

  const second = text.indexOf(target, first + target.length);
  if (second < 0) return { output: html, removed: false };

  const startPoint = map[second];
  const endPoint = map[second + target.length - 1];
  if (!startPoint || !endPoint) return { output: html, removed: false };

  return {
    output: html.slice(0, startPoint.start) + html.slice(endPoint.end),
    removed: true,
  };
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
    const visible = normalizeText(
      block
        .replace(/<br\s*\/?>/gi, " ")
        .replace(/<[^>]+>/g, " ")
        .replace(/&nbsp;|&#160;/gi, " "),
    );

    if (!visible && !/<(?:img|video|iframe|svg|hr)\b/i.test(block)) removals.push({ start, end });
    opener.lastIndex = end;
  }

  let output = html;
  removals.sort((a, b) => b.start - a.start).forEach(range => {
    output = output.slice(0, range.start) + output.slice(range.end);
  });
  return output;
}

function stripEmptyContainers(html: string) {
  let output = html;
  for (let pass = 0; pass < 6; pass += 1) {
    const next = output
      .replace(/<p\b[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p\s*>/gi, "")
      .replace(/<div\b([^>]*)class=(['"])([^'"]*\bfree-text\b[^'"]*)\2([^>]*)>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/div\s*>/gi, "");
    output = stripEmptyTextBlocks(next);
    if (output === next) break;
  }
  return output;
}

export function dedupeArticleTextBlocks(html: string) {
  if (!html) return html;

  let output = html;

  // The old cleanup only caught immediately repeated runs. In the broken saves
  // the second copy can sit behind extra wrappers, BRs or another editor block,
  // so discover every long paragraph and remove later exact copies by visible
  // text, regardless of the surrounding HTML structure.
  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const target = findDuplicatedParagraph(output);
    if (!target) break;
    const result = removeOneLaterOccurrence(output, target);
    if (!result.removed) break;
    output = result.output;
  }

  return stripEmptyContainers(output);
}
