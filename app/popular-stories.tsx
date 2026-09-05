"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { optimizedImageUrl } from "../lib/image-optimization";
import "./popular.css";

type Article = { id: number; title: string; category: string; image_url: string | null; views: number };
const fallbackImages = ["/images/mural.png", "/images/hq.png", "/images/hero.png"];

export function PopularStories() {
  const [articles, setArticles] = useState<Article[]>([]);
  useEffect(() => { getSupabase().from("articles").select("id,title,category,image_url,views").eq("status", "published").is("archived_at", null).lte("published_at", new Date().toISOString()).order("views", { ascending: false }).order("published_at", { ascending: false }).limit(3).then(({ data }) => setArticles((data as Article[] | null) ?? [])); }, []);
  if (!articles.length) return null;
  return <section className="popular"><div className="section-label"><span>02</span><p>NAJCZĘŚCIEJ CZYTANE</p><a href="/wiadomosci">PEŁNE ARCHIWUM ↗</a></div><div className="popular-grid">{articles.map((article, index) => <a href={`/artykul/${article.id}`} key={article.id}><img src={optimizedImageUrl(article.image_url || fallbackImages[index],750)} alt="" /><div><p>0{index + 1} · {article.category}</p><h2>{article.title}</h2><span>{article.views ?? 0} ODSŁON →</span></div></a>)}</div></section>;
}
