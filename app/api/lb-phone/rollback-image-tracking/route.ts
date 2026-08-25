import { NextResponse } from "next/server";

const TOKEN = "ss-rollback-8d69f3e7c2a14a2f";
const TRACK_PATH = "/api/lb-phone/view-image";

function unwrapTracked(value: string | null | undefined, baseUrl: string) {
  let current = String(value || "").trim();
  if (!current) return "";

  for (let i = 0; i < 6; i++) {
    try {
      const url = new URL(current, baseUrl);
      if (url.pathname !== TRACK_PATH) break;
      const source = url.searchParams.get("src") || "";
      if (!source || source === current) break;
      current = source;
    } catch {
      break;
    }
  }
  return current;
}

async function patchRow(table: string, id: number, fields: Record<string, string>, supabaseUrl: string, headers: Record<string, string>) {
  const response = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify(fields),
    cache: "no-store",
  }).catch(() => null);
  return Boolean(response?.ok);
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) return NextResponse.json({ error: "not_configured" }, { status: 503 });

  const headers = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };
  const baseUrl = url.origin;

  const [articlesResponse, featuresResponse, guideResponse, notificationsResponse] = await Promise.all([
    fetch(`${supabaseUrl}/rest/v1/articles?select=id,image_url,social_image&limit=5000`, { headers, cache: "no-store" }),
    fetch(`${supabaseUrl}/rest/v1/street_features?select=id,image_url&limit=5000`, { headers, cache: "no-store" }),
    fetch(`${supabaseUrl}/rest/v1/guide_places?select=id,image_url&limit=5000`, { headers, cache: "no-store" }),
    fetch(`${supabaseUrl}/rest/v1/phone_notifications?select=id,thumbnail&limit=5000`, { headers, cache: "no-store" }),
  ]);

  if (!articlesResponse.ok || !featuresResponse.ok || !guideResponse.ok) {
    return NextResponse.json({
      error: "lookup_failed",
      articles: articlesResponse.status,
      features: featuresResponse.status,
      guide: guideResponse.status,
      notifications: notificationsResponse.status,
    }, { status: 502 });
  }

  const articles = await articlesResponse.json() as Array<{ id: number; image_url?: string | null; social_image?: string | null }>;
  const features = await featuresResponse.json() as Array<{ id: number; image_url?: string | null }>;
  const guide = await guideResponse.json() as Array<{ id: number; image_url?: string | null }>;
  const notifications = notificationsResponse.ok ? await notificationsResponse.json() as Array<{ id: number; thumbnail?: string | null }> : [];

  let restored = 0;
  let failed = 0;

  for (const row of articles) {
    const fields: Record<string, string> = {};
    const image = unwrapTracked(row.image_url, baseUrl);
    const social = unwrapTracked(row.social_image, baseUrl);
    if (row.image_url && image && image !== row.image_url) fields.image_url = image;
    if (row.social_image && social && social !== row.social_image) fields.social_image = social;
    if (Object.keys(fields).length) {
      if (await patchRow("articles", row.id, fields, supabaseUrl, headers)) restored++;
      else failed++;
    }
  }

  for (const row of features) {
    const image = unwrapTracked(row.image_url, baseUrl);
    if (row.image_url && image && image !== row.image_url) {
      if (await patchRow("street_features", row.id, { image_url: image }, supabaseUrl, headers)) restored++;
      else failed++;
    }
  }

  for (const row of guide) {
    const image = unwrapTracked(row.image_url, baseUrl);
    if (row.image_url && image && image !== row.image_url) {
      if (await patchRow("guide_places", row.id, { image_url: image }, supabaseUrl, headers)) restored++;
      else failed++;
    }
  }

  for (const row of notifications) {
    const thumbnail = unwrapTracked(row.thumbnail, baseUrl);
    if (row.thumbnail && thumbnail && thumbnail !== row.thumbnail) {
      if (await patchRow("phone_notifications", row.id, { thumbnail }, supabaseUrl, headers)) restored++;
      else failed++;
    }
  }

  return NextResponse.json({
    ok: failed === 0,
    restored,
    failed,
    scanned: articles.length + features.length + guide.length + notifications.length,
  });
}
