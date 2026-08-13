import { checkRateLimit, jsonError } from "../../../../lib/server-security";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const limited = await checkRateLimit(request, "staff_activation", 5, 30 * 60);
    if (!limited.configured) return jsonError("Aktywacja kont jest chwilowo niedostępna.", 503, "rate_limit_unavailable");
    if (!limited.allowed) return jsonError("Za dużo prób aktywacji. Spróbuj ponownie później.", 429, "rate_limited");

    const body = await request.json();
    const email = clean(body.email, 254).toLowerCase();
    const password = typeof body.password === "string" ? body.password : "";
    if (!email.includes("@") || password.length < 10 || password.length > 256) return jsonError("Podaj poprawny e-mail i hasło mające minimum 10 znaków.", 400, "invalid_credentials");

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!url || !serviceKey || !anonKey) return jsonError("Aktywacja kont nie jest skonfigurowana.", 503, "not_configured");

    const staff = await fetch(`${url}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email)}&active=eq.true&select=email&limit=1`, {
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` }, cache: "no-store",
    });
    if (!staff.ok) throw new Error(`Staff lookup failed: ${staff.status}`);
    const rows = await staff.json() as Array<{email:string}>;
    if (!rows.length) return jsonError("To konto nie zostało jeszcze dodane przez Naczelnego.", 403, "not_staff");

    const signup = await fetch(`${url}/auth/v1/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: anonKey, Authorization: `Bearer ${anonKey}` },
      body: JSON.stringify({ email, password }),
      cache: "no-store",
    });
    const result = await signup.json().catch(() => ({}));
    if (!signup.ok) {
      const message = typeof result?.msg === "string" ? result.msg : typeof result?.message === "string" ? result.message : "Nie udało się aktywować konta.";
      return jsonError(message, signup.status >= 500 ? 503 : 400, "activation_failed");
    }
    return Response.json({ ok: true });
  } catch (error) {
    console.error("StreetScope staff activation failed", error);
    return jsonError("Nie udało się aktywować konta. Spróbuj ponownie później.", 500, "activation_failed");
  }
}
