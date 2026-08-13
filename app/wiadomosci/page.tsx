"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { SiteNav } from "../site-nav";

type Article = { id: number; title: string; category: string; excerpt: string; image_url: string | null; published_at: string | null };
const fallbackImages = ["/images/hero.png", "/images/hq.png", "/images/mural.png"];
const perPage = 9;

export default function WiadomosciPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [category, setCategory] = useState("WSZYSTKIE");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);

  useEffect(() => { getSupabase().from("articles").select("id,title,category,excerpt,image_url,published_at").eq("status", "published").is("archived_at", null).lte("published_at", new Date().toISOString()).order("published_at", { ascending: false }).then(({ data }) => setArticles((data as Article[] | null) ?? [])); }, []);
  const categories = useMemo(() => ["WSZYSTKIE", ...Array.from(new Set(articles.map(article => article.category)))], [articles]);
  const visible = useMemo(() => { const search = query.trim().toLocaleLowerCase("pl-PL"); return articles.filter(article => (category === "WSZYSTKIE" || article.category === category) && (!search || `${article.title} ${article.excerpt} ${article.category}`.toLocaleLowerCase("pl-PL").includes(search))); }, [articles, category, query]);
  const totalPages = Math.max(1, Math.ceil(visible.length / perPage));
  const paged = visible.slice((page - 1) * perPage, page * perPage);
  function changeCategory(value: string) { setCategory(value); setPage(1); }
  function changeQuery(value: string) { setQuery(value); setPage(1); }

  return <main className="listing-page"><SiteNav /><section className="listing-head"><p className="kicker"><i /> ARCHIWUM STREET SCOPE</p><h1>WSZYSTKIE<br /><em>WIADOMOŚCI.</em></h1><p>Relacje, które zostają dłużej niż nocne światła miasta.</p></section><section className="listing-content"><div className="archive-tools"><label><span>SZUKAJ W ARCHIWUM</span><input value={query} onChange={event => changeQuery(event.target.value)} placeholder="Tytuł, rejon albo temat..." /></label><p>{visible.length} {visible.length === 1 ? "MATERIAŁ" : "MATERIAŁÓW"}</p></div><div className="category-bar">{categories.map(item => <button key={item} onClick={() => changeCategory(item)} className={item === category ? "active" : ""}>{item}</button>)}</div>{paged.length ? <><div className="article-cards">{paged.map((article, index) => <a href={`/artykul/${article.id}`} className="article-card" key={article.id}><img src={article.image_url || fallbackImages[index % fallbackImages.length]} alt="" /><div><p>{article.category} · {article.published_at ? new Date(article.published_at).toLocaleDateString("pl-PL") : "DZISIAJ"}</p><h2>{article.title}</h2><span>{article.excerpt}</span><b>CZYTAJ ARTYKUŁ →</b></div></a>)}</div>{totalPages > 1 && <nav className="pagination" aria-label="Strony archiwum"><button disabled={page === 1} onClick={() => setPage(current => current - 1)}>← POPRZEDNIA</button>{Array.from({ length: totalPages }, (_, index) => index + 1).map(number => <button key={number} className={number === page ? "active" : ""} onClick={() => setPage(number)}>{number}</button>)}<button disabled={page === totalPages} onClick={() => setPage(current => current + 1)}>NASTĘPNA →</button></nav>}</> : <div className="no-articles"><p className="kicker"><i /> BRAK WYNIKÓW</p><h2>NIC TU<br /><em>NIE MA.</em></h2><p>Zmień frazę albo kategorię i spróbuj ponownie.</p></div>}</section><footer><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p></footer></main>;
}
