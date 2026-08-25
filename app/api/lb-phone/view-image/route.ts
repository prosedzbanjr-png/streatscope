type PublishKind = "article" | "fashion" | "motor" | "guide";

const TRACK_PATH = "/api/lb-phone/view-image";

function validKind(value: string): value is PublishKind {
  return ["article", "fashion", "motor", "guide"].includes(value);
}

function safeSource(raw: string, requestOrigin: string, supabaseUrl: string) {
  try {
    const source = new URL(raw, requestOrigin);
    const supabase = new URL(supabaseUrl);
    const requestHost = new URL(requestOrigin).hostname;
    if (!["https:", "http:"].includes(source.protocol)) return null;
    if (![supabase.hostname, requestHost, "streetscope.vercel.app"].includes(source.hostname)) return null;
    if (source.pathname === TRACK_PATH) return null;
    return source.toString();
  } catch {
    return null;
  }
}

async function incrementView(kind: PublishKind, id: number, supabaseUrl: string, serviceKey: string) {
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };

  const rpcName = kind === "article" ? "increment_article_views" : kind === "guide" ? "increment_guide_views" : "increment_feature_views";
  const rpcBody = kind === "article" ? { article_id: id } : kind === "guide" ? { place_id: id } : { feature_id: id };
  const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/${rpcName}`, {
    method: "POST",
    headers,
    body: JSON.stringify(rpcBody),
    cache: "no-store",
  }).catch(() => null);
  if (rpc?.ok) return true;

  const table = kind === "article" ? "articles" : kind === "guide" ? "guide_places" : "street_features";
  const lookup = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}&select=id,views&limit=1`, {
    headers,
    cache: "no-store",
  }).catch(() => null);
  if (!lookup?.ok) return false;

  const rows = await lookup.json().catch(() => []) as Array<{ id?: number; views?: number | null }>;
  if (!rows[0]?.id) return false;
  const views = Math.max(0, Number(rows[0].views) || 0) + 1;
  const update = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ views }),
    cache: "no-store",
  }).catch(() => null);
  return Boolean(update?.ok);
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const requestOrigin = requestUrl.origin;
  const kind = requestUrl.searchParams.get("kind") || "";
  const id = Number(requestUrl.searchParams.get("id"));
  const rawSource = requestUrl.searchParams.get("src") || "";
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || "";

  if (!validKind(kind) || !Number.isInteger(id) || id < 1 || !rawSource || !supabaseUrl) {
    return new Response("Bad image tracking request", { status: 400 });
  }

  const source = safeSource(rawSource, requestOrigin, supabaseUrl);
  if (!source) return new Response("Image source not allowed", { status: 400 });

  let counted = false;
  if (serviceKey) counted = await incrementView(kind, id, supabaseUrl, serviceKey).catch(() => false);

  return new Response(null, {
    status: 302,
    headers: {
      Location: source,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "X-StreetScope-View-Tracking": counted ? "counted" : "not-counted",
    },
  });
}
