import { NextRequest, NextResponse } from "next/server";

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

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

    let lastError = "Nie udało się wysłać webhooka.";

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const response = await fetch(webhookUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
          cache: "no-store"
        });

        if (response.ok) {
          return NextResponse.json({ ok: true, attempts: attempt });
        }

        const text = await response.text().catch(() => "");
        lastError = `Discord webhook: ${response.status}${text ? ` ${text}` : ""}`;

        if (response.status === 429) {
          const retryAfterHeader = response.headers.get("retry-after");
          const retryAfter = retryAfterHeader ? Number(retryAfterHeader) : NaN;
          await wait(Number.isFinite(retryAfter) ? Math.max(retryAfter * 1000, 750) : 1200 * attempt);
          continue;
        }

        if (response.status >= 500) {
          await wait(900 * attempt);
          continue;
        }

        break;
      } catch (error) {
        lastError = error instanceof Error ? error.message : "Błąd połączenia z Discordem.";
        if (attempt < 3) await wait(900 * attempt);
      }
    }

    return NextResponse.json({ ok: false, error: lastError }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Nie udało się wysłać webhooka." }, { status: 500 });
  }
}
