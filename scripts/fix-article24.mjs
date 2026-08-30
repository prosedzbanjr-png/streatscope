import { createClient } from '@supabase/supabase-js';

function normalize(value) {
  return value
    .replace(/<br\s*\/?>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;|&#160;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pl-PL');
}

function matchingDivEnd(html, start) {
  const tags = /<\/?div\b[^>]*>/gi;
  tags.lastIndex = start;
  let depth = 0;
  let match;
  while ((match = tags.exec(html))) {
    if (/^<\/div/i.test(match[0])) depth -= 1;
    else depth += 1;
    if (depth === 0) return match.index + match[0].length;
  }
  return -1;
}

function findTextBlocks(html) {
  const opener = /<div\b[^>]*class=(['"])[^'"]*\btext-block\b[^'"]*\1[^>]*>/gi;
  const blocks = [];
  let match;
  while ((match = opener.exec(html))) {
    const start = match.index;
    const end = matchingDivEnd(html, start);
    if (end <= start) continue;
    blocks.push({ start, end, fingerprint: normalize(html.slice(start, end)), kind: 'text-block' });
    opener.lastIndex = end;
  }
  return blocks;
}

function inside(index, ranges) {
  return ranges.some(range => index > range.start && index < range.end);
}

function findLegacyParagraphs(html, textBlocks) {
  const paragraphs = [];
  const regex = /<p\b[^>]*>[\s\S]*?<\/p\s*>/gi;
  let match;
  while ((match = regex.exec(html))) {
    if (inside(match.index, textBlocks)) continue;
    const fingerprint = normalize(match[0]);
    if (fingerprint.length < 80) continue;
    paragraphs.push({ start: match.index, end: match.index + match[0].length, fingerprint, kind: 'paragraph' });
  }
  return paragraphs;
}

function dedupe(html) {
  const textBlocks = findTextBlocks(html);
  const candidates = [...textBlocks, ...findLegacyParagraphs(html, textBlocks)]
    .filter(block => block.fingerprint.length >= 80)
    .sort((a, b) => a.start - b.start || b.end - a.end);

  const seen = new Map();
  const duplicates = [];
  for (const block of candidates) {
    const previous = seen.get(block.fingerprint);
    if (!previous) {
      seen.set(block.fingerprint, block);
      continue;
    }
    if (block.start >= previous.start && block.end <= previous.end) continue;
    duplicates.push(block);
  }

  let output = html;
  for (const block of duplicates.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, block.start) + output.slice(block.end);
  }
  return { output, removed: duplicates.length };
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const TARGET = 'Według pierwszych relacji nieznany mężczyzna ma uprowadzać przypadkowe osoby, a następnie zmuszać je do rozebrania się, tańczenia i śpiewania. Na ten moment nie wiadomo, czym kieruje się sprawca ani ilu mieszkańców mogło już paść jego ofiarą.';

function removeLaterTargetCopies(html) {
  const tokens = TARGET.split(/\s+/).filter(Boolean).map(escapeRegex);
  const inlineGap = '(?:\\s|&nbsp;|&#160;|<(?:\\/?(?:span|strong|b|i|em|u|s|a)\\b[^>]*|br\\s*\\/?)>)*';
  const regex = new RegExp(tokens.join(inlineGap), 'giu');
  const matches = [...html.matchAll(regex)];
  if (matches.length <= 1) return { output: html, removed: 0, found: matches.length };

  let output = html;
  for (const match of matches.slice(1).sort((a, b) => (b.index ?? 0) - (a.index ?? 0))) {
    const start = match.index ?? 0;
    const end = start + match[0].length;
    output = output.slice(0, start) + output.slice(end);
  }

  // Remove empty wrappers left by surgical text removal.
  output = output
    .replace(/<p\b[^>]*>\s*(?:<br\s*\/?>\s*)?<\/p\s*>/gi, '')
    .replace(/<div\b([^>]*)class=(['"])([^'"]*\bfree-text\b[^'"]*)\2([^>]*)>\s*(?:<br\s*\/?>\s*)?<\/div\s*>/gi, '')
    .replace(/<div\b([^>]*)class=(['"])([^'"]*\btext-block\b[^'"]*)\2([^>]*)>\s*<\/div\s*>/gi, '');

  return { output, removed: matches.length - 1, found: matches.length };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service env for article cleanup');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: article, error } = await client.from('articles').select('id,body').eq('id', 24).single();
if (error || !article) throw new Error(error?.message || 'Article 24 not found');

const before = String(article.body || '');
const generic = dedupe(before);
const surgical = removeLaterTargetCopies(generic.output);
const after = surgical.output;
const changed = after !== before;

if (changed) {
  const { error: updateError } = await client.from('articles').update({ body: after }).eq('id', 24);
  if (updateError) throw new Error(updateError.message);
}

console.log(`[article24-cleanup] genericRemoved=${generic.removed} targetFound=${surgical.found} targetRemoved=${surgical.removed} before=${before.length} after=${after.length} changed=${changed}`);
