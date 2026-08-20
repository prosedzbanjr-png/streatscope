"use client";

import { useEffect, useRef } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";

type Access={status?:"pending"|"approved"|"rejected"};
type Bid={id:number;bidder_name:string|null;amount:number|null;created_at:string};
type Vehicle={auction_current_bid:number|null;auction_start_price:number|null;auction_min_increment:number|null;auction_bid_count:number|null;status:string;sale_mode:string};

export default function RealtimeAuctionSync(){
  const params=useParams<{id:string}>();
  const vehicleId=Number(params.id);
  const previousAccess=useRef<string>("");
  const syncingBids=useRef(false);
  const syncingAccess=useRef(false);
  const lastBidSync=useRef(0);
  const lastAccessSync=useRef(0);

  useEffect(()=>{
    if(!Number.isFinite(vehicleId))return;
    const sb=getSupabase();
    let stopped=false;

    const getToken=()=>localStorage.getItem(`tow-auction-${params.id}`)||"";

    const syncAccess=async(force=false)=>{
      const now=Date.now();
      if(syncingAccess.current||(!force&&now-lastAccessSync.current<1200))return;
      const token=getToken();
      if(!token)return;
      syncingAccess.current=true;
      lastAccessSync.current=now;
      try{
        const {data,error}=await sb.rpc("get_market_auction_access",{p_vehicle_id:vehicleId,p_bidder_token:token});
        if(error||stopped)return;
        const status=String((data as Access|null)?.status||"");
        if(previousAccess.current&&previousAccess.current!==status&&status==="approved"){
          sessionStorage.setItem(`tow-approved-${vehicleId}`,"1");
          window.location.reload();
          return;
        }
        previousAccess.current=status;
      }finally{
        syncingAccess.current=false;
      }
    };

    const syncBids=async(force=false)=>{
      const now=Date.now();
      if(syncingBids.current||(!force&&now-lastBidSync.current<900))return;
      syncingBids.current=true;
      lastBidSync.current=now;
      try{
        const [{data:bids,error:bidErr},{data:vehicle,error:vehicleErr}]=await Promise.all([
          sb.from("market_auction_bids").select("id,bidder_name,amount,created_at").eq("vehicle_id",vehicleId).order("amount",{ascending:false}).order("created_at",{ascending:false}).limit(50),
          sb.from("market_vehicles").select("auction_current_bid,auction_start_price,auction_min_increment,auction_bid_count,status,sale_mode").eq("id",vehicleId).maybeSingle()
        ]);
        if(stopped)return;
        if(!vehicleErr&&vehicle){
          const v=vehicle as Vehicle;
          const current=Number(v.auction_current_bid??v.auction_start_price??0);
          const increment=Number(v.auction_min_increment||500);
          const priceNodes=[document.querySelector<HTMLElement>(".vehicle-detail-head > strong"),document.querySelector<HTMLElement>(".auction-numbers > div:first-child b")];
          priceNodes.forEach(el=>{if(el)el.textContent=`$${current.toLocaleString("en-US")}`});
          const input=document.querySelector<HTMLInputElement>(".auction-bid-form input[type='number']");
          if(input){const min=current+increment;input.min=String(min);if(Number(input.value)<min)input.value=String(min)}
        }
        if(!bidErr){
          const list=((bids as Bid[]|null)??[]);
          const headCount=document.querySelector<HTMLElement>(".auction-history-head > b");
          if(headCount)headCount.textContent=`${list.length} ${list.length===1?"OFERTA":"OFERT"}`;
          const history=document.querySelector<HTMLElement>(".auction-history");
          if(history){
            let listEl=history.querySelector<HTMLElement>(".auction-bid-list");
            const empty=history.querySelector<HTMLElement>(".auction-no-bids");
            if(list.length&&!listEl){
              empty?.remove();
              listEl=document.createElement("div");
              listEl.className="auction-bid-list";
              history.appendChild(listEl);
            }
            if(listEl){
              listEl.innerHTML="";
              list.slice(0,5).forEach((bid,index)=>{
                const row=document.createElement("div");row.className=`auction-bid-row ${index===0?"leader":""}`;
                const badge=document.createElement("span");badge.textContent=index===0?"NAJWYŻSZA":"OFERTA";
                const who=document.createElement("strong");who.textContent=bid.bidder_name||"NIEZNANY UCZESTNIK";
                const amount=document.createElement("b");amount.textContent=`$${Number(bid.amount??0).toLocaleString("en-US")}`;
                const date=document.createElement("small");date.textContent=new Date(bid.created_at).toLocaleString("pl-PL");
                row.append(badge,who,amount,date);listEl!.appendChild(row);
              });
            }
          }
        }
      }finally{
        syncingBids.current=false;
      }
    };

    const approvedAfterReload=sessionStorage.getItem(`tow-approved-${vehicleId}`)==="1";
    if(approvedAfterReload)sessionStorage.removeItem(`tow-approved-${vehicleId}`);

    void syncAccess(true);
    void syncBids(true);

    const channel=sb.channel(`tow-auction-live-${vehicleId}`)
      .on("postgres_changes",{event:"*",schema:"public",table:"market_auction_bids",filter:`vehicle_id=eq.${vehicleId}`},()=>void syncBids())
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"market_auction_registrations",filter:`vehicle_id=eq.${vehicleId}`},()=>void syncAccess())
      .on("postgres_changes",{event:"UPDATE",schema:"public",table:"market_vehicles",filter:`id=eq.${vehicleId}`},()=>void syncBids())
      .subscribe();

    // Realtime jest głównym mechanizmem. Te interwały są tylko lekkim fallbackiem.
    const accessPoll=window.setInterval(()=>void syncAccess(true),8000);
    const bidPoll=window.setInterval(()=>void syncBids(true),12000);

    return()=>{
      stopped=true;
      window.clearInterval(accessPoll);
      window.clearInterval(bidPoll);
      void sb.removeChannel(channel);
    };
  },[params.id,vehicleId]);

  return null;
}
