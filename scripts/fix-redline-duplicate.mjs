import { createClient } from '@supabase/supabase-js';

const TARGETS = [
  'Redline Logistic działa w branży transportowej i logistycznej. Samo korzystanie z ochrony przy wartościowych przewozach nie jest niczym niezwykłym.',
  'Więcej pytań pojawia się jednak w momencie, gdy pracownicy ochrony poruszają się Aleutianem wyposażonym w zewnętrzne płyty balistyczne.',
  'Taki pojazd trudno uznać za zwykłe auto służbowe. Płyty balistyczne jasno sugerują przygotowanie na znacznie poważniejsze zagrożenie niż kradzież ładunku czy awanturę przy magazynie.',
];

function countLiteral(value, needle) {
  let count = 0;
  let cursor = 0;
  while (true) {
    const index = value.indexOf(needle, cursor);
    if (index < 0) return count;
    count += 1;
    cursor = index + needle.length;
  }
}

function removeSecondLiteral(value, needle) {
  const first = value.indexOf(needle);
  if (first < 0) return value;
  const second = value.indexOf(needle, first + needle.length);
  if (second < 0) return value;
  return value.slice(0, second) + value.slice(second + needle.length);
}

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

function structuralDedupe(html) {
  const opener = /<div\b[^>]*class=(['"])[^'"]*\btext-block\b[^'"]*\1[^>]*>/gi;
  const blocks = [];
  let match;
  while ((match = opener.exec(html))) {
    const start = match.index;
    const end = matchingDivEnd(html, start);
    if (end <= start) continue;
    const fingerprint = normalize(html.slice(start, end));
    if (fingerprint.length >= 80) blocks.push({ start, end, fingerprint });
    opener.lastIndex = end;
  }

  const seen = new Set();
  const duplicates = [];
  for (const block of blocks) {
    if (seen.has(block.fingerprint)) duplicates.push(block);
    else seen.add(block.fingerprint);
  }

  let output = html;
  for (const block of duplicates.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, block.start) + output.slice(block.end);
  }
  return { output, removed: duplicates.length };
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service env for Redline cleanup');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: rows, error } = await client
  .from('articles')
  .select('id,title,body,updated_at')
  .ilike('title', '%Redline Logistic%')
  .order('id', { ascending: false })
  .limit(5);

if (error) throw new Error(error.message);
if (!rows?.length) throw new Error('Redline Logistic article not found');

const article = rows[0];
const before = String(article.body || '');
let after = before;
const literalCounts = TARGETS.map(target => countLiteral(after, target));

if (literalCounts.every(count => count >= 2)) {
  for (const target of TARGETS) after = removeSecondLiteral(after, target);
}

const structural = structuralDedupe(after);
after = structural.output;

if (after !== before) {
  const { error: updateError } = await client
    .from('articles')
    .update({ body: after, updated_at: new Date().toISOString() })
    .eq('id', article.id);
  if (updateError) throw new Error(updateError.message);
}

console.log(`[redline-cleanup] id=${article.id} title=${JSON.stringify(article.title)} literalCounts=${literalCounts.join(',')} structuralRemoved=${structural.removed} before=${before.length} after=${after.length} changed=${after !== before}`);
