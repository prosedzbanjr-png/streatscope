import { NextResponse } from "next/server";

type EventName = "review" | "published";
type ReviewKind = "article" | "feature" | "guide";

const text = (value: unknown, max = 1000) => typeof value === "string" ? value.trim().slice(0, max) : "";

export async function POST(request: Request) {
  try {
    const input = await request.json();
    const event = input.event as EventName;
    const kind = (input.kind || "article") as ReviewKind;
    const reviewWebhook = process.env.REVIEW_DISCORD_WEBHOOK_URL;
    const publishWebhook = process.env.DISCORD_WEBHOOK_URL;
    const webhook = event === "review" ? reviewWebhook : publishWebhook;
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const token = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";

    if (!["review", "published"].includes(event) || !["article", "feature", "guide"].includes(kind)) {
      return NextResponse.json({ error: "Nieprawidłowe dane." }, { status: 400 });
    }
    if (!webhook) return NextResponse.json({ ok: true, skipped: true });
    if (!supabaseUrl || !supabaseKey || !token) return NextResponse.json({ error: "Brak autoryzacji." }, { status: 401 });

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
    if (event === "published" && !["editor_in_chief", "deputy_editor_in_chief"].includes(staff.role || "")) {
      return NextResponse.json({ error: "Brak dostępu." }, { status: 403 });
    }

    const actor = [staff.first_name, staff.last_name].filter(Boolean).join(" ") || staff.display_name || email.split("@")[0];
    const baseUrl = new URL(request.url).origin;

    let title = text(input.title, 250) || "Bez tytułu";
    let category = text(input.category, 80) || "MATERIAŁ";
    let excerpt = text(input.subtitle || input.excerpt, 900) || "Brak zajawki.";
    let author = actor;
    let targetUrl = `${baseUrl}/redakcja/zarzadzaj`;

    if (kind === "article") {
      const articleId = Number(input.articleId || input.entityId);
      if (!Number.isInteger(articleId) || articleId < 1) return NextResponse.json({ error: "Nieprawidłowe ID artykułu." }, { status: 400 });
      const articleResult = await fetch(`${supabaseUrl}/rest/v1/articles?id=eq.${articleId}&select=id,title,excerpt,category,author_name,author_email,status,review_status`, { headers });
      const articleRows = await articleResult.json() as Array<{ id:number; title:string; excerpt:string; category:string; author_name?:string|null; author_email?:string|null }>;
      const article = articleRows[0];
      if (!article) return NextResponse.json({ error: "Nie znaleziono materiału." }, { status: 404 });
      title = text(article.title, 250) || title;
      category = text(article.category, 80) || "ARTYKUŁ";
      excerpt = text(article.excerpt, 900) || excerpt;
      author = text(article.author_name || article.author_email, 160) || actor;
      targetUrl = event === "published" ? `${baseUrl}/artykul/${article.id}` : `${baseUrl}/redakcja/zarzadzaj`;
    }

    if (kind === "feature") {
      const entityId = Number(input.entityId);
      const featureKind = text(input.featureKind, 20).toLowerCase();
      category = featureKind === "motor" ? "MOTOR / BUILD" : featureKind === "fashion" ? "FASHION / LOOK" : "LOOK / BUILD";
      if (Number.isInteger(entityId) && entityId > 0) {
        const result = await fetch(`${supabaseUrl}/rest/v1/street_features?id=eq.${entityId}&select=id,kind,title,subtitle,submitted_by,created_by&limit=1`, { headers });
        if (result.ok) {
          const rows = await result.json() as Array<{ id:number; kind?:string; title?:string; subtitle?:string|null; submitted_by?:string|null; created_by?:string|null }>;
          const row = rows[0];
          if (row) {
            title = text(row.title, 250) || title;
            excerpt = text(row.subtitle, 900) || excerpt;
            category = row.kind === "motor" ? "MOTOR / BUILD" : "FASHION / LOOK";
            author = text(row.submitted_by || row.created_by, 160) || actor;
          }
        }
      }
    }

    if (kind === "guide") {
      category = "SCOPE GUIDE";
      const entityId = Number(input.entityId);
      if (Number.isInteger(entityId) && entityId > 0) {
        const result = await fetch(`${supabaseUrl}/rest/v1/guide_places?id=eq.${entityId}&select=id,name,category,neighborhood,short_description,submitted_by&limit=1`, { headers });
        if (result.ok) {
          const rows = await result.json() as Array<{ id:number; name?:string; category?:string; neighborhood?:string|null; short_description?:string|null; submitted_by?:string|null }>;
          const row = rows[0];
          if (row) {
            title = text(row.name, 250) || title;
            excerpt = text(row.short_description, 900) || excerpt;
            const placeCategory = [row.category, row.neighborhood].filter(Boolean).join(" · ");
            category = placeCategory ? `SCOPE GUIDE · ${text(placeCategory, 100)}` : "SCOPE GUIDE";
            author = text(row.submitted_by, 160) || actor;
          }
        }
      }
    }

    const isReview = event === "review";
    const payload = {
      username: "StreetScope · Redakcja",
      embeds: [{
        title: isReview ? "✍️ Materiał czeka na akceptację" : "🗞️ Materiał opublikowany",
        url: targetUrl,
        color: isReview ? 0xf0a31b : 0xe52425,
        fields: [
          { name: "Tytuł", value: title },
          { name: "Format", value: category, inline: true },
          { name: isReview ? "Wysłał(a)" : "Opublikował(a)", value: actor, inline: true },
          { name: "Autor / zgłaszający", value: author, inline: true },
          { name: "Zajawka", value: excerpt },
        ],
        footer: { text: isReview ? "StreetScope · kolejka akceptacji" : "StreetScope · publikacja" },
        timestamp: new Date().toISOString(),
      }],
    };

    const sent = await fetch(webhook, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!sent.ok) return NextResponse.json({ error: "Discord odrzucił powiadomienie." }, { status: 502 });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nie udało się wysłać powiadomienia." }, { status: 500 });
  }
}
