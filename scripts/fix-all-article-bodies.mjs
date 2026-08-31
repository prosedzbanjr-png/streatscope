import { createClient } from '@supabase/supabase-js';

// 1 September 2026 in Poland (CEST, UTC+2).
const FROM = '2026-08-31T22:00:00.000Z';
const TO = '2026-09-01T22:00:00.000Z';
const MIN_PARAGRAPH_LENGTH = 80;

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
    .normalize('NFKC')
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pl-PL');
}

function isBoundary(tag) {
  return /^<br\b/i.test(tag) || /^<\/(?:p|div|li|blockquote|h[1-6])\b/i.test(tag);
}

function extractParagraphs(html) {
  const paragraphs = [];
  let text = '';
  let pendingSpace = false;

  const append = raw => {
    const visible = raw.replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '');
    for (const char of visible) {
      if (/\s/u.test(char)) {
        if (text) pendingSpace = true;
        continue;
      }
      if (pendingSpace && text && !text.endsWith(' ')) text += ' ';
      pendingSpace = false;
      text += char;
    }
  };

  const flush = () => {
    const normalized = normalizeText(text);
    if (normalized.length >= MIN_PARAGRAPH_LENGTH) paragraphs.push(normalized);
    text = '';
    pendingSpace = false;
  };

  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i + 1);
      if (end < 0) break;
      const tag = html.slice(i, end + 1);
      if (isBoundary(tag)) flush();
      i = end + 1;
      continue;
    }

    if (html[i] === '&') {
      const end = html.indexOf(';', i + 1);
      if (end > i && end - i <= 12) {
        append(decodeEntity(html.slice(i, end + 1)));
        i = end + 1;
        continue;
      }
    }

    append(html[i]);
    i += 1;
  }

  flush();
  return paragraphs;
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function paragraphRegex(paragraph) {
  const tokens = paragraph.split(/\s+/).filter(Boolean).map(escapeRegex);
  // Same mechanism that fixed the old Redline article: match the visible
  // paragraph while ignoring harmless inline HTML, BRs, entities and spaces.
  const gap = '(?:\\s|&nbsp;|&#160;|&#x[a-f0-9]+;|&#\\d+;|<(?:\\/?(?:span|strong|b|i|em|u|s|a|small|mark)\\b[^>]*|br\\s*\\/?)>)*';
  return new RegExp(tokens.join(gap), 'giu');
}

function stripEmptyWrappers(html) {
  let output = html;
  let previous = '';
  for (let pass = 0; pass < 8 && output !== previous; pass += 1) {
    previous = output;
    output = output
      .replace(/<p\b[^>]*>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/p\s*>/gi, '')
      .replace(/<div\b([^>]*)class=(['"])([^'"]*\bfree-text\b[^'"]*)\2([^>]*)>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/div\s*>/gi, '')
      .replace(/<div\b([^>]*)class=(['"])([^'"]*\btext-block\b[^'"]*)\2([^>]*)>(?:\s|&nbsp;|&#160;|<br\s*\/?>)*<\/div\s*>/gi, '');
  }
  return output;
}

function surgicalCleanup(html) {
  let output = String(html || '');
  const paragraphs = extractParagraphs(output);
  const counts = new Map();
  for (const paragraph of paragraphs) counts.set(paragraph, (counts.get(paragraph) || 0) + 1);

  const duplicateParagraphs = [...counts.entries()]
    .filter(([, count]) => count > 1)
    .map(([paragraph]) => paragraph)
    .sort((a, b) => b.length - a.length);

  let removed = 0;
  for (const paragraph of duplicateParagraphs) {
    const regex = paragraphRegex(paragraph);
    const matches = [...output.matchAll(regex)];
    if (matches.length <= 1) continue;

    for (const match of matches.slice(1).sort((a, b) => (b.index ?? 0) - (a.index ?? 0))) {
      const start = match.index ?? 0;
      output = output.slice(0, start) + output.slice(start + match[0].length);
      removed += 1;
    }
  }

  output = stripEmptyWrappers(output);
  return { output, removed, duplicateParagraphs: duplicateParagraphs.length };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service env for Sep 1 article cleanup');

const client = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { data: rows, error } = await client
  .from('articles')
  .select('id,title,body,published_at')
  .gte('published_at', FROM)
  .lt('published_at', TO)
  .order('id', { ascending: true });

if (error) throw new Error(error.message);

let changed = 0;
let removed = 0;
const changedIds = [];

for (const article of rows || []) {
  const before = String(article.body || '');
  const cleaned = surgicalCleanup(before);
  const after = cleaned.output;

  console.log(
    `[sep1-cleanup] scan id=${article.id} title=${JSON.stringify(article.title || '')} duplicateParagraphs=${cleaned.duplicateParagraphs} removed=${cleaned.removed}`,
  );

  if (after === before) continue;

  const verification = surgicalCleanup(after);
  if (verification.output !== after || verification.removed !== 0) {
    throw new Error(`Sep 1 cleanup was not idempotent for article id=${article.id}`);
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
  if (verifyError || !verified) throw new Error(`Article ${article.id}: ${verifyError?.message || 'verification read failed'}`);
  if (String(verified.body || '') !== after) throw new Error(`Article ${article.id}: database verification mismatch`);

  changed += 1;
  removed += cleaned.removed;
  changedIds.push(article.id);
}

console.log(
  `[sep1-cleanup] VERIFIED scanned=${rows?.length || 0} changed=${changed} removedCopies=${removed} ids=${changedIds.join(',') || 'none'}`,
);
