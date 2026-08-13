"use client";

import { FormEvent, useRef, useState } from "react";
import { SiteNav } from "../site-nav";

export default function ZglosTematPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [tone, setTone] = useState<"ok" | "error" | "">("");
  const startedAt = useRef(Date.now());
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); const formElement = event.currentTarget; setBusy(true); setMessage(""); setTone("");
    try {
      const form = new FormData(formElement);
      const lastSent = Number(localStorage.getItem("streetscope-tip-last-sent") ?? 0);
      const waitMs = 10 * 60 * 1000 - (Date.now() - lastSent);
      if (waitMs > 0) { setMessage(`Kolejne zgłoszenie możesz wysłać za ${Math.ceil(waitMs / 60000)} min.`); setTone("error"); return; }
      const controller = new AbortController(); const timeout = window.setTimeout(() => controller.abort(), 15000);
      const response = await fetch("/api/zgloszenie", { method: "POST", headers: { "Content-Type": "application/json" }, signal: controller.signal, body: JSON.stringify({ title: form.get("title"), district: form.get("district"), description: form.get("description"), contact: form.get("contact"), website: form.get("website"), startedAt: startedAt.current }) });
      window.clearTimeout(timeout);
      const result = await response.json().catch(() => ({}));
      if (response.ok) { localStorage.setItem("streetscope-tip-last-sent", String(Date.now())); formElement.reset(); startedAt.current = Date.now(); setMessage("Zgłoszenie wysłane do redakcji."); setTone("ok"); }
      else { setMessage(result.error || (response.status === 429 ? "Za dużo prób. Spróbuj ponownie za kilka minut." : "Nie udało się wysłać zgłoszenia. Spróbuj ponownie później.")); setTone("error"); }
    } catch (error) { setMessage(error instanceof DOMException && error.name === "AbortError" ? "Serwer odpowiada zbyt długo. Spróbuj ponownie." : "Brak połączenia z formularzem. Spróbuj ponownie później."); setTone("error"); }
    finally { setBusy(false); }
  }
  return <main className="tip-page"><SiteNav /><section className="tip-grid"><div><p className="kicker"><i /> KONTAKT Z REDAKCJĄ</p><h1>ZGŁOŚ<br /><em>TEMAT.</em></h1><p>Widzisz coś, o czym miasto powinno wiedzieć? Napisz. Nie musisz podawać swoich danych.</p><small>Nie używaj formularza w sytuacji wymagającej natychmiastowej pomocy służb.</small></div><form onSubmit={submit} className="tip-form"><input className="spam-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /><label>TYTUŁ ZGŁOSZENIA<input name="title" required minLength={6} placeholder="Co się wydarzyło?" /></label><label>REJON<select name="district" defaultValue="LA MESA"><option>LA MESA</option><option>DAVIS</option><option>DOWNTOWN</option><option>INNY REJON</option></select></label><label>OPIS<textarea name="description" required minLength={30} placeholder="Podaj najważniejsze informacje: co, gdzie i kiedy." /></label><label>TWÓJ KONTAKT <small>opcjonalnie</small><input name="contact" type="text" placeholder="Telefon, e-mail lub pseudonim" /></label><button type="submit" disabled={busy}>{busy ? "WYSYŁANIE..." : "WYŚLIJ ZGŁOSZENIE ↗"}</button>{message && <p className={`tip-success ${tone === "error" ? "is-error" : ""}`} role="status">{message}</p>}</form></section><footer><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p></footer></main>;
}
