import { jsonError } from "../../../../lib/server-security";

type SubmissionKind = "feature" | "guide";

const serviceHeaders = (serviceKey: string) => ({
  "Content-Type": "application/json",
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
});

async function getCaller(url: string, anonKey: string, token: string) {
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as { email?: string };
}

async function getStaff(url: string, serviceKey: string, email: string) {
  const response = await fetch(`${url}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email)}&active=eq.true&select=role,display_name,first_name,last_name&limit=1`, {
    headers: serviceHeaders(serviceKey),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ role?:string; display_name?:string|null; first_name?:string|null; last_name?:string|null }>;
  return rows[0] || null;
}

function cleanString(value: unknown, max = 4000) {
  return typeof value === "string" ? value.trim().slice(0, max) : value == null ? null : String(value).slice(0, max);
}

function cleanPayload(kind: SubmissionKind, raw: Record<string, unknown>, email: string) {
  const now = new Date().toISOString();
  if (kind === "guide") {
    return {
      name: cleanString(raw.name, 250) || "Bez nazwy",
      category: cleanString(raw.category, 80) || "food",
      neighborhood: cleanString(raw.neighborhood, 160),
      short_description: cleanString(raw.short_description, 500),
      description: cleanString(raw.description, 12000),
      image_url: cleanString(raw.image_url, 2000),
      gallery: Array.isArray(raw.gallery) ? raw.gallery.filter(v=>typeof v === "string").slice(0,8) : [],
      address: cleanString(raw.address, 500),
      phone: cleanString(raw.phone, 120),
      hours: cleanString(raw.hours, 200),
      website_url: cleanString(raw.website_url, 2000),
      price_level: cleanString(raw.price_level, 10),
      featured_order: Number(raw.featured_order) || 100,
      active: false,
      featured: Boolean(raw.featured),
      featured_home: Boolean(raw.featured_home),
      featured_label: cleanString(raw.featured_label, 100) || "PROMOWANE",
      review_status: "review",
      review_note: null,
      submitted_by: email,
      submitted_at: now,
      updated_at: now,
    };
  }

  return {
    kind: raw.kind === "motor" ? "motor" : "fashion",
    title: cleanString(raw.title, 250) || "Bez tytułu",
    subtitle: cleanString(raw.subtitle, 500),
    description: cleanString(raw.description, 12000),
    image_url: cleanString(raw.image_url, 2000),
    gallery: Array.isArray(raw.gallery) ? raw.gallery.filter(v=>typeof v === "string").slice(0,8) : [],
    person_name: cleanString(raw.person_name, 250),
    location: cleanString(raw.location, 250),
    vehicle_model: cleanString(raw.vehicle_model, 250),
    vehicle_year: cleanString(raw.vehicle_year, 40),
    owner_name: cleanString(raw.owner_name, 250),
    workshop: cleanString(raw.workshop, 250),
    details: cleanString(raw.details, 8000),
    badge: cleanString(raw.badge, 120),
    editor_take: cleanString(raw.editor_take, 4000),
    score_style: raw.score_style == null ? null : Number(raw.score_style),
    score_originality: raw.score_originality == null ? null : Number(raw.score_originality),
    score_details: raw.score_details == null ? null : Number(raw.score_details),
    score_build: raw.score_build == null ? null : Number(raw.score_build),
    score_overall: raw.score_overall == null ? null : Number(raw.score_overall),
    engine: cleanString(raw.engine, 250),
    power: cleanString(raw.power, 250),
    drivetrain: cleanString(raw.drivetrain, 250),
    wheels: cleanString(raw.wheels, 250),
    suspension: cleanString(raw.suspension, 250),
    build_cost: cleanString(raw.build_cost, 250),
    featured: false,
    published: false,
    review_status: "review",
    review_note: null,
    submitted_by: email,
    submitted_at: now,
    created_by: email,
    updated_at: now,
  };
}

async function sendDiscord(webhook: string | undefined, baseUrl: string, kind: SubmissionKind, row: Record<string, unknown>, actor: string) {
  if (!webhook) return;
  const isGuide = kind === "guide";
  const format = isGuide ? "SCOPE GUIDE" : row.kind === "motor" ? "MOTOR / BUILD" : "FASHION / LOOK";
  const title = String(isGuide ? row.name || "Bez nazwy" : row.title || "Bez tytułu");
  const subtitle = String(isGuide ? row.short_description || "Brak zajawki." : row.subtitle || "Brak zajawki.");
  const payload = {
    username: "StreetScope · Redakcja",
    embeds: [{
      title: "✍️ Materiał czeka na akceptację",
      url: `${baseUrl}/redakcja/zarzadzaj`,
      color: 0xf0a31b,
      fields: [
        { name: "Tytuł", value: title.slice(0,250) },
        { name: "Format", value: format, inline: true },
        { name: "Wysłał(a)", value: actor.slice(0,160), inline: true },
        { name: "Zajawka", value: subtitle.slice(0,900) },
      ],
      footer: { text: "StreetScope · kolejka akceptacji" },
      timestamp: new Date().toISOString(),
    }],
  };
  await fetch(webhook, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(payload) }).catch(()=>undefined);
}

