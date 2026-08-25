"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./guide-detail.css";

type GuidePlace = {
  id:number; name:string; category:string; neighborhood:string|null; short_description:string|null; description:string|null;
  image_url:string|null; gallery:string[]|null; address:string|null; phone:string|null; hours:string|null; website_url:string|null; price_level:string|null;
  featured:boolean; featured_label:string|null; active:boolean;
};

const categoryLabel:Record<string,string>={
  food:"JEDZENIE",nightlife:"NOCNE ŻYCIE",motor:"MOTORYZACJA",shopping:"ZAKUPY",services:"USŁUGI",entertainment:"ROZRYWKA"
};

export default function GuideDetailPage({params}:{params:Promise<{id:string}>}){
  const [row,setRow]=useState<GuidePlace|null>(null);
  const [missing,setMissing]=useState(false);
  const [lightbox,setLightbox]=useState<string|null>(null);

  useEffect(()=>{
    let alive=true;
    params.then(async({id})=>{
      const n=Number(id);
      if(!Number.isInteger(n)||n<1){if(alive)setMissing(true);return;}
      const client=getSupabase();
      const {data}=await client.from("guide_places").select("*").eq("id",n).eq("active",true).is("archived_at",null).maybeSingle();
      if(!alive)return;
      if(!data){setMissing(true);return;}
      setRow(data as GuidePlace);
      void client.rpc("increment_guide_views",{place_id:n});
    });
    return()=>{alive=false};
  },[params]);

  if(missing)return <main className="guide-detail-missing"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><h1>TEGO MIEJSCA<br/><em>TU NIE MA.</em></h1><a href="/guide">← WRÓĆ DO GUIDE</a></main>;
  if(!row)return <main className="guide-detail-loading">ŁADOWANIE…</main>;

  const label=categoryLabel[row.category]||row.category.toUpperCase();
  const gallery=(row.gallery||[]).filter(Boolean);
  return <main className="guide-detail-page">
    <header className="guide-detail-nav"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/guide">← SCOPE GUIDE</a><a href="/fashion">FASHION</a><a href="/motor">MOTOR</a></nav></header>
    <section className="guide-detail-hero" style={row.image_url?{backgroundImage:`url(${row.image_url})`}:undefined}>
      <div className="guide-detail-shade"/>
      <article><span>{row.featured_label||label}</span><small>{label}{row.neighborhood?` · ${row.neighborhood}`:""}</small><h1>{row.name}</h1><p>{row.short_description||row.description||"Miejsce w Scope Guide."}</p></article>
    </section>
    <section className="guide-detail-body">
      <aside><p>INFORMACJE</p>{row.price_level&&<div><small>CENY</small><b>{row.price_level}</b></div>}{row.hours&&<div><small>GODZINY</small><b>{row.hours}</b></div>}{row.address&&<div><small>LOKALIZACJA</small><b>{row.address}</b></div>}{row.phone&&<div><small>TELEFON</small><b>{row.phone}</b></div>}{row.website_url&&<a href={row.website_url} target="_blank" rel="noreferrer">LINK BIZNESU ↗</a>}</aside>
      <article><p className="guide-detail-kicker">SCOPE GUIDE / {label}</p><h2>{row.name}</h2><p className="guide-detail-description">{row.description||row.short_description||"Brak pełnego opisu tego miejsca."}</p>{row.featured&&<div className="guide-detail-promo"><b>{row.featured_label||"PROMOWANE"}</b><span>Wyróżniony wpis w Scope Guide.</span></div>}</article>
    </section>
    {gallery.length>0&&<section className="guide-detail-gallery"><div className="guide-detail-gallery-head"><p>GALERIA</p><h2>ZOBACZ<br/><em>MIEJSCE.</em></h2><span>{gallery.length} ZDJĘĆ</span></div><div className="guide-detail-gallery-grid">{gallery.map((url,index)=><button type="button" key={`${url}-${index}`} onClick={()=>setLightbox(url)}><img src={url} alt={`${row.name} — zdjęcie ${index+1}`}/></button>)}</div></section>}
    <section className="guide-detail-more"><div><p>LOS SANTOS</p><h2>SPRAWDŹ WIĘCEJ<br/><em>MIEJSC W MIEŚCIE.</em></h2></div><a href="/guide">WRÓĆ DO SCOPE GUIDE →</a></section>
    <footer className="guide-detail-footer"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>SCOPE GUIDE · LOS SANTOS</p><a href="/guide">WSZYSTKIE MIEJSCA →</a></footer>
    {lightbox&&<div className="guide-detail-lightbox" role="dialog" aria-modal="true" onClick={()=>setLightbox(null)}><button type="button" onClick={()=>setLightbox(null)}>ZAMKNIJ ×</button><img src={lightbox} alt={row.name}/></div>}
  </main>;
}
