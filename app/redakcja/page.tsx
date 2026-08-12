"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
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
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [galleryFiles, setGalleryFiles] = useState<File[]>([]);

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

  function selectCover(event: ChangeEvent<HTMLInputElement>) { setCoverFile(event.target.files?.[0] ?? null); }
  function selectGallery(event: ChangeEvent<HTMLInputElement>) { setGalleryFiles(Array.from(event.target.files ?? []).slice(0, 8)); }

  async function uploadImage(file: File) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) throw new Error("Nieprawidłowy plik");
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
    const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const client = getSupabase();
    const { error } = await client.storage.from("article-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return client.storage.from("article-images").getPublicUrl(path).data.publicUrl;
  }

  async function saveArticle(event: FormEvent<HTMLFormElement>, status: "draft" | "published") {
    event.preventDefault(); setBusy(true); setMessage("");
    const form = new FormData(event.currentTarget);
    const now = new Date().toISOString();
    try {
      const uploadedCover = coverFile ? await uploadImage(coverFile) : "";
      const uploadedGallery = await Promise.all(galleryFiles.map(uploadImage));
      const manualGallery = String(form.get("gallery") ?? "").split(/\n|,/).map(url => url.trim()).filter(Boolean);
      const { error } = await getSupabase().from("articles").insert({
      title: String(form.get("title") ?? "").trim(), category: String(form.get("category") ?? "AKTUALNOŚCI"),
      excerpt: String(form.get("excerpt") ?? "").trim(), body: String(form.get("body") ?? "").trim(),
      image_url: uploadedCover || String(form.get("image_url") ?? "").trim() || null,
      gallery: [...uploadedGallery, ...manualGallery],
      status, author_email: EDITOR_EMAIL,
      published_at: status === "published" ? now : null, updated_at: now,
      });
      if (error) throw error;
      event.currentTarget.reset(); setCoverFile(null); setGalleryFiles([]); setMessage(status === "published" ? "Materiał opublikowany." : "Szkic zapisany."); await loadArticles();
    } catch { setMessage("Nie udało się dodać zdjęć lub zapisać materiału. Sprawdź bucket i zasady Storage w Supabase."); }
    setBusy(false);
  }

  if (!signedIn) return <main className="editor-shell"><header className="editor-header"><a href="/" className="wordmark">STREET<span>SCOPE</span></a></header><section className="editor-card"><p className="kicker"><i /> PANEL REDAKCYJNY</p><h1>WEJDŹ DO<br /><em>REDAKCJI.</em></h1><form className="login-form" onSubmit={signIn}><input type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="E-MAIL" required/><input type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="HASŁO" required/><button disabled={busy}>{busy ? "LOGOWANIE..." : "ZALOGUJ SIĘ →"}</button>{message && <small>{message}</small>}</form></section></main>;

  return <main className="editor-shell"><header className="editor-header"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><div><span>NACZELNY</span><button onClick={async () => { await getSupabase().auth.signOut(); setSignedIn(false); }}>WYLOGUJ</button></div></header><section className="editor-dashboard"><div className="dashboard-heading"><div><p className="kicker"><i /> PULPIT NACZELNEGO</p><h1>NOWY<br /><em>MATERIAŁ.</em></h1></div><p>Twórz szkice albo publikuj je od razu. Wpisy po publikacji trafiają na stronę główną.</p></div><form className="article-form" onSubmit={e => saveArticle(e, "published")}><label>TYTUŁ<input name="title" required minLength={6} maxLength={120} placeholder="Co wydarzyło się w mieście?" /></label><label>KATEGORIA<select name="category" defaultValue="AKTUALNOŚCI"><option>AKTUALNOŚCI</option><option>ULICE</option><option>SPORT</option><option>OPINIE</option><option>WYDARZENIA</option></select></label><label className="wide">ZAJAWKA<input name="excerpt" required minLength={30} maxLength={320} placeholder="Krótki opis widoczny na stronie głównej..." /></label><label className="wide">PEŁNA TREŚĆ ARTYKUŁU<textarea name="body" required minLength={80} maxLength={12000} placeholder="Tu wpisujesz pełny artykuł. Puste linie tworzą kolejne akapity." /></label><label className="wide">ZDJĘCIE GŁÓWNE — WYBIERZ PLIK<input type="file" accept="image/jpeg,image/png,image/webp" onChange={selectCover} /><small>{coverFile ? `Wybrano: ${coverFile.name}` : "JPG, PNG lub WEBP · maks. 8 MB"}</small></label><label className="wide">GALERIA — WYBIERZ ZDJĘCIA<input type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={selectGallery} /><small>{galleryFiles.length ? `Wybrano zdjęć: ${galleryFiles.length}` : "Maksymalnie 8 zdjęć · JPG, PNG lub WEBP"}</small></label><label className="wide">LUB DODAJ LINK DO ZDJĘCIA GŁÓWNEGO<input name="image_url" type="url" placeholder="https://..." /></label><label className="wide">DODATKOWE LINKI DO GALERII (JEDEN W KAŻDEJ LINII)<textarea name="gallery" className="gallery-input" placeholder={'https://...\nhttps://...'} /></label><div className="form-actions"><span>{message}</span><button type="button" disabled={busy} onClick={e => { const form = e.currentTarget.form; if (form?.reportValidity()) saveArticle({ preventDefault() {}, currentTarget: form } as FormEvent<HTMLFormElement>, "draft"); }}>{busy ? "ZAPIS..." : "ZAPISZ SZKIC"}</button><button type="submit" className="publish" disabled={busy}>{busy ? "PUBLIKACJA..." : "OPUBLIKUJ ↗"}</button></div></form></section><section className="article-list"><div className="list-title"><p className="kicker"><i /> TWOJE MATERIAŁY</p><h2>REDAKCYJNA<br /><em>KOLEJKA.</em></h2></div><div className="list-items">{articles.length ? articles.map(article => <article key={article.id}><span className={article.status === "published" ? "status live" : "status"}>{article.status === "published" ? "OPUBLIKOWANO" : "SZKIC"}</span><div><b>{article.category}</b><h3>{article.title}</h3><small>{new Date(article.created_at).toLocaleDateString("pl-PL")}</small>{article.status === "published" && <a className="article-open" href={`/artykul/${article.id}`}>OTWÓRZ ARTYKUŁ ↗</a>}</div></article>) : <p className="empty-state">Brak materiałów. Pierwszy artykuł nie napisze się sam.</p>}</div></section><a className="editor-back editor-home" href="/">← WRÓĆ NA STRONĘ GŁÓWNĄ</a></main>;
}
