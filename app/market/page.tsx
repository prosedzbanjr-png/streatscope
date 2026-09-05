"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { optimizedImageUrl } from "../../lib/image-optimization";
import "./market.css";
import "./market-promo.css";

type Vehicle = { id:number; brand:string; model:string; year:number|null; price:number; mileage:number|null; image_url:string|null; status:string; featured:boolean; drivetrain:string|null; transmission:string|null; sale_mode:"sale"|"auction"; auction_start_price:number|null; auction_min_increment:number|null; auction_current_bid:number|null; auction_bid_count:number|null; auction_ends_at:string|null };

export default function MarketPage(){
 const [rows,setRows]=useState<Vehicle[]>([]);
 const [q,setQ]=useState("");
 const [status,setStatus]=useState("available");
 const [loadError,setLoadError]=useState("");
 const load=async()=>{
  setLoadError("");
  const {data,error}=await getSupabase().from("market_vehicles").select("id,brand,model,year,price,mileage,image_url,status,featured,drivetrain,transmission,sale_mode,auction_start_price,auction_min_increment,auction_current_bid,auction_bid_count,auction_ends_at").eq("sale_mode","sale").order("featured",{ascending:false}).order("created_at",{ascending:false});
  if(error){setRows([]);setLoadError(`Nie udało się pobrać ofert Tow & Trade: ${error.message}`);return;}
  setRows((data as Vehicle[]|null)??[]);
 };
 useEffect(()=>{void load()},[]);
 const filtered=useMemo(()=>rows.filter(v=>(status==="all"||v.status===status)&&`${v.brand} ${v.model}`.toLowerCase().includes(q.toLowerCase())),[rows,q,status]);
 return <main className="market">
  <header className="market-nav"><a href="/" className="market-logo">STREET<span>SCOPE</span></a><nav><a className="active" href="/market">MARKET</a><a href="/licytacje">LICYTACJE</a></nav></header>
  <section className="market-hero market-hero-background">
   <div className="market-hero-copy"><p>STREETSCOPE × TOW & TRADE</p><h1>TOW &<br/><em>TRADE.</em></h1><span>Samochody dostępne w salonie Tow & Trade.</span></div>
  </section>
  <section className="market-showroom-note"><div><small>NIE WIDZISZ SWOJEGO WYMARZONEGO AUTA NA NASZEJ STRONIE?</small><h2>TO JESZCZE NIE ZNACZY, ŻE GO NIE MAMY.</h2><p>Posiadamy dostęp do <strong>szerokiej gamy pojazdów</strong>, również tych, których nie znajdziesz w naszej ofercie online. Odwiedź nas przy <strong>Little Bighorn Ave</strong>. Zapytaj sprzedawcę o dostępne pojazdy oraz <strong>indywidualną ofertę</strong>.</p><b>Twoje wymarzone auto może być bliżej, niż myślisz.</b></div></section>
  <section className="market-tools"><input placeholder="SZUKAJ MARKI / MODELU" value={q} onChange={e=>setQ(e.target.value)}/><select value={status} onChange={e=>setStatus(e.target.value)}><option value="available">NA SPRZEDAŻ</option><option value="reserved">ZAREZERWOWANE</option><option value="sold">SPRZEDANE</option><option value="all">WSZYSTKIE</option></select></section>
  <section className="market-content-background">
   <div className="market-grid market-grid-main">{loadError?<div className="market-empty"><strong>BŁĄD MARKETU</strong><br/>{loadError}</div>:<>{filtered.map(v=><a className={`vehicle-card ${v.status}`} href={`/market/${v.id}`} key={v.id}><div className="vehicle-photo" style={v.image_url?{backgroundImage:`url(${optimizedImageUrl(v.image_url,828)})`}:undefined}>{v.featured&&<b>WYRÓŻNIONE</b>}<span>{v.status==="sold"?"SPRZEDANE":v.status==="reserved"?"ZAREZERWOWANE":"NA SPRZEDAŻ"}</span></div><div className="vehicle-info"><small>{v.year||"—"}{v.mileage!=null?` · ${v.mileage.toLocaleString("pl-PL")} MI`:""}</small><h2>{v.brand} {v.model}</h2><p>{[v.drivetrain,v.transmission].filter(Boolean).join(" · ")||"TOW & TRADE"}</p><strong>CENA · ${Number(v.price||0).toLocaleString("en-US")}</strong></div></a>)}{filtered.length===0&&<div className="market-empty">BRAK OFERT PASUJĄCYCH DO FILTRÓW.</div>}</>}</div>
   <div className="market-yard-overlay"><small>NASZA LOKALIZACJA</small><h3>LITTLE BIGHORN AVE</h3><p>Wpadnij na plac, pogadaj ze sprzedawcą i sprawdź auta, których nie ma jeszcze online.</p></div>
  </section>
  <footer className="market-footer"><b>TOW & TRADE</b><span>We współpracy ze StreetScope.</span></footer>
 </main>;
}
