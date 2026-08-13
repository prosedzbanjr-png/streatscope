"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./archive.css";

type ArchivedArticle={id:number;title:string;category:string;status:string;author_email:string;archived_at:string;archived_by:string|null;updated_at:string};

export default function ArchivePage(){
  const [allowed,setAllowed]=useState<boolean|null>(null);const [rows,setRows]=useState<ArchivedArticle[]>([]);const [query,setQuery]=useState("");const [message,setMessage]=useState("");
  const client=()=>getSupabase();
  async function load(){const {data,error}=await client().from("articles").select("id,title,category,status,author_email,archived_at,archived_by,updated_at").not("archived_at","is",null).order("archived_at",{ascending:false});if(error)setMessage(error.message);setRows((data as ArchivedArticle[]|null)??[]);}
  useEffect(()=>{client().auth.getUser().then(async({data})=>{const email=data.user?.email?.toLowerCase()||"";const {data:person}=await client().from("staff_accounts").select("active,role").eq("email",email).maybeSingle();const ok=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));setAllowed(ok);if(ok)await load();});},[]);
  async function restore(row:ArchivedArticle){if(!window.confirm(`Przywrócić materiał „${row.title}”?`))return;const {error}=await client().from("articles").update({archived_at:null,archived_by:null,updated_at:new Date().toISOString()}).eq("id",row.id);setMessage(error?error.message:"Materiał został przywrócony.");if(!error)await load();}
  const filtered=useMemo(()=>{const q=query.trim().toLowerCase();if(!q)return rows;return rows.filter(row=>[row.title,row.category,row.author_email,row.archived_by||""].some(v=>v.toLowerCase().includes(q)));},[rows,query]);
  if(allowed===null)return <main className="archive-page">ŁADOWANIE…</main>;
  if(!allowed)return <main className="archive-page"><h1>DOSTĘP<br/><em>ZAMKNIĘTY.</em></h1></main>;
  return <main className="archive-page"><header><a className="wordmark" href="/">STREET<span>SCOPE</span></a><nav><a href="/redakcja/material">EDYTOR</a><a href="/redakcja/zarzadzaj">ZGŁOSZENIA</a><a href="/redakcja/rekrutacja">REKRUTACJA</a></nav></header><section className="archive-head"><p className="kicker"><i/> ARCHIWUM REDAKCYJNE</p><h1>USUNIĘTE<br/><em>MATERIAŁY.</em></h1><p>{message||"Materiały nie są kasowane na zawsze. Tutaj możesz je znaleźć i przywrócić."}</p><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="SZUKAJ W ARCHIWUM…"/></section><section className="archive-list">{filtered.length?filtered.map(row=><article key={row.id}><div><span>{row.category} · {row.status.toUpperCase()}</span><h2>{row.title}</h2><p>Autor: {row.author_email}</p><small>Archiwizacja: {new Date(row.archived_at).toLocaleString("pl-PL")}{row.archived_by?` · przez ${row.archived_by}`:""}</small></div><button onClick={()=>restore(row)}>PRZYWRÓĆ →</button></article>):<p>Archiwum jest puste albo nic nie pasuje do wyszukiwania.</p>}</section></main>;
}
