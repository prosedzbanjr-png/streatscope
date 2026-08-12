"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./manage.css";

const EDITOR_EMAIL = "kujalowicze@gmail.com";
type Tip = { id:number; title:string; district:string; description:string; contact:string|null; status:string; created_at:string };

export default function ZarzadzajPage() {
  const [allowed, setAllowed] = useState<boolean|null>(null); const [tips, setTips] = useState<Tip[]>([]); const [media, setMedia] = useState<Array<{ name:string; url:string }>>([]); const [message,setMessage] = useState("");
  const client = () => getSupabase();
  async function load() { const [{data: rows}, storage] = await Promise.all([client().from("tips").select("id,title,district,description,contact,status,created_at").order("created_at", {ascending:false}).limit(80), client().storage.from("article-images").list("", {limit:100, sortBy:{column:"created_at",order:"desc"}})]); setTips((rows as Tip[]|null)??[]); setMedia((storage.data??[]).filter(file => file.name).map(file => ({name:file.name,url:client().storage.from("article-images").getPublicUrl(file.name).data.publicUrl}))); }
  useEffect(()=>{client().auth.getUser().then(async ({data})=>{const ok=data.user?.email?.toLowerCase()===EDITOR_EMAIL;setAllowed(ok);if(ok) await load();});},[]);
  async function setTip(id:number,status:string){const {error}=await client().from("tips").update({status}).eq("id",id);setMessage(error?"Nie udało się zmienić statusu.":"Status zgłoszenia zapisany.");if(!error) await load();}
  async function copy(url:string){await navigator.clipboard.writeText(url);setMessage("Link do zdjęcia skopiowany.");}
  if(allowed===null)return <main className="manage-page">ŁADOWANIE…</main>;
  if(!allowed)return <main className="manage-page"><h1>DOSTĘP<br/><em>ZAMKNIĘTY.</em></h1></main>;
  return <main className="manage-page"><header><a className="wordmark" href="/">STREET<span>SCOPE</span></a><nav><a href="/redakcja">EDYTOR</a><a href="/redakcja/statystyki">STATYSTYKI</a></nav></header><section className="manage-head"><p className="kicker"><i/> PANEL REDAKCYJNY</p><h1>ZARZĄDZAJ<br/><em>REDKCJĄ.</em></h1><p>{message}</p></section><section className="manage-grid"><div><p className="kicker"><i/> ZGŁOSZENIA OD MIESZKAŃCÓW</p><div className="tip-list">{tips.length?tips.map(t=><article key={t.id}><span>{t.status}</span><h2>{t.title}</h2><b>{t.district} · {new Date(t.created_at).toLocaleDateString("pl-PL")}</b><p>{t.description}</p>{t.contact&&<small>KONTAKT: {t.contact}</small>}<div><button onClick={()=>setTip(t.id,"reviewing")}>PRZYJMIJ</button><button onClick={()=>setTip(t.id,"used")}>UŻYTE</button><button onClick={()=>setTip(t.id,"archived")}>ODRZUĆ</button><a href={`/redakcja/material?tip=${t.id}`}>ZAMIEŃ W MATERIAŁ →</a></div></article>):<p>Brak zgłoszeń.</p>}</div></div><aside><p className="kicker"><i/> BIBLIOTEKA MEDIÓW</p><div className="media-library">{media.length?media.map(m=><button key={m.name} onClick={()=>copy(m.url)} title="Kliknij, aby skopiować link"><img src={m.url} alt=""/><span>KOPIUJ LINK</span></button>):<p>Nie ma jeszcze zdjęć.</p>}</div></aside></section></main>;
}
