"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import { toReaderArticleHtml } from "../../../lib/sanitize-html";
import "./article.css";

type Article = { id: number; title: string; category: string; excerpt: string; body: string | null; image_url: string | null; gallery: string[] | null; published_at: string | null; views: number; author_email: string | null; author_name: string | null; author_role: string | null };
type RailStory = Pick<Article, "id" | "title" | "category" | "image_url" | "views">;

const ARTICLE24_PARAGRAPH = "Według pierwszych relacji nieznany mężczyzna ma uprowadzać przypadkowe osoby, a następnie zmuszać je do rozebrania się, tańczenia i śpiewania. Na ten moment nie wiadomo, czym kieruje się sprawca ani ilu mieszkańców mogło już paść jego ofiarą.";

function normalizeReaderText(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("pl-PL");
}

function htmlToReaderText(value: string) {
  if (typeof window === "undefined" || !value) return value;
  const template = document.createElement("template");
  template.innerHTML = value;
  return template.content.textContent || "";
}

function ensureArticle24Paragraph(value: string, articleId: number) {
  if (typeof window === "undefined" || articleId !== 24 || !value) return value;
  const template = document.createElement("template");
  template.innerHTML = value;
  const target = normalizeReaderText(ARTICLE24_PARAGRAPH);
  const blocks = Array.from(template.content.querySelectorAll<HTMLElement>("p,h1,h2,h3,blockquote,li,div"));
  if (blocks.some(block => normalizeReaderText(block.textContent || "") === target)) return value;

  const heading = blocks.find(block => normalizeReaderText(block.textContent || "") === "rysopis podejrzanego");
  const paragraph = document.createElement("p");
  paragraph.className = "ss-restored-article24";
  paragraph.textContent = ARTICLE24_PARAGRAPH;

  if (heading?.parentNode) heading.parentNode.insertBefore(paragraph, heading);
  else template.content.insertBefore(paragraph, template.content.firstChild);
  return template.innerHTML;
}

