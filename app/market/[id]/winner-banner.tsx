"use client";

import { useEffect } from "react";

export default function WinnerBanner(){
  useEffect(()=>{
    const applyWinner=()=>{
      const closed=document.querySelector<HTMLElement>(".auction-closed");
      if(!closed)return;

      const leader=document.querySelector<HTMLElement>(".auction-bid-row.leader");
      const winnerName=leader?.querySelector<HTMLElement>("strong")?.textContent?.trim();
      const winnerAmount=leader?.querySelector<HTMLElement>("b")?.textContent?.trim();

      if(winnerName){
        closed.innerHTML=`<div style="text-align:center"><small style="display:block;color:#d71920;font-weight:950;letter-spacing:1.4px;margin-bottom:8px">LICYTACJA ZAKOŃCZONA</small><strong style="display:block;font-size:26px;color:#fff">WYGRAŁ: ${winnerName.replace(/[<>&]/g,"")}</strong>${winnerAmount?`<b style="display:block;margin-top:8px;font-size:20px;color:#d71920">${winnerAmount.replace(/[<>&]/g,"")}</b>`:""}</div>`;
      }else{
        closed.innerHTML='<div style="text-align:center"><small style="display:block;color:#d71920;font-weight:950;letter-spacing:1.4px;margin-bottom:8px">LICYTACJA ZAKOŃCZONA</small><strong style="display:block;font-size:24px;color:#fff">BRAK ZŁOŻONYCH OFERT</strong></div>';
      }
    };

    applyWinner();
    const observer=new MutationObserver(applyWinner);
    observer.observe(document.body,{childList:true,subtree:true});
    return()=>observer.disconnect();
  },[]);

  return null;
}
