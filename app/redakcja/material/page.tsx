"use client";

import { ChangeEvent, FormEvent, useEffect, useRef, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./material.css";

const EDITOR_EMAIL = "kujalowicze@gmail.com";

function cleanText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export default function MaterialPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [title, setTitle] = useState(""); const [excerpt, setExcerpt] = useState(""); const [category, setCategory] = useState("AKTUALNOŚCI");
  const [body, setBody] = useState(""); const [cover, setCover] = useState<File | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLDivElement>(null); const inlineFile = useRef<HTMLInputElement>(null); const selectionRange = useRef<Range | null>(null);
  const client = () => getSupabase();

  useEffect(() => { client().auth.getUser().then(({ data }) => setAllowed(data.user?.email?.toLowerCase() === EDITOR_EMAIL)); }, []);
  useEffect(() => { if (canvas.current && canvas.current.innerHTML !== body) canvas.current.innerHTML = body; }, [body]);

  function syncBody() { setBody(canvas.current?.innerHTML ?? ""); }
  function saveCaret() { const selection = window.getSelection(); if (selection?.rangeCount) selectionRange.current = selection.getRangeAt(0).cloneRange(); }
  function restoreCaret() { const selection = window.getSelection(); if (selectionRange.current && selection) { selection.removeAllRanges(); selection.addRange(selectionRange.current); } }
  function command(name: string, value?: string) { canvas.current?.focus(); restoreCaret(); document.execCommand(name, false, value); saveCaret(); syncBody(); }
  function addLink() { const link = window.prompt("Wklej adres linku:"); if (link) command("createLink", link); }
  async function upload(file: File) {
    if (!file.type.startsWith("image/") || file.size > 8 * 1024 * 1024) throw new Error("Nieprawidłowy plik");
    const extension = file.name.split(".").pop()?.replace(/[^a-z0-9]/gi, "") || "jpg";
    const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
    const { error } = await client().storage.from("article-images").upload(path, file, { contentType: file.type, upsert: false });
    if (error) throw error;
    return client().storage.from("article-images").getPublicUrl(path).data.publicUrl;
  }
  async function insertImage(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0]; if (!file) return;
    try {
      const url = await upload(file); canvas.current?.focus(); restoreCaret();
      const selection = window.getSelection(); const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
      const figure = document.createElement("figure"); figure.className = "inline-media";
      const image = document.createElement("img"); image.src = url; image.alt = "Zdjęcie w materiale";
      const caption = document.createElement("figcaption"); caption.contentEditable = "true"; caption.dataset.placeholder = "Dodaj podpis zdjęcia…";
      figure.append(image, caption);
      if (range) { range.deleteContents(); range.insertNode(figure); const after = document.createRange(); after.setStartAfter(figure); after.collapse(true); selection?.removeAllRanges(); selection?.addRange(after); } else canvas.current?.append(figure);
      saveCaret(); syncBody();
    } catch { setMessage("Nie udało się przesłać zdjęcia do treści."); } finally { event.target.value = ""; }
  }
  async function save(event: FormEvent, status: "draft" | "published") {
    event.preventDefault(); const text = cleanText(body);
    if (title.trim().length < 6 || excerpt.trim().length < 30 || text.length < 80) { setMessage("Tytuł, zajawka i treść muszą być uzupełnione."); return; }
    setBusy(true); setMessage("");
    try {
      const image_url = cover ? await upload(cover) : null;
      const { error } = await client().from("articles").insert({ title: title.trim(), excerpt: excerpt.trim(), category, body, image_url, gallery: [], status, author_email: EDITOR_EMAIL, published_at: status === "published" ? new Date().toISOString() : null, updated_at: new Date().toISOString() });
      if (error) throw error;
      setTitle(""); setExcerpt(""); setBody(""); setCover(null); if (canvas.current) canvas.current.innerHTML = "";
      setMessage(status === "published" ? "Materiał opublikowany." : "Szkic zapisany.");
    } catch { setMessage("Nie udało się zapisać materiału. Sprawdź bucket article-images w Supabase."); } finally { setBusy(false); }
  }

  if (allowed === null) return <main className="material-page"><p>ŁADOWANIE…</p></main>;
  if (!allowed) return <main className="material-page"><a className="wordmark" href="/">STREET<span>SCOPE</span></a><h1>DOSTĘP<br /><em>ZAMKNIĘTY.</em></h1><a className="material-action" href="/redakcja">ZALOGUJ SIĘ →</a></main>;
  return <main className="material-page"><header><a className="wordmark" href="/">STREET<span>SCOPE</span></a><nav><a href="/redakcja">PANEL</a><a href="/redakcja/statystyki">STATYSTYKI</a></nav></header><form className="material-layout"><section className="material-intro"><p className="kicker"><i /> EDYTOR REDAKCYJNY</p><h1>NAPISZ<br /><em>MATERIAŁ.</em></h1><p>Zdjęcie wstawiasz dokładnie tam, gdzie stoi kursor. Kliknij w podpis pod obrazem, żeby go uzupełnić.</p></section><section className="material-form"><label>TYTUŁ<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Co wydarzyło się w mieście?" maxLength={120} /></label><div className="material-row"><label>KATEGORIA<select value={category} onChange={event => setCategory(event.target.value)}><option>AKTUALNOŚCI</option><option>ULICE</option><option>SPORT</option><option>OPINIE</option><option>WYDARZENIA</option></select></label><label>ZDJĘCIE GŁÓWNE<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setCover(event.target.files?.[0] ?? null)} /><small>{cover ? cover.name : "JPG, PNG lub WEBP · maks. 8 MB"}</small></label></div><label>ZAJAWKA<input value={excerpt} onChange={event => setExcerpt(event.target.value)} placeholder="Krótki opis widoczny na stronie głównej…" maxLength={320} /></label><label>PEŁNA TREŚĆ<div className="material-editor"><div className="material-toolbar" role="toolbar" aria-label="Formatowanie"><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("bold")}><b>B</b></button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("italic")}><i>I</i></button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("underline")}><u>U</u></button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("strikeThrough")}><s>S</s></button><span /><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "h2")}>NAGŁÓWEK</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "h3")}>ŚRÓDTYTUŁ</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "blockquote")}>CYTAT</button><span /><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("insertUnorderedList")}>• LISTA</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("insertOrderedList")}>1. LISTA</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={addLink}>LINK</button><button type="button" onMouseDown={event => { event.preventDefault(); saveCaret(); }} onClick={() => inlineFile.current?.click()}>+ ZDJĘCIE</button></div><div ref={canvas} className="material-canvas" contentEditable suppressContentEditableWarning data-placeholder="Napisz materiał. Ustaw kursor w miejscu, w którym ma pojawić się obraz." onInput={syncBody} onKeyUp={saveCaret} onMouseUp={saveCaret} onFocus={saveCaret} /></div></label><input ref={inlineFile} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={insertImage} /><div className="material-actions"><small>{message}</small><button type="button" disabled={busy} onClick={event => save(event, "draft")}>{busy ? "ZAPIS…" : "ZAPISZ SZKIC"}</button><button type="button" className="primary" disabled={busy} onClick={event => save(event, "published")}>{busy ? "PUBLIKACJA…" : "OPUBLIKUJ ↗"}</button></div></section></form></main>;
}
