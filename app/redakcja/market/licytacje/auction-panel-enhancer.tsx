"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../../../lib/supabase";

type AuctionMeta={id:number;listed_by_name:string|null};

export default function AuctionPanelEnhancer(){
  const [query,setQuery]=useState("");
  const [meta,setMeta]=useState<Record<number,string>>({});

  useEffect(()=>{
    (async()=>{
      const {data}=await getSupabase().from("market_vehicles").select("id,listed_by_name").eq("sale_mode","auction");
      const map:Record<number,string>={};
      for(const row of ((data as AuctionMeta[]|null)??[])) map[row.id]=row.listed_by_name?.trim()||"—";
      setMeta(map);
    })();
  },[]);

  useEffect(()=>{
    const apply=()=>{
      const section=Array.from(document.querySelectorAll<HTMLElement>(".market-list")).find(el=>el.querySelector("h2")?.textContent?.includes("LICYTACJE"));
      if(!section)return;
      const needle=query.trim().toLowerCase();
      section.querySelectorAll<HTMLElement>(":scope > article").forEach(card=>{
        const name=card.querySelector("h3")?.textContent?.toLowerCase()||"";
        const idText=card.querySelector("small")?.textContent?.match(/#(\d+)/)?.[1];
        const id=idText?Number(idText):0;
        card.style.display=!needle||name.includes(needle)?"":"none";
        const info=card.children.item(1) as HTMLElement|null;
        if(info&&id&&!info.querySelector(".auction-listed-by")){
          const el=document.createElement("div");
          el.className="auction-listed-by";
          el.innerHTML=`<span>WYSTAWIŁ</span><strong>${meta[id]||"—"}</strong>`;
          info.appendChild(el);
        }else if(info&&id){
          const strong=info.querySelector<HTMLElement>(".auction-listed-by strong");
          if(strong)strong.textContent=meta[id]||"—";
        }
      });
    };
    apply();
    const observer=new MutationObserver(apply);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[query,meta]);

  return <div className="auction-search-dock">
    <div><small>BAZA LICYTACJI</small><strong>SZYBKIE WYSZUKIWANIE</strong></div>
    <label><span>⌕</span><input value={query} onChange={e=>setQuery(e.target.value)} placeholder="SZUKAJ PO MARCE LUB MODELU..."/></label>
    {query&&<button type="button" onClick={()=>setQuery("")}>WYCZYŚĆ</button>}
  </div>;
}
