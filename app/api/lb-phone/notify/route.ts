import { NextResponse } from "next/server";

type PublishKind = "article" | "fashion" | "motor" | "guide";

const text = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const isApprover = (role: string) => ["editor_in_chief", "deputy_editor_in_chief"].includes(role);

export async function POST(request: Request) {
  try {
    const bridgeUrl = process.env.LB_PHONE_NOTIFY_URL;
    const bridgeSecret = process.env.LB_PHONE_NOTIFY_SECRET;
    const appId = process.env.LB_PHONE_APP_ID || "streetscope";
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

    if (!supabaseUrl || !supabaseKey || !token) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    if (!bridgeUrl) return NextResponse.json({ error: "StreetScope nie ma ustawionego adresu bridge LB Phone (LB_PHONE_NOTIFY_URL)." }, { status: 503 });

    const input = await request.json();
    const kind = text(input.kind, 20) as PublishKind;
    const id = Number(input.id);
    if (!Number.isInteger(id) || id < 1 || !["article", "fashion", "motor", "guide"].includes(kind)) {
      return NextResponse.json({ error: "Nieprawidłowe dane powiadomienia." }, { status: 400 });
    }

    const headers = { apikey: supabaseKey, Authorization: `Bearer ${token}` };
    const userResult = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!userResult.ok) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    const user = await userResult.json() as { email?: string };
    const email = text(user.email, 254).toLowerCase();
    if (!email) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

    const staffResult = await fetch(`${supabaseUrl}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email)}&select=active,role`, { headers });
    if (!staffResult.ok) return NextResponse.json({ error: "Nie udało się sprawdzić uprawnień." }, { status: 502 });
    const staffRows = await staffResult.json() as Array<{ active?: boolean; role?: string }>;
    const staff = staffRows[0];
    if (!staff?.active || !isApprover(staff.role || "")) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });

    let title = "";
    let content = "";
    let thumbnail = "";
    let path = "";
    let notificationLabel = "NOWY MATERIAŁ";

    if (kind === "article") {
      const result = await fetch(`${supabaseUrl}/rest/v1/articles?id=eq.${id}&select=id,title,excerpt,image_url,status,published_at,scheduled_for`, { headers });
      if (!result.ok) return NextResponse.json({ error: "Nie udało się pobrać artykułu." }, { status: 502 });
      const rows = await result.json() as Array<{ id:number; title?:string; excerpt?:string; image_url?:string|null; status?:string; published_at?:string|null; scheduled_for?:string|null }>;
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Nie znaleziono artykułu." }, { status: 404 });
      const publishTime = row.published_at ? new Date(row.published_at).getTime() : 0;
      if (row.status !== "published" || (publishTime > Date.now() + 5000)) return NextResponse.json({ error: "Materiał nie jest jeszcze publiczny." }, { status: 409 });
      title = text(row.title, 180);
      content = text(row.excerpt, 260);
      thumbnail = text(row.image_url, 1000);
      path = `/artykul/${row.id}`;
      notificationLabel = "NOWY ARTYKUŁ";
    } else if (kind === "fashion" || kind === "motor") {
      const result = await fetch(`${supabaseUrl}/rest/v1/street_features?id=eq.${id}&select=id,kind,title,subtitle,image_url,published`, { headers });
      if (!result.ok) return NextResponse.json({ error: "Nie udało się pobrać wpisu." }, { status: 502 });
      const rows = await result.json() as Array<{ id:number; kind?:string; title?:string; subtitle?:string|null; image_url?:string|null; published?:boolean }>;
      const row = rows[0];
      if (!row || row.kind !== kind) return NextResponse.json({ error: "Nie znaleziono wpisu." }, { status: 404 });
      if (!row.published) return NextResponse.json({ error: "Wpis nie jest publiczny." }, { status: 409 });
      title = text(row.title, 180);
      content = text(row.subtitle, 260);
      thumbnail = text(row.image_url, 1000);
      path = `/${kind}/${row.id}`;
      notificationLabel = kind === "fashion" ? "NOWY LOOK" : "NOWY BUILD";
    } else {
      const result = await fetch(`${supabaseUrl}/rest/v1/guide_places?id=eq.${id}&select=id,name,short_description,image_url,active`, { headers });
      if (!result.ok) return NextResponse.json({ error: "Nie udało się pobrać miejsca." }, { status: 502 });
      const rows = await result.json() as Array<{ id:number; name?:string; short_description?:string|null; image_url?:string|null; active?:boolean }>;
      const row = rows[0];
      if (!row) return NextResponse.json({ error: "Nie znaleziono miejsca." }, { status: 404 });
      if (!row.active) return NextResponse.json({ error: "Miejsce nie jest publiczne." }, { status: 409 });
      title = text(row.name, 180);
      content = text(row.short_description, 260);
      thumbnail = text(row.image_url, 1000);
      path = `/guide/${row.id}`;
      notificationLabel = "NOWE W SCOPE GUIDE";
    }

    const baseUrl = new URL(request.url).origin;
    const payload = {
      audience: "all",
      app: appId,
      title: `StreetScope · ${notificationLabel}`,
      content: content ? `${title} — ${content}`.slice(0, 500) : title,
      thumbnail: thumbnail || undefined,
      url: `${baseUrl}${path}`,
      kind,
      id,
    };

    const bridgeHeaders: Record<string, string> = { "Content-Type": "application/json" };
    if (bridgeSecret) {
      bridgeHeaders.Authorization = `Bearer ${bridgeSecret}`;
      bridgeHeaders["X-StreetScope-Secret"] = bridgeSecret;
    }

    const sent = await fetch(bridgeUrl, { method: "POST", headers: bridgeHeaders, body: JSON.stringify(payload), cache: "no-store" });
    if (!sent.ok) return NextResponse.json({ error: `Bridge LB Phone odrzucił powiadomienie (${sent.status}).` }, { status: 502 });

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Nie udało się wysłać powiadomienia LB Phone." }, { status: 500 });
  }
}
