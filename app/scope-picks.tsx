"use client";
import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import "./scope-picks.css";

type Pick={id:number;kind:"fashion"|"motor";title:string;subtitle:string|null;image_url:string|null;badge:string|null;score_overall:number|null};
type Place={id:number;name:string;short_description:string|null;image_url:string|null;featured_label:string|null};

export function ScopePicks(){
 const [fashion,setFashion]=useState<Pick|null>(null);const [motor,setMotor]=useState<Pick|null>(null);const [place,setPlace]=useState<Place|null>(null);
 useEffect(()=>{let alive=true;(async()=>{const c=getSupabase();const [{data:f},{data:m},{data:p}]=await Promise.all([
 c.from("street_features").select("id,kind,title,subtitle,image_url,badge,score_overall").eq("kind","fashion").eq("published",true).eq("featured",true).is("archived_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle(),
 c.from("street_features").select("id,kind,title,subtitle,image_url,badge,score_overall").eq("kind","motor").eq("published",true).eq("featured",true).is("archived_at",null).order("created_at",{ascending:false}).limit(1).maybeSingle(),
 c.from("guide_places").select("id,name,short_description,image_url,featured_label").eq("active",true).eq("featured",true).is("archived_at",null).order("featured_order").limit(1).maybeSingle()
 ]);if(!alive)return;setFashion(f as Pick|null);setMotor(m as Pick|null);setPlace(p as Place|null)})();return()=>{alive=false}},[]);
 if(!fashion&&!motor&&!place)return null;
 return <section className="scope-picks"><header><div><p>SCOPE PICKS / REDAKCJA</p><h2>THIS WEEK&apos;S<br/><em>BEST.</em></h2></div><span>WYBRANE PRZEZ STREETSCOPE</span></header><div className="scope-picks-grid">{place&&<a href={`/guide/${place.id}`} className="scope-pick-card"><img src={place.image_url||"/images/hero.png"} alt=""/><div/><article><small>📍 PLACE OF THE WEEK</small><h3>{place.name}</h3><p>{place.short_description||"StreetScope poleca."}</p></article></a>}{fashion&&<a href={`/fashion/${fashion.id}`} className="scope-pick-card"><img src={fashion.image_url||"/images/hero.png"} alt=""/><div/><article><small>👕 {fashion.badge||"FIT OF THE WEEK"}</small><h3>{fashion.title}</h3><p>{fashion.score_overall!=null?`SCOPE SCORE ${fashion.score_overall.toFixed(1)}/10`:fashion.subtitle}</p></article></a>}{motor&&<a href={`/motor/${motor.id}`} className="scope-pick-card"><img src={motor.image_url||"/images/hero.png"} alt=""/><div/><article><small>🏎️ {motor.badge||"BUILD OF THE WEEK"}</small><h3>{motor.title}</h3><p>{motor.score_overall!=null?`SCOPE SCORE ${motor.score_overall.toFixed(1)}/10`:motor.subtitle}</p></article></a>}</div></section>;
}
