"use client";

import { FormEvent, useState } from "react";
import { SiteNav } from "../site-nav";

export default function DolaczPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const lastSent = Number(localStorage.getItem("streetscope-recruitment-last-sent") || 0);
    const remaining = 10 * 60 * 1000 - (Date.now() - lastSent);
    if (remaining > 0) { setMessage(`Kolejne zgłoszenie możesz wysłać za ${Math.ceil(remaining / 60000)} min.`); setBusy(false); return; }
    const response = await fetch("/api/rekrutacja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ firstName: form.get("firstName"), lastName: form.get("lastName"), phone: form.get("phone"), email: form.get("email"), message: form.get("message"), consent: form.get("consent") === "yes", website: form.get("website") }) });
    const result = await response.json().catch(() => ({}));
    if (response.ok) { localStorage.setItem("streetscope-recruitment-last-sent", String(Date.now())); event.currentTarget.reset(); setMessage("Zgłoszenie trafiło do redakcji. Odezniemy się, jeśli będziemy chcieli porozmawiać."); } else setMessage(result.error || "Nie udało się wysłać zgłoszenia.");
    setBusy(false);
  }
  return <main className="recruitment-page"><SiteNav /><section className="recruitment-grid"><div><p className="kicker"><i /> REKRUTACJA STREET SCOPE</p><h1>DOŁĄCZ<br />DO <em>NAS.</em></h1><p>Szukamy osób, które mają oczy i uszy otwarte na miasto — potrafią zdobyć temat, zebrać informacje i napisać to po ludzku.</p><ul><li>Relacje z ulic i dzielnic</li><li>Materiały, wywiady i zdjęcia</li><li>Bez zbędnego PR-u</li></ul></div><form onSubmit={submit} className="recruitment-form"><input className="spam-trap" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" /><div className="recruitment-row"><label>IMIĘ<input name="firstName" required minLength={2} placeholder="np. Izumi" /></label><label>NAZWISKO<input name="lastName" required minLength={2} placeholder="np. Daigo" /></label></div><label>NUMER TELEFONU<input name="phone" required type="tel" minLength={6} placeholder="np. 555-0147" /></label><label>ADRES E-MAIL<input name="email" required type="email" placeholder="twoj@email.pl" /></label><label>KILKA SŁÓW O SOBIE<textarea name="message" required minLength={30} placeholder="Napisz, czym chcesz się zajmować i dlaczego chcesz tworzyć StreetScope." /></label><label className="recruitment-consent"><input name="consent" value="yes" required type="checkbox" /> <span>Wyrażam zgodę na kontakt w sprawie tego zgłoszenia.</span></label><button type="submit" disabled={busy}>{busy ? "WYSYŁANIE…" : "WYŚLIJ ZGŁOSZENIE ↗"}</button>{message && <p className="recruitment-message">{message}</p>}</form></section><footer><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p></footer></main>;
}
