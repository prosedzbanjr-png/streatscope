"use client";

import { FormEvent, useState } from "react";
import { SiteNav } from "../site-nav";

export default function ZglosTematPage() {
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const response = await fetch("/api/zgloszenie", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: form.get("title"), district: form.get("district"), description: form.get("description"), contact: form.get("contact") }) });
    if (response.ok) { event.currentTarget.reset(); setMessage("Zgłoszenie wysłane do redakcji."); } else setMessage("Nie udało się wysłać zgłoszenia. Spróbuj ponownie później.");
    setBusy(false);
  }
  return <main className="tip-page"><SiteNav/><section className="tip-grid"><div><p className="kicker"><i/> KONTAKT Z REDAKCJĄ</p><h1>ZGŁOŚ<br/><em>TEMAT.</em></h1><p>Widzisz coś, o czym miasto powinno wiedzieć? Napisz. Nie musisz podawać swoich danych.</p><small>Nie używaj formularza w sytuacji wymagającej natychmiastowej pomocy służb.</small></div><form onSubmit={submit} className="tip-form"><label>TYTUŁ ZGŁOSZENIA<input name="title" required minLength={6} placeholder="Co się wydarzyło?"/></label><label>REJON<select name="district" defaultValue="LA MESA"><option>LA MESA</option><option>DAVIS</option><option>DOWNTOWN</option><option>INNY REJON</option></select></label><label>OPIS<textarea name="description" required minLength={30} placeholder="Podaj najważniejsze informacje: co, gdzie i kiedy."/></label><label>TWÓJ KONTAKT <small>opcjonalnie</small><input name="contact" type="text" placeholder="Telefon, e-mail lub pseudonim"/></label><button type="submit" disabled={busy}>{busy ? "WYSYŁANIE..." : "WYŚLIJ ZGŁOSZENIE ↗"}</button>{message && <p className="tip-success">{message}</p>}</form></section><footer><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p></footer></main>;
}
