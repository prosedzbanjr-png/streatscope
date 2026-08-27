"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";

type Mode = "culture" | "guide";
type PreviewState = { id:number; href:string; isPublic:boolean } | null;

export default function HiddenPreviewButton({ mode }: { mode: Mode }) {
  const [preview,setPreview]=useState<PreviewState>(null);

  useEffect(()=>{
    let alive=true;
    let lastId=0;

    const sync=async()=>{
      const id=Number(new URLSearchParams(window.location.search).get("id")||0);
      if(!Number.isInteger(id)||id<1){lastId=0;if(alive)setPreview(null);return;}
      if(id===lastId)return;
      lastId=id;
      try{
        const client=getSupabase();
        if(mode==="guide"){
          const {data}=await client.from("guide_places").select("id,active").eq("id",id).maybeSingle();
          if(!alive)return;
          if(!data){setPreview(null);return;}
          setPreview({id,href:data.active?`/guide/${id}`:`/guide/${id}?preview=1`,isPublic:Boolean(data.active)});
          return;
        }
        const {data}=await client.from("street_features").select("id,kind,published").eq("id",id).maybeSingle();
        if(!alive)return;
        if(!data){setPreview(null);return;}
        const kind=data.kind==="motor"?"motor":"fashion";
        setPreview({id,href:data.published?`/${kind}/${id}`:`/${kind}/${id}?preview=1`,isPublic:Boolean(data.published)});
      }catch{if(alive)setPreview(null);}
    };

    void sync();
    const timer=window.setInterval(()=>{void sync();},500);
    return()=>{alive=false;window.clearInterval(timer);};
  },[mode]);

  if(!preview)return null;
  return <a href={preview.href} target="_blank" rel="noreferrer" style={{position:"fixed",right:22,bottom:22,zIndex:9998,background:preview.isPublic?"#171717":"#d71920",color:"#fff",border:"1px solid rgba(255,255,255,.25)",padding:"13px 16px",fontFamily:"DM Mono, monospace",fontSize:10,fontWeight:900,letterSpacing:".08em",textDecoration:"none",boxShadow:"0 10px 30px rgba(0,0,0,.35)"}}>{preview.isPublic?"PODGLĄD ↗":"UKRYTY PODGLĄD ↗"}</a>;
}
