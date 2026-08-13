"use client";

import { ChangeEvent, ClipboardEvent, FormEvent, MouseEvent, useEffect, useMemo, useRef, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./material.css";

const EDITOR_EMAIL = "kujalowicze@gmail.com";

function cleanText(html: string) {
  return html.replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim();
}

function turnFreeTextIntoInputs(root: HTMLElement) {
  root.querySelectorAll<HTMLDivElement>("div.free-text").forEach(field => {
    field.contentEditable = "true";
    field.dataset.placeholder = field.dataset.placeholder || "Kliknij i pisz…";
    field.setAttribute("aria-label", "Pole tekstowe materiału");
    if (field.parentElement?.classList.contains("text-block")) {
      if (!field.parentElement.querySelector("[data-text-handle]")) {
        const handle = document.createElement("button");
        handle.type = "button"; handle.className = "text-handle"; handle.dataset.textHandle = "true"; handle.textContent = "⠿"; handle.title = "Złap i przesuń pole tekstowe";
        field.parentElement.prepend(handle);
      }
      return;
    }
    const block = document.createElement("div");
    block.className = "text-block";
    block.style.cssText = field.style.cssText;
    field.style.cssText = "";
    const handle = document.createElement("button");
    handle.type = "button"; handle.className = "text-handle"; handle.dataset.textHandle = "true"; handle.textContent = "⠿"; handle.title = "Złap i przesuń pole tekstowe";
    block.append(handle, field);
  });
}

function serializeCanvas(root: HTMLElement) {
  const copy = root.cloneNode(true) as HTMLElement;
  const rootBox = root.getBoundingClientRect();
  const sourceChildren = Array.from(root.children).filter(node => !(node as HTMLElement).dataset.pageSheet) as HTMLElement[];
  const copyChildren = Array.from(copy.children).filter(node => !(node as HTMLElement).dataset.pageSheet) as HTMLElement[];
  sourceChildren.forEach((source, index) => {
    const target = copyChildren[index] as HTMLElement | undefined;
    if (!target) return;
    // Normal paragraphs are document flow. Saving their pixel coordinates turns
    // a long article into a pile of overlapping absolutely positioned lines.
    // Only deliberately movable editor elements need coordinates.
    const isFreeElement = source.classList.contains("text-block") || source.matches("figure.inline-media,figure.inline-video");
    if (!isFreeElement) return;
    const box = source.getBoundingClientRect();
    target.dataset.readerX = String(Math.max(0, Math.round(box.left - rootBox.left)));
    const rawY = Math.max(0, Math.round(box.top - rootBox.top));
    // Editor sheets have a visible 28px gap. Persist the displayed position,
    // including that gap, so page two starts below page one in the reader.
    target.dataset.readerY = String(rawY + Math.floor(rawY / 980) * 28);
    target.dataset.readerWidth = String(Math.max(1, Math.round(box.width)));
    target.dataset.readerHeight = String(Math.max(1, Math.round(box.height)));
  });
  copy.dataset.canvasHeight = String(Math.max(980, Math.round(root.offsetHeight)));
  copy.dataset.pageCount = root.dataset.pages || "1";
  copy.querySelectorAll("[data-page-sheet]").forEach(sheet => sheet.remove());
  copy.querySelectorAll(".text-handle").forEach(handle => handle.remove());
  copy.querySelectorAll<HTMLElement>(".free-text").forEach(field => field.removeAttribute("contenteditable"));
  return `<div class="article-layout" data-canvas-height="${copy.dataset.canvasHeight}" data-page-count="${copy.dataset.pageCount}">${copy.innerHTML}</div>`;
}

export default function MaterialPage() {
  const [articleId, setArticleId] = useState(0); const [routeReady, setRouteReady] = useState(false); const isEditing = articleId > 0;
  const [allowed, setAllowed] = useState<boolean | null>(null); const [role, setRole] = useState<"editor_in_chief" | "deputy_editor_in_chief" | "journalist" | null>(null); const [currentEmail, setCurrentEmail] = useState(""); const [currentName, setCurrentName] = useState(""); const [articleAuthor, setArticleAuthor] = useState("");
  const [title, setTitle] = useState(""); const [excerpt, setExcerpt] = useState(""); const [category, setCategory] = useState("AKTUALNOŚCI"); const [socialTitle, setSocialTitle] = useState(""); const [socialDescription, setSocialDescription] = useState(""); const [socialImage, setSocialImage] = useState("");
  const [body, setBody] = useState(""); const [cover, setCover] = useState<File | null>(null); const [existingCover, setExistingCover] = useState<string | null>(null); const [coverPreview, setCoverPreview] = useState(""); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false); const [preview, setPreview] = useState(false); const [mobilePreview, setMobilePreview] = useState(false); const [loaded, setLoaded] = useState(false); const [selectedMedia, setSelectedMedia] = useState<HTMLElement | null>(null); const [mediaWidth, setMediaWidth] = useState(100); const [publishAt, setPublishAt] = useState(""); const [reviewStatus, setReviewStatus] = useState("draft"); const [articles, setArticles] = useState<Array<{ id: number; title: string; status: string; review_status?: string | null; updated_at: string }>>([]); const [versions, setVersions] = useState<Array<{ id:number; created_at:string; title:string }>>([]);
  const canvas = useRef<HTMLDivElement>(null); const inlineFile = useRef<HTMLInputElement>(null); const selectionRange = useRef<Range | null>(null); const draggedMedia = useRef<HTMLElement | null>(null); const pointerMove = useRef<((event: PointerEvent) => void) | null>(null); const bodyLoaded = useRef(false); const bodyRef = useRef(""); const activeTextField = useRef<HTMLElement | null>(null); const [editorDirty, setEditorDirty] = useState(0); const editTimer = useRef<number | null>(null);
  const client = () => getSupabase();

  const draftKey = `streetscope-material-draft-${isEditing ? articleId : "new"}`;
  const previewBody = useMemo(() => {
    if (!body || typeof document === "undefined") return body || "";
    const documentCopy = document.implementation.createHTMLDocument("preview");
    documentCopy.body.innerHTML = body;
    // Keep the authored layout. The preview must be a faithful reader version
    // of the canvas, not a separate column-based interpretation of it.
    documentCopy.querySelectorAll(".text-handle,.media-handle,[data-page-sheet]").forEach(node => node.remove());
    documentCopy.querySelectorAll<HTMLElement>(".free-text").forEach(node => {
      node.removeAttribute("contenteditable");
    });
    documentCopy.querySelectorAll<HTMLElement>("figure.inline-media,figure.inline-video").forEach(node => {
      // The canvas uses inline sizes and margins when an element was dragged.
      // Copy them to CSS variables so preview rules cannot accidentally reset
      // the placement to a full-width image.
      const style = node.style;
      style.setProperty("--reader-width", `${node.dataset.readerWidth || node.offsetWidth || 1}px`);
      if (style.marginLeft) style.setProperty("--reader-margin-left", style.marginLeft);
      if (style.marginRight) style.setProperty("--reader-margin-right", style.marginRight);
      if (style.marginTop) style.setProperty("--reader-margin-top", style.marginTop);
      if (style.marginBottom) style.setProperty("--reader-margin-bottom", style.marginBottom);
    });
    documentCopy.querySelectorAll<HTMLElement>("[data-reader-x]").forEach(node => {
      node.style.position = "absolute";
      node.style.left = `${node.dataset.readerX || "0"}px`;
      node.style.top = `${node.dataset.readerY || "0"}px`;
      node.style.width = `${node.dataset.readerWidth || "1"}px`;
      node.style.minHeight = `${node.dataset.readerHeight || "1"}px`;
      node.style.margin = "0";
    });
    // Compatibility for materials saved by the broken preview: restore normal
    // article flow for headings and paragraphs that accidentally got coordinates.
    documentCopy.querySelectorAll<HTMLElement>("p[data-reader-x],h2[data-reader-x],h3[data-reader-x],blockquote[data-reader-x],ul[data-reader-x],ol[data-reader-x]").forEach(node => {
      delete node.dataset.readerX; delete node.dataset.readerY; delete node.dataset.readerWidth; delete node.dataset.readerHeight;
      node.style.removeProperty("position"); node.style.removeProperty("left"); node.style.removeProperty("top"); node.style.removeProperty("width"); node.style.removeProperty("min-height"); node.style.removeProperty("margin");
    });
    documentCopy.querySelectorAll<HTMLElement>(".article-layout[data-canvas-height]").forEach(node => {
      node.style.minHeight = `${node.dataset.canvasHeight || "980"}px`;
    });
    return documentCopy.body.innerHTML;
  }, [body]);
  const hasPreviewContent = Boolean(cleanText(previewBody));
  const previewUsesCanvasLayout = /(?:class=(?:"[^"]*\btext-block\b|\'[^\']*\btext-block\b)|data-layout=(?:"free"|\'free\'))/i.test(previewBody);
  useEffect(() => { if (!cover) { setCoverPreview(existingCover || ""); return; } const url = URL.createObjectURL(cover); setCoverPreview(url); return () => URL.revokeObjectURL(url); }, [cover, existingCover]);
  useEffect(() => { const id = Number(new URLSearchParams(window.location.search).get("id")); setArticleId(Number.isFinite(id) && id > 0 ? id : 0); setRouteReady(true); }, []);
  async function loadQueue() { const { data } = await client().from("articles").select("id,title,status,review_status,updated_at").order("updated_at", { ascending: false }).limit(12); setArticles((data as Array<{ id: number; title: string; status: string; review_status?: string | null; updated_at: string }> | null) ?? []); }
  useEffect(() => { if (!routeReady) return; client().auth.getUser().then(async ({ data }) => { const email = data.user?.email?.toLowerCase() || ""; let nextRole:"editor_in_chief"|"deputy_editor_in_chief"|"journalist"|null = null; let nextName=""; if (email) { const {data:staff}=await client().from("staff_accounts").select("active,role,display_name,first_name,last_name").eq("email",email).maybeSingle(); if (staff?.active) { nextRole=staff.role; nextName=[staff.first_name,staff.last_name].filter(Boolean).join(" ")||staff.display_name||""; } } setCurrentEmail(email); setCurrentName(nextName); setRole(nextRole); setAllowed(Boolean(nextRole)); if (!nextRole) { setLoaded(true); return; } await loadQueue(); if (!isEditing) { setLoaded(true); return; } const { data: article } = await client().from("articles").select("title,excerpt,category,body,image_url,social_title,social_description,social_image,published_at,review_status,author_email").eq("id", articleId).single(); if (!article) { setMessage("Nie znaleziono materiału albo nie masz do niego dostępu."); setLoaded(true); return; } setTitle(article.title); setExcerpt(article.excerpt); setCategory(article.category); setBody(article.body || ""); setExistingCover(article.image_url); setSocialTitle(article.social_title || ""); setSocialDescription(article.social_description || ""); setSocialImage(article.social_image || ""); setPublishAt(article.published_at ? new Date(article.published_at).toISOString().slice(0, 16) : ""); setReviewStatus(article.review_status || "draft"); setArticleAuthor(article.author_email || email); setLoaded(true); }); }, [routeReady, articleId]);
  useEffect(() => { const root = canvas.current; if (!root) return; if (!bodyLoaded.current) { const normalized = body.replace(/\sclass=(['"])\1/g, "").replace(/\sclass=(['"])is-selected\1/g, "").replace(/\sclass=(['"])inline-media is-selected\1/g, ' class="inline-media"'); const holder = document.createElement("div"); holder.innerHTML = normalized; const savedCanvas = holder.querySelector<HTMLElement>(":scope > .article-layout[data-canvas-height]"); if (savedCanvas) { root.innerHTML = savedCanvas.innerHTML; root.dataset.pages = savedCanvas.dataset.pageCount || "1"; const savedHeight = Number(savedCanvas.dataset.canvasHeight); if (Number.isFinite(savedHeight) && savedHeight > 0) { root.style.height = `${savedHeight}px`; root.style.minHeight = `${savedHeight}px`; } } else { root.innerHTML = normalized; } turnFreeTextIntoInputs(root); bodyRef.current = normalized; bodyLoaded.current = true; } root.contentEditable = "false"; root.querySelectorAll("p,h2,h3,blockquote,figcaption").forEach(node => { (node as HTMLElement).contentEditable = "true"; }); window.requestAnimationFrame(() => fitCanvasPages()); }, [body]);
  useEffect(() => { const root = canvas.current; if (!root) return; root.querySelectorAll("figure.inline-media").forEach(figure => { if (figure.querySelector("[data-media-handle]")) return; const handle = document.createElement("span"); handle.className = "media-handle"; handle.contentEditable = "false"; handle.draggable = false; handle.dataset.mediaHandle = "true"; handle.setAttribute("role", "button"); handle.setAttribute("aria-label", "Złap i przeciągnij zdjęcie"); handle.title = "Złap i przeciągnij zdjęcie"; handle.textContent = "⠿"; figure.prepend(handle); }); }, [body, selectedMedia]);
  useEffect(() => {
    const installControls = () => {
    const toolbar = document.querySelector(".material-toolbar");
    if (!toolbar || toolbar.parentElement?.querySelector("[data-text-styles]")) return;
    const wrap = document.createElement("div"); wrap.className = "text-style-controls"; wrap.dataset.textStyles = "true"; wrap.contentEditable = "false";
    const font = document.createElement("select"); font.className = "editor-select"; font.setAttribute("aria-label", "Czcionka"); font.innerHTML = '<option value="">CZCIONKA</option><option value="Arial, sans-serif">ARIAL</option><option value="Georgia, serif">GEORGIA</option><option value="Courier New, monospace">COURIER MONO</option><option value="Impact, sans-serif">IMPACT</option><option value="Trebuchet MS, sans-serif">TREBUCHET</option><option value="Barlow Condensed, sans-serif">BARLOW</option>';
    const size = document.createElement("input"); size.type = "range"; size.className = "editor-pixel-size"; size.min = "1"; size.max = "100"; size.value = "22"; size.setAttribute("aria-label", "Rozmiar czcionki od 1 do 100 pikseli");
    const sizeValue = document.createElement("output"); sizeValue.className = "editor-pixel-value"; sizeValue.textContent = "22 PX";
    const colorLabel = document.createElement("label"); colorLabel.className = "editor-color"; colorLabel.textContent = "KOLOR"; const color = document.createElement("input"); color.type = "color"; color.value = "#111111"; color.setAttribute("aria-label", "Kolor zaznaczonego tekstu"); colorLabel.append(color);
    font.addEventListener("change", () => { if (font.value) setFont(font.value); }); size.addEventListener("input", () => { sizeValue.textContent = `${size.value} PX`; setTextPixelSize(Number(size.value)); }); color.addEventListener("change", () => setTextColor(color.value));
    const addText = document.createElement("button"); addText.type = "button"; addText.textContent = "+ POLE TEKSTU"; addText.addEventListener("mousedown", event => event.preventDefault()); addText.addEventListener("click", addTextBlock);
    const removeText = document.createElement("button"); removeText.type = "button"; removeText.textContent = "USUŃ POLE"; removeText.className = "delete-media"; removeText.addEventListener("mousedown", event => event.preventDefault()); removeText.addEventListener("click", removeActiveTextBlock);
    wrap.append(font, size, sizeValue, colorLabel, addText, removeText); toolbar.parentElement?.append(wrap);
    };
    const frame = window.requestAnimationFrame(installControls); const timer = window.setTimeout(installControls, 250);
    return () => { window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  });
  useEffect(() => {
    const root = canvas.current; if (!root) return;
    const rememberField = (event: FocusEvent) => { const field = (event.target as HTMLElement).closest(".free-text,p,h2,h3,blockquote,figcaption") as HTMLElement | null; if (field && root.contains(field)) activeTextField.current = field; };
    root.addEventListener("focusin", rememberField);
    return () => root.removeEventListener("focusin", rememberField);
  }, [loaded]);
  useEffect(() => {
    const overlay = document.querySelector<HTMLElement>(".material-preview");
    if (!overlay) return;
    const article = overlay.querySelector<HTMLElement>("article");
    if (!article || overlay.querySelector("[data-preview-panel]")) return;

    const panel = document.createElement("div");
    panel.className = "preview-panel";
    panel.dataset.previewPanel = "true";
    panel.innerHTML = '<span class="preview-panel-label">PODGLĄD NA ŻYWO</span><div class="preview-panel-actions"><button type="button" data-preview-wide>↔ KOMPUTER</button><button type="button" data-preview-phone>▯ TELEFON</button><button type="button" data-preview-close>× WRÓĆ DO EDYCJI</button></div>';
    const close = () => { setPreview(false); setMobilePreview(false); };
    panel.querySelector<HTMLButtonElement>("[data-preview-wide]")?.addEventListener("click", () => overlay.classList.remove("preview-phone-mode"));
    panel.querySelector<HTMLButtonElement>("[data-preview-phone]")?.addEventListener("click", () => overlay.classList.add("preview-phone-mode"));
    panel.querySelector<HTMLButtonElement>("[data-preview-close]")?.addEventListener("click", close);
    overlay.prepend(panel);
    return () => panel.remove();
  }, [preview, mobilePreview]);
  useEffect(() => {
    const root = canvas.current; if (!root) return;
    const stopLabelActivation = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      event.preventDefault();
    };
    const stopLabelMouseDown = (event: globalThis.MouseEvent) => {
      const target = event.target as HTMLElement;
      if (target.closest(".free-text,figure.inline-media,figure.inline-video,figcaption,button,input,select,a")) return;
      event.preventDefault();
    };
    root.addEventListener("mousedown", stopLabelMouseDown, true);
    root.addEventListener("click", stopLabelActivation);
    return () => { root.removeEventListener("mousedown", stopLabelMouseDown, true); root.removeEventListener("click", stopLabelActivation); };
  }, [loaded]);
  useEffect(() => { if (!allowed || !loaded) return; const timer = window.setTimeout(() => { const currentBody = bodyRef.current || body; const content = { title, excerpt, category, body: currentBody, socialTitle, socialDescription, socialImage, savedAt: new Date().toISOString() }; if (title || excerpt || currentBody) { localStorage.setItem(draftKey, JSON.stringify(content)); setMessage("Szkic zapisany automatycznie."); } }, 900); return () => window.clearTimeout(timer); }, [title, excerpt, category, body, socialTitle, socialDescription, socialImage, allowed, loaded, editorDirty]);
  useEffect(() => { if (!allowed || !loaded || isEditing) return; const raw = localStorage.getItem(draftKey); if (!raw) return; try { const saved = JSON.parse(raw); if ((saved.title || saved.body) && window.confirm("Przywrócić automatycznie zapisany szkic?")) { setTitle(saved.title || ""); setExcerpt(saved.excerpt || ""); setCategory(saved.category || "AKTUALNOŚCI"); setBody(saved.body || ""); setSocialTitle(saved.socialTitle || ""); setSocialDescription(saved.socialDescription || ""); setSocialImage(saved.socialImage || ""); } } catch {} }, [allowed, loaded]);
  useEffect(() => {
    if (!loaded || role !== "journalist") return;
    const button = document.querySelector<HTMLButtonElement>(".material-actions .primary");
    if (!button) return;
    const original = button.textContent;
    button.textContent = "WYŚLIJ DO AKCEPTACJI →";
    const submitForReview = (event: globalThis.MouseEvent) => { event.preventDefault(); event.stopImmediatePropagation(); save(event as unknown as FormEvent, "review"); };
    button.addEventListener("click", submitForReview, true);
    return () => { button.removeEventListener("click", submitForReview, true); button.textContent = original; };
  });

  function fitCanvasPages() {
    const root = canvas.current;
    if (!root) return;
    const pageHeight = 980;
    const pageGap = 28;
    root.querySelectorAll("[data-page-sheet]").forEach(sheet => sheet.remove());
    const bottom = Array.from(root.children).reduce((max, node) => {
      const element = node as HTMLElement;
      return Math.max(max, element.offsetTop + element.offsetHeight);
    }, 0);
    const pages = Math.max(1, Math.ceil((bottom + 140) / pageHeight));
    const totalHeight = pages * pageHeight + (pages - 1) * pageGap;
    // The sheets are absolutely positioned, so they do not normally add to the
    // document flow.  Set a real height as well as min-height: this keeps every
    // control below the canvas (save/publish and text controls) underneath the
    // final sheet instead of halfway through the last virtual page.
    root.style.height = `${totalHeight}px`;
    root.style.minHeight = `${totalHeight}px`;
    root.dataset.pages = String(pages);
    for (let index = 0; index < pages; index += 1) {
      const sheet = document.createElement("div");
      sheet.dataset.pageSheet = "true";
      sheet.className = "material-page-sheet";
      sheet.style.top = `${index * (pageHeight + pageGap)}px`;
      sheet.style.height = `${pageHeight}px`;
      sheet.innerHTML = `<span>STRONA ${index + 1}</span>`;
      root.prepend(sheet);
    }
  }
  function syncBody() { const root = canvas.current; if (!root) { bodyRef.current = ""; return; } fitCanvasPages(); root.querySelectorAll(".is-selected,.is-dragging,.drop-before,.drop-after").forEach(node => node.classList.remove("is-selected", "is-dragging", "drop-before", "drop-after")); bodyRef.current = serializeCanvas(root); if (editTimer.current) window.clearTimeout(editTimer.current); editTimer.current = window.setTimeout(() => { setBody(bodyRef.current); setEditorDirty(value => value + 1); }, 650); }
  function commitBodyForPreview() { const html = canvas.current ? serializeCanvas(canvas.current) : bodyRef.current; bodyRef.current = html; setBody(html); }
  function togglePreview() { if (!preview) commitBodyForPreview(); setPreview(value => !value); }
  function toggleMobilePreview() { if (!mobilePreview) commitBodyForPreview(); setMobilePreview(value => !value); }
  function pastePlainText(event: ClipboardEvent<HTMLDivElement>) {
    if ((event.target as HTMLElement).closest(".free-text")) return;
    const text = event.clipboardData.getData("text/plain");
    if (!text) return;
    event.preventDefault();
    const selection = window.getSelection();
    const range = selection?.rangeCount ? selection.getRangeAt(0) : null;
    if (!range) return;
    range.deleteContents();
    const fragment = document.createDocumentFragment();
    const lines = text.replace(/\r\n?/g, "\n").split("\n");
    lines.forEach((line, index) => { if (index) fragment.append(document.createElement("br")); fragment.append(document.createTextNode(line)); });
    range.insertNode(fragment);
    range.collapse(false);
    selection?.removeAllRanges(); selection?.addRange(range);
    saveCaret(); syncBody();
  }
  function saveCaret() { const selection = window.getSelection(); if (selection?.rangeCount) selectionRange.current = selection.getRangeAt(0).cloneRange(); }
  function restoreCaret() { const selection = window.getSelection(); if (selectionRange.current && selection) { selection.removeAllRanges(); selection.addRange(selectionRange.current); } }
  function hasSelectedText() { const selection = window.getSelection(); return Boolean(selection?.rangeCount && !selection.getRangeAt(0).collapsed && selection.toString().trim()); }
  function restoreAndHasSelectedText() { restoreCaret(); return hasSelectedText(); }
  function command(name: string, value?: string) { restoreCaret(); document.execCommand(name, false, value); saveCaret(); syncBody(); }
  function setFont(font: string) { const field = activeTextField.current; if (restoreAndHasSelectedText() && font !== "default") { document.execCommand("fontName", false, font); saveCaret(); syncBody(); return; } if (field && font) { field.style.fontFamily = font; syncBody(); return; } if (font !== "default") command("fontName", font); }
  function setFontSize(size: string) { if (size !== "default") command("fontSize", size); }
  function setTextPixelSize(size: number) {
    const field = activeTextField.current; const fixed = Math.max(1, Math.min(100, size)); const root = canvas.current; const selection = window.getSelection(); if (!root || !selection) return; restoreCaret(); if (!selection.rangeCount) return; const range = selection.getRangeAt(0); const selected = !range.collapsed && selection.toString().trim().length > 0;
    if (field && !selected) { field.style.setProperty("font-size", `${fixed}px`, "important"); field.style.setProperty("line-height", "1.35", "important"); syncBody(); return; }
    const common = range.commonAncestorContainer instanceof HTMLElement ? range.commonAncestorContainer : range.commonAncestorContainer.parentElement;
    if (!selected || !common?.closest(".free-text")) return;
    const fragment = range.extractContents(); const span = document.createElement("span"); span.style.setProperty("font-size", `${fixed}px`, "important"); span.style.setProperty("line-height", "inherit", "important"); span.style.display = "inline"; span.style.verticalAlign = "baseline"; span.append(fragment); range.insertNode(span);
    const next = document.createRange(); next.selectNodeContents(span); selection.removeAllRanges(); selection.addRange(next); saveCaret(); syncBody();
  }
  function setTextColor(color: string) { const field = activeTextField.current; if (restoreAndHasSelectedText()) { document.execCommand("foreColor", false, color); saveCaret(); syncBody(); return; } if (field) { field.style.color = color; syncBody(); return; } command("foreColor", color); }
  function addLink() { const link = window.prompt("Wklej adres linku:"); if (link) command("createLink", link); }
  function youtubeEmbedUrl(url: string) { try { const parsed = new URL(url); const id = parsed.hostname.includes("youtu.be") ? parsed.pathname.slice(1) : parsed.searchParams.get("v") || parsed.pathname.split("/").filter(Boolean).pop(); return id ? `https://www.youtube-nocookie.com/embed/${id.replace(/[^a-zA-Z0-9_-]/g, "")}` : null; } catch { return null; } }
  function insertVideo() {
    const source = window.prompt("Wklej link YouTube albo bezpośredni adres filmu MP4:"); if (!source || !canvas.current) return;
    canvas.current.focus(); restoreCaret(); const selection = window.getSelection(); const range = selection?.rangeCount ? selection.getRangeAt(0) : null; const figure = document.createElement("figure"); figure.className = "inline-video"; const embed = youtubeEmbedUrl(source);
    if (embed) { const iframe = document.createElement("iframe"); iframe.src = embed; iframe.title = "Wideo w materiale"; iframe.allowFullscreen = true; iframe.setAttribute("allow", "accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"); figure.append(iframe); } else if (/\.(mp4|webm|ogg)(\?.*)?$/i.test(source)) { const video = document.createElement("video"); video.src = source; video.controls = true; video.preload = "metadata"; figure.append(video); } else { setMessage("Użyj linku YouTube lub bezpośredniego adresu pliku MP4, WEBM albo OGG."); return; }
    const caption = document.createElement("figcaption"); caption.contentEditable = "true"; caption.dataset.placeholder = "Dodaj podpis filmu…"; figure.append(caption); if (range) { range.deleteContents(); range.insertNode(figure); const after = document.createRange(); after.setStartAfter(figure); after.collapse(true); selection?.removeAllRanges(); selection?.addRange(after); } else canvas.current.append(figure); saveCaret(); syncBody();
  }
  function selectMedia(event: MouseEvent<HTMLDivElement>) { const target = event.target as HTMLElement; const media = target.closest("figure.inline-media") as HTMLElement | null; if (!media) return; canvas.current?.querySelectorAll("figure.inline-media.is-selected").forEach(item => item.classList.remove("is-selected")); media.classList.add("is-selected"); setSelectedMedia(media); setMediaWidth(Number.parseInt(media.dataset.width || "100", 10) || 100); }
  function clearMediaSelection(event: React.PointerEvent<HTMLDivElement>) { const target = event.target as HTMLElement; if (target.closest("figure.inline-media")) return; canvas.current?.querySelectorAll("figure.inline-media.is-selected").forEach(item => item.classList.remove("is-selected")); setSelectedMedia(null); }
  function addTextBlock() {
    const root = canvas.current;
    if (!root) return;
    const box = root.getBoundingClientRect(); const block = document.createElement("div"); block.className = "text-block"; block.style.left = `${Math.max(18, Math.min(box.width - 260, 40))}px`; block.style.top = `${Math.max(18, root.scrollTop + 40)}px`; const handle = document.createElement("button"); handle.type = "button"; handle.className = "text-handle"; handle.dataset.textHandle = "true"; handle.textContent = "⠿"; handle.title = "Złap i przesuń pole tekstowe"; const text = document.createElement("div"); text.className = "free-text"; text.dataset.placeholder = "Kliknij i pisz…"; text.contentEditable = "true"; text.setAttribute("aria-label", "Pole tekstowe materiału"); text.style.fontFamily = "Arial, sans-serif"; text.style.fontSize = "16px"; text.style.lineHeight = "1.35"; block.append(handle, text); root.append(block); fitCanvasPages();
    activeTextField.current = text;
    text.focus({ preventScroll: true }); syncBody();
  }
  function removeActiveTextBlock() { const field = activeTextField.current; const block = field?.closest(".text-block"); if (!block) { setMessage("Kliknij najpierw pole tekstowe, które chcesz usunąć."); return; } if (!window.confirm("Usunąć to pole tekstowe?")) return; block.remove(); activeTextField.current = null; syncBody(); }
  function dragStart(event: React.DragEvent<HTMLDivElement>) { event.preventDefault(); }
  function dragEnd() { canvas.current?.querySelectorAll(".is-dragging,.drop-before,.drop-after").forEach(node => node.classList.remove("is-dragging", "drop-before", "drop-after")); draggedMedia.current = null; }
  function blockAtPoint(x: number, y: number) { const root = canvas.current; if (!root) return null; const pointed = document.elementFromPoint(x, y) as HTMLElement | null; const direct = pointed?.closest("p,h2,h3,blockquote,figure.inline-media,figure.inline-video") as HTMLElement | null; if (direct && root.contains(direct)) return direct; const legacy = (document as Document & { caretRangeFromPoint?: (x: number, y: number) => Range | null }).caretRangeFromPoint?.(x, y); const modern = document.caretPositionFromPoint?.(x, y); const node = legacy?.startContainer ?? modern?.offsetNode ?? null; const element = node instanceof Element ? node : node?.parentElement; const fromCaret = element?.closest("p,h2,h3,blockquote,figure.inline-media,figure.inline-video") as HTMLElement | null; return fromCaret && root.contains(fromCaret) ? fromCaret : null; }
  function dragOver(event: React.DragEvent<HTMLDivElement>) { event.preventDefault(); }
  function dropMedia(event: React.DragEvent<HTMLDivElement>) { event.preventDefault(); }
  function moveAt(x: number, y: number) { const root = canvas.current; const dragged = draggedMedia.current; if (!root || !dragged) return; root.querySelectorAll(".drop-before,.drop-after").forEach(node => node.classList.remove("drop-before", "drop-after")); const destination = blockAtPoint(x, y); if (destination && destination !== dragged) { const box = destination.getBoundingClientRect(); destination.classList.add(y < box.top + box.height / 2 ? "drop-before" : "drop-after"); return; } const rootBox = root.getBoundingClientRect(); root.classList.add("free-drop-active"); root.style.setProperty("--drop-x", `${Math.max(0, Math.min(rootBox.width - 34, x - rootBox.left))}px`); root.style.setProperty("--drop-y", `${Math.max(0, y - rootBox.top)}px`); }
  function startPointerMove(event: React.PointerEvent<HTMLDivElement>) { const target = event.target as HTMLElement; const textHandle = target.closest("[data-text-handle]") as HTMLElement | null; if (textHandle) { const block = textHandle.closest(".text-block") as HTMLElement | null; const root = canvas.current; if (!block || !root) return; event.preventDefault(); event.stopPropagation(); const startX = event.clientX; const startY = event.clientY; const originalLeft = Number.parseFloat(block.style.left || "0"); const originalTop = Number.parseFloat(block.style.top || "0"); const moveText = (pointer: PointerEvent) => { const bounds = root.getBoundingClientRect(); const maxLeft = Math.max(0, bounds.width - block.offsetWidth); block.style.left = `${Math.max(0, Math.min(maxLeft, originalLeft + pointer.clientX - startX))}px`; block.style.top = `${Math.max(0, originalTop + pointer.clientY - startY)}px`; fitCanvasPages(); }; const endText = () => { syncBody(); window.removeEventListener("pointermove", moveText); }; window.addEventListener("pointermove", moveText); window.addEventListener("pointerup", endText, { once: true }); return; } if (!target.closest("[data-media-handle]")) return; const media = target.closest("figure.inline-media") as HTMLElement | null; if (!media) return; event.preventDefault(); event.stopPropagation(); draggedMedia.current = media; media.classList.add("is-dragging"); const move = (pointer: PointerEvent) => moveAt(pointer.clientX, pointer.clientY); const end = (pointer: PointerEvent) => { const root = canvas.current; const dragged = draggedMedia.current; if (root && dragged) { const destination = blockAtPoint(pointer.clientX, pointer.clientY); if (destination && destination !== dragged) { const box = destination.getBoundingClientRect(); root.insertBefore(dragged, pointer.clientY < box.top + box.height / 2 ? destination : destination.nextSibling); dragged.style.removeProperty("margin-top"); dragged.style.removeProperty("margin-left"); } else { const rootBox = root.getBoundingClientRect(); const currentBox = dragged.getBoundingClientRect(); const maxLeft = Math.max(0, rootBox.width - currentBox.width - 24); const left = Math.max(0, Math.min(maxLeft, pointer.clientX - rootBox.left - currentBox.width / 2)); const targetTop = Math.max(0, pointer.clientY - rootBox.top - 22); const ownTop = Math.max(0, currentBox.top - rootBox.top); const extraTop = Math.max(0, targetTop - ownTop); dragged.style.marginLeft = `${Math.round(left)}px`; dragged.style.marginTop = `${Math.round(28 + extraTop)}px`; dragged.style.marginRight = "0"; dragged.dataset.layout = "free"; } root.classList.remove("free-drop-active"); root.style.removeProperty("--drop-x"); root.style.removeProperty("--drop-y"); fitCanvasPages(); bodyRef.current = serializeCanvas(root); setSelectedMedia(dragged); } dragEnd(); window.removeEventListener("pointermove", move); window.removeEventListener("pointerup", end); }; pointerMove.current = move; window.addEventListener("pointermove", move); window.addEventListener("pointerup", end, { once: true }); }
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
  function updateMediaWidth(width: number) { const media = (selectedMedia && canvas.current?.contains(selectedMedia) ? selectedMedia : canvas.current?.querySelector("figure.inline-media.is-selected")) as HTMLElement | null; if (!media) { setMessage("Najpierw kliknij zdjęcie, które chcesz zmienić."); return; } const limited = Math.min(100, Math.max(25, width)); media.dataset.width = String(limited); media.style.setProperty("width", `${limited}%`, "important"); media.style.setProperty("max-width", `${limited}%`, "important"); setSelectedMedia(media); setMediaWidth(limited); setBody(canvas.current?.innerHTML ?? ""); }
  function updateAltText() { if (!selectedMedia) return; const image = selectedMedia.querySelector("img"); if (!image) return; const next = window.prompt("Opis ALT zdjęcia (dla dostępności):", image.alt || ""); if (next !== null) { image.alt = next.trim() || "Zdjęcie w materiale"; syncBody(); } }
  function moveMedia(direction: "up" | "down") { if (!selectedMedia) return; const sibling = direction === "up" ? selectedMedia.previousElementSibling : selectedMedia.nextElementSibling; if (sibling) { if (direction === "up") selectedMedia.parentElement?.insertBefore(selectedMedia, sibling); else selectedMedia.parentElement?.insertBefore(sibling, selectedMedia); syncBody(); } }
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
      const figure = document.createElement("figure"); figure.className = "inline-media"; figure.draggable = false; figure.dataset.width = "100"; figure.style.width = "100%";
      const handle = document.createElement("span"); handle.className = "media-handle"; handle.contentEditable = "false"; handle.draggable = false; handle.dataset.mediaHandle = "true"; handle.setAttribute("role", "button"); handle.setAttribute("aria-label", "Złap i przeciągnij zdjęcie"); handle.title = "Złap i przeciągnij zdjęcie"; handle.textContent = "⠿";
      const image = document.createElement("img"); image.src = url; image.alt = "Zdjęcie w materiale";
      const caption = document.createElement("figcaption"); caption.contentEditable = "true"; caption.dataset.placeholder = "Dodaj podpis zdjęcia…";
      figure.append(handle, image, caption);
      if (range) { range.deleteContents(); range.insertNode(figure); const after = document.createRange(); after.setStartAfter(figure); after.collapse(true); selection?.removeAllRanges(); selection?.addRange(after); } else canvas.current?.append(figure);
      saveCaret(); syncBody();
    } catch { setMessage("Nie udało się przesłać zdjęcia do treści."); } finally { event.target.value = ""; }
  }
  async function save(event: FormEvent, action: "draft" | "review" | "published") {
    event.preventDefault(); const currentBody = canvas.current ? serializeCanvas(canvas.current) : bodyRef.current; bodyRef.current = currentBody; const text = cleanText(currentBody);
    if (title.trim().length < 6 || excerpt.trim().length < 30 || text.length < 80) { setMessage("Tytuł, zajawka i treść muszą być uzupełnione."); return; }
    if (action === "published" && !["editor_in_chief","deputy_editor_in_chief"].includes(role || "")) { setMessage("Materiał może opublikować tylko Redaktor Naczelny albo jego Zastępca."); return; }
    setBusy(true); setMessage("");
    try {
      const image_url = cover ? await upload(cover) : null;
      const planned = publishAt ? new Date(publishAt).toISOString() : null;
      const status = action === "published" ? "published" : "draft";
      const nextReviewStatus = action === "published" ? "published" : action === "review" ? "review" : reviewStatus === "changes_requested" ? "changes_requested" : "draft";
      const payload = { title: title.trim(), excerpt: excerpt.trim(), category, body: currentBody, image_url: image_url || existingCover, gallery: [], social_title: socialTitle.trim() || null, social_description: socialDescription.trim() || null, social_image: socialImage.trim() || null, status, review_status: nextReviewStatus, author_email: articleAuthor || currentEmail, author_name: currentName || currentEmail.split("@")[0], author_role: role === "editor_in_chief" ? "REDAKTOR NACZELNY" : role === "deputy_editor_in_chief" ? "ZASTĘPCA REDAKTORA NACZELNEGO" : "DZIENNIKARZ", published_at: status === "published" ? (planned || new Date().toISOString()) : null, updated_at: new Date().toISOString() };
      const result = isEditing ? await client().from("articles").update(payload).eq("id", articleId).select("id").single() : await client().from("articles").insert(payload).select("id").single(); const { error } = result;
      if (error) throw error;
      if (result.data?.id) await client().from("article_versions").insert({ article_id: result.data.id, title: payload.title, excerpt: payload.excerpt, body: payload.body, image_url: payload.image_url, created_by: currentEmail });
      localStorage.removeItem(draftKey); if (!isEditing) { setTitle(""); setExcerpt(""); setBody(""); bodyRef.current = ""; setCover(null); if (canvas.current) canvas.current.innerHTML = ""; }
      setMessage(status === "published" ? (planned && new Date(planned).getTime() > Date.now() ? "Materiał zaplanowany." : isEditing ? "Materiał zaktualizowany." : "Materiał opublikowany.") : nextReviewStatus === "review" ? "Materiał przekazany do akceptacji." : "Szkic zapisany."); await loadQueue();
    } catch { setMessage("Nie udało się zapisać materiału. Sprawdź bucket article-images w Supabase."); } finally { setBusy(false); }
  }
  async function showVersions() { if (!isEditing) { setMessage("Historia pojawi się po pierwszym zapisie materiału."); return; } const { data } = await client().from("article_versions").select("id,created_at,title").eq("article_id", articleId).order("created_at", { ascending:false }).limit(10); setVersions((data as Array<{ id:number; created_at:string; title:string }> | null) ?? []); }
  const canManageArticles = ["editor_in_chief", "deputy_editor_in_chief"].includes(role || "");
  async function deleteArticle(id: number, articleTitle: string) {
    if (!canManageArticles) { setMessage("Tylko Redaktor Naczelny albo Zastępca może usuwać materiały."); return; }
    if (!window.confirm(`Usunąć materiał „${articleTitle}”? Tej operacji nie da się cofnąć.`)) return;
    setBusy(true);
    const { error } = await client().from("articles").delete().eq("id", id);
    setBusy(false);
    if (error) { setMessage(error.message); return; }
    setMessage("Materiał został usunięty.");
    if (id === articleId) { window.location.href = "/redakcja/material"; return; }
    await loadQueue();
  }
  useEffect(() => {
    if (!canManageArticles) return;
    const queue = document.querySelector<HTMLElement>(".material-queue");
    if (!queue) return;
    const cleanup: HTMLButtonElement[] = [];
    queue.querySelectorAll<HTMLAnchorElement>('a[href*="/redakcja/material?id="]').forEach(link => {
      if (link.querySelector("[data-delete-article]")) return;
      const id = Number(new URL(link.href).searchParams.get("id"));
      const title = link.querySelector("b")?.textContent?.trim() || "ten materiał";
      if (!Number.isInteger(id) || id < 1) return;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "article-delete";
      button.dataset.deleteArticle = "true";
      button.textContent = "USUŃ";
      button.title = "Usuń materiał";
      button.addEventListener("click", event => { event.preventDefault(); event.stopPropagation(); deleteArticle(id, title); });
      link.append(button);
      cleanup.push(button);
    });
    return () => cleanup.forEach(button => button.remove());
  }, [articles, canManageArticles]);

  if (allowed === null || !loaded) return <main className="material-page"><p>ŁADOWANIE…</p></main>;
  if (!allowed) return <main className="material-page"><a className="wordmark" href="/">STREET<span>SCOPE</span></a><h1>DOSTĘP<br /><em>ZAMKNIĘTY.</em></h1><a className="material-action" href="/redakcja">ZALOGUJ SIĘ →</a></main>;
  const previewClass = `article-rich${previewUsesCanvasLayout ? " article-layout" : ""}`;
  return <main className="material-page"><header><a href="/" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/redakcja/material">NOWY</a><a href="/redakcja/zarzadzaj">ZARZĄDZAJ</a><a href="/redakcja/statystyki">STATYSTYKI</a></nav></header><form className="material-layout"><section className="material-intro"><p className="kicker"><i /> {isEditing ? "EDYCJA MATERIAŁU" : "EDYTOR REDAKCYJNY"}</p><h1>{isEditing ? "EDYTUJ" : "NAPISZ"}<br /><em>MATERIAŁ.</em></h1><p>Zdjęcie wstawiasz dokładnie tam, gdzie stoi kursor. Złap czerwony uchwyt ⠿ w lewym górnym rogu zdjęcia, a następnie upuść je między akapitami.</p><button className="preview-toggle" type="button" onClick={() => { commitBodyForPreview(); setPreview(true); }}>PODGLĄD MATERIAŁU →</button><button className="preview-toggle" type="button" onClick={() => { commitBodyForPreview(); setMobilePreview(true); }}>PODGLĄD TELEFONU →</button><button className="preview-toggle" type="button" onClick={showVersions}>HISTORIA ZMIAN →</button></section><section className="material-form"><label>TYTUŁ<input value={title} onChange={event => setTitle(event.target.value)} placeholder="Co wydarzyło się w mieście?" maxLength={120} /></label><div className="material-row"><label>KATEGORIA<select value={category} onChange={event => setCategory(event.target.value)}><option>AKTUALNOŚCI</option><option>ULICE</option><option>SPORT</option><option>OPINIE</option><option>WYDARZENIA</option></select></label><label>ZDJĘCIE GŁÓWNE<input type="file" accept="image/jpeg,image/png,image/webp" onChange={event => setCover(event.target.files?.[0] ?? null)} /><small>{cover ? cover.name : existingCover ? "Aktualne zdjęcie zostanie zachowane" : "JPG, PNG lub WEBP · maks. 8 MB"}</small></label></div><label>ZAJAWKA<input value={excerpt} onChange={event => setExcerpt(event.target.value)} placeholder="Krótki opis widoczny na stronie głównej…" maxLength={320} /></label><div className="material-row"><label>STATUS REDAKCYJNY<select value={reviewStatus} onChange={event => setReviewStatus(event.target.value)}><option value="draft">SZKIC</option><option value="review">DO AKCEPTACJI</option></select></label><label>TERMIN PUBLIKACJI<input type="datetime-local" value={publishAt} onChange={event => setPublishAt(event.target.value)} /><small>Puste = publikacja od razu</small></label></div><details className="social-settings"><summary>USTAWIENIA PODGLĄDU LINKU — DISCORD / SOCIALE</summary><p>Opcjonalne. Puste pola użyją tytułu, zajawki i zdjęcia głównego artykułu.</p><label>TYTUŁ PODGLĄDU<input value={socialTitle} onChange={event => setSocialTitle(event.target.value)} placeholder="Domyślnie: tytuł artykułu" maxLength={110} /></label><label>OPIS PODGLĄDU<textarea value={socialDescription} onChange={event => setSocialDescription(event.target.value)} placeholder="Domyślnie: zajawka artykułu" maxLength={260} /></label><label>OBRAZ PODGLĄDU — LINK<input value={socialImage} onChange={event => setSocialImage(event.target.value)} type="url" placeholder="Domyślnie: zdjęcie główne" /></label></details><label>PEŁNA TREŚĆ<div className="material-editor"><div className="material-toolbar" role="toolbar" aria-label="Formatowanie"><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("undo")}>↶</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("redo")}>↷</button><span /><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("bold")}><b>B</b></button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("italic")}><i>I</i></button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("underline")}><u>U</u></button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("strikeThrough")}><s>S</s></button><span /><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "h2")}>NAGŁÓWEK</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "h3")}>ŚRÓDTYTUŁ</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("formatBlock", "blockquote")}>CYTAT</button><span /><button type="button" onMouseDown={event => event.preventDefault()} onClick={() => command("insertUnorderedList")}>• LISTA</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={addLink}>LINK</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={insertVideo}>+ WIDEO</button><button type="button" onMouseDown={event => event.preventDefault()} onClick={addTextBlock}>+ TEKST</button><button type="button" onMouseDown={event => { event.preventDefault(); saveCaret(); }} onClick={() => inlineFile.current?.click()}>+ ZDJĘCIE</button></div>{selectedMedia && <div className="media-controls"><b>WYBRANE ZDJĘCIE</b><button type="button" onClick={() => updateMedia("wide")}>PEŁNA SZEROKOŚĆ</button><button type="button" onClick={() => updateMedia("left")}>LEWO</button><button type="button" onClick={() => updateMedia("right")}>PRAWO</button><button type="button" onClick={() => updateMedia("small")}>MAŁE</button><button type="button" onClick={() => updateAltText()}>ALT</button><button type="button" onClick={() => moveMedia("up")}>↑</button><button type="button" onClick={() => moveMedia("down")}>↓</button><label className="width-control">SZEROKOŚĆ <input type="range" min="25" max="100" value={mediaWidth} onChange={event => updateMediaWidth(Number(event.target.value))} /></label><button type="button" className="delete-media" onClick={removeMedia}>USUŃ</button></div>}<div ref={canvas} className="material-canvas" contentEditable={false} data-placeholder="Napisz materiał. Dodaj pole przyciskiem + TEKST." onInput={syncBody} onPaste={pastePlainText} onClick={selectMedia} onKeyUp={saveCaret} onMouseUp={saveCaret} onFocus={saveCaret} onDragStart={dragStart} onDragEnd={dragEnd} onDragOver={dragOver} onDrop={dropMedia} onPointerDownCapture={startPointerMove} /></div></label><input ref={inlineFile} className="visually-hidden" type="file" accept="image/jpeg,image/png,image/webp" onChange={insertImage} /><div className="material-actions"><small>{message}</small><button type="button" disabled={busy} onClick={event => save(event, "draft")}>{busy ? "ZAPIS…" : "ZAPISZ SZKIC"}</button><button type="button" className="primary" disabled={busy} onClick={event => save(event, "published")}>{busy ? "PUBLIKACJA…" : isEditing ? "AKTUALIZUJ ↗" : "OPUBLIKUJ ↗"}</button></div></section></form><section className="material-queue"><p className="kicker"><i /> OSTATNIE MATERIAŁY</p>{articles.length ? articles.map(article => <a key={article.id} href={`/redakcja/material?id=${article.id}`}><span>{article.status === "published" ? "OPUBLIKOWANY" : article.review_status === "review" ? "DO AKCEPTACJI" : "SZKIC"}</span><b>{article.title}</b><em>EDYTUJ →</em></a>) : <p>Nie masz jeszcze materiałów.</p>}</section>{versions.length > 0 && <section className="version-list"><p className="kicker"><i /> HISTORIA ZMIAN</p>{versions.map(version => <p key={version.id}>{new Date(version.created_at).toLocaleString("pl-PL")} · {version.title}</p>)}</section>}{mobilePreview && <div className="material-preview mobile-preview preview-phone-mode" role="dialog" aria-modal="true"><article><p className="kicker"><i /> {category} · TELEFON</p><h1>{title || "TYTUŁ MATERIAŁU"}</h1><p className="lead">{excerpt || "Uzupełnij zajawkę, żeby sprawdzić pierwsze wrażenie."}</p>{hasPreviewContent ? <section className={previewClass} dangerouslySetInnerHTML={{ __html: previewBody }} /> : <div className="preview-empty"><b>Brak treści materiału</b>Dodaj tekst lub zdjęcie w edytorze — tu zobaczysz dokładnie efekt.</div>}</article></div>}{preview && <div className="material-preview" role="dialog" aria-modal="true"><article><p className="kicker"><i /> {category} · PODGLĄD</p><h1>{title || "TYTUŁ MATERIAŁU"}</h1><p className="lead">{excerpt || "Uzupełnij zajawkę, żeby sprawdzić pierwsze wrażenie."}</p>{hasPreviewContent ? <section className={previewClass} dangerouslySetInnerHTML={{ __html: previewBody }} /> : <div className="preview-empty"><b>Brak treści materiału</b>Dodaj tekst lub zdjęcie w edytorze — tu zobaczysz dokładnie efekt.</div>}</article></div>}</main>;
}
