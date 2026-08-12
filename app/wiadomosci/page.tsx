"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { SiteNav } from "../site-nav";

type Article = { id: number; title: string; category: string; excerpt: string; image_url: string | null; published_at: string | null };
const fallbackImages = ["/images/hero.png", "/images/hq.png", "/images/mural.png"];

export default function WiadomosciPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState("WSZYSTKIE");
  useEffect(() => { getSupabase().from("articles").select("id,title,category,excerpt,image_url,published_at").eq("status", "published").lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).then(({ data }) => setArticles((data as Article[] | null) ?? [])); }, []);
  const categories = useMemo(() => ["WSZYSTKIE", ...Array.from(new Set(articles.map(article => article.category)))], [articles]);
  const visible = category === "WSZYSTKIE" ? articles : articles.filter(article => article.category === category);
  return <main className="listing-page"><SiteNav/><section className="listing-head"><p className="kicker"><i/> ARCHIWUM STREET SCOPE</p><h1>WSZYSTKIE<br/><em>WIADOMOŚCI.</em></h1><p>Relacje, które zostają dłużej niż nocne światła miasta.</p></section><section className="listing-content"><div className="category-bar">{categories.map(item => <button key={item} onClick={() => setCategory(item)} className={item === category ? "active" : ""}>{item}</button>)}</div>{visible.length ? <div className="article-cards">{visible.map((article, index) => <a href={`/artykul/${article.id}`} className="article-card" key={article.id}><img src={article.image_url || fallbackImages[index % fallbackImages.length]} alt=""/><div><p>{article.category} · {article.published_at ? new Date(article.published_at).toLocaleDateString("pl-PL") : "DZISIAJ"}</p><h2>{article.title}</h2><span>{article.excerpt}</span><b>CZYTAJ ARTYKUŁ →</b></div></a>)}</div> : <div className="no-articles"><p className="kicker"><i/> PUSTE ARCHIWUM</p><h2>JESZCZE NIC<br/><em>DO CZYTANIA.</em></h2><p>Opublikowane materiały z panelu redakcji pojawią się tutaj.</p></div>}</section><footer><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p></footer></main>;
}
