import { checkRateLimit, jsonError } from "../../../../lib/server-security";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const allowedRoles = new Set(["editor_in_chief", "deputy_editor_in_chief", "journalist"]);

async function getCaller(url: string, anonKey: string, token: string) {
  const response = await fetch(`${url}/auth/v1/user`, {
    headers: { apikey: anonKey, Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  if (!response.ok) return null;
  return await response.json() as { id?: string; email?: string };
}

async function isChief(url: string, serviceKey: string, email: string) {
  const response = await fetch(`${url}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email.toLowerCase())}&active=eq.true&select=role&limit=1`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
    cache: "no-store",
  });
  if (!response.ok) return false;
  const rows = await response.json() as Array<{ role: string }>;
  return Boolean(rows[0] && ["editor_in_chief", "deputy_editor_in_chief"].includes(rows[0].role));
}

export async function POST(request: Request) {
  try {
    const limited = await checkRateLimit(request, "staff_create", 20, 60 * 60);
    if (!limited.configured) return jsonError("Tworzenie kont jest chwilowo niedostępne.", 503, "rate_limit_unavailable");
    if (!limited.allowed) return jsonError("Za dużo prób tworzenia kont. Spróbuj ponownie później.", 429, "rate_limited");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !anonKey || !serviceKey) return jsonError("Tworzenie kont nie jest skonfigurowane.", 503, "not_configured");

    const authHeader = request.headers.get("authorization") || "";
    const token = authHeader.toLowerCase().startsWith("bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return jsonError("Brak autoryzacji.", 401, "unauthorized");

    const caller = await getCaller(url, anonKey, token);
    const callerEmail = caller?.email?.toLowerCase() || "";
    if (!callerEmail || !(await isChief(url, serviceKey, callerEmail))) return jsonError("Nie masz uprawnień do tworzenia kont.", 403, "forbidden");

    const body = await request.json();
    const email = clean(body.email, 254).toLowerCase();
    const firstName = clean(body.firstName, 80);
    const lastName = clean(body.lastName, 80);
    const role = clean(body.role, 64);
    const password = typeof body.password === "string" ? body.password : "";
    if (!email.includes("@")) return jsonError("Podaj poprawny adres e-mail.", 400, "invalid_email");
    if (!allowedRoles.has(role)) return jsonError("Nieprawidłowa rola.", 400, "invalid_role");
    if (password.length < 10 || password.length > 256) return jsonError("Hasło musi mieć minimum 10 znaków.", 400, "invalid_password");

    const createAuth = await fetch(`${url}/auth/v1/admin/users`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
      body: JSON.stringify({ email, password, email_confirm: true }),
      cache: "no-store",
    });
    const authResult = await createAuth.json().catch(() => ({}));
    if (!createAuth.ok) {
      const message = typeof authResult?.msg === "string" ? authResult.msg : typeof authResult?.message === "string" ? authResult.message : "Nie udało się utworzyć konta logowania.";
      return jsonError(message, createAuth.status === 422 ? 409 : 400, "auth_create_failed");
    }

    const authUserId = typeof authResult?.id === "string" ? authResult.id : "";
    const displayName = [firstName, lastName].filter(Boolean).join(" ");
    const createStaff = await fetch(`${url}/rest/v1/staff_accounts?on_conflict=email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: serviceKey,
        Authorization: `Bearer ${serviceKey}`,
        Prefer: "resolution=merge-duplicates,return=minimal",
      },
      body: JSON.stringify({ email, first_name: firstName || null, last_name: lastName || null, display_name: displayName || null, role, active: true }),
      cache: "no-store",
    });

    if (!createStaff.ok) {
      if (authUserId) {
        await fetch(`${url}/auth/v1/admin/users/${encodeURIComponent(authUserId)}`, {
          method: "DELETE",
          headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
          cache: "no-store",
        }).catch(() => undefined);
      }
      return jsonError("Nie udało się zapisać profilu redakcyjnego. Konto Auth zostało wycofane.", 500, "staff_create_failed");
    }

    return Response.json({ ok: true, email });
  } catch (error) {
    console.error("StreetScope staff creation failed", error);
    return jsonError("Nie udało się utworzyć konta.", 500, "staff_create_failed");
  }
}
