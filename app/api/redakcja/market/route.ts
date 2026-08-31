import { createClient } from "@supabase/supabase-js";
import { jsonError } from "../../../../lib/server-security";

type Staff = {
  email: string;
  role: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
};

const allowedRoles = new Set(["editor_in_chief", "deputy_editor_in_chief", "journalist", "dealer"]);
const allowedStatuses = new Set(["available", "reserved", "sold"]);

function config() {
  return {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    anonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "",
    serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY || "",
  };
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

async function getStaff(url: string, serviceKey: string, email: string): Promise<Staff | null> {
  const response = await fetch(
    `${url}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email)}&active=eq.true&select=email,role,first_name,last_name,display_name&limit=1`,
    { headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store" },
  );
  if (!response.ok) return null;
  const rows = (await response.json()) as Staff[];
  const person = rows[0] || null;
  return person && allowedRoles.has(person.role) ? person : null;
}

function staffName(person: Staff) {
  return (
    [person.first_name?.trim(), person.last_name?.trim()].filter(Boolean).join(" ") ||
    person.display_name?.trim() ||
    person.email
  );
}

function authToken(request: Request) {
  const header = request.headers.get("authorization") || "";
  return header.toLowerCase().startsWith("bearer ") ? header.slice(7).trim() : "";
}

function text(value: unknown, max = 5000) {
  const clean = String(value ?? "").trim();
  return clean ? clean.slice(0, max) : null;
}

function integer(value: unknown, min = 0) {
  if (value === null || value === undefined || value === "") return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(min, Math.trunc(parsed)) : null;
}

function normalizePayload(input: Record<string, unknown>) {
  const brand = text(input.brand, 80);
  const model = text(input.model, 80);
  const price = integer(input.price, 1);
  if (!brand || !model) throw new Error("Podaj markę i model pojazdu.");
  if (!price || price <= 0) throw new Error("Ustaw poprawną cenę sprzedaży.");

  const status = String(input.status || "available");
  if (!allowedStatuses.has(status)) throw new Error("Nieprawidłowy status oferty.");

  const gallery = Array.isArray(input.gallery)
    ? input.gallery.filter((item): item is string => typeof item === "string" && item.startsWith("http")).slice(0, 8)
    : [];

  return {
    brand,
    model,
    year: integer(input.year, 0),
    price,
    mileage: integer(input.mileage, 0),
    drivetrain: text(input.drivetrain, 120),
    transmission: text(input.transmission, 120),
    engine: text(input.engine, 120),
    color: text(input.color, 120),
    description: text(input.description, 12000),
    image_url: typeof input.image_url === "string" && input.image_url.startsWith("http") ? input.image_url : null,
    gallery,
    seller_name: text(input.seller_name, 160) || "Tow & Trade",
    seller_phone: text(input.seller_phone, 80),
    status,
    featured: Boolean(input.featured),
    sale_mode: "sale",
    auction_start_price: null,
    auction_current_bid: null,
    auction_bid_count: 0,
    auction_ends_at: null,
    updated_at: new Date().toISOString(),
  };
}

async function authorize(request: Request) {
  const { url, anonKey, serviceKey } = config();
  if (!url || !anonKey || !serviceKey) {
    return { error: jsonError("Tow & Trade nie ma pełnej konfiguracji serwera.", 503, "not_configured") } as const;
  }
  const token = authToken(request);
  if (!token) return { error: jsonError("Sesja wygasła. Zaloguj się ponownie.", 401, "unauthorized") } as const;
  const email = await callerEmail(url, anonKey, token);
  if (!email) return { error: jsonError("Sesja jest nieprawidłowa. Zaloguj się ponownie.", 401, "unauthorized") } as const;
  const staff = await getStaff(url, serviceKey, email);
  if (!staff) return { error: jsonError("To konto nie ma aktywnego dostępu do Tow & Trade.", 403, "forbidden") } as const;
  return { url, serviceKey, staff } as const;
}

async function rest(url: string, serviceKey: string, path: string, init: RequestInit) {
  return fetch(`${url}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      ...(init.headers || {}),
    },
    cache: "no-store",
  });
}

export async function POST(request: Request) {
  try {
    const auth = await authorize(request);
    if ("error" in auth) return auth.error;
    const body = (await request.json()) as { action?: string; id?: number; path?: string; payload?: Record<string, unknown> };
    const action = String(body.action || "save");

    if (action === "sign-upload") {
      const path = String(body.path || "");
      if (!/^market-[a-zA-Z0-9._-]{10,220}$/.test(path)) return jsonError("Nieprawidłowa nazwa pliku.", 400, "bad_file_path");
      const admin = createClient(auth.url, auth.serviceKey, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      const { data, error } = await admin.storage.from("article-images").createSignedUploadUrl(path);
      if (error || !data?.token) {
        console.error("Tow & Trade signed upload failed", error);
        return jsonError(`Nie udało się przygotować wysyłania zdjęcia. ${error?.message || ""}`.trim(), 500, "upload_sign_failed");
      }
      return Response.json({ ok: true, path: data.path || path, token: data.token });
    }

    if (action === "delete") {
      const id = Number(body.id || 0);
      if (!Number.isInteger(id) || id <= 0) return jsonError("Nieprawidłowe ID oferty.", 400, "bad_id");
      const response = await rest(auth.url, auth.serviceKey, `market_vehicles?id=eq.${id}&sale_mode=eq.sale`, {
        method: "DELETE",
        headers: { Prefer: "return=minimal" },
      });
      if (!response.ok) {
        const detail = await response.text();
        throw new Error(`delete ${response.status}: ${detail}`);
      }
      return Response.json({ ok: true, id });
    }

    if (action === "status") {
      const id = Number(body.id || 0);
      const status = String(body.payload?.status || "");
      if (!Number.isInteger(id) || id <= 0) return jsonError("Nieprawidłowe ID oferty.", 400, "bad_id");
      if (!allowedStatuses.has(status)) return jsonError("Nieprawidłowy status oferty.", 400, "bad_status");
      const response = await rest(auth.url, auth.serviceKey, `market_vehicles?id=eq.${id}&sale_mode=eq.sale&select=*`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Prefer: "return=representation" },
        body: JSON.stringify({ status, updated_at: new Date().toISOString() }),
      });
      const raw = await response.text();
      if (!response.ok) throw new Error(`status ${response.status}: ${raw}`);
      const rows = raw ? (JSON.parse(raw) as unknown[]) : [];
      if (!rows.length) return jsonError("Oferta nie istnieje albo nie jest ofertą sprzedaży.", 404, "not_found");
      return Response.json({ ok: true, row: rows[0] });
    }

    const payload = normalizePayload(body.payload || {});
    const id = Number(body.id || 0);
    const editing = Number.isInteger(id) && id > 0;
    const path = editing ? `market_vehicles?id=eq.${id}&sale_mode=eq.sale&select=*` : "market_vehicles?select=*";
    const response = await rest(auth.url, auth.serviceKey, path, {
      method: editing ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json", Prefer: "return=representation" },
      body: JSON.stringify(editing ? payload : { ...payload, listed_by_name: staffName(auth.staff) }),
    });
    const raw = await response.text();
    if (!response.ok) throw new Error(`save ${response.status}: ${raw}`);
    const rows = raw ? (JSON.parse(raw) as unknown[]) : [];
    if (!rows.length) return jsonError("Baza nie potwierdziła zapisu oferty.", 500, "save_not_confirmed");
    return Response.json({ ok: true, row: rows[0] });
  } catch (error) {
    console.error("Tow & Trade market operation failed", error);
    const detail = error instanceof Error ? error.message : "Nieznany błąd";
    return jsonError(`Nie udało się zapisać oferty. ${detail}`, 500, "market_save_failed");
  }
}
