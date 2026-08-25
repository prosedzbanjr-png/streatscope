import { NextResponse } from "next/server";

type PublishKind = "article" | "fashion" | "motor" | "guide";

const text = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const isApprover = (role: string) => ["editor_in_chief", "deputy_editor_in_chief"].includes(role);
const TRACK_PATH = "/api/lb-phone/view-image";

function unwrapTrackedImage(value: string, baseUrl: string) {
  if (!value) return "";
  try {
    const url = new URL(value, baseUrl);
    if (url.pathname !== TRACK_PATH) return value;
    return url.searchParams.get("src") || value;
  } catch {
    return value;
  }
}

function trackedImageUrl(kind: PublishKind, id: number, value: string, baseUrl: string) {
  const source = unwrapTrackedImage(value, baseUrl);
  if (!source) return "";
  const url = new URL(TRACK_PATH, baseUrl);
  url.searchParams.set("kind", kind);
  url.searchParams.set("id", String(id));
  url.searchParams.set("src", source);
  return url.toString();
}

async function saveTrackedImage(table: "articles" | "street_features" | "guide_places", id: number, tracked: string, supabaseUrl: string, serviceHeaders: Record<string, string>) {
  if (!tracked) return false;
  const update = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...serviceHeaders, "Content-Type": "application/json", Prefer: "return=minimal" },
    body: JSON.stringify({ image_url: tracked }),
    cache: "no-store",
  }).catch(() => null);
  return Boolean(update?.ok);
}

export async function POST(request: Request) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const appId = process.env.LB_PHONE_APP_ID || "streetscope";
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

    if (!supabaseUrl || !supabaseKey || !token) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    if (!serviceKey) return NextResponse.json({ error: "Brak SUPABASE_SERVICE_ROLE_KEY po stronie serwera." }, { status: 503 });

    const input = await request.json();
    const kind = text(input.kind, 20) as PublishKind;
    const id = Number(input.id);
    if (!Number.isInteger(id) || id < 1 || !["article", "fashion", "motor", "guide"].includes(kind)) {
      return NextResponse.json({ error: "Nieprawidłowe dane powiadomienia." }, { status: 400 });
    }

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
    let title = "";
    let content = "";
    let thumbnail = "";
    let path = "";
    let notificationLabel = "NOWY MATERIAŁ";

    if (kind === "article") {
      const result = await fetch(`${supabaseUrl}/rest/v1/articles?id=eq.${id}&select=id,title,excerpt,image_url,status,published_at,scheduled_for`, { headers: serviceHeaders, cache: "no-store" });
      if (!result.ok) return NextResponse.json({ error: "Nie udało się pobrać artykułu." }, { status: 502 });
      const rows = await result.json() as Array<{ id:number; title?:string; excerpt?:string; image_url?:string|null; status?:string; published_at?:string|null; scheduled_for?:string|null }>;
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Nie znaleziono artykułu." }, { status: 404 });
      const publishTime = row.published_at ? new Date(row.published_at).getTime() : 0;
      if (row.status !== "published" || publishTime > Date.now() + 5000) return NextResponse.json({ error: "Materiał nie jest jeszcze publiczny." }, { status: 409 });
      title = text(row.title, 180);
      content = text(row.excerpt, 260);
      const rawImage = text(row.image_url, 2000);
      thumbnail = rawImage;
      const tracked = trackedImageUrl(kind, row.id, rawImage, baseUrl);
      if (tracked && tracked !== rawImage) await saveTrackedImage("articles", row.id, tracked, supabaseUrl, serviceHeaders);
      path = `/artykul/${row.id}`;
      notificationLabel = "NOWY ARTYKUŁ";
    } else if (kind === "fashion" || kind === "motor") {
      const result = await fetch(`${supabaseUrl}/rest/v1/street_features?id=eq.${id}&select=id,kind,title,subtitle,image_url,published`, { headers: serviceHeaders, cache: "no-store" });
      if (!result.ok) return NextResponse.json({ error: "Nie udało się pobrać wpisu." }, { status: 502 });
      const rows = await result.json() as Array<{ id:number; kind?:string; title?:string; subtitle?:string|null; image_url?:string|null; published?:boolean }>;
      const row = rows[0];
      if (!row || row.kind !== kind) return NextResponse.json({ error: "Nie znaleziono wpisu." }, { status: 404 });
      if (!row.published) return NextResponse.json({ error: "Wpis nie jest publiczny." }, { status: 409 });
      title = text(row.title, 180);
      content = text(row.subtitle, 260);
      const rawImage = text(row.image_url, 2000);
      thumbnail = rawImage;
      const tracked = trackedImageUrl(kind, row.id, rawImage, baseUrl);
      if (tracked && tracked !== rawImage) await saveTrackedImage("street_features", row.id, tracked, supabaseUrl, serviceHeaders);
      path = `/${kind}/${row.id}`;
      notificationLabel = kind === "fashion" ? "NOWY LOOK" : "NOWY BUILD";
    } else {
      const result = await fetch(`${supabaseUrl}/rest/v1/guide_places?id=eq.${id}&select=id,name,short_description,image_url,active`, { headers: serviceHeaders, cache: "no-store" });
      if (!result.ok) return NextResponse.json({ error: "Nie udało się pobrać miejsca." }, { status: 502 });
      const rows = await result.json() as Array<{ id:number; name?:string; short_description?:string|null; image_url?:string|null; active?:boolean }>;
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Nie znaleziono miejsca." }, { status: 404 });
      if (!row.active) return NextResponse.json({ error: "Miejsce nie jest publiczne." }, { status: 409 });
      title = text(row.name, 180);
      content = text(row.short_description, 260);
      const rawImage = text(row.image_url, 2000);
      thumbnail = rawImage;
      const tracked = trackedImageUrl(kind, row.id, rawImage, baseUrl);
      if (tracked && tracked !== rawImage) await saveTrackedImage("guide_places", row.id, tracked, supabaseUrl, serviceHeaders);
      path = `/guide/${row.id}`;
      notificationLabel = "NOWE W SCOPE GUIDE";
    }

    const queued = await fetch(`${supabaseUrl}/rest/v1/phone_notifications?select=id,status`, {
      method: "POST",
      headers: {
        ...serviceHeaders,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        kind,
        entity_id: id,
        app: appId,
        title: `StreetScope · ${notificationLabel}`,
        content: content ? `${title} — ${content}`.slice(0, 500) : title,
        thumbnail: thumbnail || null,
        url: `${baseUrl}${path}`,
        status: "pending",
        created_by: email,
      }),
      cache: "no-store",
    });

    if (!queued.ok) {
      const details = text(await queued.text(), 500);
      return NextResponse.json({ error: details.includes("phone_notifications") ? "Najpierw uruchom SQL instalacyjny kolejki LB Phone w Supabase." : "Supabase odrzucił dodanie powiadomienia do kolejki." }, { status: 502 });
    }

    const rows = await queued.json() as Array<{ id?: number; status?: string }>;
    return NextResponse.json({ ok: true, queued: true, queueId: rows[0]?.id || null });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się dodać powiadomienia do kolejki LB Phone." }, { status: 500 });
  }
}
