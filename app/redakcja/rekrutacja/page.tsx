"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./recruitment.css";

type Application = { id:number; first_name:string; last_name:string; phone:string; email:string; message:string; status:"new"|"contacted"|"rejected"|"accepted"; created_at:string };
const labels:Record<Application["status"], string> = { new:"NOWE", contacted:"KONTAKT", rejected:"ODRZUCONE", accepted:"PRZYJĘTE" };

export default function RecruitmentPanel() {
  const [allowed,setAllowed]=useState<boolean|null>(null); const [rows,setRows]=useState<Application[]>([]); const [message,setMessage]=useState("");
  const client=()=>getSupabase();
  async function load(){const {data,error}=await client().from("recruitment_applications").select("id,first_name,last_name,phone,email,message,status,created_at").order("created_at",{ascending:false});if(error)setMessage(error.message);setRows((data as Application[]|null)??[]);}
  useEffect(()=>{client().auth.getUser().then(async({data})=>{const email=data.user?.email?.toLowerCase()||"";const {data:person}=await client().from("staff_accounts").select("active,role").eq("email",email).maybeSingle();const ok=Boolean(person?.active&&["editor_in_chief","deputy_editor_in_chief"].includes(person.role));setAllowed(ok);if(ok)await load();});},[]);
  async function setStatus(id:number,status:Application["status"]){const {error}=await client().from("recruitment_applications").update({status}).eq("id",id);setMessage(error?error.message:"Status zgłoszenia zapisany.");if(!error)await load();}
  if(allowed===null)return <main className="recruitment-panel">ŁADOWANIE…</main>;
  if(!allowed)return <main className="recruitment-panel"><h1>DOSTĘP<br/><em>ZAMKNIĘTY.</em></h1></main>;
  return <main className="recruitment-panel"><header><a className="wordmark" href="/">STREET<span>SCOPE</span></a><nav><a href="/redakcja/material">EDYTOR</a><a href="/redakcja/zarzadzaj">ZGŁOSZENIA</a><a href="/redakcja/zespol">ZESPÓŁ</a></nav></header><section className="recruitment-panel-head"><p className="kicker"><i/> NABÓR DO REDAKCJI</p><h1>ZGŁOSZENIA<br/><em>REKRUTACYJNE.</em></h1><p>{message||"Przeglądaj kandydatury i oznaczaj etap kontaktu."}</p></section><section className="application-list">{rows.length?rows.map(row=><article key={row.id}><aside><span className={`application-status status-${row.status}`}>{labels[row.status]}</span><b>{new Date(row.created_at).toLocaleDateString("pl-PL",{day:"2-digit",month:"long",year:"numeric"})}</b></aside><div><h2>{row.first_name} {row.last_name}</h2><p className="application-contact"><a href={`mailto:${row.email}`}>{row.email}</a><a href={`tel:${row.phone}`}>{row.phone}</a></p><p className="application-message">{row.message}</p><footer><button onClick={()=>setStatus(row.id,"contacted")}>OZNACZ: KONTAKT</button><button onClick={()=>setStatus(row.id,"accepted")}>PRZYJMIJ</button><button className="reject" onClick={()=>setStatus(row.id,"rejected")}>ODRZUĆ</button></footer></div></article>):<p className="empty">Brak zgłoszeń rekrutacyjnych.</p>}</section></main>;
}
