"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { optimizedImageUrl } from "../../lib/image-optimization";
import "./guide.css";

type GuidePlace = {
  id:number; name:string; category:string; neighborhood:string|null; short_description:string|null; description:string|null;
  image_url:string|null; address:string|null; phone:string|null; hours:string|null; website_url:string|null; price_level:string|null;
  featured:boolean; featured_label:string|null; active:boolean;
  created_at:string|null; updated_at:string|null; submitted_at:string|null; reviewed_at:string|null;
};

const categories = [
  ["all","WSZYSTKO"],["food","JEDZENIE"],["nightlife","NOCNE ŻYCIE"],["motor","MOTORYZACJA"],
  ["shopping","ZAKUPY"],["services","USŁUGI"],["entertainment","ROZRYWKA"]
];

function dateValue(value:string|null|undefined){
  if(!value)return 0;
  const parsed=Date.parse(value);
  return Number.isFinite(parsed)?parsed:0;
}

function publicationTime(row:GuidePlace){
  // Guide może powstać wcześniej jako szkic. Przy publikacji/akceptacji ustawiane są
  // reviewed_at i updated_at, więc to one mają pierwszeństwo przed created_at.
  return dateValue(row.reviewed_at)||dateValue(row.updated_at)||dateValue(row.submitted_at)||dateValue(row.created_at);
}

export default function GuidePage(){
  const [rows,setRows]=useState<GuidePlace[]>([]);
  const [category,setCategory]=useState("all");
  const [query,setQuery]=useState("");
  const [loading,setLoading]=useState(true);

  useEffect(()=>{ let alive=true; (async()=>{ try{
    const {data}=await getSupabase().from("guide_places").select("*").eq("active",true).is("archived_at",null).order("updated_at",{ascending:false}).order("id",{ascending:false});
    const sorted=((data as GuidePlace[]|null)??[]).sort((a,b)=>publicationTime(b)-publicationTime(a)||Number(Boolean(b.featured))-Number(Boolean(a.featured))||b.id-a.id);
    if(alive)setRows(sorted);
  } finally { if(alive)setLoading(false); } })(); return()=>{alive=false}; },[]);

  const filtered=useMemo(()=>rows.filter(row=>{
    const categoryOk=category==="all"||row.category===category;
    const q=query.trim().toLowerCase();
    const searchOk=!q||[row.name,row.neighborhood,row.short_description,row.address].filter(Boolean).join(" ").toLowerCase().includes(q);
    return categoryOk&&searchOk;
  }),[rows,category,query]);

  return <main className="guide-page">
    <header className="guide-nav"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/wiadomosci">WIADOMOŚCI</a><a href="/fashion">FASHION</a><a href="/motor">MOTOR</a><a className="active" href="/guide">SCOPE GUIDE</a><a href="/o-redakcji">O REDAKCJI</a></nav></header>
    <section className="guide-hero"><p className="kicker"><i/> MIEJSKI PRZEWODNIK</p><h1>SCOPE<br/><em>GUIDE.</em></h1><p>Gdzie zjeść, gdzie wyjść, gdzie naprawić auto i gdzie warto zajrzeć. Bez szukania po całym mieście.</p><span>LOS SANTOS · 2026</span></section>
    <section className="guide-tools"><div className="guide-categories">{categories.map(([value,label])=><button className={category===value?"active":""} key={value} onClick={()=>setCategory(value)}>{label}</button>)}</div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="SZUKAJ MIEJSCA, DZIELNICY…" /></section>
    <section className="guide-content">
      <div className="guide-heading"><p className="kicker"><i/> MIEJSCA</p><h2>{category==="all"?"LOS SANTOS":"WYBRANA KATEGORIA"}</h2><span>{filtered.length} WYNIKÓW</span></div>
      {loading?<p className="guide-state">ŁADOWANIE GUIDE…</p>:filtered.length?<div className="guide-grid">{filtered.map(row=><article className={`guide-card ${row.featured?"featured":""}`} id={`place-${row.id}`} key={row.id}>
        <a className="guide-card__image" href={`/guide/${row.id}`} style={row.image_url?{backgroundImage:`url(${optimizedImageUrl(row.image_url,828)})`}:undefined}>{row.featured&&<span>{row.featured_label||"STREETSCOPE PICK"}</span>}</a>
        <div className="guide-card__body"><small>{categories.find(c=>c[0]===row.category)?.[1]||row.category}{row.neighborhood?` · ${row.neighborhood}`:""}</small><h3><a href={`/guide/${row.id}`}>{row.name}</a></h3><p>{row.short_description||row.description||"Miejsce w Scope Guide."}</p><div className="guide-meta">{row.price_level&&<b>{row.price_level}</b>}{row.hours&&<span>{row.hours}</span>}</div>{(row.address||row.phone)&&<div className="guide-contact">{row.address&&<span>{row.address}</span>}{row.phone&&<span>{row.phone}</span>}</div>}<div className="guide-card__actions"><a href={`/guide/${row.id}`}>ZOBACZ MIEJSCE →</a>{row.website_url&&<a href={row.website_url} target="_blank" rel="noreferrer">LINK BIZNESU ↗</a>}</div></div>
      </article>)}</div>:<p className="guide-state">NIC TU JESZCZE NIE MA. ZMIEŃ FILTR ALBO DODAJ MIEJSCE W PANELU REDAKCJI.</p>}
    </section>
    <section className="guide-disclaimer"><b>PROMOWANE ≠ RECENZOWANE.</b><p>Wyróżnione wpisy mogą być płatną promocją. Materiały redakcyjne StreetScope pozostają oddzielone od katalogu reklamowego.</p></section>
    <footer className="guide-footer"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>SCOPE GUIDE · LOS SANTOS</p><a href="/">WRÓĆ NA GŁÓWNĄ →</a></footer>
  </main>;
}