export async function POST(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) return jsonError("Wysyłanie do akceptacji nie jest skonfigurowane.", 503, "not_configured");

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonError("Brak autoryzacji.", 401, "unauthorized");
    const caller = await getCaller(url, anonKey, token);
    const email = caller?.email?.toLowerCase() || "";
    if (!email) return jsonError("Brak autoryzacji.", 401, "unauthorized");
    const staff = await getStaff(url, serviceKey, email);
    if (!staff) return jsonError("Brak dostępu do redakcji.", 403, "forbidden");

    const input = await request.json().catch(()=>({})) as { kind?:SubmissionKind; id?:number; payload?:Record<string,unknown> };
    const kind = input.kind;
    if (kind !== "guide" && kind !== "feature") return jsonError("Nieprawidłowy typ materiału.", 400, "invalid_kind");
    const payload = cleanPayload(kind, input.payload || {}, email);
    const table = kind === "guide" ? "guide_places" : "street_features";
    const id = Number(input.id || 0);

    if (id > 0) {
      const ownerSelect = kind === "guide" ? "id,submitted_by" : "id,submitted_by,created_by";
      const currentRes = await fetch(`${url}/rest/v1/${table}?id=eq.${id}&select=${ownerSelect}&limit=1`, { headers:serviceHeaders(serviceKey), cache:"no-store" });
      if (!currentRes.ok) return jsonError("Nie udało się sprawdzić istniejącego wpisu.", 500, "lookup_failed");
      const currentRows = await currentRes.json() as Array<{submitted_by?:string|null;created_by?:string|null}>;
      const current = currentRows[0];
      if (!current) return jsonError("Nie znaleziono wpisu.", 404, "not_found");
      const isApprover = ["editor_in_chief","deputy_editor_in_chief"].includes(staff.role || "");
      const owner = (current.submitted_by || current.created_by || "").toLowerCase();
      if (!isApprover && owner !== email) return jsonError("Nie możesz edytować cudzego wpisu.", 403, "forbidden");
    }

    const endpoint = id > 0 ? `${url}/rest/v1/${table}?id=eq.${id}&select=*` : `${url}/rest/v1/${table}?select=*`;
    const method = id > 0 ? "PATCH" : "POST";
    const response = await fetch(endpoint, {
      method,
      headers:{ ...serviceHeaders(serviceKey), Prefer:"return=representation" },
      body:JSON.stringify(payload),
      cache:"no-store",
    });
    const result = await response.json().catch(()=>null);
    if (!response.ok) return jsonError(`Nie udało się zapisać materiału do akceptacji: ${JSON.stringify(result)}`, 500, "save_failed");
    const row = Array.isArray(result) ? result[0] : result;
    if (!row?.id) return jsonError("Materiał nie został zapisany w kolejce.", 500, "missing_row");

    const actor = [staff.first_name,staff.last_name].filter(Boolean).join(" ") || staff.display_name || email.split("@")[0];
    await sendDiscord(process.env.REVIEW_DISCORD_WEBHOOK_URL, new URL(request.url).origin, kind, row, actor);

    return Response.json({ ok:true, id:row.id, review_status:"review" }, { headers:{"Cache-Control":"no-store"} });
  } catch (error) {
    console.error("StreetScope review submission failed", error);
    return jsonError(error instanceof Error ? error.message : "Nie udało się wysłać materiału do akceptacji.", 500, "submit_review_failed");
  }
}
