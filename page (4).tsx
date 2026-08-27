"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./article.css";

type Article = { id: number; title: string; category: string; excerpt: string; body: string | null; image_url: string | null; gallery: string[] | null; published_at: string | null };

function normalizeText(value: string) {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim().toLocaleLowerCase("pl-PL");
}

export default function ArticlePage({ params }: { params: Promise<{ id: string }> }) {
  const [article, setArticle] = useState<Article | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => { params.then(({ id }) => getSupabase().from("articles").select("id,title,category,excerpt,body,image_url,gallery,published_at").eq("id", Number(id)).eq("status", "published").single().then(({ data }) => { if (data) setArticle(data as Article); else setMissing(true); })); }, [params]);
  if (missing) return <main className="article-page article-missing"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><h1>TEGO MATERIAŁU<br />TU <em>NIE MA.</em></h1><a href="/" className="red-button">← WRÓĆ DO WIADOMOŚCI</a></main>;
  if (!article) return <main className="article-page article-missing"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p className="kicker"><i /> ŁADOWANIE MATERIAŁU</p></main>;
  const date = article.published_at ? new Date(article.published_at).toLocaleDateString("pl-PL", { day: "2-digit", month: "long", year: "numeric" }) : "DZISIAJ";
  const rawBody = article.body?.trim() || "";
  const paragraphs = rawBody ? rawBody.split(/\n\s*\n/).filter(Boolean) : [];
  const excerptText = normalizeText(article.excerpt || "");
  const bodyText = normalizeText(rawBody.replace(/<[^>]*>/g, " "));
  const showLead = Boolean(excerptText) && (!bodyText || !bodyText.startsWith(excerptText));
  const gallery = (article.gallery || []).filter(Boolean);
  return <main className="article-page"><header className="article-nav"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><a href="/#stories">← WSZYSTKIE TEMATY</a></header><article className="article-content"><p className="kicker"><i /> {article.category} · {date}</p><h1>{article.title}</h1>{showLead && <p className="article-lead">{article.excerpt}</p>}{article.image_url && <img className="article-hero" src={article.image_url} alt="" />}{paragraphs.map((paragraph, index) => <p key={index} className="article-paragraph">{paragraph}</p>)}{gallery.length > 0 && <section className="article-gallery"><p className="kicker"><i /> GALERIA</p><div>{gallery.map((url, index) => <img src={url} alt={`Zdjęcie ${index + 1}`} key={`${url}-${index}`} />)}</div></section>}</article><footer><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p></footer></main>;
}
