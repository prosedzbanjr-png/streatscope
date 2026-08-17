"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

type Story = {
  key?: string;
  id?: number;
  source_type?: "article"|"fashion"|"motor"|"guide";
  title: string;
  category: string;
  excerpt?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  href?: string;
  pinned?: boolean;
};
type SlotRow={slot:string;source_type:Story["source_type"];source_id:number};

const fallback: Story[] = [
  { title: "Nocna akcja służb w La Mesa", category: "PILNE", excerpt: "Kilka radiowozów, blokady ulic i interwencja służb. Sprawdzamy, co wydarzyło się wczoraj wieczorem.", image_url: "/images/hero.png", href: "/wiadomosci" },
  { title: "Co zmienia się dziś w centrum Los Santos?", category: "MIASTO", excerpt: "Najważniejsze miejskie informacje w jednym miejscu.", image_url: "/images/hq.png", href: "/wiadomosci" },
  { title: "Nowy mural przyciąga uwagę mieszkańców", category: "KULTURA", excerpt: "Ulica znów dostała własny głos.", image_url: "/images/mural.png", href: "/wiadomosci" },
  { title: "Car meet zakończony interwencją", category: "MOTO", excerpt: "Nocne spotkanie przerwane przez służby.", image_url: "/images/hero.png", href: "/motor" },
  { title: "Redakcja czeka na sygnały od mieszkańców", category: "STREETSCOPE", excerpt: "Masz temat? Napisz do nas.", image_url: "/images/hq.png", href: "/wiadomosci" },
  { title: "Miasto po zmroku — z bliska", category: "REPORTAŻ", excerpt: "Historie, których nie widać za dnia.", image_url: "/images/mural.png", href: "/wiadomosci" },
];

function dateLabel(value?: string | null) {
  if (!value) return "DZISIAJ";
  try { return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value)); }
  catch { return "DZISIAJ"; }
}
function timeValue(value?: string | null){const parsed=value?new Date(value).getTime():0;return Number.isFinite(parsed)?parsed:0;}
function storyKey(type?:Story["source_type"],id?:number){return type&&id?`${type}-${id}`:"";}
function uniqueKey(story:Story){return story.key||storyKey(story.source_type,story.id)||story.title;}

