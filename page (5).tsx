"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

const EDITOR_EMAIL = "kujalowicze@gmail.com";
type Article = { id: number; title: string; category: string; status: "draft" | "published"; created_at: string };

export default function RedakcjaPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [articles, setArticles] = useState<Article[]>([]);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function loadArticles() {
    const { data } = await getSupabase().from("articles").select("id,title,category,status,created_at").order("created_at", { ascending: false }).limit(30);
    setArticles((data as Article[] | null) ?? []);
  }

  useEffect(() => {
    const client = getSupabase();
    client.auth.getUser().then(({ data }) => {
      if (data.user?.email?.toLowerCase() === EDITOR_EMAIL) {
        setSignedIn(true);
        loadArticles();
      }
    });
  }, []);

  async function signIn(event: FormEvent<HTMLFormElement>) {
    event.preventDefault(); setBusy(true); setMessage("");
    const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
    if (error) setMessage("Nieprawidłowy e-mail lub hasło.");
    else if (data.user?.email?.toLowerCase() !== EDITOR_EMAIL) setMessage("To konto nie ma uprawnień naczelnego.");
    else { setSignedIn(true); setPassword(""); await loadArticles(); }
    setBusy(false);
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>, status: "draft" | "published") {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    const { error } = await getSupabase().from("articles").insert({
      title: String(form.get("title") ?? "").trim(), category: String(form.get("category") ?? "AKTUALNOŚCI"),
      excerpt: String(form.get("excerpt") ?? "").trim(), status, author_email: EDITOR_EMAIL,
      published_at: status === "published" ? now : null, updated_at: now,
    });
    if (error) setMessage("Nie udało się zapisać materiału. Sprawdź zasady dostępu w Supabase.");
    else { event.currentTarget.reset(); setMessage(status === "published" ? "Materiał opublikowany." : "Szkic zapisany."); await loadArticles(); }
    setBusy(false);
  }

  if (!signedIn) return <main className="editor-shell"><header className="editor-header"><a href="/" className="wordmark">STREET<span>SCOPE</span></a></header><section className="editor-card"><p className="kicker"><i /> PANEL REDAKCYJNY</p><h1>WEJDŹ DO<br /><em>REDAKCJI.</em></h1><form className="login-form" onSubmit={signIn}><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-MAIL" required/><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="HASŁO" required/><button disabled={busy}>{busy ? "LOGOWANIE..." : "ZALOGUJ SIĘ →"}</button>{message && <small>{message}</small>}</form></section></main>;

  return <main className="editor-shell"><header className="editor-header"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><div><span>NACZELNY</span><button onClick={async () => { await getSupabase().auth.signOut(); setSignedIn(false); }}>WYLOGUJ</button></div></header><section className="editor-dashboard"><div className="dashboard-heading"><div><p className="kicker"><i /> PULPIT NACZELNEGO</p><h1>NOWY<br /><em>MATERIAŁ.</em></h1></div><p>Twórz szkice albo publikuj je od razu. Wpisy po publikacji trafiają na stronę główną.</p></div><form className="article-form" onSubmit={e => saveArticle(e, "published")}><label>TYTUŁ<input name="title" required minLength={6} maxLength={120} placeholder="Co wydarzyło się w mieście?" /></label><label>KATEGORIA<select name="category" defaultValue="AKTUALNOŚCI"><option>AKTUALNOŚCI</option><option>ULICE</option><option>SPORT</option><option>OPINIE</option><option>WYDARZENIA</option></select></label><label className="wide">ZAJAWKA / TREŚĆ<textarea name="excerpt" required minLength={30} maxLength={1200} placeholder="Napisz konkretnie, co czytelnik ma wiedzieć..." /></label><div className="form-actions"><span>{message}</span><button type="button" disabled={busy} onClick={e => { const form = e.currentTarget.form; if (form?.reportValidity()) saveArticle({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>, "draft"); }}>{busy ? "ZAPIS..." : "ZAPISZ SZKIC"}</button><button type="submit" className="publish" disabled={busy}>{busy ? "PUBLIKACJA..." : "OPUBLIKUJ ↗"}</button></div></form></section><section className="article-list"><div className="list-title"><p className="kicker"><i /> TWOJE MATERIAŁY</p><h2>REDAKCYJNA<br /><em>KOLEJKA.</em></h2></div><div className="list-items">{articles.length ? articles.map(article => <article key={article.id}><span className={article.status === "published" ? "status live" : "status"}>{article.status === "published" ? "OPUBLIKOWANO" : "SZKIC"}</span><div><b>{article.category}</b><h3>{article.title}</h3><small>{new Date(article.created_at).toLocaleDateString("pl-PL")}</small></div></article>) : <p className="empty-state">Brak materiałów. Pierwszy artykuł nie napisze się sam.</p>}</div></section><a className="editor-back editor-home" href="/">← WRÓĆ NA STRONĘ GŁÓWNĄ</a></main>;
}
