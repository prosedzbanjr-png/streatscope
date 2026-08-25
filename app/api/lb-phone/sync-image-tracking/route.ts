import { NextResponse } from "next/server";

type PublishKind = "article" | "fashion" | "motor" | "guide";
const TRACK_PATH = "/api/lb-phone/view-image";
const text = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const isApprover = (role: string) => ["editor_in_chief", "deputy_editor_in_chief"].includes(role);

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
  }).catch(() => null);
  return Boolean(response?.ok);
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!supabaseUrl || !supabaseKey || !serviceKey || !token) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

    const userHeaders = { apikey: supabaseKey, Authorization: `Bearer ${token}` };
    const serviceHeaders = { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` };

    const userResult = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: userHeaders, cache: "no-store" });
    if (!userResult.ok) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    const user = await userResult.json() as { email?: string };
    const email = text(user.email, 254).toLowerCase();
    if (!email) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

    const staffResult = await fetch(`${supabaseUrl}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email)}&select=active,role`, { headers: userHeaders, cache: "no-store" });
    if (!staffResult.ok) return NextResponse.json({ error: "Nie udało się sprawdzić uprawnień." }, { status: 502 });
    const staffRows = await staffResult.json() as Array<{ active?: boolean; role?: string }>;
    const staff = staffRows[0];
    if (!staff?.active || !isApprover(staff.role || "")) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });

    const baseUrl = new URL(request.url).origin;
    const [articlesResponse, featuresResponse, guideResponse] = await Promise.all([
      fetch(`${supabaseUrl}/rest/v1/articles?status=eq.published&archived_at=is.null&image_url=not.is.null&select=id,image_url&limit=1000`, { headers: serviceHeaders, cache: "no-store" }),
      fetch(`${supabaseUrl}/rest/v1/street_features?published=eq.true&archived_at=is.null&image_url=not.is.null&select=id,kind,image_url&limit=1000`, { headers: serviceHeaders, cache: "no-store" }),
      fetch(`${supabaseUrl}/rest/v1/guide_places?active=eq.true&archived_at=is.null&image_url=not.is.null&select=id,image_url&limit=1000`, { headers: serviceHeaders, cache: "no-store" }),
    ]);
    if (!articlesResponse.ok || !featuresResponse.ok || !guideResponse.ok) return NextResponse.json({ error: "Nie udało się pobrać materiałów do synchronizacji." }, { status: 502 });

    const articles = await articlesResponse.json() as Array<{ id: number; image_url: string }>;
    const features = await featuresResponse.json() as Array<{ id: number; kind: "fashion" | "motor"; image_url: string }>;
    const guide = await guideResponse.json() as Array<{ id: number; image_url: string }>;
    let changed = 0;

    for (const row of articles) {
      const tracked = trackedImageUrl("article", row.id, row.image_url, baseUrl);
      if (tracked !== row.image_url && await patchRow("articles", row.id, tracked, supabaseUrl, serviceHeaders)) changed++;
    }
    for (const row of features) {
      if (row.kind !== "fashion" && row.kind !== "motor") continue;
      const tracked = trackedImageUrl(row.kind, row.id, row.image_url, baseUrl);
      if (tracked !== row.image_url && await patchRow("street_features", row.id, tracked, supabaseUrl, serviceHeaders)) changed++;
    }
    for (const row of guide) {
      const tracked = trackedImageUrl("guide", row.id, row.image_url, baseUrl);
      if (tracked !== row.image_url && await patchRow("guide_places", row.id, tracked, supabaseUrl, serviceHeaders)) changed++;
    }

    return NextResponse.json({ ok: true, changed, scanned: articles.length + features.length + guide.length });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Synchronizacja nie powiodła się." }, { status: 500 });
  }
}
