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

function dedupe(html) {
  const opener = /<div\b[^>]*class=(['"])[^'"]*\btext-block\b[^'"]*\1[^>]*>/gi;
  const seen = new Set();
  const duplicates = [];
  let match;
  while ((match = opener.exec(html))) {
    const start = match.index;
    const end = matchingDivEnd(html, start);
    if (end <= start) continue;
    const fingerprint = normalize(html.slice(start, end));
    if (fingerprint.length >= 80) {
      if (seen.has(fingerprint)) duplicates.push({ start, end });
      else seen.add(fingerprint);
    }
    opener.lastIndex = end;
  }
  let output = html;
  for (const block of duplicates.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, block.start) + output.slice(block.end);
  }
  return { output, removed: duplicates.length };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service env for article cleanup');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: article, error } = await client.from('articles').select('id,body').eq('id', 24).single();
if (error || !article) throw new Error(error?.message || 'Article 24 not found');

const before = String(article.body || '');
const { output: after, removed } = dedupe(before);
if (removed > 0) {
  const { error: updateError } = await client.from('articles').update({ body: after }).eq('id', 24);
  if (updateError) throw new Error(updateError.message);
}

console.log(`[article24-cleanup] removed=${removed} before=${before.length} after=${after.length}`);
