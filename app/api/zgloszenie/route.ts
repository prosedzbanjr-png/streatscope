import { NextResponse } from "next/server";

const safe = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const title = safe(payload.title, 256); const district = safe(payload.district, 80) || "Nie podano"; const description = safe(payload.description, 4000); const contact = safe(payload.contact, 256);
    if (title.length < 6 || description.length < 30) return NextResponse.json({ error: "Nieprawidłowe zgłoszenie." }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (supabaseUrl && supabaseKey) {
      const saved = await fetch(`${supabaseUrl}/rest/v1/tips`, { method: "POST", headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: "return=minimal" }, body: JSON.stringify({ title, district, description, contact: contact || null, status: "new" }) });
      if (!saved.ok) throw new Error("Tip storage failure");
    }

    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (webhook) {
      await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "StreetScope · Zgłoszenia", embeds: [{ title: "🗞️ Nowy temat dla redakcji", color: 0xe52425, fields: [{ name: "Tytuł", value: title }, { name: "Rejon", value: district, inline: true }, { name: "Kontakt", value: contact || "Anonimowo", inline: true }, { name: "Opis", value: description.slice(0, 1000) }], footer: { text: "StreetScope · formularz zgłoszeń" }, timestamp: new Date().toISOString() }] }) });
    }
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Nie udało się wysłać zgłoszenia." }, { status: 500 }); }
}
