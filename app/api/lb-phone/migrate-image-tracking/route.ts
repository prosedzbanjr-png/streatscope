import { NextResponse } from "next/server";

type PublishKind = "article" | "fashion" | "motor" | "guide";
const TOKEN = "ss-views-20260825-4e93bcb39c0e4ff9a155db6bcc5a06d4";
const TRACK_PATH = "/api/lb-phone/view-image";

function trackedImageUrl(kind: PublishKind, id: number, value: string, baseUrl: string) {
  if (!value) return "";
  try {
    const existing = new URL(value, baseUrl);
    if (existing.pathname === TRACK_PATH) {
      const source = existing.searchParams.get("src") || "";
      if (!source) return value;
      const normalized = new URL(TRACK_PATH, baseUrl);
      normalized.searchParams.set("kind", kind);
      normalized.searchParams.set("id", String(id));
      normalized.searchParams.set("src", source);
      return normalized.toString();
    }
  } catch {}
  const url = new URL(TRACK_PATH, baseUrl);
  url.searchParams.set("kind", kind);
  url.searchParams.set("id", String(id));
  url.searchParams.set("src", value);
  return url.toString();
}

async function patchRow(table: string, id: number, imageUrl: string, supabaseUrl: string, headers: Record<string, string>) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ image_url: imageUrl }),
    cache: "no-store",
  });
  return response.ok;
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const baseUrl = url.origin;

  const [articlesResponse, featuresResponse, guideResponse] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/articles?status=eq.published&archived_at=is.null&image_url=not.is.null&select=id,image_url&limit=1000`, { headers, cache: "no-store" }),
    fetch(`${supabaseUrl}/rest/v1/street_features?published=eq.true&archived_at=is.null&image_url=not.is.null&select=id,kind,image_url&limit=1000`, { headers, cache: "no-store" }),
    fetch(`${supabaseUrl}/rest/v1/guide_places?active=eq.true&archived_at=is.null&image_url=not.is.null&select=id,image_url&limit=1000`, { headers, cache: "no-store" }),
  ]);

  if (!articlesResponse.ok || !featuresResponse.ok || !guideResponse.ok) {
    return NextResponse.json({ error: "lookup_failed", articles: articlesResponse.status, features: featuresResponse.status, guide: guideResponse.status }, { status: 502 });
  }

  const articles = await articlesResponse.json() as Array<{ id: number; image_url: string }>;
  const features = await featuresResponse.json() as Array<{ id: number; kind: "fashion" | "motor"; image_url: string }>;
  const guide = await guideResponse.json() as Array<{ id: number; image_url: string }>;

  let changedArticles = 0;
  let changedFeatures = 0;
  let changedGuide = 0;
  const examples: string[] = [];

  for (const row of articles) {
    const tracked = trackedImageUrl("article", row.id, row.image_url, baseUrl);
    if (tracked !== row.image_url && await patchRow("articles", row.id, tracked, supabaseUrl, headers)) {
      changedArticles++;
      if (examples.length < 3) examples.push(tracked);
    }
  }
  for (const row of features) {
    if (row.kind !== "fashion" && row.kind !== "motor") continue;
    const tracked = trackedImageUrl(row.kind, row.id, row.image_url, baseUrl);
    if (tracked !== row.image_url && await patchRow("street_features", row.id, tracked, supabaseUrl, headers)) {
      changedFeatures++;
      if (examples.length < 3) examples.push(tracked);
    }
  }
  for (const row of guide) {
    const tracked = trackedImageUrl("guide", row.id, row.image_url, baseUrl);
    if (tracked !== row.image_url && await patchRow("guide_places", row.id, tracked, supabaseUrl, headers)) {
      changedGuide++;
      if (examples.length < 3) examples.push(tracked);
    }
  }

  return NextResponse.json({
    ok: true,
    found: { articles: articles.length, features: features.length, guide: guide.length },
    changed: { articles: changedArticles, features: changedFeatures, guide: changedGuide },
    examples,
  });
}
