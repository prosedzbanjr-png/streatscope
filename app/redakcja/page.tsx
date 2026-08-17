"use client";

import { useEffect } from "react";
import { getSupabase } from "../../lib/supabase";

export default function RedakcjaHome(){
  useEffect(()=>{
    const client=getSupabase();
    client.auth.getUser().then(async({data})=>{
      const email=data.user?.email?.toLowerCase()||"";
      if(!email){window.location.replace("/redakcja/logowanie");return;}
      const {data:person}=await client.from("staff_accounts").select("active,role").eq("email",email).maybeSingle();
      if(!person?.active){window.location.replace("/redakcja/logowanie");return;}
      window.location.replace("/redakcja/dashboard");
    });
  },[]);
  return <main style={{minHeight:"100vh",background:"#111",color:"white",display:"grid",placeItems:"center",fontFamily:"monospace",letterSpacing:"2px"}}>OTWIERAM PANEL…</main>;
}
