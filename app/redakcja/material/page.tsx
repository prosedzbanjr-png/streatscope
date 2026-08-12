"use client";

import { ChangeEvent, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./material.css";

const EDITOR_EMAIL = "kujalowicze@gmail.com";

function cleanText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

export default function MaterialPage() {
  const [articleId, setArticleId] = useState(0); const [routeReady, setRouteReady] = useState(false); const isEditing = articleId > 0;
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [title, setTitle] = useState(""); const [excerpt, setExcerpt] = useState(""); const [category, setCategory] = useState("AKTUALNOŚCI");
  const [body, setBody] = useState(""); const [cover, setCover] = useState<File | null>(null); const [existingCover, setExistingCover] = useState<string | null>(null); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState(false); const [loaded, setLoaded] = useState(false); const [selectedMedia, setSelectedMedia] = useState<HTMLElement | null>(null); const [mediaWidth, setMediaWidth] = useState(100);
  const canvas = useRef<HTMLDivElement>(null); const inlineFile = useRef<HTMLInputElement>(null); const selectionRange = useRef<Range | null>(null);
  const client = () => getSupabase();

  const draftKey = `streetscope-material-draft-${isEditing ? articleId : "new"}`;
  const previewBody = useMemo(() => body || "<p>Tu pojawi się treść materiału.</p>", [body]);
  useEffect(() => { const id = Number(new URLSearchParams(window.location.search).get("id")); setArticleId(Number.isFinite(id) && id > 0 ? id : 0); setRouteReady(true); }, []);
  useEffect(() => { if (!routeReady) return; client().auth.getUser().then(async ({ data }) => { const ok = data.user?.email?.toLowerCase() === EDITOR_EMAIL; setAllowed(ok); if (!ok || !isEditing) { setLoaded(true); return; } const { data: article } = await client().from("articles").select("title,excerpt,category,body,image_url").eq("id", articleId).single(); if (!article) { setMessage("Nie znaleziono materiału do edycji."); setLoaded(true); return; } setTitle(article.title); setExcerpt(article.excerpt); setCategory(article.category); setBody(article.body || ""); setExistingCover(article.image_url); setLoaded(true); } ); }, [routeReady, articleId]);
  useEffect(() => { if (canvas.current && canvas.current.innerHTML !== body) canvas.current.innerHTML = body; }, [body]);
  useEffect(() => { if (!allowed || !loaded) return; const timer = window.setTimeout(() => { const content = { title, excerpt, category, body, savedAt: new Date().toISOString() }; if (title || excerpt || body) { localStorage.setItem(draftKey, JSON.stringify(content)); setMessage("Szkic zapisany automatycznie."); } }, 900); return () => window.clearTimeout(timer); }, [title, excerpt, category, body, allowed, loaded]);
  useEffect(() => { if (!allowed || !loaded || isEditing) return; const raw = localStorage.getItem(draftKey); if (!raw) return; try { const saved = JSON.parse(raw); if ((saved.title || saved.body) && window.confirm("Przywrócić automatycznie zapisany szkic?")) { setTitle(saved.title || ""); setExcerpt(saved.excerpt || ""); setCategory(saved.category || "AKTUALNOŚCI"); setBody(saved.body || ""); } } catch {} }, [allowed, loaded]);

  function syncBody() { setBody(canvas.current?.innerHTML ?? ""); }
  function saveCaret() { const selection = window.getSelection(); if (selection?.rangeCount) selectionRange.current = selection.getRangeAt(0).cloneRange(); }
  function restoreCaret() { const selection = window.getSelection(); if (selectionRange.current && selection) { selection.removeAllRanges(); selection.addRange(selectionRange.current); } }
  function command(name: string, value?: string) { canvas.current?.focus(); restoreCaret(); document.execCommand(name, false, value); saveCaret(); syncBody(); }
  function addLink() { const link = window.prompt("Wklej adres linku:"); if (link) command("createLink", link); }
  function youtubeEmbedUrl(url: string) { try { const parsed = new URL(url); const id = parsed.hostname.includes("youtu.be") ? parsed.pathname.slice(1) : parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop(); return id ? `https://www.youtube-nocookie.com/embed/${id.replace(/[^a-zA-Z0-9_-]/g, "")}` : null; } catch { return null; } }
  function insertVideo() {
    const source = window.prompt("Wklej link YouTube albo bezpośredni adres filmu MP4:"); if (!source || !canvas.current) return;
    canvas.current.focus(); restoreCaret(); const selection = window.getSelection(); const range = selection?.rangeCount ? selection.getRangeAt(0) : null; const figure = document.createElement("figure"); figure.className = "inline-video"; const embed = youtubeEmbedUrl(source);
    if (embed) { const iframe = document.createElement("iframe"); iframe.src = embed; iframe.title = "Wideo w materiale"; iframe.allowFullscreen = true; iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"); figure.append(iframe); } else if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(source)) { const video = document.createElement("video"); video.src = source; video.controls = true; video.preload = "metadata"; figure.append(video); } else { setMessage("Użyj linku YouTube lub bezpośredniego adresu pliku MP4, WEBM albo OGG."); return; }
    const caption = document.createElement("figcaption"); caption.contentEditable = "true"; caption.dataset.placeholder = "Dodaj podpis filmu…"; figure.append(caption); if (range) { range.deleteContents(); range.insertNode(figure); const after = document.createRange(); after.setStartAfter(figure); after.collapse(true); selection?.removeAllRanges(); selection?.addRange(after); } else canvas.current.append(figure); saveCaret(); syncBody();
  }
  function selectMedia(event: MouseEvent<HTMLDivElement>) { const target = event.target as HTMLElement; const media = target.closest("figure.inline-media") as HTMLElement | null; if (!media) { setSelectedMedia(null); return; } setSelectedMedia(media); setMediaWidth(Number.parseInt(media.dataset.width || "100", 10) || 100); }
  function updateMedia(layout: "wide" | "left" | "right" | "small") {
    if (!selectedMedia) return;
    selectedMedia.dataset.layout = layout;
    if (layout === "wide") updateMediaWidth(100);
    if (layout === "small") {
      const requested = window.prompt("Podaj szerokość zdjęcia od 25 do 100 (%):", String(mediaWidth));
      if (requested !== null) { const width = Number.parseInt(requested, 10); if (Number.isFinite(width) && width >= 25 && width <= 100) updateMediaWidth(width); else setMessage("Szerokość zdjęcia musi być liczbą od 25 do 100."); }
    }
    syncBody();
  }
  function updateMediaWidth(width: number) { if (!selectedMedia) return; selectedMedia.dataset.width = String(width); selectedMedia.style.width = `${width}%`; setMediaWidth(width); syncBody(); }
  function removeMedia() { if (!selectedMedia || !window.confirm("Usunąć to zdjęcie z treści?")) return; selectedMedia.remove(); setSelectedMedia(null); syncBody(); }
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
      const figure = document.createElement("figure"); figure.className = "inline-media"; figure.dataset.width = "100"; figure.style.width = "100%";
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
      const payload = { title: title.trim(), excerpt: excerpt.trim(), category, body, image_url: image_url || existingCover, gallery: [], status, author_email: EDITOR_EMAIL, published_at: status === "published" ? new Date().toISOString() : null, updated_at: new Date().toISOString() };
      const { error } = isEditing ? await client().from("articles").update(payload).eq("id", articleId) : await client().from("articles").insert(payload);
      if (error) throw error;
      localStorage.removeItem(draftKey); if (!isEditing) { setTitle(""); setExcerpt(""); setBody(""); setCover(null); if (canvas.current) canvas.current.innerHTML = ""; }
      setMessage(status === "published" ? (isEditing ? "Materiał zaktualizowany." : "Materiał opublikowany.") : "Szkic zapisany.");
    } catch { setMessage("Nie udało się zapisać materiału. Sprawdź bucket article-images w Supabase."); } finally { setBusy(false); }
  }

  if (allowed === null || !loaded) return <main className="material-page"><p>ŁADOWANIE…</p></main>;
  if (!allowed) return <main className="material-page"><a className="wordmark" href="/">STREET<span>SCOPE</span></a><h1>DOSTĘP<br /><em>ZAMKNIĘTY.</em></h1><a className="material-action" href="/redakcja">ZALOGUJ SIĘ →</a></main>;
  return <main className="material-page"><header><a href="/" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/redakcja">PANEL</a><a href="/redakcja/statystyki">STATYSTYKI</a></nav></header><form className="material-layout"><section className="material-intro"><p className="kicker"><i /> {isEditing ? "EDYCJA MATERIAŁU" : "EDYTOR REDAKCYJNY"}</p><h1>{isEditing ? "EDYTUJ" : "NAPISZ"}<br /><em>MATERIAŁ.</em></h1><p>Zdjęcie wstawiasz dokładnie tam, gdzie stoi kursor. Kliknij obraz, aby zmienić jego układ lub go usunąć.</p><button className="preview-toggle" type="button" onClick={() => setPreview(value => !value)}>{preview ? "WRÓĆ DO EDYCJI" : "PODGLĄD MATERIAŁU →"}</button></section><section className="material-form"><label>TYTUŁ<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Co wydarzyło się w mieście?" maxLength={120} /></label><div className="material-row"><label>KATEGORIA<select value={category} onChange={event => setCategory(event.target.value)}><option>AKTUALNOŚCI</option><option>ULICE</option><option>SPORT</option><option>OPINIE</option><option>WYDARZENIA</option></select></label><label>ZDJĘCIE GŁÓWNE<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setCover(event.target.files?.[0] ?? null)} /><small>{cover ? cover.name : existingCover ? "Aktualne zdjęcie zostanie zachowane" : "JPG, PNG lub WEBP · maks. 8 MB"}</small></label></div><label>ZAJAWKA<input value={excerpt} onChange={event => setExcerpt(event.target.value)} placeholder="Krótki opis widoczny na stronie głównej…" maxLength={320} /></label><label>PEŁNA TREŚĆ<div className="material-editor"><div className="material-toolbar" role="toolbar" aria-label="Formatowanie"><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("undo")}>↶</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("redo")}>↷</button><span /><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("bold")}><b>B</b></button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("italic")}><i>I</i></button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("underline")}><u>U</u></button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("strikeThrough")}><s>S</s></button><span /><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "h2")}>NAGŁÓWEK</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "h3")}>ŚRÓDTYTUŁ</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "blockquote")}>CYTAT</button><span /><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("insertUnorderedList")}>• LISTA</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("insertOrderedList")}>1. LISTA</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={addLink}>LINK</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={insertVideo}>+ WIDEO</button><button type="button" onMouseDown={event => { event.preventDefault(); saveCaret(); }} onClick={() => inlineFile.current?.click()}>+ ZDJĘCIE</button></div>{selectedMedia && <div className="media-controls"><b>WYBRANE ZDJĘCIE</b><button type="button" onClick={() => updateMedia("wide")}>PEŁNA SZEROKOŚĆ</button><button type="button" onClick={() => updateMedia("left")}>LEWO</button><button type="button" onClick={() => updateMedia("right")}>PRAWO</button><button type="button" onClick={() => updateMedia("small")}>MAŁE</button><button type="button" className="delete-media" onClick={removeMedia}>USUŃ</button></div>}<div ref={canvas} className="material-canvas" contentEditable suppressContentEditableWarning data-placeholder="Napisz materiał. Ustaw kursor w miejscu, w którym ma pojawić się obraz." onInput={syncBody} onClick={selectMedia} onKeyUp={saveCaret} onMouseUp={saveCaret} onFocus={saveCaret} /></div></label><input ref={inlineFile} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={insertImage} /><div className="material-actions"><small>{message}</small><button type="button" disabled={busy} onClick={event => save(event, "draft")}>{busy ? "ZAPIS…" : "ZAPISZ SZKIC"}</button><button type="button" className="primary" disabled={busy} onClick={event => save(event, "published")}>{busy ? "PUBLIKACJA…" : isEditing ? "AKTUALIZUJ ↗" : "OPUBLIKUJ ↗"}</button></div></section></form>{preview && <div className="material-preview" role="dialog" aria-modal="true"><button className="preview-close" type="button" onClick={() => setPreview(false)}>× ZAMKNIJ</button><article><p className="kicker"><i /> {category} · PODGLĄD</p><h1>{title || "TYTUŁ MATERIAŁU"}</h1><p className="lead">{excerpt || "Tutaj będzie zajawka artykułu."}</p><section dangerouslySetInnerHTML={{ __html: previewBody }} /></article></div>}</main>;
}
