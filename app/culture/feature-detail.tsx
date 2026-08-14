"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import "./feature-detail.css";

type Kind="fashion"|"motor";
type Feature={id:number;kind:Kind;title:string;subtitle:string|null;description:string|null;image_url:string|null;gallery:string[]|null;person_name:string|null;location:string|null;vehicle_model:string|null;vehicle_year:string|null;owner_name:string|null;workshop:string|null;details:string|null;badge:string|null;created_at:string;views:number|null};

export function FeatureDetail({kind,params}:{kind:Kind;params:Promise<{id:string}>}){
  const [row,setRow]=useState<Feature|null>(null);const [missing,setMissing]=useState(false);
  useEffect(()=>{params.then(({id})=>{const n=Number(id);if(!Number.isInteger(n)||n<1){setMissing(true);return;}const client=getSupabase();client.from("street_features").select("*").eq("id",n).eq("kind",kind).eq("published",true).is("archived_at",null).maybeSingle().then(({data})=>{if(!data)setMissing(true);else{setRow(data as Feature);client.rpc("increment_feature_views",{feature_id:n}).then(()=>setRow(current=>current?{...current,views:(current.views??0)+1}:current));}});});},[params,kind]);
  const isFashion=kind==="fashion";
  if(missing)return <main className="feature-missing"><a href={`/${kind}`} className="wordmark">STREET<span>SCOPE</span></a><h1>TEGO {isFashion?"LOOKU":"BUILDU"}<br/><em>TU NIE MA.</em></h1><a href={`/${kind}`}>← WRÓĆ</a></main>;
  if(!row)return <main className="feature-loading">ŁADOWANIE…</main>;
  const gallery=(row.gallery||[]).filter(Boolean);const date=new Date(row.created_at).toLocaleDateString("pl-PL");
  return <main className={`feature-page ${kind}`}><header><a href="/" className="wordmark">STREET<span>SCOPE</span></a><nav><a href={`/${kind}`}>← {isFashion?"FASHION":"MOTOR"}</a><a href={isFashion?"/motor":"/fashion"}>{isFashion?"MOTOR":"FASHION"}</a></nav></header><section className="feature-hero"><img src={row.image_url||"/images/hero.png"} alt=""/><div/><article><span>{row.badge||(isFashion?"STREET LOOK":"STREET BUILD")}</span><small>{date} · {row.views??0} ODSŁON · STREETSCOPE</small><h1>{row.title}</h1><p>{row.subtitle||row.description}</p></article></section><section className="feature-body"><aside><p>PROFILE</p>{isFashion?<><b>{row.person_name||"STREET STYLE"}</b>{row.location&&<span>{row.location}</span>}{row.details&&<div><small>OUTFIT / DETAILS</small><strong>{row.details}</strong></div>}</>:<><b>{row.vehicle_model||row.title}</b>{row.vehicle_year&&<span>{row.vehicle_year}</span>}{row.owner_name&&<div><small>OWNER</small><strong>{row.owner_name}</strong></div>}{row.workshop&&<div><small>WORKSHOP</small><strong>{row.workshop}</strong></div>}{row.details&&<div><small>MODS / SPEC</small><strong>{row.details}</strong></div>}</>}</aside><article><p className="feature-kicker">{isFashion?"THE LOOK":"THE BUILD"}</p><h2>{row.title}</h2><p>{row.description||row.subtitle||"StreetScope dokumentuje kulturę miasta od poziomu ulicy."}</p></article></section>{gallery.length>0&&<section className="feature-gallery"><p>{isFashion?"LOOKBOOK":"RAW SHOTS"}</p><div>{gallery.map((url,i)=><img src={url} alt="" key={`${url}-${i}`}/>)}</div></section>}<footer><a href={`/${kind}`}>WIĘCEJ {isFashion?"LOOKÓW":"BUILDÓW"} →</a><a href={isFashion?"/motor":"/fashion"}>{isFashion?"STREET MOTOR":"STREET FASHION"} →</a></footer></main>;
}
