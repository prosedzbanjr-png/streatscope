import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const TOKEN = "ss24raw-3f9c7d";

function normalize(value: string) {
  return value
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;|&#160;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/[\u00AD\u200B-\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function topLevelBlocks(body: string) {
  const holder = body.match(/<div class=["']article-layout["'][^>]*>([\s\S]*)<\/div>\s*$/i)?.[1] ?? body;
  const tags = /<(div|p|h1|h2|h3|blockquote)\b[^>]*>[\s\S]*?<\/\1\s*>/gi;
  const out: Array<{index:number; tag:string; className:string; text:string; html:string}> = [];
  let match: RegExpExecArray | null;
  let index = 0;
  while ((match = tags.exec(holder))) {
    const open = match[0].match(/^<([a-z0-9]+)\b([^>]*)>/i);
    const className = open?.[2].match(/class=["']([^"']*)["']/i)?.[1] ?? "";
    out.push({ index: index++, tag: match[1].toLowerCase(), className, text: normalize(match[0]), html: match[0] });
  }
  return out;
}

export async function GET(request: NextRequest) {
  if (request.nextUrl.searchParams.get("token") !== TOKEN) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ error: "missing_env" }, { status: 500 });

  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await client.from("articles").select("id,title,excerpt,body,updated_at").eq("id", 24).single();
  if (error || !data) return NextResponse.json({ error: error?.message || "missing" }, { status: 500 });
  const body = String(data.body || "");
  const blocks = topLevelBlocks(body);
  const target = "Według pierwszych relacji nieznany mężczyzna ma uprowadzać przypadkowe osoby";
  const hits = blocks.filter(block => block.text.includes(target)).map(({index,tag,className,text,html}) => ({ index, tag, className, text, html }));
  return NextResponse.json({ id:data.id, title:data.title, excerpt:data.excerpt, updated_at:data.updated_at, bodyLength:body.length, body, blocks, hits }, { headers: { "Cache-Control": "no-store, max-age=0" } });
}
