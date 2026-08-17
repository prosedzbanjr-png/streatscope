"use client";

import { useEffect,useMemo,useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./home-layout.css";

type Item={key:string;source_type:"article"|"fashion"|"motor"|"guide";source_id:number;title:string;category:string;image_url:string|null};
type SlotValue={source_type:Item["source_type"];source_id:number};
const slots=[
  ["hero","DUŻY KAFEL / HERO"],
  ["card1","KAFEL 1 — NAJNOWSZE"],["card2","KAFEL 2 — NAJNOWSZE"],["card3","KAFEL 3 — NAJNOWSZE"],["card4","KAFEL 4 — NAJNOWSZE"],
  ["brief1","SKRÓT 1"],["brief2","SKRÓT 2"],["brief3","SKRÓT 3"],["brief4","SKRÓT 4"],["brief5","SKRÓT 5"]
] as const;

export default function HomeLayoutPage(){
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [items,setItems]=useState<Item[]>([]);
  const [layout,setLayout]=useState<Record<string,SlotValue|undefined>>({});
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const client=()=>getSupabase();

  useEffect(()=>{(async()=>{
    const {data:userData}=await client().auth.getUser();
    const email=userData.user?.email?.toLowerCase()||"";
    const {data:person}=await client().from("staff_accounts").select("role,active").eq("email",email).maybeSingle();
    const ok=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));setAllowed(ok);if(!ok)return;
    const now=new Date().toISOString();
    const [articles,features,guide,slotRows]=await Promise.all([
      client().from("articles").select("id,title,category,image_url,published_at").eq("status","published").is("archived_at",null).lte("published_at",now).order("published_at",{ascending:false}).limit(80),
      client().from("street_features").select("id,kind,title,image_url,created_at").eq("published",true).is("archived_at",null).order("created_at",{ascending:false}).limit(80),
      client().from("guide_places").select("id,name,image_url,updated_at").eq("active",true).eq("review_status","published").is("archived_at",null).order("updated_at",{ascending:false}).limit(80),
      client().from("homepage_slots").select("slot,source_type,source_id")
    ]);
    const list:Item[]=[
      ...(articles.data||[]).map((r:any)=>({key:`article-${r.id}`,source_type:"article" as const,source_id:r.id,title:r.title,category:r.category||"WIADOMOŚCI",image_url:r.image_url})),
      ...(features.data||[]).map((r:any)=>({key:`${r.kind}-${r.id}`,source_type:r.kind as "fashion"|"motor",source_id:r.id,title:r.title,category:r.kind==="fashion"?"FASHION":"MOTOR",image_url:r.image_url})),
      ...(guide.data||[]).map((r:any)=>({key:`guide-${r.id}`,source_type:"guide" as const,source_id:r.id,title:r.name,category:"SCOPE GUIDE",image_url:r.image_url}))
    ];
    setItems(list);
    const next:Record<string,SlotValue>={};for(const r of slotRows.data||[])next[(r as any).slot]={source_type:(r as any).source_type,source_id:(r as any).source_id};setLayout(next);
  })();},[]);

  const byKey=useMemo(()=>new Map(items.map(i=>[i.key,i])),[items]);
  const valueFor=(slot:string)=>{const v=layout[slot];return v?`${v.source_type}-${v.source_id}`:""};
  const setSlot=(slot:string,key:string)=>{if(!key){setLayout(p=>({...p,[slot]:undefined}));return;}const item=byKey.get(key);if(item)setLayout(p=>({...p,[slot]:{source_type:item.source_type,source_id:item.source_id}}))};
  const save=async()=>{setBusy(true);setMessage("");try{const {data}=await client().auth.getSession();const token=data.session?.access_token;if(!token)throw new Error("Sesja wygasła.");const clean:Record<string,SlotValue>={};for(const [k,v] of Object.entries(layout))if(v)clean[k]=v;const response=await fetch("/api/redakcja/home-layout",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({slots:clean})});const result=await response.json().catch(()=>({}));if(!response.ok)throw new Error(result.error||"Nie udało się zapisać.");setMessage("UKŁAD GŁÓWNEJ ZAPISANY.");}catch(e){setMessage(e instanceof Error?e.message:"Nie udało się zapisać.");}finally{setBusy(false)}};

  if(allowed===null)return <main className="home-layout-admin">ŁADOWANIE…</main>;
  if(!allowed)return <main className="home-layout-admin"><h1>DOSTĘP ZAMKNIĘTY.</h1></main>;
  return <main className="home-layout-admin"><header><a href="/redakcja/dashboard" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/redakcja/dashboard">DASHBOARD</a><a href="/" target="_blank">PODGLĄD GŁÓWNEJ</a></nav></header><section className="layout-head"><p>STRONA GŁÓWNA</p><h1>UKŁAD<br/><em>MATERIAŁÓW.</em></h1><span>{message||"Wybierz dokładnie, co ma siedzieć w dużym kaflu, czterech kartach i skrócie redakcyjnym."}</span></section><section className="slot-grid">{slots.map(([slot,label])=>{const selected=items.find(i=>`${i.source_type}-${i.source_id}`===valueFor(slot));return <article key={slot} className={slot==="hero"?"hero-slot":""}><div className="slot-preview">{selected?.image_url?<img src={selected.image_url} alt=""/>:<span>BRAK PODGLĄDU</span>}</div><label>{label}</label><select value={valueFor(slot)} onChange={e=>setSlot(slot,e.target.value)}><option value="">AUTO / NAJNOWSZY</option>{items.map(item=><option key={item.key} value={`${item.source_type}-${item.source_id}`}>{item.category} — {item.title}</option>)}</select>{selected&&<small>{selected.category} · {selected.title}</small>}</article>})}</section><div className="layout-actions"><button onClick={save} disabled={busy}>{busy?"ZAPISUJĘ…":"ZAPISZ UKŁAD GŁÓWNEJ"}</button></div></main>;
}
