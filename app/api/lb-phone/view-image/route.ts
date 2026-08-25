const TRACK_PATH = "/api/lb-phone/view-image";

function safeSource(raw: string, requestOrigin: string) {
  try {
    const source = new URL(raw, requestOrigin);
    if (!["https:", "http:"].includes(source.protocol)) return null;
    if (source.origin === requestOrigin && source.pathname === TRACK_PATH) return null;
    return source.toString();
  } catch {
    return null;
  }
}

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const source = safeSource(requestUrl.searchParams.get("src") || "", requestUrl.origin);
  if (!source) return new Response("Image source unavailable", { status: 400 });

  return new Response(null, {
    status: 302,
    headers: {
      Location: source,
      "Cache-Control": "no-store, no-cache, must-revalidate, max-age=0",
      "CDN-Cache-Control": "no-store",
      "Vercel-CDN-Cache-Control": "no-store",
      "Access-Control-Allow-Origin": "*",
      "X-StreetScope-View-Tracking": "disabled",
    },
  });
}
