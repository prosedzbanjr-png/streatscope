"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import { logActivity } from "../../../lib/activity-log";
import "./manage.css";

type Tip = { id:number; title:string; district:string; description:string; contact:string|null; status:string; created_at:string; archived_at:string|null; archived_by:string|null };
type Review = { id:number; title:string; excerpt:string; category:string; author_email:string; updated_at:string; review_note:string|null; scheduled_for:string|null };
type FeatureReview = { id:number; kind:"fashion"|"motor"; title:string; subtitle:string|null; submitted_by:string|null; created_by:string|null; updated_at:string; review_note:string|null };
type GuideReview = { id:number; name:string; category:string; neighborhood:string|null; short_description:string|null; submitted_by:string|null; updated_at:string; review_note:string|null; featured:boolean; featured_home:boolean };

export default function ZarzadzajPage() {
  const [allowed, setAllowed] = useState<boolean|null>(null);
  const [canApprove, setCanApprove] = useState(false);
  const [currentEmail, setCurrentEmail] = useState("");
  const [tips, setTips] = useState<Tip[]>([]);
  const [media, setMedia] = useState<Array<{ name:string; url:string }>>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [featureReviews,setFeatureReviews]=useState<FeatureReview[]>([]);
  const [guideReviews,setGuideReviews]=useState<GuideReview[]>([]);
  const [message,setMessage] = useState("");
  const client = () => getSupabase();

  async function notifyPublished(articleId:number){
    const {data}=await client().auth.getSession();
    const token=data.session?.access_token;
    if(!token)return;
    await fetch("/api/discord",{method:"POST",headers:{"Content-Type":"application/json",Authorization:`Bearer ${token}`},body:JSON.stringify({event:"published",articleId})});
  }

  async function load() {
    const [{data: rows, error: tipsError}, storage, {data: queued}, {data: features}, {data: guides}] = await Promise.all([
      client().from("tips").select("id,title,district,description,contact,status,created_at,archived_at,archived_by").is("archived_at", null).neq("status", "archived").order("created_at", {ascending:false}).limit(80),
      client().storage.from("article-images").list("", {limit:100, sortBy:{column:"created_at",order:"desc"}}),
      client().from("articles").select("id,title,excerpt,category,author_email,updated_at,review_note,scheduled_for").eq("status","draft").eq("review_status","review").is("archived_at",null).order("updated_at",{ascending:false}),
      client().from("street_features").select("id,kind,title,subtitle,submitted_by,created_by,updated_at,review_note").eq("review_status","review").is("archived_at",null).order("updated_at",{ascending:false}),
      client().from("guide_places").select("id,name,category,neighborhood,short_description,submitted_by,updated_at,review_note,featured,featured_home").eq("review_status","review").order("updated_at",{ascending:false})
    ]);
    if (tipsError) setMessage(tipsError.message);
    setTips((rows as Tip[]|null)??[]);
    setReviews((queued as Review[]|null)??[]);
    setFeatureReviews((features as FeatureReview[]|null)??[]);
    setGuideReviews((guides as GuideReview[]|null)??[]);
    setMedia((storage.data??[]).filter(file => file.name).map(file => ({name:file.name,url:client().storage.from("article-images").getPublicUrl(file.name).data.publicUrl})));
  }

  useEffect(()=>{
    client().auth.getUser().then(async ({data})=>{
      const email=data.user?.email?.toLowerCase()||"";
      const {data:person}=await client().from("staff_accounts").select("role,active").eq("email",email).maybeSingle();
      const ok=Boolean(person?.active);
      const approver=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));
      setCurrentEmail(email);setAllowed(ok);setCanApprove(approver);if(ok) await load();
    });
  },[]);

  async function setTip(id:number,status:string){
    const update = status === "archived" ? {status:"archived", archived_at:new Date().toISOString(), archived_by:currentEmail || null} : {status, archived_at:null, archived_by:null};
    const {error}=await client().from("tips").update(update).eq("id",id);
    setMessage(error?error.message:status === "archived" ? "Zgłoszenie przeniesiono do archiwum." : "Status zgłoszenia zapisany.");
    if(!error){const tip=tips.find(item=>item.id===id);await logActivity({actorEmail:currentEmail,action:status==="archived"?"tip_archived":"tip_status_changed",entityType:"tip",entityId:id,entityLabel:tip?.title||`Zgłoszenie #${id}`,details:{status}});await load();}
  }

  async function copy(url:string){await navigator.clipboard.writeText(url);setMessage("Link do zdjęcia skopiowany.");}

  async function approve(article:Review){
    if(!window.confirm(`Opublikować „${article.title}”?`)) return;
    const now=new Date().toISOString();
    const publishTime=article.scheduled_for && new Date(article.scheduled_for).getTime() > Date.now() ? article.scheduled_for : now;
    const {data:author}=await client().from("staff_accounts").select("display_name,role").eq("email",article.author_email).maybeSingle();
    const authorRole=author?.role==="editor_in_chief"?"REDAKTOR NACZELNY":author?.role==="deputy_editor_in_chief"?"ZASTĘPCA REDAKTORA NACZELNEGO":"DZIENNIKARZ";
    const {error}=await client().from("articles").update({status:"published",review_status:"published",published_at:publishTime,approved_at:now,approved_by:currentEmail,review_note:null,reviewed_by:currentEmail,reviewed_at:now,author_name:author?.display_name||article.author_email.split("@")[0],author_role:authorRole,updated_at:now}).eq("id",article.id);
    if(!error){ if(publishTime===now) await notifyPublished(article.id); await logActivity({actorEmail:currentEmail,action:publishTime===now?"article_published":"article_scheduled",entityType:"article",entityId:article.id,entityLabel:article.title}); }
    setMessage(error?error.message:(publishTime===now?"Materiał zatwierdzony i opublikowany.":`Materiał zatwierdzony. Publikacja: ${new Date(publishTime).toLocaleString("pl-PL")}.`));
    if(!error)await load();
  }

  async function requestChanges(article:Review){
    const note=window.prompt("Napisz redaktorowi, co ma poprawić:",article.review_note||"");if(note===null)return;
    const {error}=await client().from("articles").update({status:"draft",review_status:"changes_requested",review_note:note.trim()||"Proszę poprawić materiał.",reviewed_by:currentEmail,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq("id",article.id);
    setMessage(error?error.message:"Materiał odesłany do poprawy.");if(!error){await logActivity({actorEmail:currentEmail,action:"article_changes_requested",entityType:"article",entityId:article.id,entityLabel:article.title,details:{note:note.trim()||"Proszę poprawić materiał."}});await load();}
  }

  async function approveFeature(item:FeatureReview){
    if(!confirm(`Opublikować ${item.kind==="fashion"?"LOOK":"BUILD"} „${item.title}”?`))return;const now=new Date().toISOString();
    const {error}=await client().from("street_features").update({published:true,review_status:"published",review_note:null,reviewed_by:currentEmail,reviewed_at:now,updated_at:now}).eq("id",item.id);
    setMessage(error?error.message:"LOOK / BUILD zatwierdzony i opublikowany.");if(!error){await logActivity({actorEmail:currentEmail,action:"feature_published",entityType:"feature",entityId:item.id,entityLabel:item.title,details:{kind:item.kind}});await load();}
  }
  async function changesFeature(item:FeatureReview){
    const note=prompt("Co dziennikarz ma poprawić?",item.review_note||"");if(note===null)return;const now=new Date().toISOString();
    const {error}=await client().from("street_features").update({published:false,review_status:"changes_requested",review_note:note.trim()||"Proszę poprawić wpis.",reviewed_by:currentEmail,reviewed_at:now,updated_at:now}).eq("id",item.id);
    setMessage(error?error.message:"LOOK / BUILD odesłany do poprawy.");if(!error){await logActivity({actorEmail:currentEmail,action:"feature_changes_requested",entityType:"feature",entityId:item.id,entityLabel:item.title,details:{kind:item.kind,note}});await load();}
  }
  async function approveGuide(item:GuideReview){
    if(!confirm(`Opublikować w Scope Guide „${item.name}”?`))return;const now=new Date().toISOString();
    const {error}=await client().from("guide_places").update({active:true,review_status:"published",review_note:null,reviewed_by:currentEmail,reviewed_at:now,updated_at:now}).eq("id",item.id);
    setMessage(error?error.message:"Wpis Scope Guide zatwierdzony i opublikowany.");if(!error){await logActivity({actorEmail:currentEmail,action:"guide_published",entityType:"guide_place",entityId:item.id,entityLabel:item.name});await load();}
  }
  async function changesGuide(item:GuideReview){
    const note=prompt("Co dziennikarz ma poprawić?",item.review_note||"");if(note===null)return;const now=new Date().toISOString();
    const {error}=await client().from("guide_places").update({active:false,review_status:"changes_requested",review_note:note.trim()||"Proszę poprawić wpis.",reviewed_by:currentEmail,reviewed_at:now,updated_at:now}).eq("id",item.id);
    setMessage(error?error.message:"Wpis Scope Guide odesłany do poprawy.");if(!error){await logActivity({actorEmail:currentEmail,action:"guide_changes_requested",entityType:"guide_place",entityId:item.id,entityLabel:item.name,details:{note}});await load();}
  }

  if(allowed===null)return <main className="manage-page">ŁADOWANIE…</main>;
  if(!allowed)return <main className="manage-page"><h1>DOSTĘP<br/><em>ZAMKNIĘTY.</em></h1></main>;

  return <main className="manage-page">
    <header><a className="wordmark" href="/">STREET<span>SCOPE</span></a><nav><a href="/redakcja/dashboard">DASHBOARD</a><a href="/redakcja/material">EDYTOR</a>{canApprove&&<a href="/redakcja/zespol">ZESPÓŁ</a>}{canApprove&&<a href="/redakcja/rekrutacja">REKRUTACJA</a>}{canApprove&&<a href="/redakcja/statystyki">STATYSTYKI</a>}{canApprove&&<a href="/redakcja/archiwum">ARCHIWUM</a>}{canApprove&&<a href="/redakcja/logi">LOGI</a>}</nav></header>
    <section className="manage-head"><p className="kicker"><i/> {canApprove?"PANEL NACZELNEGO":"PANEL REDAKCJI"}</p><h1>{canApprove?<>ZARZĄDZAJ<br/><em>REDAKCJĄ.</em></>:<>ZGŁOSZENIA<br/><em>MIESZKAŃCÓW.</em></>}</h1><p>{message}</p></section>

    {canApprove&&<section className="approval-section"><p className="kicker"><i/> ARTYKUŁY DO AKCEPTACJI</p>{reviews.length?<div className="approval-list">{reviews.map(article=><article key={article.id}><span>{article.category} · OD {article.author_email}</span><h2>{article.title}</h2><p>{article.excerpt}</p>{article.scheduled_for&&<small>PLANOWANA PUBLIKACJA: {new Date(article.scheduled_for).toLocaleString("pl-PL")}</small>}{article.review_note&&<small>OSTATNIA UWAGA: {article.review_note}</small>}<div><a href={`/redakcja/material?id=${article.id}`}>OTWÓRZ I POPRAW →</a><button onClick={()=>requestChanges(article)}>ODEŚLIJ DO POPRAWY</button><button className="approve" onClick={()=>approve(article)}>ZATWIERDŹ I OPUBLIKUJ →</button></div></article>)}</div>:<p className="empty-note">Brak artykułów czekających na decyzję.</p>}</section>}

    {canApprove&&<section className="approval-section"><p className="kicker"><i/> LOOK / BUILD DO AKCEPTACJI</p>{featureReviews.length?<div className="approval-list">{featureReviews.map(item=><article key={`feature-${item.id}`}><span>{item.kind==="fashion"?"FASHION / LOOK":"MOTOR / BUILD"} · OD {item.submitted_by||item.created_by||"REDAKCJI"}</span><h2>{item.title}</h2><p>{item.subtitle||"Street Culture"}</p><div><a href="/redakcja/kultura">OTWÓRZ EDYTOR →</a><button onClick={()=>changesFeature(item)}>ODEŚLIJ DO POPRAWY</button><button className="approve" onClick={()=>approveFeature(item)}>ZATWIERDŹ I OPUBLIKUJ →</button></div></article>)}</div>:<p className="empty-note">Brak LOOK / BUILD czekających na decyzję.</p>}</section>}

    {canApprove&&<section className="approval-section"><p className="kicker"><i/> SCOPE GUIDE DO AKCEPTACJI</p>{guideReviews.length?<div className="approval-list">{guideReviews.map(item=><article key={`guide-${item.id}`}><span>{item.category} · {item.neighborhood||"LOS SANTOS"} · OD {item.submitted_by||"REDAKCJI"}</span><h2>{item.name}</h2><p>{item.short_description||"Wpis Scope Guide"}</p><small>{item.featured?"★ WYRÓŻNIENIE · ":""}{item.featured_home?"PROMOCJA NA GŁÓWNEJ":"ZWYKŁY WPIS"}</small><div><a href="/redakcja/guide">OTWÓRZ EDYTOR →</a><button onClick={()=>changesGuide(item)}>ODEŚLIJ DO POPRAWY</button><button className="approve" onClick={()=>approveGuide(item)}>ZATWIERDŹ I OPUBLIKUJ →</button></div></article>)}</div>:<p className="empty-note">Brak wpisów Guide czekających na decyzję.</p>}</section>}

    <section className="manage-grid"><div><p className="kicker"><i/> ZGŁOSZENIA OD MIESZKAŃCÓW</p><div className="tip-list">{tips.length?tips.map(t=><article key={t.id}><span>{t.status}</span><h2>{t.title}</h2><b>{t.district} · {new Date(t.created_at).toLocaleDateString("pl-PL")}</b><p>{t.description}</p>{t.contact&&<small>KONTAKT: {t.contact}</small>}<div><button onClick={()=>setTip(t.id,"reviewing")}>PRZYJMIJ</button><button onClick={()=>setTip(t.id,"used")}>UŻYTE</button><button onClick={()=>setTip(t.id,"archived")}>ODRZUĆ / ARCHIWIZUJ</button><a href={`/redakcja/material?tip=${t.id}`}>ZAMIEŃ W MATERIAŁ →</a></div></article>):<p>Brak aktywnych zgłoszeń.</p>}</div></div><aside><p className="kicker"><i/> BIBLIOTEKA MEDIÓW</p><div className="media-library">{media.length?media.map(m=><button key={m.name} onClick={()=>copy(m.url)} title="Kliknij, aby skopiować link"><img src={m.url} alt=""/><span>KOPIUJ LINK</span></button>):<p>Nie ma jeszcze zdjęć.</p>}</div></aside></section>
  </main>;
}
