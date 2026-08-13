import { NextResponse } from "next/server";
import { checkRateLimit, jsonError } from "../../../lib/server-security";

const clean = (value: unknown, max: number) => typeof value === "string" ? value.trim().slice(0, max) : "";
const safeUrl = (value: unknown) => {
  const raw = clean(value, 1000);
  if (!raw) return null;
  try { const url = new URL(raw); return ["http:", "https:"].includes(url.protocol) ? url.toString() : null; } catch { return null; }
};

export async function POST(request: Request) {
  try {
    const limited = await checkRateLimit(request, "recruitment", 2, 30 * 60);
    if (!limited.configured) return jsonError("Rekrutacja jest chwilowo niedostępna. Spróbuj ponownie później.", 503, "rate_limit_unavailable");
    if (!limited.allowed) return jsonError("Za dużo zgłoszeń z tego połączenia. Spróbuj ponownie później.", 429, "rate_limited");

    const form = await request.formData();
    if (clean(form.get("website"), 200)) return NextResponse.json({ ok: true });
    const startedAt = Number(form.get("startedAt") || 0);
    if (startedAt && Date.now() - startedAt < 1800) return NextResponse.json({ ok: true });

    const firstName = clean(form.get("firstName"), 100);
    const lastName = clean(form.get("lastName"), 120);
    const phone = clean(form.get("phone"), 60);
    const email = clean(form.get("email"), 254).toLowerCase();
    const message = clean(form.get("message"), 8000);
    const portfolioUrl = safeUrl(form.get("portfolioUrl"));
    const consent = form.get("consent") === "true";
    const cv = form.get("cv");
    if (firstName.length < 2 || lastName.length < 2 || phone.length < 6 || !email.includes("@") || message.length < 30 || !consent) return jsonError("Uzupełnij wszystkie wymagane pola formularza.", 400, "invalid_submission");
    if (form.get("portfolioUrl") && !portfolioUrl) return jsonError("Link do portfolio musi zaczynać się od http:// lub https://.", 400, "invalid_portfolio");

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) return jsonError("Rekrutacja nie jest jeszcze skonfigurowana.", 503, "not_configured");

    let cvPath: string | null = null;
    if (cv instanceof File && cv.size > 0) {
      const allowed = new Set(["application/pdf", "application/msword", "application/vnd.openxmlformats-officedocument.wordprocessingml.document"]);
      if (!allowed.has(cv.type) || cv.size > 5 * 1024 * 1024) return jsonError("CV: tylko PDF/DOC/DOCX, maksymalnie 5 MB.", 400, "invalid_cv");
      const ext = cv.name.toLowerCase().endsWith(".docx") ? "docx" : cv.name.toLowerCase().endsWith(".doc") ? "doc" : "pdf";
      cvPath = `${new Date().getUTCFullYear()}/${crypto.randomUUID()}.${ext}`;
      const upload = await fetch(`${supabaseUrl}/storage/v1/object/recruitment-cv/${cvPath}`, {
        method: "POST",
        headers: { apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, "Content-Type": cv.type, "x-upsert": "false" },
        body: await cv.arrayBuffer(),
      });
      if (!upload.ok) throw new Error(`CV upload failure: ${upload.status}`);
    }

    const saved = await fetch(`${supabaseUrl}/rest/v1/recruitment_applications`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: supabaseKey, Authorization: `Bearer ${supabaseKey}`, Prefer: "return=minimal" },
      body: JSON.stringify({ first_name: firstName, last_name: lastName, phone, email, message, portfolio_url: portfolioUrl, cv_path: cvPath, consent: true, status: "new" }),
    });
    if (!saved.ok) throw new Error(`Application storage failure: ${saved.status}`);

    const webhook = process.env.RECRUITMENT_DISCORD_WEBHOOK_URL;
    if (webhook) {
      const fields: Array<{name:string;value:string;inline?:boolean}> = [
        { name: "Kandydat", value: `${firstName} ${lastName}`.slice(0, 1024), inline: true },
        { name: "Telefon", value: phone.slice(0, 1024), inline: true },
        { name: "E-mail", value: email.slice(0, 1024), inline: true },
        { name: "Dlaczego chce dołączyć", value: message.slice(0, 1024) },
      ];
      if (portfolioUrl) fields.push({ name: "Portfolio", value: portfolioUrl.slice(0, 1024) });
      if (cvPath) fields.push({ name: "CV", value: "CV zapisane w panelu rekrutacji." });
      const sent = await fetch(webhook, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ username: "StreetScope · Rekrutacja", embeds: [{ title: "👤 Nowe zgłoszenie do redakcji", color: 0xe52425, fields, footer: { text: "StreetScope · rekrutacja" }, timestamp: new Date().toISOString() }] }) }).catch(() => null);
      if (sent && !sent.ok) console.error("StreetScope recruitment Discord webhook failed", sent.status);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("StreetScope recruitment submission failed", error);
    return jsonError("Nie udało się wysłać zgłoszenia. Spróbuj ponownie później.", 500, "submission_failed");
  }
}
