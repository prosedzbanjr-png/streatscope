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
  return { output, removed: duplicates.length, candidates: candidates.map(item => ({ kind: item.kind, fingerprint: item.fingerprint.slice(0, 120) })) };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service env for article cleanup');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: article, error } = await client.from('articles').select('id,body').eq('id', 24).single();
if (error || !article) throw new Error(error?.message || 'Article 24 not found');

const before = String(article.body || '');
const { output: after, removed, candidates } = dedupe(before);
if (removed > 0) {
  const { error: updateError } = await client.from('articles').update({ body: after }).eq('id', 24);
  if (updateError) throw new Error(updateError.message);
}

console.log(`[article24-cleanup] removed=${removed} before=${before.length} after=${after.length}`);
console.log('[article24-cleanup] candidates=' + JSON.stringify(candidates));
