import { jsonError } from "../../../../lib/server-security";

type QueueKind = "feature" | "guide";
type QueueAction = "approve" | "changes";

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

async function getChief(url: string, serviceKey: string, email: string) {
  const response = await fetch(`${url}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email.toLowerCase())}&active=eq.true&select=role&limit=1`, {
    headers: serviceHeaders(serviceKey),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ role?: string }>;
  const role = rows[0]?.role || "";
  return ["editor_in_chief", "deputy_editor_in_chief"].includes(role) ? role : null;
}

async function authorize(request: Request) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !anonKey || !serviceKey) return { error: jsonError("Kolejka akceptacji nie jest skonfigurowana.", 503, "not_configured") } as const;

  const authHeader = request.headers.get("authorization") || "";
  const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
  if (!token) return { error: jsonError("Brak autoryzacji.", 401, "unauthorized") } as const;

  const caller = await getCaller(url, anonKey, token);
  const email = caller?.email?.toLowerCase() || "";
  if (!email || !(await getChief(url, serviceKey, email))) return { error: jsonError("Nie masz dostępu do kolejki akceptacji.", 403, "forbidden") } as const;

  return { url, serviceKey, email } as const;
}

async function readJson(response: Response) {
  const value = await response.json().catch(() => null);
  if (!response.ok) {
    const message = value && typeof value === "object" && "message" in value ? String((value as { message?: unknown }).message || "") : "";
    throw new Error(message || `Supabase zwrócił błąd ${response.status}.`);
  }
  return value;
}

export async function GET(request: Request) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;
    const { url, serviceKey } = auth;

    const [featureResponse, guideResponse] = await Promise.all([
      fetch(`${url}/rest/v1/street_features?review_status=eq.review&archived_at=is.null&select=id,kind,title,subtitle,submitted_by,created_by,updated_at,review_note&order=updated_at.desc`, {
        headers: serviceHeaders(serviceKey),
        cache: "no-store",
      }),
      fetch(`${url}/rest/v1/guide_places?review_status=eq.review&archived_at=is.null&select=id,name,category,neighborhood,short_description,submitted_by,updated_at,review_note,featured,featured_home&order=updated_at.desc`, {
        headers: serviceHeaders(serviceKey),
        cache: "no-store",
      }),
    ]);

    const [features, guides] = await Promise.all([readJson(featureResponse), readJson(guideResponse)]);
    const featureRows = Array.isArray(features) ? features : [];
    const guideRows = Array.isArray(guides) ? guides : [];

    return Response.json({
      ok: true,
      features: featureRows,
      guides: guideRows,
      counts: { features: featureRows.length, guides: guideRows.length },
    }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("StreetScope review queue load failed", error);
    return jsonError(error instanceof Error ? error.message : "Nie udało się pobrać kolejki akceptacji.", 500, "review_queue_failed");
  }
}

export async function PATCH(request: Request) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;
    const { url, serviceKey, email } = auth;

    const body = await request.json().catch(() => ({}));
    const kind = String(body.kind || "") as QueueKind;
    const action = String(body.action || "") as QueueAction;
    const id = Number(body.id);
    const note = typeof body.note === "string" ? body.note.trim().slice(0, 1500) : "";

    if (!Number.isInteger(id) || id < 1) return jsonError("Nieprawidłowe ID wpisu.", 400, "invalid_id");
    if (!(["feature", "guide"] as string[]).includes(kind)) return jsonError("Nieprawidłowy typ wpisu.", 400, "invalid_kind");
    if (!(["approve", "changes"] as string[]).includes(action)) return jsonError("Nieprawidłowa akcja.", 400, "invalid_action");

    const now = new Date().toISOString();
    const table = kind === "feature" ? "street_features" : "guide_places";
    const select = kind === "feature" ? "id,kind,title" : "id,name";
    const update = kind === "feature"
      ? action === "approve"
        ? { published: true, review_status: "published", review_note: null, reviewed_by: email, reviewed_at: now, updated_at: now }
        : { published: false, review_status: "changes_requested", review_note: note || "Proszę poprawić wpis.", reviewed_by: email, reviewed_at: now, updated_at: now }
      : action === "approve"
        ? { active: true, review_status: "published", review_note: null, reviewed_by: email, reviewed_at: now, updated_at: now }
        : { active: false, review_status: "changes_requested", review_note: note || "Proszę poprawić wpis.", reviewed_by: email, reviewed_at: now, updated_at: now };

    const updateResponse = await fetch(`${url}/rest/v1/${table}?id=eq.${id}&select=${select}`, {
      method: "PATCH",
      headers: { ...serviceHeaders(serviceKey), Prefer: "return=representation" },
      body: JSON.stringify(update),
      cache: "no-store",
    });
    const updated = await readJson(updateResponse) as Array<Record<string, unknown>>;
    const row = updated?.[0];
    if (!row) return jsonError("Nie znaleziono wpisu do aktualizacji.", 404, "not_found");

    const label = kind === "feature" ? String(row.title || `Wpis #${id}`) : String(row.name || `Guide #${id}`);
    const activity = kind === "feature"
      ? action === "approve" ? "feature_published" : "feature_changes_requested"
      : action === "approve" ? "guide_published" : "guide_changes_requested";

    await fetch(`${url}/rest/v1/activity_logs`, {
      method: "POST",
      headers: { ...serviceHeaders(serviceKey), Prefer: "return=minimal" },
      body: JSON.stringify({
        actor_email: email,
        action: activity,
        entity_type: kind === "feature" ? "feature" : "guide_place",
        entity_id: String(id),
        entity_label: label,
        details: action === "changes" ? { note: note || "Proszę poprawić wpis." } : {},
      }),
      cache: "no-store",
    }).catch(() => undefined);

    return Response.json({ ok: true, item: row }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    console.error("StreetScope review queue update failed", error);
    return jsonError(error instanceof Error ? error.message : "Nie udało się zmienić statusu wpisu.", 500, "review_queue_update_failed");
  }
}
