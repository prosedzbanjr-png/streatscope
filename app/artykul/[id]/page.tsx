"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import { toReaderArticleHtml } from "../../../lib/sanitize-html";
import "./article.css";

type Article = { id: number; title: string; category: string; excerpt: string; body: string | null; image_url: string | null; gallery: string[] | null; published_at: string | null; views: number; author_email: string | null; author_name: string | null; author_role: string | null };
type RailStory = Pick<Article, "id" | "title" | "category" | "image_url" | "views">;

function StoryRail({ title, stories, empty }: { title: string; stories: RailStory[]; empty: string }) {
  return <section className="rail-card rail-list"><p className="rail-label">{title}</p>{stories.length ? <div className="rail-stories">{stories.map(story => <a href={`/artykul/${story.id}`} className="rail-story" key={story.id}>{story.image_url && <img src={story.image_url} alt="" />}<span>{story.category}</span><b>{story.title}</b><small>{story.views ?? 0} ODSŁON →</small></a>)}</div> : <p className="rail-empty">{empty}</p>}</section>;
}

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [missing, setMissing] = useState(false);
  const [latest, setLatest] = useState<RailStory[]>([]);
  const [popular, setPopular] = useState<RailStory[]>([]);

  const loadRails = async (activeId: number) => {
    const client = getSupabase();
    const fields = "id,title,category,image_url,views";
    const [latestResult, popularResult] = await Promise.all([
      client.from("articles").select(fields).eq("status", "published").neq("id", activeId).order("published_at", { ascending: false }).limit(3),
      client.from("articles").select(fields).eq("status", "published").neq("id", activeId).order("views", { ascending: false }).limit(3),
    ]);
    setLatest((latestResult.data || []) as RailStory[]);
    setPopular((popularResult.data || []) as RailStory[]);
  };

  useEffect(() => { params.then(({ id }) => { const articleId = Number(id); if (!Number.isInteger(articleId) || articleId < 1) { setMissing(true); return; } getSupabase().from("articles").select("id,title,category,excerpt,body,image_url,gallery,published_at,views,author_email,author_name,author_role").eq("id", articleId).eq("status", "published").maybeSingle().then(({ data }) => { if (!data) { setMissing(true); return; } setArticle(data as Article); void loadRails(articleId); getSupabase().rpc("increment_article_views", { article_id: articleId }).then(() => setArticle(current => current ? { ...current, views: (current.views ?? 0) + 1 } : current)); }); }); }, [params]);
  if (missing) return <main className="article-page article-missing"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><h1>TEGO MATERIAŁU<br />TU <em>NIE MA.</em></h1><a href="/" className="red-button">← WRÓĆ DO WIADOMOŚCI</a></main>;
  if (!article) return <main className="article-page article-missing"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p className="kicker"><i /> ŁADOWANIE MATERIAŁU</p></main>;
  const date = article.published_at ? new Date(article.published_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "long", year: "numeric" }) : "DZISIAJ";
  const safeBody = toReaderArticleHtml(article.body || "");
  const bodyHasRichContent = /<\/?[a-z][\s\S]*>/i.test(safeBody);
  const paragraphs = (article.body || article.excerpt).split(/\n\s*\n/).filter(Boolean);
  const gallery = (article.gallery || []).filter(Boolean);
  const author = article.author_name?.trim() || article.author_email?.split("@")[0] || "REDAKCJA STREET SCOPE";
  const authorRole = article.author_role?.trim() || "REDAKTOR";
  return <main className="article-page"><header className="article-nav"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><a href="/#stories">← WSZYSTKIE TEMATY</a></header><div className="article-shell"><aside className="article-rail article-rail-left" aria-label="Materiały StreetScope"><StoryRail title="NAJNOWSZE" stories={latest} empty="Kolejne relacje są już w drodze." /><StoryRail title="NA TOPIE" stories={popular} empty="Tu pojawią się najczęściej czytane materiały." /></aside><article className="article-content"><p className="kicker"><i /> {article.category} · {date} · {article.views ?? 0} ODSŁON</p><h1>{article.title}</h1><p className="article-byline">TEKST: <b>{author}</b><span>·</span>{authorRole}</p><p className="article-lead">{article.excerpt}</p>{article.image_url && <img className="article-hero" src={article.image_url} alt="" />}{bodyHasRichContent ? <section className="article-rich" dangerouslySetInnerHTML={{ __html: safeBody }} /> : paragraphs.map((paragraph, index) => <p key={index} className="article-paragraph">{paragraph}</p>)}{gallery.length > 0 && <section className="article-gallery"><p className="kicker"><i /> GALERIA</p><div>{gallery.map((url, index) => <img src={url} alt={`Zdjęcie ${index + 1}`} key={`${url}-${index}`} />)}</div></section>}</article><aside className="article-rail article-rail-right" aria-label="Odnośniki StreetScope"><a href="/zglos-temat" className="rail-card rail-cta"><p className="rail-label">MASZ TEMAT?</p><strong>ZGŁOŚ<br />TEMAT.</strong><span>Anonimowo lub z kontaktem →</span></a><a href="/o-redakcji" className="rail-card rail-office"><p className="rail-label">STREET SCOPE</p><strong>POZNAJ<br />REDAKCJĘ.</strong><span>Kto tworzy relacje z miasta →</span></a></aside></div><footer><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p></footer></main>;
}
