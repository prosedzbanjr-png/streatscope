import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { dedupeArticleTextBlocks } from "../../../../lib/dedupe-article-body";

const TOKEN = "ss-fix-24-4d2a";

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "missing_supabase_env" }, { status: 500 });

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data: article, error } = await client.from("articles").select("id,body").eq("id", 24).single();
  if (error || !article) return NextResponse.json({ error: error?.message || "article_not_found" }, { status: 500 });

  const before = String(article.body || "");
  const after = dedupeArticleTextBlocks(before);
  const changed = after !== before;

  if (changed) {
    const { error: updateError } = await client.from("articles").update({ body: after }).eq("id", 24);
    if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, changed, beforeLength: before.length, afterLength: after.length }, { headers: { "Cache-Control": "no-store" } });
}
