"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { getSupabase } from "../../../lib/supabase";

export default function ListedBy(){
  const params=useParams<{id:string}>();
  const [name,setName]=useState("");

  useEffect(()=>{
    const id=Number(params.id);
    if(!Number.isFinite(id))return;
    getSupabase().from("market_vehicles").select("seller_name").eq("id",id).maybeSingle().then(({data})=>{
      const value=String(data?.seller_name||"").trim();
      if(value&&value.toLowerCase()!=="tow & trade")setName(value);
    });
  },[params.id]);

  if(!name)return null;
  return <div className="market-listed-by"><small>WYSTAWIŁ</small><strong>{name}</strong><span>TOW &amp; TRADE</span></div>;
}
