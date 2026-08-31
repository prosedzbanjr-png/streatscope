import { jsonError } from "../../../../../lib/server-security";

type Staff = { role: string };
type VehicleRow = { id: number; image_url: string | null; gallery: string[] | null };

const allowedRoles = new Set(["editor_in_chief", "deputy_editor_in_chief", "dealer"]);

function config() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
}

function authToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

async function callerEmail(url: string, anonKey: string, token: string) {
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return "";
  const user = (await response.json()) as { email?: string };
  return user.email?.trim().toLowerCase() || "";
}

async function authorize(request: Request) {
  const { url, anonKey, serviceKey } = config();
  if (!url || !anonKey || !serviceKey) return { error: jsonError("Tow & Trade nie ma pełnej konfiguracji serwera.", 503) } as const;

  const token = authToken(request);
  if (!token) return { error: jsonError("Sesja wygasła. Zaloguj się ponownie.", 401) } as const;

  const email = await callerEmail(url, anonKey, token);
  if (!email) return { error: jsonError("Sesja jest nieprawidłowa. Zaloguj się ponownie.", 401) } as const;

  const staffResponse = await fetch(
    `${url}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email)}&active=eq.true&select=role&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store" },
  );
  const staffRows = staffResponse.ok ? ((await staffResponse.json()) as Staff[]) : [];
  if (!staffRows[0] || !allowedRoles.has(staffRows[0].role)) return { error: jsonError("Brak dostępu do zarządzania zdjęciami Tow & Trade.", 403) } as const;

  return { url, serviceKey } as const;
}

export async function POST(request: Request) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;

    const body = (await request.json()) as { vehicleId?: number; imageUrl?: string };
    const vehicleId = Number(body.vehicleId || 0);
    const imageUrl = String(body.imageUrl || "").trim();
    if (!Number.isInteger(vehicleId) || vehicleId <= 0) return jsonError("Nieprawidłowe ID oferty.", 400);
    if (!/^https?:\/\//i.test(imageUrl)) return jsonError("Nieprawidłowy adres zdjęcia.", 400);

    const headers = { apikey: auth.serviceKey, Authorization: `Bearer ${auth.serviceKey}` };
    const vehicleResponse = await fetch(
      `${auth.url}/rest/v1/market_vehicles?id=eq.${vehicleId}&sale_mode=eq.sale&select=id,image_url,gallery&limit=1`,
      { headers, cache: "no-store" },
    );
    if (!vehicleResponse.ok) throw new Error(`read ${vehicleResponse.status}: ${await vehicleResponse.text()}`);

    const rows = (await vehicleResponse.json()) as VehicleRow[];
    const vehicle = rows[0];
    if (!vehicle) return jsonError("Nie znaleziono tej oferty.", 404);

    const gallery = Array.isArray(vehicle.gallery) ? vehicle.gallery.filter(item => typeof item === "string") : [];
    const nextGallery = gallery.filter(item => item !== imageUrl);
    const removeCover = vehicle.image_url === imageUrl;
    if (!removeCover && nextGallery.length === gallery.length) return jsonError("To zdjęcie nie należy już do tej oferty.", 404);

    const patch = {
      image_url: removeCover ? null : vehicle.image_url,
      gallery: nextGallery,
      updated_at: new Date().toISOString(),
    };

    const updateResponse = await fetch(
      `${auth.url}/rest/v1/market_vehicles?id=eq.${vehicleId}&sale_mode=eq.sale&select=id,image_url,gallery`,
      {
        method: "PATCH",
        headers: { ...headers, "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify(patch),
        cache: "no-store",
      },
    );
    const raw = await updateResponse.text();
    if (!updateResponse.ok) throw new Error(`update ${updateResponse.status}: ${raw}`);
    const updated = raw ? (JSON.parse(raw) as VehicleRow[]) : [];
    if (!updated[0]) return jsonError("Baza nie potwierdziła usunięcia zdjęcia.", 500);

    return Response.json({ ok: true, row: updated[0] });
  } catch (error) {
    console.error("Tow & Trade remove image failed", error);
    return jsonError(`Nie udało się usunąć zdjęcia. ${error instanceof Error ? error.message : "Nieznany błąd"}`, 500);
  }
}
