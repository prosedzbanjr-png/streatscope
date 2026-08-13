"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "../logowanie/login.css";

export default function HasloPage() {
  const [ready, setReady] = useState(false);
  const [password, setPassword] = useState("");
  const [repeat, setRepeat] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const client = getSupabase();
    client.auth.getSession().then(({ data }) => setReady(Boolean(data.session)));
    const { data: listener } = client.auth.onAuthStateChange((_event, session) => setReady(Boolean(session)));
    return () => listener.subscription.unsubscribe();
  }, []);

  async function submit(event: FormEvent) {
    event.preventDefault(); setMessage("");
    if (password.length < 10) { setMessage("Nowe hasło musi mieć minimum 10 znaków."); return; }
    if (password !== repeat) { setMessage("Hasła nie są takie same."); return; }
    setBusy(true);
    const { error } = await getSupabase().auth.updateUser({ password });
    setBusy(false);
    if (error) { setMessage("Nie udało się zmienić hasła. Otwórz ponownie link z e-maila lub zaloguj się ponownie."); return; }
    setPassword(""); setRepeat(""); setMessage("Hasło zostało zmienione. Możesz wrócić do panelu redakcji.");
  }

  return <main className="staff-login"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><section><p className="kicker"><i /> BEZPIECZEŃSTWO KONTA</p><h1>NOWE<br/><em>HASŁO.</em></h1><p>{ready ? "Ustaw nowe hasło do konta redakcyjnego." : "Otwórz link resetu hasła z e-maila albo zaloguj się, aby zmienić swoje hasło."}</p>{ready ? <form onSubmit={submit}><label>NOWE HASŁO<input type="password" minLength={10} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="new-password" /></label><label>POWTÓRZ HASŁO<input type="password" minLength={10} value={repeat} onChange={e=>setRepeat(e.target.value)} required autoComplete="new-password" /></label><button className="primary" disabled={busy}>{busy ? "ZAPIS…" : "ZMIEŃ HASŁO →"}</button><small role="status">{message}</small></form> : <a className="primary" href="/redakcja/logowanie">PRZEJDŹ DO LOGOWANIA →</a>}</section></main>;
}
