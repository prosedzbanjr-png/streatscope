import { createClient } from '@supabase/supabase-js';

const PAGE_SIZE = 200;
const MAX_PASSES = 30;

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

function extractVisibleSegments(html) {
  const segments = [];
  let text = '';
  let start = -1;
  let end = -1;
  let pendingSpace = false;

  const flush = () => {
    const normalized = normalizeText(text);
    if (normalized && start >= 0 && end >= start) {
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

function sameRun(segments, first, second, length) {
  for (let offset = 0; offset < length; offset += 1) {
    if (segments[first + offset]?.text !== segments[second + offset]?.text) return false;
  }
  return true;
}

function findImmediateRepeatedRun(segments) {
  for (let start = 0; start < segments.length; start += 1) {
    const maxLength = Math.min(16, Math.floor((segments.length - start) / 2));
    for (let length = maxLength; length >= 1; length -= 1) {
      if (!sameRun(segments, start, start + length, length)) continue;

      const repeatedChars = segments
        .slice(start, start + length)
        .reduce((sum, segment) => sum + segment.text.length, 0);

      // Keep this deliberately conservative: only unmistakable long repeats.
      // This prevents legitimate short headings, labels or list rows from being removed.
      if (length === 1 && repeatedChars < 120) continue;
      if (length > 1 && repeatedChars < 100) continue;

      return {
        start: segments[start + length].start,
        end: segments[start + length * 2 - 1].end,
        length,
        repeatedChars,
      };
    }
  }
  return null;
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

    if (!visible && !/<(?:img|video|iframe|svg|hr)\b/i.test(block)) {
      removals.push({ start, end });
    }

    opener.lastIndex = end;
  }

  let output = html;
  removals
    .sort((a, b) => b.start - a.start)
    .forEach(range => {
      output = output.slice(0, range.start) + output.slice(range.end);
    });

  return output;
}

function cleanupBody(html) {
  let output = String(html || '');
  let removedRuns = 0;

  for (let pass = 0; pass < MAX_PASSES; pass += 1) {
    const segments = extractVisibleSegments(output);
    const duplicate = findImmediateRepeatedRun(segments);
    if (!duplicate) break;

    output = output.slice(0, duplicate.start) + output.slice(duplicate.end);
    removedRuns += 1;
  }

  output = output
    .replace(/<p\b[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p\s*>/gi, '')
    .replace(/<div\b([^>]*)class=(['"])([^'"]*\bfree-text\b[^'"]*)\2([^>]*)>\s*(?:<br\s*\/?>\s*)?<\/div\s*>/gi, '');
  output = stripEmptyTextBlocks(output);

  return { output, removedRuns };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service env for all-article cleanup');

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let scanned = 0;
let changed = 0;
let removedRuns = 0;
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

    // Verify that another pass does not find another repeat before touching the DB.
    const verification = cleanupBody(after);
    if (verification.output !== after) {
      throw new Error(`Cleanup was not idempotent for article id=${article.id}`);
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
    removedRuns += cleaned.removedRuns;
    changedIds.push(article.id);
    console.log(
      `[all-article-cleanup] fixed id=${article.id} title=${JSON.stringify(article.title || '')} runs=${cleaned.removedRuns} bytes=${before.length}->${after.length}`,
    );
  }

  if (batch.length < PAGE_SIZE) break;
}

console.log(
  `[all-article-cleanup] VERIFIED scanned=${scanned} changed=${changed} removedRuns=${removedRuns} ids=${changedIds.join(',') || 'none'}`,
);
