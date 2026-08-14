"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./materials.css";

type Kind = "article"|"fashion"|"motor"|"guide";
type Status = "draft"|"review"|"changes_requested"|"published"|"hidden"|"archived";
type Item = { key:string; id:number; kind:Kind; title:string; subtitle:string; status:Status; updatedAt:string; preview:string; edit:string };

const kindLabel:Record<Kind,string>={article:"ARTYKUŁ",fashion:"LOOK",motor:"BUILD",guide:"SCOPE GUIDE"};
const statusLabel:Record<Status,string>={draft:"SZKIC",review:"DO AKCEPTACJI",changes_requested:"DO POPRAWY",published:"OPUBLIKOWANE",hidden:"UKRYTE",archived:"ARCHIWUM"};

export default function MaterialyPage(){
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [isChief,setIsChief]=useState(false);
  const [items,setItems]=useState<Item[]>([]);
  const [query,setQuery]=useState("");
  const [kind,setKind]=useState<"all"|Kind>("all");
  const [status,setStatus]=useState<"all"|Status>("all");
  const [message,setMessage]=useState("");
  const client=()=>getSupabase();

  async function load(email:string, chief:boolean){
    const [articles,features,guides]=await Promise.all([
      client().from("articles").select("id,title,excerpt,status,review_status,updated_at,archived_at").order("updated_at",{ascending:false}),
      client().from("street_features").select("id,kind,title,subtitle,published,review_status,updated_at,archived_at,created_by").order("updated_at",{ascending:false}),
      client().from("guide_places").select("id,name,category,neighborhood,short_description,active,review_status,updated_at,submitted_by").order("updated_at",{ascending:false})
    ]);
    const errors=[articles.error,features.error,guides.error].filter(Boolean);
    if(errors.length)setMessage(errors[0]?.message||"Nie udało się pobrać części materiałów.");
    const out:Item[]=[];
    for(const row of (articles.data??[]) as any[]){
      const s:Status=row.archived_at?"archived":row.review_status==="review"?"review":row.review_status==="changes_requested"?"changes_requested":row.status==="published"?"published":"draft";
      out.push({key:`article-${row.id}`,id:row.id,kind:"article",title:row.title,subtitle:row.excerpt||"",status:s,updatedAt:row.updated_at,preview:`/artykul/${row.id}`,edit:`/redakcja/material?id=${row.id}`});
    }
    for(const row of (features.data??[]) as any[]){
      if(!chief && row.created_by && row.created_by.toLowerCase()!==email) continue;
      const s:Status=row.archived_at?"archived":row.review_status==="review"?"review":row.review_status==="changes_requested"?"changes_requested":row.published?"published":"draft";
      const k:Kind=row.kind==="motor"?"motor":"fashion";
      out.push({key:`feature-${row.id}`,id:row.id,kind:k,title:row.title,subtitle:row.subtitle||"",status:s,updatedAt:row.updated_at,preview:`/${row.kind}/${row.id}`,edit:`/redakcja/kultura?id=${row.id}`});
    }
    for(const row of (guides.data??[]) as any[]){
      if(!chief && row.submitted_by && row.submitted_by.toLowerCase()!==email) continue;
      const s:Status=row.review_status==="review"?"review":row.review_status==="changes_requested"?"changes_requested":row.active?"published":"hidden";
      out.push({key:`guide-${row.id}`,id:row.id,kind:"guide",title:row.name,subtitle:[row.category,row.neighborhood,row.short_description].filter(Boolean).join(" · "),status:s,updatedAt:row.updated_at,preview:`/guide#place-${row.id}`,edit:`/redakcja/guide?id=${row.id}`});
    }
    out.sort((a,b)=>new Date(b.updatedAt).getTime()-new Date(a.updatedAt).getTime());
    setItems(out);
  }

  useEffect(()=>{client().auth.getUser().then(async({data})=>{
    const email=data.user?.email?.toLowerCase()||"";
    const {data:person}=await client().from("staff_accounts").select("role,active").eq("email",email).maybeSingle();
    const ok=Boolean(person?.active); const chief=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));
    setAllowed(ok);setIsChief(chief);if(ok)await load(email,chief);
  })},[]);

  const filtered=useMemo(()=>items.filter(item=>{
    if(kind!=="all"&&item.kind!==kind)return false;
    if(status!=="all"&&item.status!==status)return false;
    const q=query.trim().toLowerCase();
    return !q||`${item.title} ${item.subtitle} ${kindLabel[item.kind]} ${statusLabel[item.status]}`.toLowerCase().includes(q);
  }),[items,kind,status,query]);

  async function archive(item:Item){
    if(!confirm(item.kind==="guide"?`Ukryć „${item.title}” w Scope Guide?`:`Przenieść „${item.title}” do archiwum?`))return;
    const now=new Date().toISOString();
    const res=item.kind==="article"?await client().from("articles").update({archived_at:now,updated_at:now}).eq("id",item.id):item.kind==="guide"?await client().from("guide_places").update({active:false,updated_at:now}).eq("id",item.id):await client().from("street_features").update({archived_at:now,updated_at:now}).eq("id",item.id);
    if(res.error){setMessage(res.error.message);return;}
    setMessage(item.kind==="guide"?"Wpis Guide ukryty.":"Materiał przeniesiony do archiwum.");
    const {data}=await client().auth.getUser();const email=data.user?.email?.toLowerCase()||"";await load(email,isChief);
  }

  if(allowed===null)return <main className="materials-page">ŁADOWANIE…</main>;
  if(!allowed)return <main className="materials-page"><h1>DOSTĘP ZAMKNIĘTY.</h1></main>;

  return <main className="materials-page">
    <header><a href="/" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/redakcja/dashboard">DASHBOARD</a><a href="/redakcja/zarzadzaj">AKCEPTACJA</a></nav></header>
    <section className="materials-head"><p className="kicker"><i/> CENTRALNE ZARZĄDZANIE</p><h1>WSZYSTKIE<br/><em>MATERIAŁY.</em></h1><p>{message||"Artykuły, LOOK, BUILD i Scope Guide w jednym miejscu."}</p></section>
    <section className="materials-new"><b>+ NOWY MATERIAŁ</b><a href="/redakcja/material">ARTYKUŁ</a><a href="/redakcja/kultura">LOOK / FASHION</a><a href="/redakcja/kultura">BUILD / MOTOR</a><a href="/redakcja/guide">SCOPE GUIDE</a></section>
    <section className="materials-tools"><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="SZUKAJ TYTUŁU, FORMATU, STATUSU…"/><select value={kind} onChange={e=>setKind(e.target.value as any)}><option value="all">WSZYSTKIE FORMATY</option><option value="article">ARTYKUŁY</option><option value="fashion">LOOK</option><option value="motor">BUILD</option><option value="guide">SCOPE GUIDE</option></select><select value={status} onChange={e=>setStatus(e.target.value as any)}><option value="all">WSZYSTKIE STATUSY</option><option value="draft">SZKICE</option><option value="review">DO AKCEPTACJI</option><option value="changes_requested">DO POPRAWY</option><option value="published">OPUBLIKOWANE</option><option value="hidden">UKRYTE</option><option value="archived">ARCHIWUM</option></select></section>
    <section className="materials-summary"><span>{filtered.length} WYNIKÓW</span><span>{items.filter(i=>i.status==="review").length} DO AKCEPTACJI</span><span>{items.filter(i=>i.status==="published").length} PUBLICZNYCH</span></section>
    <section className="materials-list">{filtered.length?filtered.map(item=><article key={item.key}><div className="materials-type"><b>{kindLabel[item.kind]}</b><span className={`status status-${item.status}`}>{statusLabel[item.status]}</span></div><div className="materials-info"><h2>{item.title}</h2><p>{item.subtitle||"Brak zajawki."}</p><small>AKTUALIZACJA: {new Date(item.updatedAt).toLocaleString("pl-PL")}</small></div><div className="materials-actions"><a href={item.edit}>EDYTUJ</a><a href={item.preview} target="_blank">PODGLĄD ↗</a>{isChief&&item.status!=="archived"&&<button onClick={()=>archive(item)}>{item.kind==="guide"?"UKRYJ":"ARCHIWIZUJ"}</button>}</div></article>):<p className="materials-empty">Brak materiałów pasujących do filtrów.</p>}</section>
  </main>;
}
