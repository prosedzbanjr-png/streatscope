import { NextResponse } from "next/server";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    if (clean(body.website, 200)) return NextResponse.json({ ok: true });
    const firstName = clean(body.firstName, 80);
    const lastName = clean(body.lastName, 100);
    const phone = clean(body.phone, 40);
    const email = clean(body.email, 254).toLowerCase();
    const message = clean(body.message, 1600);
    const consent = body.consent === true;
    if (firstName.length < 2 || lastName.length < 2 || phone.length < 6 || !email.includes("@") || message.length < 30 || !consent) return NextResponse.json({ error: "Uzupełnij wszystkie wymagane pola formularza." }, { status: 400 });

    const webhook = process.env.DISCORD_WEBHOOK_URL;
    if (webhook) {
      const sent = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "StreetScope · Rekrutacja", embeds: [{ title: "👤 Nowe zgłoszenie do redakcji", color: 0xe52425, fields: [{ name: "Kandydat", value: `${firstName} ${lastName}`, inline: true }, { name: "Telefon", value: phone, inline: true }, { name: "E-mail", value: email, inline: true }, { name: "Dlaczego chce dołączyć", value: message }], footer: { text: "StreetScope · rekrutacja" }, timestamp: new Date().toISOString() }] }) });
      if (!sent.ok) throw new Error("Webhook rejected");
    }
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie później." }, { status: 500 });
  }
}
