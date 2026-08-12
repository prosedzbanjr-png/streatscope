"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./stats.css";

const EDITOR_EMAIL = "kujalowicze@gmail.com";
type Article = { id: number; title: string; category: string; status: "draft" | "published"; published_at: string | null; views: number | null };

export default function StatystykiPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  useEffect(() => { const client = getSupabase(); client.auth.getUser().then(async ({ data }) => { const ok = data.user?.email?.toLowerCase() === EDITOR_EMAIL; setAllowed(ok); if (!ok) return; const { data: rows } = await client.from("articles").select("id,title,category,status,published_at,views").order("views", { ascending: false }); setArticles((rows as Article[] | null) ?? []); }); }, []);
  const published = useMemo(() => articles.filter(article => article.status === "published"), [articles]);
  const totalViews = published.reduce((sum, article) => sum + (article.views ?? 0), 0);
  const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const weekCount = published.filter(article => article.published_at && new Date(article.published_at).getTime() >= weekAgo).length;
  const top = published.slice(0, 8);
  if (allowed === null) return <main className="stats-page"><p className="kicker"><i /> ŁADOWANIE STATYSTYK</p></main>;
  if (!allowed) return <main className="stats-page"><a className="wordmark" href="/">STREET<span>SCOPE</span></a><h1>DOSTĘP<br /><em>ZAMKNIĘTY.</em></h1><a href="/redakcja" className="red-button">ZALOGUJ SIĘ →</a></main>;
  return <main className="stats-page"><header><a className="wordmark" href="/">STREET<span>SCOPE</span></a><a href="/redakcja">← PANEL REDAKCJI</a></header><section className="stats-head"><p className="kicker"><i /> ANALITYKA REDAKCYJNA</p><h1>ZASIĘG<br /><em>MATERIAŁÓW.</em></h1><p>Odsłony są liczone raz na artykuł w trakcie jednej sesji przeglądarki.</p></section><section className="stat-cards"><article><span>ŁĄCZNE ODSŁONY</span><b>{totalViews}</b></article><article><span>OPUBLIKOWANE / 7 DNI</span><b>{weekCount}</b></article><article><span>WSZYSTKIE PUBLIKACJE</span><b>{published.length}</b></article></section><section className="ranking"><div><p className="kicker"><i /> TOP MATERIAŁY</p><h2>CO LUDZIE<br /><em>CZYTAJĄ.</em></h2></div><ol>{top.length ? top.map((article, index) => <li key={article.id}><span>0{index + 1}</span><div><b>{article.category}</b><h3>{article.title}</h3></div><strong>{article.views ?? 0}<small>ODSŁON</small></strong></li>) : <p>Jeszcze nie ma opublikowanych materiałów.</p>}</ol></section></main>;
}
