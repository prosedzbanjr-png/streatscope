import { NextResponse } from "next/server";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const safeUrl = (value: unknown) => {
  const raw = clean(value, 500);
  if (!raw) return null;
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; }
};

export async function POST(request: Request) {
  try {
    const form = await request.formData();
    if (clean(form.get("website"), 200)) return NextResponse.json({ ok: true });
    const firstName = clean(form.get("firstName"), 80);
    const lastName = clean(form.get("lastName"), 100);
    const phone = clean(form.get("phone"), 40);
    const email = clean(form.get("email"), 254).toLowerCase();
    const message = clean(form.get("message"), 1600);
    const portfolioUrl = safeUrl(form.get("portfolioUrl"));
    const consent = form.get("consent") === "true";
    const cv = form.get("cv");
    if (firstName.length < 2 || lastName.length < 2 || phone.length < 6 || !email.includes("@") || message.length < 30 || !consent) return NextResponse.json({ error: "Uzupełnij wszystkie wymagane pola formularza." }, { status: 400 });
    if (form.get("portfolioUrl") && !portfolioUrl) return NextResponse.json({ error: "Link do portfolio musi zaczynać się od http:// lub https://." }, { status: 400 });

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const webhook = process.env.RECRUITMENT_DISCORD_WEBHOOK_URL;
    if (!supabaseUrl || !supabaseKey || !webhook) return NextResponse.json({ error: "Rekrutacja nie jest jeszcze skonfigurowana." }, { status: 503 });

    let cvPath: string | null = null;
    if (cv instanceof File && cv.size > 0) {
      const allowed = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
      if (!allowed.has(cv.type) || cv.size > 5 * 1024 * 1024) return NextResponse.json({ error: "CV: tylko PDF/DOC/DOCX, maksymalnie 5 MB." }, { status: 400 });
      const ext = cv.name.toLowerCase().endsWith(".docx") ? "docx" : cv.name.toLowerCase().endsWith(".doc") ? "doc" : "pdf";
      cvPath = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${ext}`;
      const upload = await fetch(`${supabaseUrl}/storage/v1/object/recruitment-cv/${cvPath}`, {
        method: "POST",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": cv.type, "x-upsert": "false" },
        body: await cv.arrayBuffer(),
      });
      if (!upload.ok) throw new Error("CV upload failure");
    }

    const saved = await fetch(`${supabaseUrl}/rest/v1/recruitment_applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: "return=minimal" },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, phone, email, message, portfolio_url: portfolioUrl, cv_path: cvPath, consent: true, status: "new" }),
    });
    if (!saved.ok) throw new Error("Application storage failure");

    const fields: Array<{name:string;value:string;inline?:boolean}> = [
      { name: "Kandydat", value: `${firstName} ${lastName}`, inline: true },
      { name: "Telefon", value: phone, inline: true },
      { name: "E-mail", value: email, inline: true },
      { name: "Dlaczego chce dołączyć", value: message },
    ];
    if (portfolioUrl) fields.push({ name: "Portfolio", value: portfolioUrl });
    if (cvPath) fields.push({ name: "CV", value: "CV zapisane w panelu rekrutacji." });
    const sent = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "StreetScope · Rekrutacja", embeds: [{ title: "👤 Nowe zgłoszenie do redakcji", color: 0xe52425, fields, footer: { text: "StreetScope · rekrutacja" }, timestamp: new Date().toISOString() }] }) });
    if (!sent.ok) throw new Error("Recruitment webhook rejected");
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Nie udało się wysłać zgłoszenia. Spróbuj ponownie później." }, { status: 500 });
  }
}
