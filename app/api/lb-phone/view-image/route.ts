type PublishKind = "article" | "fashion" | "motor" | "guide";

const TRACK_PATH = "/api/lb-phone/view-image";

function validKind(value: string): value is PublishKind {
  return ["article", "fashion", "motor", "guide"].includes(value);
}

function sameStreetScopeOrigin(referer: string, requestOrigin: string) {
  if (!referer) return false;
  try {
    const ref = new URL(referer);
    const own = new URL(requestOrigin);
    return ref.origin === own.origin || ref.hostname === "streetscope.vercel.app";
  } catch {
    return false;
  }
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
  if (rpc?.ok) return;

  const table = kind === "article" ? "articles" : kind === "guide" ? "guide_places" : "street_features";
  const lookup = await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}&select=id,views&limit=1`, {
    headers,
    cache: "no-store",
  }).catch(() => null);
  if (!lookup?.ok) return;

  const rows = await lookup.json().catch(() => []) as Array<{ id?: number; views?: number | null }>;
  if (!rows[0]?.id) return;
  const views = Math.max(0, Number(rows[0].views) || 0) + 1;
  await fetch(`${supabaseUrl}/rest/v1/${table}?id=eq.${id}`, {
    method: "PATCH",
    headers: { ...headers, Prefer: "return=minimal" },
    body: JSON.stringify({ views }),
    cache: "no-store",
  }).catch(() => null);
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

  const shouldCount = Boolean(serviceKey) && !sameStreetScopeOrigin(request.headers.get("referer") || "", requestOrigin);
  const imagePromise = fetch(source, { cache: "no-store", redirect: "follow" });
  const countPromise = shouldCount ? incrementView(kind, id, supabaseUrl, serviceKey) : Promise.resolve();
  const [imageResult] = await Promise.allSettled([imagePromise, countPromise]);

  if (imageResult.status !== "fulfilled") return new Response("Image unavailable", { status: 502 });
  const image = imageResult.value;
  if (!image.ok || !image.body) return new Response("Image unavailable", { status: image.status || 502 });

  const headers = new Headers();
  headers.set("Content-Type", image.headers.get("content-type") || "image/jpeg");
  headers.set("Cache-Control", "no-store, no-cache, must-revalidate, max-age=0");
  headers.set("CDN-Cache-Control", "no-store");
  headers.set("Vercel-CDN-Cache-Control", "no-store");
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("X-StreetScope-View-Tracking", shouldCount ? "lb-phone" : "website-skip");
  return new Response(image.body, { status: 200, headers });
}
