import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const DEBUG_TOKEN = "ss-body-8e4f1a62c9";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== DEBUG_TOKEN) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "missing_supabase_env" }, { status: 500 });

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client
    .from("articles")
    .select("id,title,excerpt,body,status,published_at,updated_at")
    .ilike("excerpt", "Do StreetScope dotarły informacje%")
    .order("updated_at", { ascending: false })
    .limit(5);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ rows: data || [] }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
