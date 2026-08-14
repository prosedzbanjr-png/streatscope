"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import { logActivity } from "../../../lib/activity-log";
import "./archive.css";

type ArchivedMaterial = { key:string; id:number; kind:"article"|"fashion"|"motor"|"guide"; title:string; meta:string; author:string; archived_at:string; archived_by:string|null };
type ArchivedTip = { id:number; title:string; district:string; description:string; contact:string|null; status:string; created_at:string; archived_at:string; archived_by:string|null };
type ArchiveTab = "materials" | "tips";
const kindLabel={article:"ARTYKUŁ",fashion:"LOOK",motor:"BUILD",guide:"SCOPE GUIDE"} as const;

export default function ArchivePage(){
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [materials,setMaterials]=useState<ArchivedMaterial[]>([]);
  const [tips,setTips]=useState<ArchivedTip[]>([]);
  const [query,setQuery]=useState("");
  const [message,setMessage]=useState("");
  const [tab,setTab]=useState<ArchiveTab>("materials");
  const [currentEmail,setCurrentEmail]=useState("");
  const client=()=>getSupabase();

  async function load(){
    const [articles,features,guides,tipRows] = await Promise.all([
      client().from("articles").select("id,title,category,author_email,archived_at,archived_by").not("archived_at","is",null).order("archived_at",{ascending:false}),
      client().from("street_features").select("id,kind,title,created_by,submitted_by,archived_at").not("archived_at","is",null).order("archived_at",{ascending:false}),
      client().from("guide_places").select("id,name,category,neighborhood,submitted_by,archived_at,archived_by").not("archived_at","is",null).order("archived_at",{ascending:false}),
      client().from("tips").select("id,title,district,description,contact,status,created_at,archived_at,archived_by").or("archived_at.not.is.null,status.eq.archived").order("archived_at",{ascending:false,nullsFirst:false})
    ]);
    const errors=[articles.error,features.error,guides.error,tipRows.error].filter(Boolean);
    if(errors.length)setMessage(errors[0]?.message||"Nie udało się wczytać części archiwum.");
    const out:ArchivedMaterial[]=[];
    for(const r of (articles.data??[]) as any[])out.push({key:`article-${r.id}`,id:r.id,kind:"article",title:r.title,meta:r.category||"NEWS",author:r.author_email||"REDAKCJA",archived_at:r.archived_at,archived_by:r.archived_by});
    for(const r of (features.data??[]) as any[])out.push({key:`feature-${r.id}`,id:r.id,kind:r.kind==="motor"?"motor":"fashion",title:r.title,meta:r.kind==="motor"?"MOTOR / BUILD":"FASHION / LOOK",author:r.submitted_by||r.created_by||"REDAKCJA",archived_at:r.archived_at,archived_by:null});
    for(const r of (guides.data??[]) as any[])out.push({key:`guide-${r.id}`,id:r.id,kind:"guide",title:r.name,meta:[r.category,r.neighborhood].filter(Boolean).join(" · ")||"SCOPE GUIDE",author:r.submitted_by||"REDAKCJA",archived_at:r.archived_at,archived_by:r.archived_by});
    out.sort((a,b)=>new Date(b.archived_at).getTime()-new Date(a.archived_at).getTime());
    setMaterials(out);setTips((tipRows.data as ArchivedTip[]|null)??[]);
  }

  useEffect(()=>{const params=new URLSearchParams(window.location.search);if(params.get("typ")==="zgloszenia")setTab("tips");client().auth.getUser().then(async({data})=>{const email=data.user?.email?.toLowerCase()||"";const {data:person}=await client().from("staff_accounts").select("active,role").eq("email",email).maybeSingle();const ok=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));setCurrentEmail(email);setAllowed(ok);if(ok)await load();});},[]);

  async function restoreMaterial(row:ArchivedMaterial){
    if(!confirm(`Przywrócić „${row.title}”?`))return;const now=new Date().toISOString();
    if(row.kind==="article"){const {error}=await client().from("articles").update({archived_at:null,archived_by:null,updated_at:now}).eq("id",row.id);if(error){setMessage(error.message);return;}await logActivity({actorEmail:currentEmail,action:"article_restored",entityType:"article",entityId:row.id,entityLabel:row.title});}
    else if(row.kind==="guide"){const {error}=await client().from("guide_places").update({archived_at:null,archived_by:null,active:false,review_status:"draft",updated_at:now}).eq("id",row.id);if(error){setMessage(error.message);return;}await logActivity({actorEmail:currentEmail,action:"guide_restored",entityType:"guide_place",entityId:row.id,entityLabel:row.title});}
    else {const {error}=await client().from("street_features").update({archived_at:null,published:false,review_status:"draft",updated_at:now}).eq("id",row.id);if(error){setMessage(error.message);return;}await logActivity({actorEmail:currentEmail,action:"feature_restored",entityType:"feature",entityId:row.id,entityLabel:row.title,details:{kind:row.kind}});}
    setMessage("Materiał został przywrócony jako niepubliczny szkic.");await load();
  }

  async function restoreTip(row:ArchivedTip){if(!confirm(`Przywrócić zgłoszenie „${row.title}”?`))return;const {error}=await client().from("tips").update({status:"new",archived_at:null,archived_by:null}).eq("id",row.id);setMessage(error?error.message:"Zgłoszenie zostało przywrócone do aktywnych.");if(!error){await logActivity({actorEmail:currentEmail,action:"tip_restored",entityType:"tip",entityId:row.id,entityLabel:row.title});await load();}}
  async function deleteArticle(row:ArchivedMaterial){if(row.kind!=="article")return;if(!confirm(`USUNĄĆ TRWALE materiał „${row.title}”?\n\nTej operacji nie da się cofnąć.`))return;const {error}=await client().from("articles").delete().eq("id",row.id);setMessage(error?error.message:"Materiał został trwale usunięty.");if(!error){await logActivity({actorEmail:currentEmail,action:"article_deleted",entityType:"article",entityId:row.id,entityLabel:row.title});await load();}}
  async function deleteTip(row:ArchivedTip){if(!confirm(`USUNĄĆ TRWALE zgłoszenie „${row.title}”?\n\nTej operacji nie da się cofnąć.`))return;const {error}=await client().from("tips").delete().eq("id",row.id);setMessage(error?error.message:"Zgłoszenie zostało trwale usunięte.");if(!error){await logActivity({actorEmail:currentEmail,action:"tip_deleted",entityType:"tip",entityId:row.id,entityLabel:row.title});await load();}}

  const filteredMaterials=useMemo(()=>{const q=query.trim().toLowerCase();return !q?materials:materials.filter(r=>`${r.title} ${r.meta} ${r.author} ${kindLabel[r.kind]}`.toLowerCase().includes(q));},[materials,query]);
  const filteredTips=useMemo(()=>{const q=query.trim().toLowerCase();return !q?tips:tips.filter(r=>[r.title,r.district,r.description,r.contact||"",r.archived_by||""].some(v=>v.toLowerCase().includes(q)));},[tips,query]);
  function switchTab(next:ArchiveTab){setTab(next);setQuery("");window.history.replaceState(null,"",next==="tips"?"/redakcja/archiwum?typ=zgloszenia":"/redakcja/archiwum");}

  if(allowed===null)return <main className="archive-page">ŁADOWANIE…</main>;
  if(!allowed)return <main className="archive-page"><h1>DOSTĘP<br/><em>ZAMKNIĘTY.</em></h1></main>;
  const isMaterials=tab==="materials";
  return <main className="archive-page"><header><a className="wordmark" href="/">STREET<span>SCOPE</span></a><nav><a href="/redakcja/dashboard">DASHBOARD</a><a href="/redakcja/materialy">MATERIAŁY</a><a href="/redakcja/zarzadzaj">ZGŁOSZENIA</a><a href="/redakcja/rekrutacja">REKRUTACJA</a></nav></header>
    <section className="archive-head"><p className="kicker"><i/> ARCHIWUM REDAKCYJNE</p><h1>{isMaterials?<>USUNIĘTE<br/><em>MATERIAŁY.</em></>:<>ARCHIWUM<br/><em>ZGŁOSZEŃ.</em></>}</h1><p>{message||(isMaterials?"Artykuły, LOOK, BUILD i Scope Guide możesz przywrócić bez utraty historii.":"Odrzucone zgłoszenia możesz przywrócić albo usunąć trwale.")}</p><div className="archive-tabs" role="tablist"><button className={isMaterials?"active":""} onClick={()=>switchTab("materials")}>MATERIAŁY <span>{materials.length}</span></button><button className={!isMaterials?"active":""} onClick={()=>switchTab("tips")}>ZGŁOSZENIA <span>{tips.length}</span></button></div><input value={query} onChange={e=>setQuery(e.target.value)} placeholder={isMaterials?"SZUKAJ MATERIAŁU…":"SZUKAJ ZGŁOSZENIA…"}/></section>
    {isMaterials?<section className="archive-list">{filteredMaterials.length?filteredMaterials.map(row=><article key={row.key}><div><span>{kindLabel[row.kind]} · {row.meta}</span><h2>{row.title}</h2><p>Autor: {row.author}</p><small>Archiwizacja: {new Date(row.archived_at).toLocaleString("pl-PL")}{row.archived_by?` · przez ${row.archived_by}`:""}</small></div><div className="archive-actions"><button onClick={()=>restoreMaterial(row)}>PRZYWRÓĆ →</button>{row.kind==="article"&&<button className="danger" onClick={()=>deleteArticle(row)}>USUŃ TRWALE</button>}</div></article>):<p>Archiwum materiałów jest puste albo nic nie pasuje do wyszukiwania.</p>}</section>:<section className="archive-list tips-archive">{filteredTips.length?filteredTips.map(row=><article key={row.id}><div><span>{row.district} · ZGŁOSZENIE</span><h2>{row.title}</h2><p>{row.description}</p>{row.contact&&<small>Kontakt: {row.contact}</small>}<small>Archiwizacja: {row.archived_at?new Date(row.archived_at).toLocaleString("pl-PL"):"stary wpis"}{row.archived_by?` · przez ${row.archived_by}`:""}</small></div><div className="archive-actions"><button onClick={()=>restoreTip(row)}>PRZYWRÓĆ →</button><button className="danger" onClick={()=>deleteTip(row)}>USUŃ TRWALE</button></div></article>):<p>Archiwum zgłoszeń jest puste albo nic nie pasuje do wyszukiwania.</p>}</section>}
  </main>;
}