export function HomeNewsBoard() {
  const [stories,setStories]=useState<Story[]>([]);
  const [manual,setManual]=useState<Record<string,Story>>({});
  const [loading,setLoading]=useState(true);

  useEffect(()=>{
    let cancelled=false;
    const load=async()=>{
      setLoading(true);
      try{
        const now=new Date().toISOString();
        const client=getSupabase();
        const [articlesResult,featuresResult,guideResult,slotsResult]=await Promise.all([
          client.from("articles").select("id,title,category,excerpt,image_url,published_at,pinned").eq("status","published").is("archived_at",null).lte("published_at",now).order("pinned",{ascending:false}).order("published_at",{ascending:false}).limit(80),
          client.from("street_features").select("id,kind,title,subtitle,description,image_url,created_at,featured").eq("published",true).is("archived_at",null).order("created_at",{ascending:false}).limit(80),
          client.from("guide_places").select("id,name,category,short_description,description,image_url,updated_at,submitted_at,featured_home").eq("active",true).eq("review_status","published").is("archived_at",null).order("updated_at",{ascending:false}).limit(80),
          client.from("homepage_slots").select("slot,source_type,source_id")
        ]);

        const articles:Story[]=(articlesResult.data||[]).map((row:any)=>({key:`article-${row.id}`,source_type:"article",id:row.id,title:row.title,category:row.category||"WIADOMOŚCI",excerpt:row.excerpt,image_url:row.image_url,published_at:row.published_at,href:`/artykul/${row.id}`,pinned:Boolean(row.pinned)}));
        const features:Story[]=(featuresResult.data||[]).map((row:any)=>({key:`${row.kind}-${row.id}`,source_type:row.kind,id:row.id,title:row.title,category:row.kind==="fashion"?"FASHION":"MOTOR",excerpt:row.subtitle||row.description,image_url:row.image_url,published_at:row.created_at,href:`/${row.kind}/${row.id}`,pinned:Boolean(row.featured)}));
        const guide:Story[]=(guideResult.data||[]).map((row:any)=>({key:`guide-${row.id}`,source_type:"guide",id:row.id,title:row.name,category:"SCOPE GUIDE",excerpt:row.short_description||row.description,image_url:row.image_url,published_at:row.updated_at||row.submitted_at,href:`/guide/${row.id}`,pinned:Boolean(row.featured_home)}));
        const merged=[...articles,...features,...guide].sort((a,b)=>Number(Boolean(b.pinned))-Number(Boolean(a.pinned))||timeValue(b.published_at)-timeValue(a.published_at));
        const lookup=new Map(merged.map(s=>[storyKey(s.source_type,s.id),s]));
        const manualMap:Record<string,Story>={};
        if(!slotsResult.error){for(const row of (slotsResult.data||[]) as SlotRow[]){const found=lookup.get(storyKey(row.source_type,row.source_id));if(found)manualMap[row.slot]=found;}}
        if(!cancelled){setStories(merged.length?merged:fallback);setManual(manualMap);}
      }catch{if(!cancelled){setStories(fallback);setManual({});}}
      finally{if(!cancelled)setLoading(false);}
    };
    void load();return()=>{cancelled=true};
  },[]);

  if(loading)return <section className="home-loading" aria-label="Ładowanie najnowszych materiałów"><div className="skeleton skeleton-hero"/><div className="skeleton-side"><div className="skeleton skeleton-line short"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-line"/><div className="skeleton skeleton-line medium"/></div></section>;

  const mainUsed=new Set<string>();
  const takeMain=(slot:string,fallbackIndex:number)=>{
    const manualChoice=manual[slot];
    if(manualChoice&&!mainUsed.has(uniqueKey(manualChoice))){mainUsed.add(uniqueKey(manualChoice));return manualChoice;}
    const automatic=stories.find((s,idx)=>idx>=fallbackIndex&&!mainUsed.has(uniqueKey(s)));
    if(automatic){mainUsed.add(uniqueKey(automatic));return automatic;}
    const backup=fallback.find(s=>!mainUsed.has(uniqueKey(s)))||fallback[fallbackIndex%fallback.length];
    mainUsed.add(uniqueKey(backup));return backup;
  };

  const hero=takeMain("hero",0);
  const cards=[takeMain("card1",1),takeMain("card2",1),takeMain("card3",1),takeMain("card4",1)];

  // Skrót ma własną pulę unikalności. Dzięki temu może pokazywać prawdziwe materiały,
  // które są już HERO/kafelkami, ale nie powtórzy jednego wpisu pięć razy.
  const briefUsed=new Set<string>();
  const takeBrief=(slot:string,index:number)=>{
    const manualChoice=manual[slot];
    if(manualChoice&&!briefUsed.has(uniqueKey(manualChoice))){briefUsed.add(uniqueKey(manualChoice));return manualChoice;}
    const automatic=stories.find(s=>!briefUsed.has(uniqueKey(s)));
    if(automatic){briefUsed.add(uniqueKey(automatic));return automatic;}
    const backup=fallback.find(s=>!briefUsed.has(uniqueKey(s)))||fallback[index%fallback.length];
    briefUsed.add(uniqueKey(backup));return backup;
  };
  const quick=[takeBrief("brief1",0),takeBrief("brief2",1),takeBrief("brief3",2),takeBrief("brief4",3),takeBrief("brief5",4)];
  const heroHref=hero.href||(hero.id?`/artykul/${hero.id}`:"/wiadomosci");

  return <>
    <section className="home-lead">
      <article className="lead-story"><img src={hero.image_url||"/images/hero.png"} alt=""/><div className="lead-shade"/><div className="lead-copy"><span className="lead-badge">{hero.category||"NAJNOWSZE"}</span><h1>{hero.title}</h1><p>{hero.excerpt||"StreetScope sprawdza, co dzieje się w mieście — bez filtra i bez zbędnego szumu."}</p><div className="lead-meta"><a href={heroHref}>CZYTAJ WIĘCEJ <b>→</b></a><span>{dateLabel(hero.published_at)}</span></div></div></article>
      <aside className="news-brief"><div className="brief-head"><b>REDAKCYJNY SKRÓT</b><span>NAJNOWSZE ZE STREETSCOPE</span></div><div className="brief-list">{quick.map((story,index)=><a href={story.href||"/wiadomosci"} key={`${uniqueKey(story)}-${index}`}><small>{index===0?"TERAZ":`0${index+1}`}</small><strong>{story.title}</strong></a>)}</div><a className="brief-all" href="#stories">NAJNOWSZE MATERIAŁY <b>↓</b></a></aside>
    </section>
    <section className="latest-board" id="stories"><div className="board-title"><div><i/><h2>NAJNOWSZE</h2></div><a href="/wiadomosci">WIADOMOŚCI →</a></div><div className="latest-grid">{cards.map((story,index)=>{const href=story.href||"/wiadomosci";return <article className="latest-card" key={`${uniqueKey(story)}-${index}`}><a href={href} className="latest-image"><img src={story.image_url||["/images/hq.png","/images/mural.png","/images/hero.png"][index%3]} alt=""/><span>{story.category}</span></a><div className="latest-meta"><span>{dateLabel(story.published_at)}</span><b>•</b><span>STREETSCOPE</span></div><h3><a href={href}>{story.title}</a></h3><p>{story.excerpt||"Najważniejsze informacje, kontekst i relacja z miejsca wydarzeń."}</p><a className="latest-arrow" href={href}>→</a></article>})}</div></section>
  </>;
}