function StoryRail({ title, stories, empty }: { title: string; stories: RailStory[]; empty: string }) {
  return <section className="rail-card rail-list"><p className="rail-label">{title}</p>{stories.length ? <div className="rail-stories">{stories.map(story => <a href={`/artykul/${story.id}`} className="rail-story" key={story.id}>{story.image_url && <img src={story.image_url} alt="" />}<span>{story.category}</span><b>{story.title}</b><small>{story.views ?? 0} ODSŁON →</small></a>)}</div> : <p className="rail-empty">{empty}</p>}</section>;
}

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [missing, setMissing] = useState(false);
  const [latest, setLatest] = useState<RailStory[]>([]);
  const [popular, setPopular] = useState<RailStory[]>([]);
  const [readProgress, setReadProgress] = useState(0);
  const [previewMode, setPreviewMode] = useState(false);

  const loadRails = async (activeId: number) => {
    const client = getSupabase();
    const fields = "id,title,category,image_url,views";
    const [latestResult, popularResult] = await Promise.all([
      client.from("articles").select(fields).eq("status", "published").is("archived_at", null).lte("published_at", new Date().toISOString()).neq("id", activeId).order("published_at", { ascending: false }).limit(3),
      client.from("articles").select(fields).eq("status", "published").is("archived_at", null).lte("published_at", new Date().toISOString()).neq("id", activeId).order("views", { ascending: false }).limit(3),
    ]);
    setLatest((latestResult.data || []) as RailStory[]);
    setPopular((popularResult.data || []) as RailStory[]);
  };

  useEffect(() => {
    const updateProgress = () => {
      const doc = document.documentElement;
      const max = doc.scrollHeight - window.innerHeight;
      setReadProgress(max > 0 ? Math.min(100, Math.max(0, (window.scrollY / max) * 100)) : 0);
    };
    updateProgress();
    window.addEventListener("scroll", updateProgress, { passive: true });
    window.addEventListener("resize", updateProgress);
    return () => { window.removeEventListener("scroll", updateProgress); window.removeEventListener("resize", updateProgress); };
  }, []);

  useEffect(() => {
    params.then(async ({ id }) => {
      const articleId = Number(id);
      if (!Number.isInteger(articleId) || articleId < 1) { setMissing(true); return; }

      const client = getSupabase();
      const fields = "id,title,category,excerpt,body,image_url,gallery,published_at,views,author_email,author_name,author_role";
      const wantsPreview = new URLSearchParams(window.location.search).get("preview") === "1";

      if (wantsPreview) {
        try {
          const { data: authData } = await client.auth.getUser();
          const email = authData.user?.email?.toLowerCase() || "";
          if (email) {
            const { data: staff } = await client.from("staff_accounts").select("active,role").eq("email", email).maybeSingle();
            if (staff?.active) {
              const { data: previewArticle } = await client.from("articles").select(fields).eq("id", articleId).is("archived_at", null).maybeSingle();
              if (previewArticle) {
                setPreviewMode(true);
                setArticle(previewArticle as Article);
                void loadRails(articleId);
                return;
              }
            }
          }
        } catch {
          // Jeśli sesja redakcji wygasła, przechodzimy do zwykłego publicznego odczytu.
        }
      }

      client.from("articles").select(fields).eq("id", articleId).eq("status", "published").is("archived_at", null).lte("published_at", new Date().toISOString()).maybeSingle().then(({ data }) => {
        if (!data) { setMissing(true); return; }
        setArticle(data as Article);
        void loadRails(articleId);
        void fetch("/api/views/article", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ articleId }),
          keepalive: true,
        }).then(async response => {
          if (!response.ok) return;
          const result = await response.json().catch(() => ({}));
          setArticle(current => current ? { ...current, views: typeof result.views === "number" ? result.views : (current.views ?? 0) + 1 } : current);
        }).catch(() => null);
      });
    });
  }, [params]);

  if (missing) return <main className="article-page article-missing"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><h1>TEGO MATERIAŁU<br />TU <em>NIE MA.</em></h1><a href="/" className="red-button">← WRÓĆ DO WIADOMOŚCI</a></main>;
  if (!article) return <main className="article-page article-loading"><div className="reading-progress" style={{ width: `${readProgress}%` }} /><header className="article-nav"><a href="/" className="wordmark">STREET<span>SCOPE</span></a></header><section className="article-loading-shell"><div className="skeleton skeleton-kicker"/><div className="skeleton skeleton-title"/><div className="skeleton skeleton-title short"/><div className="skeleton skeleton-lead"/><div className="skeleton skeleton-article-image"/></section></main>;
  const date = article.published_at ? new Date(article.published_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "long", year: "numeric" }) : "DZISIAJ";
  const rawBody = article.body?.trim() || "";
  const safeBody = ensureArticle24Paragraph(toReaderArticleHtml(rawBody), article.id);
  const bodyHasRichContent = /<\/?[a-z][\s\S]*>/i.test(safeBody);
  const paragraphs = rawBody ? rawBody.split(/\n\s*\n/).filter(Boolean) : [];
  const excerptText = normalizeReaderText(article.excerpt || "");
  const bodyText = normalizeReaderText(bodyHasRichContent ? htmlToReaderText(safeBody) : rawBody);
  const showLead = Boolean(excerptText) && (!bodyText || !bodyText.startsWith(excerptText));
  const gallery = (article.gallery || []).filter(Boolean);
  const author = article.author_name?.trim() || article.author_email?.split("@")[0] || "REDAKCJA STREET SCOPE";
  const authorRole = article.author_role?.trim() || "REDAKTOR";
  return <main className="article-page">{previewMode && <div style={{ position: "sticky", top: 0, zIndex: 9999, background: "#d71920", color: "#fff", padding: "9px 16px", textAlign: "center", fontWeight: 800, fontSize: 12, letterSpacing: "1.2px" }}>UKRYTY PODGLĄD REDAKCYJNY · MATERIAŁ NIE JEST WIDOCZNY PUBLICZNIE</div>}<div className="reading-progress" style={{ width: `${readProgress}%` }} aria-hidden="true" /><header className="article-nav"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><a href={previewMode ? `/redakcja/material?id=${article.id}` : "/#stories"}>{previewMode ? "← WRÓĆ DO EDYCJI" : "← WSZYSTKIE TEMATY"}</a></header><div className="article-shell"><aside className="article-rail article-rail-left" aria-label="Materiały StreetScope"><StoryRail title="NAJNOWSZE" stories={latest} empty="Kolejne relacje są już w drodze." /><StoryRail title="NA TOPIE" stories={popular} empty="Tu pojawią się najczęściej czytane materiały." /></aside><article className="article-content"><p className="kicker"><i /> {article.category} · {date} · {article.views ?? 0} ODSŁON</p><h1>{article.title}</h1><p className="article-byline">TEKST: <b>{author}</b><span>·</span>{authorRole}</p>{showLead && <p className="article-lead">{article.excerpt}</p>}{article.image_url && <img className="article-hero" src={article.image_url} alt="" />}{bodyHasRichContent ? <section className="article-rich" dangerouslySetInnerHTML={{ __html: safeBody }} /> : paragraphs.map((paragraph, index) => <p key={index} className="article-paragraph">{paragraph}</p>)}{gallery.length > 0 && <section className="article-gallery"><p className="kicker"><i /> GALERIA</p><div>{gallery.map((url, index) => <img src={url} alt={`Zdjęcie ${index + 1}`} key={`${url}-${index}`} />)}</div></section>}</article><aside className="article-rail article-rail-right" aria-label="Odnośniki StreetScope"><a href="/dolacz" className="rail-card rail-hiring"><p className="rail-label">REKRUTACJA</p><strong>DOŁĄCZ<br />DO NAS.</strong><span>Masz temat, styl i chcesz pisać? Zgłoś się →</span></a><a href="/zglos-temat" className="rail-card rail-cta"><p className="rail-label">MASZ TEMAT?</p><strong>ZGŁOŚ<br />TEMAT.</strong><span>Anonimowo lub z kontaktem →</span></a><a href="/o-redakcji" className="rail-card rail-office"><p className="rail-label">STREET SCOPE</p><strong>POZNAJ<br />REDAKCJĘ.</strong><span>Kto tworzy relacje z miasta →</span></a></aside></div><footer><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p></footer></main>;
}
