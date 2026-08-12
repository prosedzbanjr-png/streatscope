import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const { title, district, description, contact } = await request.json();
    if (typeof title !== "string" || title.trim().length < 6 || typeof description !== "string" || description.trim().length < 30) return NextResponse.json({ error: "Nieprawidłowe zgłoszenie." }, { status: 400 });
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (!webhook) return NextResponse.json({ error: "Brak konfiguracji kanału redakcji." }, { status: 503 });
    const safe = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
    const response = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "StreetScope · Zgłoszenia", embeds: [{ title: "🗞️ Nowy temat dla redakcji", color: 0xe52425, fields: [{ name: "Tytuł", value: safe(title, 256) || "—" }, { name: "Rejon", value: safe(district, 80) || "Nie podano", inline: true }, { name: "Kontakt", value: safe(contact, 256) || "Anonimowo", inline: true }, { name: "Opis", value: safe(description, 1000) || "—" }], footer: { text: "StreetScope · formularz zgłoszeń" }, timestamp: new Date().toISOString() }] }) });
    if (!response.ok) throw new Error("Webhook failure");
    return NextResponse.json({ ok: true });
  } catch { return NextResponse.json({ error: "Nie udało się wysłać zgłoszenia." }, { status: 500 }); }
}
