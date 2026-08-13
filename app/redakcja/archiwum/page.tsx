"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import { logActivity } from "../../../lib/activity-log";
import "./archive.css";

type ArchivedArticle = {
  id:number; title:string; category:string; status:string; author_email:string;
  archived_at:string; archived_by:string|null; updated_at:string;
};

type ArchivedTip = {
  id:number; title:string; district:string; description:string; contact:string|null;
  status:string; created_at:string; archived_at:string; archived_by:string|null;
};

type ArchiveTab = "articles" | "tips";

export default function ArchivePage(){
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [articles,setArticles]=useState<ArchivedArticle[]>([]);
  const [tips,setTips]=useState<ArchivedTip[]>([]);
  const [query,setQuery]=useState("");
  const [message,setMessage]=useState("");
  const [tab,setTab]=useState<ArchiveTab>("articles");
  const [currentEmail,setCurrentEmail]=useState("");
  const client=()=>getSupabase();

  async function load(){
    const [{data:articleRows,error:articleError},{data:tipRows,error:tipError}] = await Promise.all([
      client().from("articles")
        .select("id,title,category,status,author_email,archived_at,archived_by,updated_at")
        .not("archived_at","is",null)
        .order("archived_at",{ascending:false}),
      client().from("tips")
        .select("id,title,district,description,contact,status,created_at,archived_at,archived_by")
        .or("archived_at.not.is.null,status.eq.archived")
        .order("archived_at",{ascending:false,nullsFirst:false})
    ]);
    if(articleError||tipError) setMessage(articleError?.message||tipError?.message||"");
    setArticles((articleRows as ArchivedArticle[]|null)??[]);
    setTips((tipRows as ArchivedTip[]|null)??[]);
  }

  useEffect(()=>{
    const params=new URLSearchParams(window.location.search);
    if(params.get("typ")==="zgloszenia")setTab("tips");
    client().auth.getUser().then(async({data})=>{
      const email=data.user?.email?.toLowerCase()||"";
      const {data:person}=await client().from("staff_accounts").select("active,role").eq("email",email).maybeSingle();
      const ok=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));
      setCurrentEmail(email);
      setAllowed(ok);
      if(ok)await load();
    });
  },[]);

  async function restoreArticle(row:ArchivedArticle){
    if(!window.confirm(`Przywrócić materiał „${row.title}”?`))return;
    const {error}=await client().from("articles").update({archived_at:null,archived_by:null,updated_at:new Date().toISOString()}).eq("id",row.id);
    setMessage(error?error.message:"Materiał został przywrócony.");
    if(!error){await logActivity({actorEmail:currentEmail,action:"article_restored",entityType:"article",entityId:row.id,entityLabel:row.title});await load();}
  }

  async function restoreTip(row:ArchivedTip){
    if(!window.confirm(`Przywrócić zgłoszenie „${row.title}”?`))return;
    const {error}=await client().from("tips").update({status:"new",archived_at:null,archived_by:null}).eq("id",row.id);
    setMessage(error?error.message:"Zgłoszenie zostało przywrócone do aktywnych.");
    if(!error){await logActivity({actorEmail:currentEmail,action:"tip_restored",entityType:"tip",entityId:row.id,entityLabel:row.title});await load();}
  }

  async function deleteArticle(row:ArchivedArticle){
    if(!window.confirm(`USUNĄĆ TRWALE materiał „${row.title}”?\n\nTej operacji nie da się cofnąć.`))return;
    const {error}=await client().from("articles").delete().eq("id",row.id);
    setMessage(error?error.message:"Materiał został trwale usunięty.");
    if(!error){await logActivity({actorEmail:currentEmail,action:"article_deleted",entityType:"article",entityId:row.id,entityLabel:row.title});await load();}
  }

  async function deleteTip(row:ArchivedTip){
    if(!window.confirm(`USUNĄĆ TRWALE zgłoszenie „${row.title}”?\n\nTej operacji nie da się cofnąć.`))return;
    const {error}=await client().from("tips").delete().eq("id",row.id);
    setMessage(error?error.message:"Zgłoszenie zostało trwale usunięte.");
    if(!error){await logActivity({actorEmail:currentEmail,action:"tip_deleted",entityType:"tip",entityId:row.id,entityLabel:row.title});await load();}
  }

  const filteredArticles=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return articles;
    return articles.filter(row=>[row.title,row.category,row.author_email,row.archived_by||""].some(v=>v.toLowerCase().includes(q)));
  },[articles,query]);

  const filteredTips=useMemo(()=>{
    const q=query.trim().toLowerCase();
    if(!q)return tips;
    return tips.filter(row=>[row.title,row.district,row.description,row.contact||"",row.archived_by||""].some(v=>v.toLowerCase().includes(q)));
  },[tips,query]);

  function switchTab(next:ArchiveTab){
    setTab(next);
    setQuery("");
    const url=next==="tips"?"/redakcja/archiwum?typ=zgloszenia":"/redakcja/archiwum";
    window.history.replaceState(null,"",url);
  }

  if(allowed===null)return <main className="archive-page">ŁADOWANIE…</main>;
  if(!allowed)return <main className="archive-page"><h1>DOSTĘP<br/><em>ZAMKNIĘTY.</em></h1></main>;

  const isArticles=tab==="articles";

  return <main className="archive-page">
    <header>
      <a className="wordmark" href="/">STREET<span>SCOPE</span></a>
      <nav>
        <a href="/redakcja/dashboard">DASHBOARD</a>
        <a href="/redakcja/material">EDYTOR</a>
        <a href="/redakcja/zarzadzaj">ZGŁOSZENIA</a>
        <a href="/redakcja/rekrutacja">REKRUTACJA</a>
      </nav>
    </header>

    <section className="archive-head">
      <p className="kicker"><i/> ARCHIWUM REDAKCYJNE</p>
      <h1>{isArticles?<>USUNIĘTE<br/><em>MATERIAŁY.</em></>:<>ARCHIWUM<br/><em>ZGŁOSZEŃ.</em></>}</h1>
      <p>{message||(isArticles?"Materiały nie są kasowane od razu. Możesz je przywrócić albo usunąć trwale.":"Odrzucone zgłoszenia nie zaśmiecają głównego panelu. Tutaj możesz je przywrócić albo usunąć trwale.")}</p>
      <div className="archive-tabs" role="tablist" aria-label="Rodzaj archiwum">
        <button className={isArticles?"active":""} onClick={()=>switchTab("articles")}>MATERIAŁY <span>{articles.length}</span></button>
        <button className={!isArticles?"active":""} onClick={()=>switchTab("tips")}>ZGŁOSZENIA <span>{tips.length}</span></button>
      </div>
      <input value={query} onChange={e=>setQuery(e.target.value)} placeholder={isArticles?"SZUKAJ MATERIAŁU…":"SZUKAJ ZGŁOSZENIA…"}/>
    </section>

    {isArticles?<section className="archive-list">
      {filteredArticles.length?filteredArticles.map(row=><article key={row.id}>
        <div>
          <span>{row.category} · {row.status.toUpperCase()}</span>
          <h2>{row.title}</h2>
          <p>Autor: {row.author_email}</p>
          <small>Archiwizacja: {new Date(row.archived_at).toLocaleString("pl-PL")}{row.archived_by?` · przez ${row.archived_by}`:""}</small>
        </div>
        <div className="archive-actions">
          <button onClick={()=>restoreArticle(row)}>PRZYWRÓĆ →</button>
          <button className="danger" onClick={()=>deleteArticle(row)}>USUŃ TRWALE</button>
        </div>
      </article>):<p>Archiwum materiałów jest puste albo nic nie pasuje do wyszukiwania.</p>}
    </section>:<section className="archive-list tips-archive">
      {filteredTips.length?filteredTips.map(row=><article key={row.id}>
        <div>
          <span>{row.district} · ZGŁOSZENIE</span>
          <h2>{row.title}</h2>
          <p>{row.description}</p>
          {row.contact&&<small>Kontakt: {row.contact}</small>}
          <small>Archiwizacja: {row.archived_at?new Date(row.archived_at).toLocaleString("pl-PL"):"stary wpis"}{row.archived_by?` · przez ${row.archived_by}`:""}</small>
        </div>
        <div className="archive-actions">
          <button onClick={()=>restoreTip(row)}>PRZYWRÓĆ →</button>
          <button className="danger" onClick={()=>deleteTip(row)}>USUŃ TRWALE</button>
        </div>
      </article>):<p>Archiwum zgłoszeń jest puste albo nic nie pasuje do wyszukiwania.</p>}
    </section>}
  </main>;
}
