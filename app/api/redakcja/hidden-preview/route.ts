import { jsonError } from "../../../../lib/server-security";

type PreviewKind = "feature" | "guide";

const serviceHeaders = (serviceKey: string) => ({
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
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
  const response = await fetch(`${url}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email.toLowerCase())}&active=eq.true&select=role&limit=1`, {
    headers: serviceHeaders(serviceKey),
    cache: "no-store",
  });
  if (!response.ok) return null;
  const rows = await response.json() as Array<{ role?: string }>;
  return rows[0] || null;
}

export async function GET(request: Request) {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) return jsonError("Ukryty podgląd nie jest skonfigurowany.", 503, "not_configured");

    const token = (request.headers.get("authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return jsonError("Brak autoryzacji.", 401, "unauthorized");

    const caller = await getCaller(url, anonKey, token);
    const email = caller?.email?.toLowerCase() || "";
    if (!email) return jsonError("Brak autoryzacji.", 401, "unauthorized");
    const staff = await getStaff(url, serviceKey, email);
    if (!staff) return jsonError("Brak dostępu do redakcji.", 403, "forbidden");

    const query = new URL(request.url).searchParams;
    const kind = query.get("kind") as PreviewKind | null;
    const id = Number(query.get("id") || 0);
    if ((kind !== "feature" && kind !== "guide") || !Number.isInteger(id) || id < 1) {
      return jsonError("Nieprawidłowe dane podglądu.", 400, "invalid_preview");
    }

    const table = kind === "feature" ? "street_features" : "guide_places";
    const response = await fetch(`${url}/rest/v1/${table}?id=eq.${id}&archived_at=is.null&select=*&limit=1`, {
      headers: serviceHeaders(serviceKey),
      cache: "no-store",
    });
    if (!response.ok) return jsonError("Nie udało się pobrać materiału do podglądu.", 500, "preview_load_failed");
    const rows = await response.json() as Array<Record<string, unknown>>;
    const row = rows[0];
    if (!row) return jsonError("Nie znaleziono materiału.", 404, "not_found");

    return Response.json({ ok: true, item: row }, { headers: { "Cache-Control": "no-store, max-age=0" } });
  } catch (error) {
    console.error("StreetScope hidden preview failed", error);
    return jsonError(error instanceof Error ? error.message : "Nie udało się otworzyć ukrytego podglądu.", 500, "hidden_preview_failed");
  }
}
