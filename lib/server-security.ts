import { createHash } from "crypto";

function getClientIp(request: Request) {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || request.headers.get("x-real-ip") || "unknown";
}

function fingerprint(request: Request, scope: string) {
  const secret = process.env.FORM_RATE_LIMIT_SALT || process.env.SUPABASE_SERVICE_ROLE_KEY || "streetscope";
  return createHash("sha256").update(`${scope}|${getClientIp(request)}|${secret}`).digest("hex");
}

export async function checkRateLimit(request: Request, scope: string, limit: number, windowSeconds: number) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return { allowed: false, configured: false };
  try {
    const response = await fetch(`${url}/rest/v1/rpc/check_form_rate_limit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: key, Authorization: `Bearer ${key}` },
      body: JSON.stringify({ p_scope: scope, p_fingerprint: fingerprint(request, scope), p_limit: limit, p_window_seconds: windowSeconds }),
      cache: "no-store",
    });
    if (!response.ok) return { allowed: false, configured: false };
    const allowed = await response.json();
    return { allowed: allowed === true, configured: true };
  } catch {
    return { allowed: false, configured: false };
  }
}

export function jsonError(message: string, status = 500, code = "server_error") {
  return Response.json({ error: message, code }, { status });
}
