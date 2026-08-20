"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";

type BidRow={id?:number;vehicle_id?:number;bidder_name?:string|null;amount?:number|null;created_at?:string};

type AccessRow={status?:"pending"|"approved"|"rejected"};

export default function RealtimeAuctionEvents(){
  const params=useParams<{id:string}>();
  const vehicleId=Number(params.id);
  const bidSyncing=useRef(false);
  const accessSyncing=useRef(false);
  const lastTopBidId=useRef<number|null>(null);
  const lastAccessStatus=useRef<string>("");

  useEffect(()=>{
    if(!Number.isFinite(vehicleId))return;
    const sb=getSupabase();
    let disposed=false;

    const renderBids=(rows:BidRow[],total:number)=>{
      if(disposed)return;
      const top=rows[0];
      if(top){
        const amount=Number(top.amount??0);
        if(Number.isFinite(amount)&&amount>0){
          const formatted=`$${amount.toLocaleString("en-US")}`;
          document.querySelectorAll<HTMLElement>(".vehicle-detail-head > strong,.auction-numbers > div:first-child b").forEach(el=>{el.textContent=formatted});
          const input=document.querySelector<HTMLInputElement>(".auction-bid-form input[type='number']");
          const incrementText=document.querySelector<HTMLElement>(".auction-numbers > div:nth-child(2) b")?.textContent||"500";
          const increment=Number(incrementText.replace(/[^0-9.]/g,""))||500;
          if(input){const next=amount+increment;input.min=String(next);if(!input.matches(":focus")&&Number(input.value)<next)input.value=String(next)}
        }
      }

      const history=document.querySelector<HTMLElement>(".auction-history");
      if(history){
        const empty=history.querySelector<HTMLElement>(".auction-no-bids");
        let list=history.querySelector<HTMLElement>(".auction-bid-list");
        if(rows.length===0){
          if(list)list.remove();
          if(!empty){const e=document.createElement("div");e.className="auction-no-bids";e.textContent="JESZCZE NIKT NIE ZALICYTOWAŁ.";history.appendChild(e)}
        }else{
          if(empty)empty.remove();
          if(!list){list=document.createElement("div");list.className="auction-bid-list";history.appendChild(list)}
          list.innerHTML="";
          rows.slice(0,5).forEach((bid,index)=>{
            const row=document.createElement("div");row.className=`auction-bid-row ${index===0?"leader":""}`;
            const badge=document.createElement("span");badge.textContent=index===0?"NAJWYŻSZA":"OFERTA";
            const who=document.createElement("strong");who.textContent=bid.bidder_name||"NIEZNANY UCZESTNIK";
            const price=document.createElement("b");price.textContent=`$${Number(bid.amount??0).toLocaleString("en-US")}`;
            const time=document.createElement("small");time.textContent=new Date(bid.created_at||Date.now()).toLocaleString("pl-PL");
            row.append(badge,who,price,time);list!.appendChild(row);
          });
        }
      }
      const count=document.querySelector<HTMLElement>(".auction-history-head > b");
      if(count)count.textContent=`${total} ${total===1?"OFERTA":"OFERT"}`;
      lastTopBidId.current=top?.id??null;
    };

    const syncBids=async()=>{
      if(disposed||bidSyncing.current||document.visibilityState==="hidden")return;
      bidSyncing.current=true;
      try{
        const {data,error,count}=await sb.from("market_auction_bids")
          .select("id,vehicle_id,bidder_name,amount,created_at",{count:"exact"})
          .eq("vehicle_id",vehicleId)
          .order("amount",{ascending:false})
          .order("created_at",{ascending:false})
          .limit(5);
        if(!error&&!disposed)renderBids((data as BidRow[]|null)??[],count??0);
      }finally{bidSyncing.current=false}
    };

    const syncAccess=async()=>{
      if(disposed||accessSyncing.current||document.visibilityState==="hidden")return;
      const pending=document.querySelector(".auction-access-box.pending");
      if(!pending)return;
      const token=localStorage.getItem(`tow-auction-${params.id}`)||"";
      if(!token)return;
      accessSyncing.current=true;
      try{
        const {data,error}=await sb.rpc("get_market_auction_access",{p_vehicle_id:vehicleId,p_bidder_token:token});
        if(error||disposed)return;
        const status=String((data as AccessRow|null)?.status||"");
        if(!lastAccessStatus.current)lastAccessStatus.current=status;
        if(status==="approved"&&lastAccessStatus.current!=="approved"){
          lastAccessStatus.current="approved";
          window.location.reload();
          return;
        }
        lastAccessStatus.current=status;
      }finally{accessSyncing.current=false}
    };

    const channel=sb.channel(`tow-auction-${vehicleId}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"market_auction_bids",filter:`vehicle_id=eq.${vehicleId}`},()=>{void syncBids()})
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"market_auction_registrations",filter:`vehicle_id=eq.${vehicleId}`},()=>{void syncAccess()})
      .subscribe();

    void syncBids();
    void syncAccess();

    // Lekki fallback tylko na wypadek, gdy websocket/Realtme po drodze zgubi event.
    // To jest jeden mały SELECT, bez reloadowania strony i bez pełnego odpytywania całej bazy.
    const bidTimer=window.setInterval(()=>void syncBids(),4000);
    const accessTimer=window.setInterval(()=>void syncAccess(),6000);
    const onVisible=()=>{if(document.visibilityState==="visible"){void syncBids();void syncAccess()}};
    document.addEventListener("visibilitychange",onVisible);

    return()=>{
      disposed=true;
      window.clearInterval(bidTimer);
      window.clearInterval(accessTimer);
      document.removeEventListener("visibilitychange",onVisible);
      void sb.removeChannel(channel);
    };
  },[params.id,vehicleId]);

  return null;
}
