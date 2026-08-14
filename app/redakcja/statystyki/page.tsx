"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./stats.css";

type Article = { id:number; title:string; category:string; status:"draft"|"published"; published_at:string|null; views:number|null };
type Feature = { id:number; kind:"fashion"|"motor"; title:string; published:boolean; created_at:string; reviewed_at:string|null; review_status:string|null };
type GuidePlace = { id:number; name:string; active:boolean; created_at:string; reviewed_at:string|null; review_status:string|null };

export default function StatystykiPage() {
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [articles,setArticles]=useState<Article[]>([]);
  const [features,setFeatures]=useState<Feature[]>([]);
  const [guide,setGuide]=useState<GuidePlace[]>([]);

  useEffect(()=>{
    const client=getSupabase();
    client.auth.getUser().then(async({data})=>{
      const email=data.user?.email?.toLowerCase()||"";
      const {data:person}=await client.from("staff_accounts").select("role,active").eq("email",email).maybeSingle();
      const ok=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));
      setAllowed(ok);
      if(!ok)return;
      const [articleRes,featureRes,guideRes]=await Promise.all([
        client.from("articles").select("id,title,category,status,published_at,views").is("archived_at",null).order("views",{ascending:false}),
        client.from("street_features").select("id,kind,title,published,created_at,reviewed_at,review_status").is("archived_at",null),
        client.from("guide_places").select("id,name,active,created_at,reviewed_at,review_status")
      ]);
      setArticles((articleRes.data as Article[]|null)??[]);
      setFeatures((featureRes.data as Feature[]|null)??[]);
      setGuide((guideRes.data as GuidePlace[]|null)??[]);
    });
  },[]);

  const publishedArticles=useMemo(()=>articles.filter(a=>a.status==="published"),[articles]);
  const publishedLooks=useMemo(()=>features.filter(f=>f.kind==="fashion"&&f.published&&f.review_status==="published"),[features]);
  const publishedBuilds=useMemo(()=>features.filter(f=>f.kind==="motor"&&f.published&&f.review_status==="published"),[features]);
  const publishedGuide=useMemo(()=>guide.filter(g=>g.active&&g.review_status==="published"),[guide]);
  const totalViews=publishedArticles.reduce((sum,a)=>sum+(a.views??0),0);
  const weekAgo=Date.now()-7*24*60*60*1000;
  const articleWeek=publishedArticles.filter(a=>a.published_at&&new Date(a.published_at).getTime()>=weekAgo).length;
  const featureWeek=[...publishedLooks,...publishedBuilds].filter(f=>new Date(f.reviewed_at||f.created_at).getTime()>=weekAgo).length;
  const guideWeek=publishedGuide.filter(g=>new Date(g.reviewed_at||g.created_at).getTime()>=weekAgo).length;
  const weekCount=articleWeek+featureWeek+guideWeek;
  const totalPublished=publishedArticles.length+publishedLooks.length+publishedBuilds.length+publishedGuide.length;
  const top=publishedArticles.slice(0,8);

  if(allowed===null)return <main className="stats-page"><p className="kicker"><i/> ŁADOWANIE STATYSTYK</p></main>;
  if(!allowed)return <main className="stats-page"><a className="wordmark" href="/">STREET<span>SCOPE</span></a><h1>DOSTĘP<br/><em>ZAMKNIĘTY.</em></h1><a href="/redakcja" className="red-button">ZALOGUJ SIĘ →</a></main>;

  return <main className="stats-page">
    <header><a className="wordmark" href="/">STREET<span>SCOPE</span></a><a href="/redakcja">← PANEL REDAKCJI</a></header>
    <section className="stats-head"><p className="kicker"><i/> ANALITYKA REDAKCYJNA</p><h1>ZASIĘG<br/><em>MATERIAŁÓW.</em></h1><p>Statystyki obejmują teraz artykuły, LOOK / Fashion, BUILD / Motor i Scope Guide.</p></section>
    <section className="stat-cards"><article><span>ŁĄCZNE ODSŁONY ARTYKUŁÓW</span><b>{totalViews}</b></article><article><span>OPUBLIKOWANE / 7 DNI</span><b>{weekCount}</b></article><article><span>WSZYSTKIE PUBLIKACJE</span><b>{totalPublished}</b></article></section>
    <section className="format-stats"><article><span>ARTYKUŁY</span><b>{publishedArticles.length}</b></article><article><span>LOOK / FASHION</span><b>{publishedLooks.length}</b></article><article><span>BUILD / MOTOR</span><b>{publishedBuilds.length}</b></article><article><span>SCOPE GUIDE</span><b>{publishedGuide.length}</b></article></section>
    <section className="ranking"><div><p className="kicker"><i/> TOP ARTYKUŁY</p><h2>CO LUDZIE<br/><em>CZYTAJĄ.</em></h2><p className="ranking-note">Ranking odsłon dotyczy na razie artykułów — LOOK, BUILD i Guide nie mają jeszcze własnego licznika wejść.</p></div><ol>{top.length?top.map((article,index)=><li key={article.id}><span>{String(index+1).padStart(2,"0")}</span><div><b>{article.category}</b><h3>{article.title}</h3></div><strong>{article.views??0}<small>ODSŁON</small></strong></li>):<p>Jeszcze nie ma opublikowanych materiałów.</p>}</ol></section>
  </main>;
}
