"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import { optimizedImageUrl } from "../../lib/image-optimization";
import "../market/market.css";
import "../market/market-promo.css";

type Vehicle={id:number;brand:string;model:string;year:number|null;mileage:number|null;image_url:string|null;status:string;featured:boolean;auction_start_price:number|null;auction_min_increment:number|null;auction_current_bid:number|null;auction_bid_count:number|null;auction_ends_at:string|null};

export default function AuctionsPage(){
 const [rows,setRows]=useState<Vehicle[]>([]);const [q,setQ]=useState("");const [showEnded,setShowEnded]=useState(false);
 const load=async()=>{const {data}=await getSupabase().from("market_vehicles").select("id,brand,model,year,mileage,image_url,status,featured,auction_start_price,auction_min_increment,auction_current_bid,auction_bid_count,auction_ends_at").eq("sale_mode","auction").order("featured",{ascending:false}).order("auction_ends_at",{ascending:true});setRows((data as Vehicle[]|null)??[])};
 useEffect(()=>{void load()},[]);
 const filtered=useMemo(()=>rows.filter(v=>{const ended=!v.auction_ends_at||new Date(v.auction_ends_at)<=new Date();return (showEnded||!ended)&&`${v.brand} ${v.model}`.toLowerCase().includes(q.toLowerCase())}),[rows,q,showEnded]);
 return <main className="market">
  <header className="market-nav"><a href="/" className="market-logo">STREET<span>SCOPE</span></a><nav><a href="/market">MARKET</a><a className="active" href="/licytacje">LICYTACJE</a></nav></header>
  <section className="market-hero market-hero-background"><div className="market-hero-copy"><p>TOW & TRADE · LICYTACJE</p><h1>LICY<br/><em>TACJE.</em></h1><span>Dealer wystawia. Miasto podbija. Najwyższa oferta zgarnia wóz.</span></div></section>
  <section className="market-showroom-note"><div><small>NIE WIDZISZ SWOJEGO WYMARZONEGO AUTA NA NASZEJ STRONIE?</small><h2>TO JESZCZE NIE ZNACZY, ŻE GO NIE MAMY.</h2><p>Posiadamy dostęp do <strong>szerokiej gamy pojazdów</strong>, również tych, których nie znajdziesz w naszej ofercie online. Odwiedź nas przy <strong>Little Bighorn Ave</strong>. Zapytaj sprzedawcę o dostępne pojazdy oraz <strong>indywidualną ofertę</strong>.</p><b>Twoje wymarzone auto może być bliżej, niż myślisz.</b></div></section>
  <section className="market-tools"><input placeholder="SZUKAJ MARKI / MODELU" value={q} onChange={e=>setQ(e.target.value)}/><select value={showEnded?"all":"active"} onChange={e=>setShowEnded(e.target.value==="all")}><option value="active">AKTYWNE LICYTACJE</option><option value="all">TAKŻE ZAKOŃCZONE</option></select></section>
  <section className="market-content-background"><div className="market-grid market-grid-main">{filtered.map(v=>{const ended=!v.auction_ends_at||new Date(v.auction_ends_at)<=new Date();const current=v.auction_current_bid??v.auction_start_price??0;return <a className={`vehicle-card auction-card ${ended?"sold":""}`} href={`/market/${v.id}`} key={v.id}><div className="vehicle-photo" style={v.image_url?{backgroundImage:`url(${optimizedImageUrl(v.image_url,828)})`}:undefined}>{v.featured&&<b>WYRÓŻNIONE</b>}<span>{ended?"ZAKOŃCZONA":"LICYTACJA"}</span></div><div className="vehicle-info"><small>{v.year||"—"}{v.mileage!=null?` · ${v.mileage.toLocaleString("pl-PL")} MI`:""}</small><h2>{v.brand} {v.model}</h2><p>{v.auction_bid_count||0} ofert · minimalne podbicie $${Number(v.auction_min_increment||500).toLocaleString("en-US")}</p><strong>{v.auction_current_bid?"AKTUALNA OFERTA":"CENA STARTOWA"} · $${Number(current).toLocaleString("en-US")}</strong><small className="auction-end">{ended?"LICYTACJA ZAKOŃCZONA":`KONIEC: ${new Date(v.auction_ends_at!).toLocaleString("pl-PL")}`}</small></div></a>})}{filtered.length===0&&<div className="market-empty">BRAK AKTYWNYCH LICYTACJI.</div>}</div><div className="market-yard-overlay"><small>TOW & TRADE</small><h3>LITTLE BIGHORN AVE</h3><p>Licytuj online albo wpadnij na plac i sprawdź pozostałe samochody dostępne u dealera.</p></div></section>
  <footer className="market-footer"><b>TOW & TRADE</b><span>Licytacje we współpracy ze StreetScope.</span></footer>
 </main>;
}
