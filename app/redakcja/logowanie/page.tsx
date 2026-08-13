"use client";

import { FormEvent, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./login.css";

export default function RedakcjaLogowanie() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage("");
    try {
      const normalized = email.trim().toLowerCase();
      if (mode === "login") {
        const result = await getSupabase().auth.signInWithPassword({ email: normalized, password });
        if (result.error) { setMessage("Nie udało się zalogować. Sprawdź e-mail i hasło."); return; }
        setMessage("Zalogowano. Otwieram pulpit…"); window.location.assign("/redakcja"); return;
      }
      const response = await fetch("/api/redakcja/aktywacja", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: normalized, password }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) { setMessage(result.error || "Nie udało się aktywować konta."); return; }
      setMessage("Konto aktywowane. Potwierdź e-mail, jeśli Supabase o to poprosi, a potem się zaloguj.");
      setMode("login"); setPassword("");
    } catch { setMessage("Serwer logowania jest chwilowo niedostępny. Spróbuj ponownie."); }
    finally { setBusy(false); }
  }

  async function resetPassword() {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) { setMessage("Najpierw wpisz e-mail konta redakcyjnego."); return; }
    setBusy(true); setMessage("");
    try {
      await getSupabase().auth.resetPasswordForEmail(normalized, { redirectTo: `${window.location.origin}/redakcja/haslo` });
      setMessage("Jeśli konto istnieje, wysłaliśmy link do ustawienia nowego hasła.");
    } catch { setMessage("Nie udało się wysłać linku. Spróbuj ponownie później."); }
    finally { setBusy(false); }
  }

  return <main className="staff-login"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><section><p className="kicker"><i /> STREFA REDAKCJI</p><h1>{mode === "login" ? <>WEJDŹ<br/>DO <em>REDAKCJI.</em></> : <>AKTYWUJ<br/><em>KONTO.</em></>}</h1><p>{mode === "login" ? "Dostęp mają wyłącznie aktywne konta redakcyjne." : "Najpierw Naczelny musi dodać Twój e-mail w panelu zespołu."}</p><form onSubmit={submit}><label>E-MAIL<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></label><label>HASŁO<input type="password" minLength={mode === "register" ? 10 : 8} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label><button className="primary" disabled={busy}>{busy ? "CHWILA…" : mode === "login" ? "ZALOGUJ →" : "AKTYWUJ KONTO →"}</button><button type="button" onClick={()=>{setMode(mode === "login" ? "register" : "login");setMessage("");}}>{mode === "login" ? "PIERWSZY RAZ? AKTYWUJ KONTO" : "MASZ JUŻ KONTO? ZALOGUJ"}</button>{mode === "login" && <button type="button" onClick={resetPassword}>NIE PAMIĘTAM HASŁA</button>}<small role="status">{message}</small></form></section></main>;
}
