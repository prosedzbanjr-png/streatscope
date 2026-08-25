import { NextResponse } from "next/server";

const json = (body: Record<string, unknown>, status = 200) => NextResponse.json(body, { status });

export async function POST(request: Request) {
  try {
    const payload = await request.json().catch(() => ({}));
    const featureId = Number(payload?.featureId);
    if (!Number.isInteger(featureId) || featureId < 1) return json({ ok: false, error: "invalid_feature_id" }, 400);

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) return json({ ok: false, error: "not_configured" }, 503);

    const headers = {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      "Content-Type": "application/json",
    };

    const rpc = await fetch(`${supabaseUrl}/rest/v1/rpc/increment_feature_views`, {
      method: "POST",
      headers,
      body: JSON.stringify({ feature_id: featureId }),
      cache: "no-store",
    }).catch(() => null);

    if (rpc?.ok) return json({ ok: true });

    const rowResponse = await fetch(
      `${supabaseUrl}/rest/v1/street_features?id=eq.${featureId}&published=eq.true&archived_at=is.null&select=id,views&limit=1`,
      { headers, cache: "no-store" },
    );
    if (!rowResponse.ok) return json({ ok: false, error: "feature_lookup_failed" }, 500);

    const rows = (await rowResponse.json()) as Array<{ id: number; views: number | null }>;
    const row = rows[0];
    if (!row) return json({ ok: false, error: "feature_not_found" }, 404);

    const nextViews = Math.max(0, Number(row.views) || 0) + 1;
    const update = await fetch(`${supabaseUrl}/rest/v1/street_features?id=eq.${featureId}`, {
      method: "PATCH",
      headers: { ...headers, Prefer: "return=minimal" },
      body: JSON.stringify({ views: nextViews }),
      cache: "no-store",
    });
    if (!update.ok) return json({ ok: false, error: "feature_update_failed" }, 500);

    return json({ ok: true, views: nextViews });
  } catch (error) {
    console.error("StreetScope feature view tracking failed", error);
    return json({ ok: false, error: "view_tracking_failed" }, 500);
  }
}
