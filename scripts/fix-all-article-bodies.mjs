import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 200;
const MIN_DUPLICATE_LENGTH = 100;
const MAX_PASSES = 200;

function decodeEntity(entity) {
  const lower = entity.toLowerCase();
  if (lower === '&nbsp;' || lower === '&#160;' || lower === '&#xa0;') return ' ';
  if (lower === '&amp;') return '&';
  if (lower === '&quot;') return '"';
  if (lower === '&apos;' || lower === '&#39;') return "'";
  if (lower === '&lt;') return '<';
  if (lower === '&gt;') return '>';
  const decimal = /^&#(\d+);$/.exec(lower);
  if (decimal) return String.fromCodePoint(Number(decimal[1]));
  const hex = /^&#x([0-9a-f]+);$/.exec(lower);
  if (hex) return String.fromCodePoint(parseInt(hex[1], 16));
  return ' ';
}

function normalizeText(value) {
  return value
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pl-PL');
}

function isParagraphBoundary(tag) {
  return /^<br\b/i.test(tag) || /^<\/(?:p|div|li|blockquote|h[1-6])\b/i.test(tag);
}

function visiblePoints(html) {
  const points = [];
  let i = 0;

  while (i < html.length) {
    if (html[i] === '<') {
      const tagEnd = html.indexOf('>', i + 1);
      if (tagEnd < 0) break;
      const tag = html.slice(i, tagEnd + 1);
      if (isParagraphBoundary(tag)) points.push({ char: ' ', start: i, end: tagEnd + 1 });
      i = tagEnd + 1;
      continue;
    }

    if (html[i] === '&') {
      const entityEnd = html.indexOf(';', i + 1);
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

function normalizedMap(html) {
  const points = visiblePoints(html);
  let text = '';
  const map = [];
  let pendingSpace = null;

  for (const point of points) {
    const raw = point.char.replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '');
    if (!raw) continue;

    if (/\s/u.test(raw)) {
      if (text && !text.endsWith(' ') && !pendingSpace) pendingSpace = point;
      continue;
    }

    if (pendingSpace) {
      text += ' ';
      map.push(pendingSpace);
      pendingSpace = null;
    }

    const lower = raw.toLocaleLowerCase('pl-PL');
    for (const char of lower) {
      text += char;
      map.push(point);
    }
  }

  return { text, map };
}

function extractVisibleSegments(html) {
  const segments = [];
  let text = '';
  let start = -1;
  let end = -1;
  let pendingSpace = false;

  const flush = () => {
    const normalized = normalizeText(text);
    if (normalized.length >= MIN_DUPLICATE_LENGTH && start >= 0 && end >= start) {
      segments.push({ text: normalized, start, end });
    }
    text = '';
    start = -1;
    end = -1;
    pendingSpace = false;
  };

  const append = (raw, rawStart, rawEnd) => {
    const visible = raw.replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '');
    if (!visible) return;

    for (const char of visible) {
      if (/\s/u.test(char)) {
        if (text) pendingSpace = true;
        continue;
      }
      if (start < 0) start = rawStart;
      if (pendingSpace && text && !text.endsWith(' ')) text += ' ';
      pendingSpace = false;
      text += char.toLocaleLowerCase('pl-PL');
      end = rawEnd;
    }
  };

  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const tagEnd = html.indexOf('>', i + 1);
      if (tagEnd < 0) break;
      const tag = html.slice(i, tagEnd + 1);
      if (isParagraphBoundary(tag)) flush();
      i = tagEnd + 1;
      continue;
    }

    if (html[i] === '&') {
      const entityEnd = html.indexOf(';', i + 1);
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

function findDuplicatedParagraph(html) {
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

function removeOneLaterOccurrence(html, target) {
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

function matchingDivEnd(html, openStart) {
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = openStart;
  let depth = 0;
  let match;

  while ((match = tags.exec(html))) {
    if (/^<\/div/i.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return match.index + match[0].length;
  }

  return -1;
}

function stripEmptyTextBlocks(html) {
  const opener = /<div\b[^>]*class=(['"])[^'"]*\btext-block\b[^'"]*\1[^>]*>/gi;
  const removals = [];
  let match;

  while ((match = opener.exec(html))) {
    const start = match.index;
    const end = matchingDivEnd(html, start);
    if (end <= start) continue;

    const block = html.slice(start, end);
    const visible = normalizeText(
      block
        .replace(/<br\s*\/?>/gi, ' ')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;|&#160;/gi, ' '),
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

function stripEmptyContainers(html) {
  let output = html;

  for (let pass = 0; pass < 6; pass += 1) {
    const before = output;
    output = output
      .replace(/<p\b[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p\s*>/gi, '')
      .replace(/<div\b([^>]*)class=(['"])([^'"]*\bfree-text\b[^'"]*)\2([^>]*)>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/div\s*>/gi, '');
    output = stripEmptyTextBlocks(output);
    if (output === before) break;
  }

  return output;
}

function cleanupBody(html) {
  let output = String(html || '');
  let removedParagraphs = 0;

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const target = findDuplicatedParagraph(output);
    if (!target) break;

    const result = removeOneLaterOccurrence(output, target);
    if (!result.removed) break;

    output = result.output;
    removedParagraphs += 1;
  }

  return {
    output: stripEmptyContainers(output),
    removedParagraphs,
  };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service env for all-article cleanup');

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let scanned = 0;
let changed = 0;
let removedParagraphs = 0;
const changedIds = [];

for (let from = 0; ; from += PAGE_SIZE) {
  const { data: rows, error } = await client
    .from('articles')
    .select('id,title,body')
    .order('id', { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  if (error) throw new Error(error.message);
  const batch = rows || [];
  if (!batch.length) break;

  for (const article of batch) {
    scanned += 1;
    const before = String(article.body || '');
    const cleaned = cleanupBody(before);
    const after = cleaned.output;

    if (after === before) continue;

    const verification = cleanupBody(after);
    if (verification.output !== after || verification.removedParagraphs !== 0) {
      throw new Error(`Cleanup verification failed for article id=${article.id}`);
    }

    const { error: updateError } = await client
      .from('articles')
      .update({ body: after })
      .eq('id', article.id);

    if (updateError) throw new Error(`Article ${article.id}: ${updateError.message}`);

    const { data: verified, error: verifyError } = await client
      .from('articles')
      .select('body')
      .eq('id', article.id)
      .single();

    if (verifyError || !verified) {
      throw new Error(`Article ${article.id}: ${verifyError?.message || 'verification read failed'}`);
    }

    if (String(verified.body || '') !== after) {
      throw new Error(`Article ${article.id}: database verification mismatch`);
    }

    changed += 1;
    removedParagraphs += cleaned.removedParagraphs;
    changedIds.push(article.id);
    console.log(
      `[all-article-cleanup] fixed id=${article.id} title=${JSON.stringify(article.title || '')} paragraphs=${cleaned.removedParagraphs} bytes=${before.length}->${after.length}`,
    );
  }

  if (batch.length < PAGE_SIZE) break;
}

console.log(
  `[all-article-cleanup] VERIFIED scanned=${scanned} changed=${changed} removedParagraphs=${removedParagraphs} ids=${changedIds.join(',') || 'none'}`,
);
