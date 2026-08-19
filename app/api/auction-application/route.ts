import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  try {
    const webhookUrl = process.env.DISCORD_AUCTION_WEBHOOK_URL;
    if (!webhookUrl) {
      return NextResponse.json({ ok: false, error: "Webhook nie jest skonfigurowany." }, { status: 500 });
    }

    const body = await req.json();
    const { auctionNumber, vehicle, bidderName, depositAmount, bankAccount } = body ?? {};

    if (!auctionNumber || !vehicle || !bidderName) {
      return NextResponse.json({ ok: false, error: "Brak wymaganych danych." }, { status: 400 });
    }

    const payload = {
      username: "Tow & Trade · Licytacje",
      embeds: [
        {
          title: "🔴 NOWE ZGŁOSZENIE DO LICYTACJI",
          color: 14162208,
          fields: [
            { name: "Licytacja", value: `#${String(auctionNumber)}`, inline: true },
            { name: "Pojazd", value: String(vehicle), inline: true },
            { name: "Klient", value: String(bidderName), inline: false },
            { name: "Depozyt", value: `$${Number(depositAmount || 0).toLocaleString("en-US")}`, inline: true },
            { name: "Rachunek", value: bankAccount ? String(bankAccount) : "Nie ustawiono", inline: true },
            { name: "Status", value: "Oczekuje na weryfikację depozytu", inline: false }
          ],
          footer: { text: "Tow & Trade · StreetScope" },
          timestamp: new Date().toISOString()
        }
      ]
    };

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      return NextResponse.json({ ok: false, error: `Discord webhook: ${response.status} ${text}` }, { status: 502 });
    }

    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Nie udało się wysłać webhooka." }, { status: 500 });
  }
}
