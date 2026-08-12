"use client";

import { FormEvent, useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./team.css";

const CHIEF = "kujalowicze@gmail.com";
type Staff = { id:number; email:string; display_name:string|null; role:"editor"|"chief"; active:boolean; created_at:string };
export default function ZespolPage() {
  const [ok,setOk]=useState<boolean|null>(null); const [staff,setStaff]=useState<Staff[]>([]); const [email,setEmail]=useState(""); const [name,setName]=useState(""); const [message,setMessage]=useState(""); const client=()=>getSupabase();
  async function load(){const {data}=await client().from("staff_accounts").select("id,email,display_name,role,active,created_at").order("created_at",{ascending:false});setStaff((data as Staff[]|null)??[]);}
  useEffect(()=>{client().auth.getUser().then(async ({data})=>{const allowed=data.user?.email?.toLowerCase()===CHIEF;setOk(allowed);if(allowed)await load();});},[]);
  async function add(event:FormEvent){event.preventDefault();const normalized=email.trim().toLowerCase();const {error}=await client().from("staff_accounts").upsert({email:normalized,display_name:name.trim()||null,role:"editor",active:true},{onConflict:"email"});setMessage(error?error.message:`Dodano ${normalized}. Wyślij tej osobie link /redakcja/logowanie.`);if(!error){setEmail("");setName("");await load();}}
  async function toggle(person:Staff){const {error}=await client().from("staff_accounts").update({active:!person.active}).eq("id",person.id);setMessage(error?error.message:person.active?"Konto wyłączone.":"Konto aktywne.");if(!error)await load();}
  if(ok===null)return <main className="team-page">ŁADOWANIE…</main>;if(!ok)return <main className="team-page"><h1>DOSTĘP ZAMKNIĘTY.</h1></main>;
  return <main className="team-page"><header><a href="/" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/redakcja/material">EDYTOR</a><a href="/redakcja/zarzadzaj">AKCEPTACJA</a></nav></header><section className="team-head"><p className="kicker"><i/> NACZELNY</p><h1>ZESPÓŁ<br/><em>REDAKCJI.</em></h1><p>Dodaj pracownika, a potem wyślij mu adres <b>/redakcja/logowanie</b>. Nie tworzysz mu hasła — ustawia je sam.</p></section><section className="team-grid"><form onSubmit={add}><p className="kicker"><i/> NOWE KONTO</p><label>NAZWA / IMIĘ<input value={name} onChange={e=>setName(e.target.value)} placeholder="np. Jan Kowalski" /></label><label>E-MAIL PRACOWNIKA<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required placeholder="redaktor@email.pl" /></label><button className="primary">DODAJ REDAKTORA →</button><small>{message}</small></form><div><p className="kicker"><i/> AKTYWNE KONTA</p><div className="staff-list">{staff.map(person=><article key={person.id}><div><b>{person.display_name||"REDAKTOR"}</b><span>{person.email}</span><em>{person.role==="chief"?"NACZELNY":person.active?"REDAKTOR":"WYŁĄCZONE"}</em></div>{person.role!=="chief"&&<button onClick={()=>toggle(person)}>{person.active?"WYŁĄCZ":"WŁĄCZ"}</button>}</article>)}</div></div></section></main>;
}
