"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./dashboard.css";

type Counts = { review:number; tips:number; recruitment:number; archivedMaterials:number; archivedTips:number; staff:number; published:number; scheduled:number };
type LogRow = { id:number; actor_email:string; action:string; entity_type:string; entity_label:string|null; created_at:string };
const actionLabel:Record<string,string> = {
  article_created:"UTWORZONO MATERIAŁ", article_updated:"ZAKTUALIZOWANO MATERIAŁ", article_submitted:"WYSŁANO DO AKCEPTACJI", article_published:"OPUBLIKOWANO MATERIAŁ", article_scheduled:"ZAPLANOWANO PUBLIKACJĘ", article_archived:"ZARCHIWIZOWANO MATERIAŁ", article_restored:"PRZYWRÓCONO MATERIAŁ", article_deleted:"USUNIĘTO MATERIAŁ TRWALE", article_changes_requested:"ODESŁANO DO POPRAWY",
  tip_status_changed:"ZMIENIONO STATUS ZGŁOSZENIA", tip_archived:"ZARCHIWIZOWANO ZGŁOSZENIE", tip_restored:"PRZYWRÓCONO ZGŁOSZENIE", tip_deleted:"USUNIĘTO ZGŁOSZENIE TRWALE", recruitment_status_changed:"ZMIENIONO STATUS REKRUTACJI",
  staff_added:"DODANO KONTO", staff_updated:"ZMIENIONO DANE KONTA", staff_role_changed:"ZMIENIONO ROLĘ", staff_toggled:"ZMIENIONO DOSTĘP",
  feature_created:"DODANO LOOK / BUILD", feature_updated:"ZAKTUALIZOWANO LOOK / BUILD", feature_archived:"ZARCHIWIZOWANO LOOK / BUILD", feature_restored:"PRZYWRÓCONO LOOK / BUILD", feature_published:"OPUBLIKOWANO LOOK / BUILD", feature_changes_requested:"ODESŁANO LOOK / BUILD DO POPRAWY",
  guide_published:"OPUBLIKOWANO SCOPE GUIDE", guide_changes_requested:"ODESŁANO SCOPE GUIDE DO POPRAWY", guide_archived:"ZARCHIWIZOWANO SCOPE GUIDE", guide_restored:"PRZYWRÓCONO SCOPE GUIDE"
};

