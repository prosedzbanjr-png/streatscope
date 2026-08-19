"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";
import "../market.css";

type Vehicle={id:number;brand:string;model:string;year:number|null;price:number;mileage:number|null;drivetrain:string|null;transmission:string|null;engine:string|null;color:string|null;description:string|null;image_url:string|null;gallery:string[]|null;seller_name:string|null;seller_phone:string|null;status:string};

export default function MarketVehiclePage(){
 const params=useParams<{id:string}>();const [v,setV]=useState<Vehicle|null>(null);const [loading,setLoading]=useState(true);
 useEffect(()=>{(async()=>{const {data}=await getSupabase().from("market_vehicles").select("*").eq("id",Number(params.id)).maybeSingle();setV((data as Vehicle|null)??null);setLoading(false);})()},[params.id]);
 if(loading)return <main className="market"><div className="market-empty">ŁADOWANIE OFERTY…</div></main>;
 if(!v)return <main className="market"><div className="market-empty">TEJ OFERTY JUŻ NIE MA.</div></main>;
 const photos=[v.image_url,...(v.gallery||[])].filter(Boolean) as string[];
 return <main className="market"><header className="market-nav"><a href="/" className="market-logo">STREET<span>SCOPE</span></a><nav><a href="/market">← TOW & TRADE</a></nav></header><section className="vehicle-detail"><div className="vehicle-detail-head"><div><p>STREETSCOPE × TOW & TRADE</p><h1>{v.brand}<br/><em>{v.model}</em></h1><span>{v.status==="sold"?"SPRZEDANE":v.status==="reserved"?"ZAREZERWOWANE":"NA SPRZEDAŻ"}</span></div><strong>${Number(v.price||0).toLocaleString("en-US")}</strong></div>{photos[0]&&<img className="vehicle-cover" src={photos[0]} alt={`${v.brand} ${v.model}`}/>}<div className="vehicle-specs"><div><small>ROK</small><b>{v.year||"—"}</b></div><div><small>PRZEBIEG</small><b>{v.mileage!=null?`${v.mileage.toLocaleString("pl-PL")} MI`:"—"}</b></div><div><small>SILNIK</small><b>{v.engine||"—"}</b></div><div><small>NAPĘD</small><b>{v.drivetrain||"—"}</b></div><div><small>SKRZYNIA BIEGÓW</small><b>{v.transmission||"—"}</b></div><div><small>KOLOR</small><b>{v.color||"—"}</b></div></div><section className="vehicle-copy"><div><p className="kicker">OFERTA TOW & TRADE</p><h2>O TYM WOZIE</h2><p>{v.description||"Tow & Trade nie dodało jeszcze opisu tej oferty."}</p></div><aside><small>SPRZEDAJĄCY</small><h3>{v.seller_name||"Tow & Trade"}</h3><p>{v.seller_phone||"Kontakt bezpośrednio przez Tow & Trade."}</p><a href="/market">WRÓĆ DO OFERT →</a></aside></section>{photos.length>1&&<section className="vehicle-gallery">{photos.slice(1).map((url,i)=><img src={url} alt="" key={`${url}-${i}`}/>)}</section>}</section></main>;
}