"use client";

import { FormEvent, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./login.css";

export default function RedakcjaLogowanie() {
  const [email, setEmail] = useState(""); const [password, setPassword] = useState(""); const [mode, setMode] = useState<"login" | "register">("login"); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) { event.preventDefault(); setBusy(true); setMessage(""); const client = getSupabase(); const normalized = email.trim().toLowerCase(); const result = mode === "login" ? await client.auth.signInWithPassword({ email: normalized, password }) : await client.auth.signUp({ email: normalized, password }); setBusy(false); if (result.error) { setMessage(result.error.message); return; } setMessage(mode === "login" ? "Zalogowano. Otwieram pulpit…" : "Konto utworzone. Potwierdź e-mail, jeśli Supabase o to poprosi, a potem się zaloguj."); if (mode === "login") window.location.assign("/redakcja"); }
  return <main className="staff-login"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><section><p className="kicker"><i /> STREFA REDAKCJI</p><h1>{mode === "login" ? "WEJDŹ<br/>DO <em>REDAKCJI.</em>" : "AKTYWUJ<br/><em>KONTO.</em>"}</h1><p>Twoje konto musi być wcześniej dodane przez naczelnego.</p><form onSubmit={submit}><label>E-MAIL<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required /></label><label>HASŁO<input type="password" minLength={8} value={password} onChange={e=>setPassword(e.target.value)} required /></label><button className="primary" disabled={busy}>{busy ? "CHWILA…" : mode === "login" ? "ZALOGUJ →" : "UTWÓRZ KONTO →"}</button><button type="button" onClick={()=>setMode(mode === "login" ? "register" : "login")}>{mode === "login" ? "PIERWSZY RAZ? AKTYWUJ KONTO" : "MASZ JUŻ KONTO? ZALOGUJ"}</button><small>{message}</small></form></section></main>;
}
