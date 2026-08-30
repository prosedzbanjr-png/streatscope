import { createClient } from '@supabase/supabase-js';

const TARGETS = [
  'Redline Logistic działa w branży transportowej i logistycznej. Samo korzystanie z ochrony przy wartościowych przewozach nie jest niczym niezwykłym.',
  'Więcej pytań pojawia się jednak w momencie, gdy pracownicy ochrony poruszają się Aleutianem wyposażonym w zewnętrzne płyty balistyczne.',
  'Taki pojazd trudno uznać za zwykłe auto służbowe. Płyty balistyczne jasno sugerują przygotowanie na znacznie poważniejsze zagrożenie niż kradzież ładunku czy awanturę przy magazynie.',
];

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

function visibleChars(html) {
  const out = [];
  let i = 0;
  while (i < html.length) {
    if (html[i] === '<') {
      const end = html.indexOf('>', i + 1);
      if (end < 0) break;
      const tag = html.slice(i, end + 1).toLowerCase();
      if (/^<br\b/.test(tag) || /^<\/(?:p|div|li|blockquote|h[1-6])\b/.test(tag)) {
        out.push({ char: ' ', start: i, end: end + 1 });
      }
      i = end + 1;
      continue;
    }
    if (html[i] === '&') {
      const end = html.indexOf(';', i + 1);
      if (end > i && end - i <= 12) {
        const entity = html.slice(i, end + 1);
        const decoded = decodeEntity(entity);
        for (const char of decoded) out.push({ char, start: i, end: end + 1 });
        i = end + 1;
        continue;
      }
    }
    out.push({ char: html[i], start: i, end: i + 1 });
    i += 1;
  }
  return out;
}

function normalizedMap(html) {
  const chars = visibleChars(html);
  let text = '';
  const map = [];
  let pendingSpace = null;

  for (const item of chars) {
    const raw = item.char.replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '');
    if (!raw) continue;
    if (/\s/u.test(raw)) {
      if (text && !text.endsWith(' ') && !pendingSpace) pendingSpace = item;
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
      map.push(item);
    }
  }
  return { text: text.trim(), map };
}

function normalizePlain(value) {
  return value
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, '')
    .replace(/\u00a0/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLocaleLowerCase('pl-PL');
}

function countNormalized(html, target) {
  const { text } = normalizedMap(html);
  const needle = normalizePlain(target);
  let count = 0;
  let cursor = 0;
  while (true) {
    const index = text.indexOf(needle, cursor);
    if (index < 0) return count;
    count += 1;
    cursor = index + needle.length;
  }
}

function removeOccurrencesAfterFirst(html, target) {
  const needle = normalizePlain(target);
  let output = html;

  while (true) {
    const { text, map } = normalizedMap(output);
    const first = text.indexOf(needle);
    if (first < 0) return output;
    const second = text.indexOf(needle, first + needle.length);
    if (second < 0) return output;

    const startPoint = map[second];
    const endPoint = map[second + needle.length - 1];
    if (!startPoint || !endPoint) throw new Error(`Could not map duplicate range for: ${target.slice(0, 40)}`);

    output = output.slice(0, startPoint.start) + output.slice(endPoint.end);
  }
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error('Missing Supabase service env for Redline cleanup');

const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: rows, error } = await client
  .from('articles')
  .select('id,title,excerpt,body,status,updated_at')
  .eq('status', 'published')
  .is('archived_at', null)
  .order('updated_at', { ascending: false })
  .limit(60);
if (error) throw new Error(error.message);

const article = (rows || []).find(row => {
  const body = String(row.body || '');
  return TARGETS.every(target => countNormalized(body, target) >= 2);
});

if (!article) {
  const diagnostics = (rows || [])
    .filter(row => /redline/i.test(`${row.title || ''} ${row.excerpt || ''}`))
    .map(row => ({ id: row.id, title: row.title, counts: TARGETS.map(target => countNormalized(String(row.body || ''), target)) }));
  throw new Error(`Published Redline article with duplicated run not found. Diagnostics=${JSON.stringify(diagnostics)}`);
}

const before = String(article.body || '');
const beforeCounts = TARGETS.map(target => countNormalized(before, target));
let after = before;
for (const target of TARGETS) after = removeOccurrencesAfterFirst(after, target);
const afterCounts = TARGETS.map(target => countNormalized(after, target));

if (!afterCounts.every(count => count === 1)) {
  throw new Error(`Cleanup verification failed before update. id=${article.id} before=${beforeCounts} after=${afterCounts}`);
}

const { error: updateError } = await client
  .from('articles')
  .update({ body: after, updated_at: new Date().toISOString() })
  .eq('id', article.id);
if (updateError) throw new Error(updateError.message);

const { data: verified, error: verifyError } = await client
  .from('articles')
  .select('id,body')
  .eq('id', article.id)
  .single();
if (verifyError || !verified) throw new Error(verifyError?.message || 'Could not verify updated Redline article');
const dbCounts = TARGETS.map(target => countNormalized(String(verified.body || ''), target));
if (!dbCounts.every(count => count === 1)) {
  throw new Error(`Database verification failed. id=${article.id} counts=${dbCounts}`);
}

console.log(`[redline-cleanup] VERIFIED id=${article.id} title=${JSON.stringify(article.title)} before=${beforeCounts.join(',')} after=${dbCounts.join(',')} bytes=${before.length}->${after.length}`);
