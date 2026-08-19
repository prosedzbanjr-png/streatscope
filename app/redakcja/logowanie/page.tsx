"use client";

import { FormEvent, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./login.css";

function loginErrorMessage(message?: string) {
  const error = (message || "").toLowerCase();

  if (error.includes("invalid login credentials")) {
    return "Nieprawidłowy e-mail lub hasło. Jeśli logujesz się pierwszy raz, konto spróbuje aktywować się automatycznie.";
  }
  if (error.includes("email not confirmed")) {
    return "E-mail konta nie został jeszcze potwierdzony. Sprawdź skrzynkę lub użyj opcji aktywacji konta.";
  }
  if (error.includes("too many requests") || error.includes("rate limit")) {
    return "Za dużo prób logowania. Odczekaj chwilę i spróbuj ponownie.";
  }

  return message ? `Nie udało się zalogować: ${message}` : "Nie udało się zalogować.";
}

export default function RedakcjaLogowanie() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mode, setMode] = useState<"login" | "register">("login");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function activateAccount(normalized: string) {
    const response = await fetch("/api/redakcja/aktywacja", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: normalized, password }),
    });
    const result = await response.json().catch(() => ({}));
    return { response, result };
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setMessage("");

    try {
      const normalized = email.trim().toLowerCase();
      const supabase = getSupabase();

      if (mode === "login") {
        let result = await supabase.auth.signInWithPassword({ email: normalized, password });

        // Najczęstszy problem po dodaniu osoby do zespołu: wpis istnieje w staff_accounts,
        // ale konto Supabase Auth nie zostało jeszcze utworzone. W takim przypadku
        // próbujemy jednorazowo aktywować konto i logujemy ponownie.
        if (result.error?.message?.toLowerCase().includes("invalid login credentials") && password.length >= 10) {
          const activation = await activateAccount(normalized);

          if (activation.response.ok) {
            result = await supabase.auth.signInWithPassword({ email: normalized, password });
          }
        }

        if (result.error) {
          setMessage(loginErrorMessage(result.error.message));
          return;
        }

        setMessage("Zalogowano. Otwieram pulpit…");
        window.location.assign("/redakcja");
        return;
      }

      const { response, result } = await activateAccount(normalized);
      if (!response.ok) {
        setMessage(result.error || "Nie udało się aktywować konta.");
        return;
      }

      // Po aktywacji od razu próbujemy zalogować użytkownika, zamiast kazać mu
      // ponownie przepisywać te same dane.
      const login = await supabase.auth.signInWithPassword({ email: normalized, password });
      if (!login.error) {
        setMessage("Konto aktywowane. Otwieram pulpit…");
        window.location.assign("/redakcja");
        return;
      }

      setMessage(loginErrorMessage(login.error.message));
      setMode("login");
    } catch (error) {
      const text = error instanceof Error ? error.message : "";
      setMessage(text ? `Błąd logowania: ${text}` : "Serwer logowania jest chwilowo niedostępny. Spróbuj ponownie.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    const normalized = email.trim().toLowerCase();
    if (!normalized.includes("@")) {
      setMessage("Najpierw wpisz e-mail konta redakcyjnego.");
      return;
    }

    setBusy(true);
    setMessage("");
    try {
      const result = await getSupabase().auth.resetPasswordForEmail(normalized, {
        redirectTo: `${window.location.origin}/redakcja/haslo`,
      });
      if (result.error) {
        setMessage(`Nie udało się wysłać linku: ${result.error.message}`);
        return;
      }
      setMessage("Jeśli konto istnieje, wysłaliśmy link do ustawienia nowego hasła.");
    } catch {
      setMessage("Nie udało się wysłać linku. Spróbuj ponownie później.");
    } finally {
      setBusy(false);
    }
  }

  return <main className="staff-login"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><section><p className="kicker"><i /> STREFA REDAKCJI</p><h1>{mode === "login" ? <>WEJDŹ<br/>DO <em>REDAKCJI.</em></> : <>AKTYWUJ<br/><em>KONTO.</em></>}</h1><p>{mode === "login" ? "Dostęp mają wyłącznie aktywne konta redakcyjne." : "Najpierw Naczelny musi dodać Twój e-mail w panelu zespołu."}</p><form onSubmit={submit}><label>E-MAIL<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="email" /></label><label>HASŁO<input type="password" minLength={mode === "register" ? 10 : 8} value={password} onChange={e=>setPassword(e.target.value)} required autoComplete={mode === "login" ? "current-password" : "new-password"} /></label><button className="primary" disabled={busy}>{busy ? "CHWILA…" : mode === "login" ? "ZALOGUJ →" : "AKTYWUJ KONTO →"}</button><button type="button" onClick={()=>{setMode(mode === "login" ? "register" : "login");setMessage("");}}>{mode === "login" ? "PIERWSZY RAZ? AKTYWUJ KONTO" : "MASZ JUŻ KONTO? ZALOGUJ"}</button>{mode === "login" && <button type="button" onClick={resetPassword}>NIE PAMIĘTAM HASŁA</button>}<small role="status">{message}</small></form></section></main>;
}
