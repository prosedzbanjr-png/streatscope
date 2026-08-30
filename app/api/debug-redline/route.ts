import { NextResponse } from "next/server";

const TARGETS = [
  "Redline Logistic działa w branży transportowej i logistycznej. Samo korzystanie z ochrony przy wartościowych przewozach nie jest niczym niezwykłym.",
  "Więcej pytań pojawia się jednak w momencie, gdy pracownicy ochrony poruszają się Aleutianem wyposażonym w zewnętrzne płyty balistyczne.",
  "Taki pojazd trudno uznać za zwykłe auto służbowe. Płyty balistyczne jasno sugerują przygotowanie na znacznie poważniejsze zagrożenie niż kradzież ładunku czy awanturę przy magazynie.",
];

function plainText(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<\/div\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function countNormalized(haystack: string, needle: string) {
  const h = plainText(haystack).replace(/\s+/g, " ").toLocaleLowerCase("pl-PL");
  const n = plainText(needle).replace(/\s+/g, " ").toLocaleLowerCase("pl-PL");
  let count = 0;
  let cursor = 0;
  while (true) {
    const index = h.indexOf(n, cursor);
    if (index < 0) return count;
    count += 1;
    cursor = index + n.length;
  }
}

export async function GET() {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !serviceKey) return NextResponse.json({ ok: false, error: "not_configured" }, { status: 503 });

    const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
    const marker = encodeURIComponent("*Redline Logistic działa w branży transportowej*");
    const response = await fetch(`${url}/rest/v1/articles?body=ilike.${marker}&select=id,title,body,updated_at&order=id.desc&limit=5`, {
      headers,
      cache: "no-store",
    });
    if (!response.ok) return NextResponse.json({ ok: false, error: "lookup_failed", status: response.status }, { status: 500 });

    const rows = await response.json() as Array<{ id:number; title:string; body:string|null; updated_at:string|null }>;
    const article = rows[0];
    if (!article) return NextResponse.json({ ok: false, error: "not_found" }, { status: 404 });
    const body = String(article.body || "");
    const text = plainText(body);

    return NextResponse.json({
      ok: true,
      id: article.id,
      title: article.title,
      updated_at: article.updated_at,
      bodyLength: body.length,
      tagCounts: {
        textBlock: (body.match(/\btext-block\b/gi) || []).length,
        freeText: (body.match(/\bfree-text\b/gi) || []).length,
        p: (body.match(/<p\b/gi) || []).length,
        div: (body.match(/<div\b/gi) || []).length,
        br: (body.match(/<br\b/gi) || []).length,
      },
      targetCounts: TARGETS.map(target => countNormalized(body, target)),
      textSample: text.slice(0, 2200),
      rawSample: body.slice(0, 3500),
    }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "debug_failed" }, { status: 500 });
  }
}
