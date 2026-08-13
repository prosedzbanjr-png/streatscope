import { NextResponse } from "next/server";

type EventName = "review" | "published";

const text = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const webhook = process.env.DISCORD_WEBHOOK_URL;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
    if (!webhook) return NextResponse.json({ ok: true, skipped: true });
    if (!supabaseUrl || !supabaseKey || !token) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

    const input = await request.json();
    const event = input.event as EventName;
    const articleId = Number(input.articleId);
    if (!Number.isInteger(articleId) || articleId < 1 || !["review", "published"].includes(event)) return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });

    const headers = { apikey: supabaseKey, Authorization: `Bearer ${token}` };
    const userResult = await fetch(`${supabaseUrl}/auth/v1/user`, { headers });
    if (!userResult.ok) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });
    const user = await userResult.json() as { email?: string };
    const email = text(user.email, 254).toLowerCase();
    if (!email) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

    const staffResult = await fetch(`${supabaseUrl}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email)}&select=active,role,display_name,first_name,last_name`, { headers });
    const staffRows = await staffResult.json() as Array<{ active?: boolean; role?: string; display_name?: string; first_name?: string; last_name?: string }>;
    const staff = staffRows[0];
    if (!staff?.active) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });
    if (event === "published" && !["editor_in_chief", "deputy_editor_in_chief"].includes(staff.role || "")) return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });

    const articleResult = await fetch(`${supabaseUrl}/rest/v1/articles?id=eq.${articleId}&select=id,title,excerpt,category,author_name,author_email,status,review_status`, { headers });
    const articleRows = await articleResult.json() as Array<{ id: number; title: string; excerpt: string; category: string; author_name?: string | null; author_email?: string | null; status?: string; review_status?: string }>;
    const article = articleRows[0];
    if (!article) return NextResponse.json({ error: "Nie znaleziono materiału." }, { status: 404 });

    const actor = [staff.first_name, staff.last_name].filter(Boolean).join(" ") || staff.display_name || email.split("@")[0];
    const isReview = event === "review";
    const baseUrl = new URL(request.url).origin;
    const payload = {
      username: "StreetScope · Redakcja",
      embeds: [{
        title: isReview ? "✍️ Materiał czeka na akceptację" : "🗞️ Materiał opublikowany",
        url: isReview ? `${baseUrl}/redakcja/zarzadzaj` : `${baseUrl}/artykul/${article.id}`,
        color: isReview ? 0xf0a31b : 0xe52425,
        fields: [
          { name: "Tytuł", value: text(article.title, 250) || "Bez tytułu" },
          { name: "Kategoria", value: text(article.category, 80) || "AKTUALNOŚCI", inline: true },
          { name: isReview ? "Wysłał(a)" : "Opublikował(a)", value: actor, inline: true },
          { name: "Autor materiału", value: text(article.author_name || article.author_email, 160) || "Redakcja", inline: true },
          { name: "Zajawka", value: text(article.excerpt, 900) || "Brak zajawki." },
        ],
        footer: { text: isReview ? "StreetScope · kolejka akceptacji" : "StreetScope · publikacja" },
        timestamp: new Date().toISOString(),
      }],
    };
    const sent = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
    if (!sent.ok) return NextResponse.json({ error: "Discord odrzucił powiadomienie." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nie udało się wysłać powiadomienia." }, { status: 500 });
  }
}
