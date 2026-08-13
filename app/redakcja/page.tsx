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
      const chief=["editor_in_chief","deputy_editor_in_chief"].includes(person.role);
      window.location.replace(chief?"/redakcja/dashboard":"/redakcja/material");
    });
  },[]);
  return <main style={{minHeight:"100vh",background:"#111",color:"white",display:"grid",placeItems:"center",fontFamily:"monospace",letterSpacing:"2px"}}>OTWIERAM PANEL…</main>;
}
