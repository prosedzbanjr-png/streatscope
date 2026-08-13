import { NextResponse } from "next/server";
import { checkRateLimit, jsonError } from "../../../lib/server-security";

const safe = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const limited = await checkRateLimit(request, "tip", 3, 10 * 60);
    if (!limited.configured) return jsonError("Formularz jest chwilowo niedostępny. Spróbuj ponownie później.", 503, "rate_limit_unavailable");
    if (!limited.allowed) return jsonError("Za dużo zgłoszeń z tego połączenia. Spróbuj ponownie za kilka minut.", 429, "rate_limited");

    const payload = await request.json();
    if (safe(payload.website, 200)) return NextResponse.json({ ok: true });
    const startedAt = Number(payload.startedAt || 0);
    if (startedAt && Date.now() - startedAt < 1800) return NextResponse.json({ ok: true });

    const title = safe(payload.title, 500);
    const district = safe(payload.district, 80) || "Nie podano";
    const description = safe(payload.description, 12000);
    const contact = safe(payload.contact, 500);
    if (title.length < 6 || description.length < 30) return jsonError("Nieprawidłowe zgłoszenie.", 400, "invalid_submission");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return jsonError("Formularz nie jest jeszcze skonfigurowany.", 503, "not_configured");

    const saved = await fetch(`${supabaseUrl}/rest/v1/tips`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: "return=minimal" },
      body: JSON.stringify({ title, district, description, contact: contact || null, status: "new" }),
    });
    if (!saved.ok) throw new Error(`Tip storage failure: ${saved.status}`);

    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (webhook) {
      const discord = await fetch(webhook, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: "StreetScope · Zgłoszenia", embeds: [{ title: "🗞️ Nowy temat dla redakcji", color: 0xe52425, fields: [{ name: "Tytuł", value: title.slice(0, 1024) }, { name: "Rejon", value: district.slice(0, 1024), inline: true }, { name: "Kontakt", value: (contact || "Anonimowo").slice(0, 1024), inline: true }, { name: "Opis", value: description.slice(0, 1000) }], footer: { text: "StreetScope · formularz zgłoszeń" }, timestamp: new Date().toISOString() }] }),
      }).catch(() => null);
      if (discord && !discord.ok) console.error("StreetScope tip Discord webhook failed", discord.status);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("StreetScope tip submission failed", error);
    return jsonError("Nie udało się wysłać zgłoszenia. Spróbuj ponownie później.", 500, "submission_failed");
  }
}
