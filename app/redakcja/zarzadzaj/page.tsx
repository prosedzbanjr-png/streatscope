"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import { logActivity } from "../../../lib/activity-log";
import "./manage.css";

type Tip = { id:number; title:string; district:string; description:string; contact:string|null; status:string; created_at:string; archived_at:string|null; archived_by:string|null };
type Review = { id:number; title:string; excerpt:string; category:string; author_email:string; updated_at:string; review_note:string|null };

export default function ZarzadzajPage() {
  const [allowed, setAllowed] = useState<boolean|null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [tips, setTips] = useState<Tip[]>([]);
  const [media, setMedia] = useState<Array<{ name:string; url:string }>>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [message,setMessage] = useState("");
  const client = () => getSupabase();

  async function notifyPublished(articleId:number){
    const {data}=await client().auth.getSession();
    const token=data.session?.access_token;
    if(!token)return;
    await fetch("/api/discord",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({event:"published",articleId})});
  }

  async function load() {
    const [{data: rows, error: tipsError}, storage, {data: queued}] = await Promise.all([
      client().from("tips")
        .select("id,title,district,description,contact,status,created_at,archived_at,archived_by")
        .is("archived_at", null)
        .neq("status", "archived")
        .order("created_at", {ascending:false})
        .limit(80),
      client().storage.from("article-images").list("", {limit:100, sortBy:{column:"created_at",order:"desc"}}),
      client().from("articles").select("id,title,excerpt,category,author_email,updated_at,review_note").eq("status","draft").eq("review_status","review").is("archived_at",null).order("updated_at",{ascending:false})
    ]);
    if (tipsError) setMessage(tipsError.message);
    setTips((rows as Tip[]|null)??[]);
    setReviews((queued as Review[]|null)??[]);
    setMedia((storage.data??[]).filter(file => file.name).map(file => ({name:file.name,url:client().storage.from("article-images").getPublicUrl(file.name).data.publicUrl})));
  }

  useEffect(()=>{
    client().auth.getUser().then(async ({data})=>{
      const email=data.user?.email?.toLowerCase()||"";
      const {data:person}=await client().from("staff_accounts").select("role,active").eq("email",email).maybeSingle();
      const ok=Boolean(person?.active);
      const approver=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));
      setCurrentEmail(email);
      setAllowed(ok);
      setCanApprove(approver);
      if(ok) await load();
    });
  },[]);

  async function setTip(id:number,status:string){
    const update = status === "archived"
      ? {status:"archived", archived_at:new Date().toISOString(), archived_by:currentEmail || null}
      : {status, archived_at:null, archived_by:null};
    const {error}=await client().from("tips").update(update).eq("id",id);
    setMessage(error?error.message:status === "archived" ? "Zgłoszenie przeniesiono do archiwum." : "Status zgłoszenia zapisany.");
    if(!error){const tip=tips.find(item=>item.id===id);await logActivity({actorEmail:currentEmail,action:status==="archived"?"tip_archived":"tip_status_changed",entityType:"tip",entityId:id,entityLabel:tip?.title||`Zgłoszenie #${id}`,details:{status}});await load();}
  }

  async function copy(url:string){await navigator.clipboard.writeText(url);setMessage("Link do zdjęcia skopiowany.");}

  async function approve(article:Review){
    if(!window.confirm(`Opublikować „${article.title}”?`)) return;
    const now=new Date().toISOString();
    const {data:author}=await client().from("staff_accounts").select("display_name,role").eq("email",article.author_email).maybeSingle();
    const authorRole=author?.role==="editor_in_chief"?"REDAKTOR NACZELNY":author?.role==="deputy_editor_in_chief"?"ZASTĘPCA REDAKTORA NACZELNEGO":"DZIENNIKARZ";
    const {error}=await client().from("articles").update({status:"published",review_status:"published",published_at:now,approved_at:now,approved_by:currentEmail,review_note:null,author_name:author?.display_name||article.author_email.split("@")[0],author_role:authorRole,updated_at:now}).eq("id",article.id);
    if(!error){ await notifyPublished(article.id); await logActivity({actorEmail:currentEmail,action:"article_published",entityType:"article",entityId:article.id,entityLabel:article.title}); }
    setMessage(error?error.message:"Materiał zatwierdzony i opublikowany.");
    if(!error)await load();
  }

  async function requestChanges(article:Review){
    const note=window.prompt("Napisz redaktorowi, co ma poprawić:",article.review_note||"");
    if(note===null)return;
    const {error}=await client().from("articles").update({status:"draft",review_status:"changes_requested",review_note:note.trim()||"Proszę poprawić materiał.",updated_at:new Date().toISOString()}).eq("id",article.id);
    setMessage(error?error.message:"Materiał odesłany do poprawy.");
    if(!error){await logActivity({actorEmail:currentEmail,action:"article_changes_requested",entityType:"article",entityId:article.id,entityLabel:article.title,details:{note:note.trim()||"Proszę poprawić materiał."}});await load();}
  }

  if(allowed===null)return <main className="manage-page">ŁADOWANIE…</main>;
  if(!allowed)return <main className="manage-page"><h1>DOSTĘP<br/><em>ZAMKNIĘTY.</em></h1></main>;

  return <main className="manage-page">
    <header>
      <a className="wordmark" href="/">STREET<span>SCOPE</span></a>
      <nav>
        <a href="/redakcja/dashboard">DASHBOARD</a>
        <a href="/redakcja/material">EDYTOR</a>
        {canApprove&&<a href="/redakcja/zespol">ZESPÓŁ</a>}
        {canApprove&&<a href="/redakcja/rekrutacja">REKRUTACJA</a>}
        {canApprove&&<a href="/redakcja/statystyki">STATYSTYKI</a>}
        {canApprove&&<a href="/redakcja/archiwum">ARCHIWUM</a>}
        {canApprove&&<a href="/redakcja/logi">LOGI</a>}
      </nav>
    </header>

    <section className="manage-head">
      <p className="kicker"><i/> {canApprove?"PANEL NACZELNEGO":"PANEL REDAKCJI"}</p>
      <h1>{canApprove?<>ZARZĄDZAJ<br/><em>REDAKCJĄ.</em></>:<>ZGŁOSZENIA<br/><em>MIESZKAŃCÓW.</em></>}</h1>
      <p>{message}</p>
    </section>

    {canApprove&&<section className="approval-section">
      <p className="kicker"><i/> MATERIAŁY DO AKCEPTACJI</p>
      {reviews.length?<div className="approval-list">{reviews.map(article=><article key={article.id}>
        <span>{article.category} · OD {article.author_email}</span>
        <h2>{article.title}</h2>
        <p>{article.excerpt}</p>
        {article.review_note&&<small>OSTATNIA UWAGA: {article.review_note}</small>}
        <div>
          <a href={`/redakcja/material?id=${article.id}`}>OTWÓRZ I POPRAW →</a>
          <button onClick={()=>requestChanges(article)}>ODEŚLIJ DO POPRAWY</button>
          <button className="approve" onClick={()=>approve(article)}>ZATWIERDŹ I OPUBLIKUJ →</button>
        </div>
      </article>)}</div>:<p className="empty-note">Brak materiałów czekających na Twoją decyzję.</p>}
    </section>}

    <section className="manage-grid">
      <div>
        <p className="kicker"><i/> ZGŁOSZENIA OD MIESZKAŃCÓW</p>
        <div className="tip-list">{tips.length?tips.map(t=><article key={t.id}>
          <span>{t.status}</span>
          <h2>{t.title}</h2>
          <b>{t.district} · {new Date(t.created_at).toLocaleDateString("pl-PL")}</b>
          <p>{t.description}</p>
          {t.contact&&<small>KONTAKT: {t.contact}</small>}
          <div>
            <button onClick={()=>setTip(t.id,"reviewing")}>PRZYJMIJ</button>
            <button onClick={()=>setTip(t.id,"used")}>UŻYTE</button>
            <button onClick={()=>setTip(t.id,"archived")}>ODRZUĆ / ARCHIWIZUJ</button>
            <a href={`/redakcja/material?tip=${t.id}`}>ZAMIEŃ W MATERIAŁ →</a>
          </div>
        </article>):<p>Brak aktywnych zgłoszeń.</p>}</div>
      </div>
      <aside>
        <p className="kicker"><i/> BIBLIOTEKA MEDIÓW</p>
        <div className="media-library">{media.length?media.map(m=><button key={m.name} onClick={()=>copy(m.url)} title="Kliknij, aby skopiować link"><img src={m.url} alt=""/><span>KOPIUJ LINK</span></button>):<p>Nie ma jeszcze zdjęć.</p>}</div>
      </aside>
    </section>
  </main>;
}
