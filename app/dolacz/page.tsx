"use client";

import { FormEvent, useRef, useState } from "react";
import { SiteNav } from "../site-nav";

export default function DolaczPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState<"ok" | "error" | "">("");
  const startedAt = useRef(Date.now());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setMessage(""); setTone("");
    try {
      const form = new FormData(formElement);
      const lastSent = Number(localStorage.getItem("streetscope-recruitment-last-sent") || 0);
      const remaining = 10 * 60 * 1000 - (Date.now() - lastSent);
      if (remaining > 0) { setMessage(`Kolejne zgłoszenie możesz wysłać za ${Math.ceil(remaining / 60000)} min.`); setTone("error"); return; }
      form.set("consent", form.get("consent") === "yes" ? "true" : "false"); form.set("startedAt", String(startedAt.current));
      const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 20000);
      const response = await fetch("/api/rekrutacja", { method: "POST", body: form, signal: controller.signal });
      window.clearTimeout(timeout);
      const result = await response.json().catch(() => ({}));
      if (response.ok) { localStorage.setItem("streetscope-recruitment-last-sent", String(Date.now())); formElement.reset(); startedAt.current = Date.now(); setMessage("Zgłoszenie trafiło do redakcji. Odezniemy się, jeśli będziemy chcieli porozmawiać."); setTone("ok"); }
      else { setMessage(result.error || "Nie udało się wysłać zgłoszenia."); setTone("error"); }
    } catch (error) { setMessage(error instanceof DOMException && error.name === "AbortError" ? "Serwer odpowiada zbyt długo. Spróbuj ponownie." : "Brak połączenia z formularzem. Spróbuj ponownie później."); setTone("error"); }
    finally { setBusy(false); }
  }
  return <main className="recruitment-page"><SiteNav /><section className="recruitment-grid"><div><p className="kicker"><i /> REKRUTACJA STREET SCOPE</p><h1>DOŁĄCZ<br />DO <em>NAS.</em></h1><p>Szukamy osób, które mają oczy i uszy otwarte na miasto — potrafią zdobyć temat, zebrać informacje i napisać to po ludzku.</p><ul><li>Relacje z ulic i dzielnic</li><li>Materiały, wywiady i zdjęcia</li><li>Bez zbędnego PR-u</li></ul></div><form onSubmit={submit} className="recruitment-form"><input className="spam-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /><div className="recruitment-row"><label>IMIĘ<input name="firstName" required minLength={2} placeholder="np. Izumi" /></label><label>NAZWISKO<input name="lastName" required minLength={2} placeholder="np. Daigo" /></label></div><label>NUMER TELEFONU<input name="phone" required type="tel" minLength={6} placeholder="np. 555-0147" /></label><label>ADRES E-MAIL<input name="email" required type="email" placeholder="twoj@email.pl" /></label><label>LINK DO PORTFOLIO <small>(OPCJONALNIE)</small><input name="portfolioUrl" type="url" placeholder="https://..." /></label><label>CV <small>(OPCJONALNIE · PDF/DOC/DOCX · MAX 5 MB)</small><input name="cv" type="file" accept=".pdf,.doc,.docx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document" /></label><label>KILKA SŁÓW O SOBIE<textarea name="message" required minLength={30} placeholder="Napisz, czym chcesz się zajmować i dlaczego chcesz tworzyć StreetScope." /></label><label className="recruitment-consent"><input name="consent" value="yes" required type="checkbox" /> <span>Wyrażam zgodę na kontakt w sprawie tego zgłoszenia.</span></label><button type="submit" disabled={busy}>{busy ? "WYSYŁANIE…" : "WYŚLIJ ZGŁOSZENIE ↗"}</button>{message && <p className={`recruitment-message ${tone === "error" ? "is-error" : ""}`} role="status">{message}</p>}</form></section><footer><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p></footer></main>;
}
