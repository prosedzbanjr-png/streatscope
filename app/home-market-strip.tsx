"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { optimizedImageUrl } from "../lib/image-optimization";
import "./home-market-strip.css";

type Vehicle={
  id:number;
  brand:string;
  model:string;
  price:number|null;
  image_url:string|null;
  status:string;
  featured:boolean;
  sale_mode:"sale"|"auction";
  auction_start_price:number|null;
  auction_current_bid:number|null;
  auction_bid_count:number|null;
  auction_ends_at:string|null;
};

export function HomeMarketStrip(){
  const [rows,setRows]=useState<Vehicle[]>([]);
  useEffect(()=>{(async()=>{
    const {data}=await getSupabase().from("market_vehicles")
      .select("id,brand,model,price,image_url,status,featured,sale_mode,auction_start_price,auction_current_bid,auction_bid_count,auction_ends_at")
      .eq("featured",true)
      .order("created_at",{ascending:false})
      .limit(12);
    setRows((data as Vehicle[]|null)??[]);
  })()},[]);

  const sales=useMemo(()=>rows.filter(v=>v.sale_mode==="sale"&&v.status!=="sold").slice(0,3),[rows]);
  const auctions=useMemo(()=>rows.filter(v=>v.sale_mode==="auction"&&v.status==="available"&&Boolean(v.auction_ends_at)&&new Date(v.auction_ends_at!).getTime()>Date.now()).slice(0,3),[rows]);
  if(sales.length===0&&auctions.length===0)return null;

  const card=(v:Vehicle)=>{
    const auction=v.sale_mode==="auction";
    const amount=auction?(v.auction_current_bid??v.auction_start_price??0):(v.price??0);
    return <a className={`home-market-card ${auction?"auction":"sale"}`} href={`/market/${v.id}`} key={v.id}>
      <div className="home-market-photo" style={v.image_url?{backgroundImage:`url(${optimizedImageUrl(v.image_url,828)})`}:undefined}>
        <span>{auction?"LICYTACJA":"NA SPRZEDAŻ"}</span>
      </div>
      <div className="home-market-info">
        <small>{auction?`${v.auction_bid_count||0} OFERT`:`TOW & TRADE`}</small>
        <h3>{v.brand} {v.model}</h3>
        <strong>{auction?(v.auction_current_bid?"AKTUALNA OFERTA":"CENA STARTOWA"):"CENA"} · ${Number(amount).toLocaleString("en-US")}</strong>
        {auction&&v.auction_ends_at&&<em>KONIEC: {new Date(v.auction_ends_at).toLocaleString("pl-PL")}</em>}
      </div>
    </a>;
  };

  return <section className="home-market-section">
    <div className="home-market-head">
      <div><p className="kicker"><i/> STREETSCOPE × TOW & TRADE</p><h2>WYBRANE <em>OFERTY.</em></h2><p>Wyróżnione samochody z marketu i aktywne licytacje Tow & Trade.</p></div>
      <div className="home-market-links"><a href="/market">CAŁY MARKET →</a><a href="/market/licytacje">LICYTACJE →</a></div>
    </div>
    {sales.length>0&&<div className="home-market-block"><div className="home-market-label"><span>MARKET</span><b>WYRÓŻNIONE AUTA</b></div><div className="home-market-grid">{sales.map(card)}</div></div>}
    {auctions.length>0&&<div className="home-market-block"><div className="home-market-label"><span>LICYTACJE</span><b>AKTYWNE TERAZ</b></div><div className="home-market-grid">{auctions.map(card)}</div></div>}
  </section>;
}