export default function DashboardPage(){
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [isChief,setIsChief]=useState(false);
  const [counts,setCounts]=useState<Counts>({review:0,tips:0,recruitment:0,archivedMaterials:0,archivedTips:0,staff:0,published:0,scheduled:0});
  const [logs,setLogs]=useState<LogRow[]>([]);
  const [message,setMessage]=useState("");
  const client=()=>getSupabase();

  useEffect(()=>{ client().auth.getUser().then(async({data})=>{
    const email=data.user?.email?.toLowerCase()||"";
    const {data:person}=await client().from("staff_accounts").select("role,active").eq("email",email).maybeSingle();
    const staffOk=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief","journalist"].includes(person.role));
    const chief=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));
    setAllowed(staffOk); setIsChief(chief); if(!staffOk)return;

    const now=new Date().toISOString();
    const common=await Promise.all([
      client().from("articles").select("id",{count:"exact",head:true}).eq("status","published").is("archived_at",null).lte("published_at",now),
      client().from("street_features").select("id",{count:"exact",head:true}).eq("published",true).is("archived_at",null),
      client().from("guide_places").select("id",{count:"exact",head:true}).eq("active",true).eq("review_status","published").is("archived_at",null),
      client().from("articles").select("id",{count:"exact",head:true}).eq("status","published").is("archived_at",null).gt("published_at",now)
    ]);
    const [publishedArticles,publishedFeatures,publishedGuides,scheduled]=common;
    let nextCounts:Counts={...counts,published:(publishedArticles.count||0)+(publishedFeatures.count||0)+(publishedGuides.count||0),scheduled:scheduled.count||0};
    const commonErrors=common.map(x=>x.error).filter(Boolean);

    if(chief){
      const admin=await Promise.all([
        client().from("articles").select("id",{count:"exact",head:true}).eq("review_status","review").is("archived_at",null),
        client().from("street_features").select("id",{count:"exact",head:true}).eq("review_status","review").is("archived_at",null),
        client().from("guide_places").select("id",{count:"exact",head:true}).eq("review_status","review").is("archived_at",null),
        client().from("tips").select("id",{count:"exact",head:true}).is("archived_at",null).neq("status","archived"),
        client().from("recruitment_applications").select("id",{count:"exact",head:true}).eq("status","new"),
        client().from("articles").select("id",{count:"exact",head:true}).not("archived_at","is",null),
        client().from("street_features").select("id",{count:"exact",head:true}).not("archived_at","is",null),
        client().from("guide_places").select("id",{count:"exact",head:true}).not("archived_at","is",null),
        client().from("tips").select("id",{count:"exact",head:true}).or("archived_at.not.is.null,status.eq.archived"),
        client().from("staff_accounts").select("id",{count:"exact",head:true}).eq("active",true),
        client().from("activity_logs").select("id,actor_email,action,entity_type,entity_label,created_at").order("created_at",{ascending:false}).limit(8)
      ]);
      const [articleReview,featureReview,guideReview,tips,recruitment,archivedArticles,archivedFeatures,archivedGuides,archivedTips,staff,recentLogs]=admin;
      nextCounts={...nextCounts,review:(articleReview.count||0)+(featureReview.count||0)+(guideReview.count||0),tips:tips.count||0,recruitment:recruitment.count||0,archivedMaterials:(archivedArticles.count||0)+(archivedFeatures.count||0)+(archivedGuides.count||0),archivedTips:archivedTips.count||0,staff:staff.count||0};
      setLogs((recentLogs.data as LogRow[]|null)??[]);
      const errors=[...commonErrors,...admin.map(x=>x.error).filter(Boolean)]; if(errors.length)setMessage(errors[0]?.message||"Nie udało się pobrać części danych.");
    } else if(commonErrors.length){setMessage(commonErrors[0]?.message||"Nie udało się pobrać części danych.");}

    setCounts(nextCounts);
  }); },[]);

  if(allowed===null)return <main className="chief-dashboard">ŁADOWANIE…</main>;
  if(!allowed)return <main className="chief-dashboard"><h1>DOSTĘP<br/><em>ZAMKNIĘTY.</em></h1></main>;

  return <main className="chief-dashboard">
    <header><a href="/" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/redakcja/materialy">MATERIAŁY</a><a href="/redakcja/material">EDYTOR</a><a href="/redakcja/kultura">FASHION / MOTOR</a><a href="/redakcja/market">TOW & TRADE</a><a href="/redakcja/guide">SCOPE GUIDE</a>{isChief&&<><a href="/redakcja/zarzadzaj">ZARZĄDZAJ</a><a href="/redakcja/logi">LOGI</a></>}</nav></header>
    <section className="dashboard-head"><p className="kicker"><i/> CENTRUM REDAKCJI</p><h1>PANEL<br/><em>{isChief?"NACZELNEGO.":"DZIENNIKARZA."}</em></h1><p>{message||"Najważniejsze miejsca redakcji w jednym panelu."}</p></section>

    {isChief&&<section className="dashboard-notifications"><p className="kicker"><i/> POWIADOMIENIA</p><div>{counts.review>0&&<a href="/redakcja/zarzadzaj"><b>{counts.review}</b><span>MATERIAŁY CZEKAJĄ NA AKCEPTACJĘ</span></a>}{counts.tips>0&&<a href="/redakcja/zarzadzaj"><b>{counts.tips}</b><span>AKTYWNE ZGŁOSZENIA MIESZKAŃCÓW</span></a>}{counts.recruitment>0&&<a href="/redakcja/rekrutacja"><b>{counts.recruitment}</b><span>NOWE KANDYDATURY</span></a>}{counts.scheduled>0&&<a href="/redakcja/zarzadzaj"><b>{counts.scheduled}</b><span>ZAPLANOWANE PUBLIKACJE</span></a>}{!counts.review&&!counts.tips&&!counts.recruitment&&!counts.scheduled&&<p>Brak rzeczy wymagających uwagi.</p>}</div></section>}

    <section className="dashboard-cards">
      <a href="/redakcja/materialy"><span>WSZYSTKIE MATERIAŁY</span><b>ALL</b><em>ARTYKUŁY · LOOK · BUILD · GUIDE →</em></a>
      <a href="/redakcja/material"><span>NOWY ARTYKUŁ</span><b>+</b><em>OTWÓRZ EDYTOR →</em></a>
      <a href="/redakcja/kultura"><span>FASHION / MOTOR</span><b>FM</b><em>LOOK & BUILD →</em></a>
      <a href="/redakcja/market"><span>TOW & TRADE</span><b>T&T</b><em>WYSTAW AUTO · EDYTUJ · SOLD →</em></a>
      <a href="/redakcja/guide"><span>SCOPE GUIDE</span><b>LS</b><em>MIEJSCA & PROMO →</em></a>
      <a href="/redakcja/statystyki"><span>OPUBLIKOWANE</span><b>{counts.published}</b><em>STATYSTYKI →</em></a>
      {isChief&&<><a href="/redakcja/zarzadzaj"><span>DO AKCEPTACJI</span><b>{counts.review}</b><em>OTWÓRZ KOLEJKĘ →</em></a><a href="/redakcja/zarzadzaj"><span>AKTYWNE ZGŁOSZENIA</span><b>{counts.tips}</b><em>PRZEJRZYJ →</em></a>}{isChief&&<><a href="/redakcja/rekrutacja"><span>NOWE REKRUTACJE</span><b>{counts.recruitment}</b><em>PRZEJRZYJ →</em></a><a href="/redakcja/zarzadzaj"><span>ZAPLANOWANE</span><b>{counts.scheduled}</b><em>HARMONOGRAM →</em></a><a href="/redakcja/zespol"><span>AKTYWNY ZESPÓŁ</span><b>{counts.staff}</b><em>ZARZĄDZAJ →</em></a><a href="/redakcja/archiwum"><span>ARCHIWUM</span><b>{counts.archivedMaterials+counts.archivedTips}</b><em>{counts.archivedMaterials} materiałów · {counts.archivedTips} zgłoszeń →</em></a></>}
    </section>

    {isChief&&<section className="dashboard-bottom"><div><p className="kicker"><i/> OSTATNIA AKTYWNOŚĆ</p>{logs.length?<div className="recent-logs">{logs.map(row=><article key={row.id}><span>{actionLabel[row.action]||row.action}</span><b>{row.entity_label||row.entity_type}</b><small>{row.actor_email} · {new Date(row.created_at).toLocaleString("pl-PL")}</small></article>)}</div>:<p>Brak zapisanych działań.</p>}<a className="logs-link" href="/redakcja/logi">PEŁNY DZIENNIK DZIAŁAŃ →</a></div><aside><p className="kicker"><i/> SKRÓTY</p><a href="/redakcja/materialy">WSZYSTKIE MATERIAŁY</a><a href="/redakcja/material">+ NOWY ARTYKUŁ</a><a href="/redakcja/kultura">FASHION / MOTOR</a><a href="/redakcja/market">TOW & TRADE</a><a href="/redakcja/guide">SCOPE GUIDE / PROMO</a><a href="/redakcja/rekrutacja">REKRUTACJA</a><a href="/redakcja/archiwum">ARCHIWUM</a><a href="/redakcja/zespol">ZESPÓŁ</a><a href="/redakcja/statystyki">STATYSTYKI</a></aside></section>}
  </main>;
}
