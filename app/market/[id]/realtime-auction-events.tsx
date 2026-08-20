"use client";

import { useEffect } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";

type BidRow={id?:number;vehicle_id?:number;bidder_name?:string|null;amount?:number|null;created_at?:string};

export default function RealtimeAuctionEvents(){
  const params=useParams<{id:string}>();
  const vehicleId=Number(params.id);

  useEffect(()=>{
    if(!Number.isFinite(vehicleId))return;
    const sb=getSupabase();
    let disposed=false;

    const updateBidUi=(bid:BidRow)=>{
      if(disposed)return;
      const amount=Number(bid.amount??0);
      if(!Number.isFinite(amount)||amount<=0)return;
      const formatted=`$${amount.toLocaleString("en-US")}`;
      document.querySelectorAll<HTMLElement>(".vehicle-detail-head > strong,.auction-numbers > div:first-child b").forEach(el=>{el.textContent=formatted});
      const input=document.querySelector<HTMLInputElement>(".auction-bid-form input[type='number']");
      const incrementText=document.querySelector<HTMLElement>(".auction-numbers > div:nth-child(2) b")?.textContent||"500";
      const increment=Number(incrementText.replace(/[^0-9.]/g,""))||500;
      if(input){const next=amount+increment;input.min=String(next);if(Number(input.value)<next)input.value=String(next)}

      const list=document.querySelector<HTMLElement>(".auction-bid-list");
      const history=document.querySelector<HTMLElement>(".auction-history");
      if(history){
        const empty=history.querySelector<HTMLElement>(".auction-no-bids");
        if(empty)empty.remove();
        let target=list;
        if(!target){target=document.createElement("div");target.className="auction-bid-list";history.appendChild(target)}
        const row=document.createElement("div");row.className="auction-bid-row leader";
        const badge=document.createElement("span");badge.textContent="NAJWYŻSZA";
        const who=document.createElement("strong");who.textContent=bid.bidder_name||"NIEZNANY UCZESTNIK";
        const price=document.createElement("b");price.textContent=formatted;
        const time=document.createElement("small");time.textContent=new Date(bid.created_at||Date.now()).toLocaleString("pl-PL");
        target.querySelectorAll(".auction-bid-row.leader").forEach(old=>old.classList.remove("leader"));
        row.append(badge,who,price,time);target.prepend(row);
        const count=document.querySelector<HTMLElement>(".auction-history-head > b");
        if(count){const n=target.querySelectorAll(".auction-bid-row").length;count.textContent=`${n} ${n===1?"OFERTA":"OFERT"}`}
      }
    };

    const refreshAccessOnce=async()=>{
      const token=localStorage.getItem(`tow-auction-${params.id}`)||"";
      if(!token||disposed)return;
      const {data,error}=await sb.rpc("get_market_auction_access",{p_vehicle_id:vehicleId,p_bidder_token:token});
      if(error||disposed)return;
      if((data as {status?:string}|null)?.status==="approved")window.location.reload();
    };

    const channel=sb.channel(`tow-auction-events-${vehicleId}-${crypto.randomUUID()}`)
      .on("postgres_changes",{event:"INSERT",schema:"public",table:"market_auction_bids",filter:`vehicle_id=eq.${vehicleId}`},payload=>updateBidUi(payload.new as BidRow))
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"market_auction_registrations",filter:`vehicle_id=eq.${vehicleId}`},()=>{void refreshAccessOnce()})
      .subscribe();

    return()=>{disposed=true;void sb.removeChannel(channel)};
  },[params.id,vehicleId]);

  return null;
}
