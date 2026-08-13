"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../../lib/supabase";
import "./culture.css";

type Kind = "fashion" | "motor";
type Feature = {
  id:number; kind:Kind; title:string; subtitle:string|null; description:string|null; image_url:string|null;
  gallery:string[]|null; person_name:string|null; location:string|null; vehicle_model:string|null; vehicle_year:string|null;
  owner_name:string|null; workshop:string|null; details:string|null; badge:string|null; featured:boolean; created_at:string;
};

function meta(row:Feature) {
  if (row.kind === "fashion") return [row.person_name, row.location].filter(Boolean).join(" · ") || "STREET FASHION";
  return [row.vehicle_model, row.vehicle_year, row.owner_name ? `OWNER: ${row.owner_name}` : null].filter(Boolean).join(" · ") || "STREET MOTOR";
}

export function CultureHub({ kind }:{ kind:Kind }) {
  const [rows,setRows]=useState<Feature[]>([]); const [loading,setLoading]=useState(true);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const { data } = await getSupabase()
          .from("street_features")
          .select("*")
          .eq("kind", kind)
          .eq("published", true)
          .is("archived_at", null)
          .order("featured", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(30);
        if (!cancelled) setRows((data as Feature[] | null) || []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, [kind]);
  const hero=rows[0]; const rest=rows.slice(1);
  const isFashion=kind==="fashion";
  return <main className={`culture-page ${kind}`}>
    <header className="culture-nav"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/fashion" className={isFashion?"active":""}>FASHION</a><a href="/motor" className={!isFashion?"active":""}>MOTOR</a><a href="/wiadomosci">WIADOMOŚCI</a><a href="/">← GŁÓWNA</a></nav></header>
    <section className="culture-mast"><p className="culture-kicker">STREETSCOPE / {isFashion?"STYLE DESK":"MOTOR DESK"}</p><h1>{isFashion?<>STREET<br/><em>FASHION.</em></>:<>STREET<br/><em>MOTOR.</em></>}</h1><p>{isFashion?"Ludzie, outfity, nowe dropy i styl Los Santos — prosto z ulicy.":"Buildy, car meety, warsztaty i auta mieszkańców — bez katalogowego nadęcia."}</p></section>
    {loading ? <section className="culture-loading"><div/><div/><div/></section> : !hero ? <section className="culture-empty"><b>{isFashion?"PIERWSZY LOOK JESZCZE NIE WJECHAŁ.":"PIERWSZY BUILD JESZCZE NIE WJECHAŁ."}</b><p>Redakcja już może dodawać wpisy z panelu StreetScope.</p></section> : <>
      <section className="culture-hero">
        <img src={hero.image_url||"/images/hero.png"} alt=""/><div className="culture-hero-shade"/>
        <div className="culture-hero-copy"><span>{hero.badge|| (isFashion?"LOOK OF THE WEEK":"FEATURED BUILD")}</span><small>{meta(hero)}</small><h2>{hero.title}</h2><p>{hero.subtitle||hero.description}</p><a href={`/${kind}/${hero.id}`}>ZOBACZ {isFashion?"LOOK":"BUILD"} →</a></div>
      </section>
      <section className="culture-grid-head"><div><i/> <h2>{isFashion?"LOOKBOOK":"BUILDS & SPOTTED"}</h2></div><span>{String(rows.length).padStart(2,"0")} WPISÓW</span></section>
      <section className="culture-grid">
        {rest.map((row,index)=><a className="culture-card" href={`/${kind}/${row.id}`} key={row.id}><div><img src={row.image_url||"/images/hero.png"} alt=""/><span>{row.badge|| (index%3===0?"RAW":isFashion?"LOOK":"SPOTTED")}</span></div><small>{meta(row)}</small><h3>{row.title}</h3><p>{row.subtitle||row.description||"StreetScope / Los Santos"}</p><b>VIEW →</b></a>)}
      </section>
    </>}
    <section className="culture-cross"><div><p>STREET CULTURE</p><h2>{isFashion?"MASZ AUTO, KTÓRE POWINNIŚMY ZOBACZYĆ?":"MASZ FIT, KTÓRY POWINIEN TU TRAFIĆ?"}</h2></div><a href={isFashion?"/motor":"/fashion"}>{isFashion?"PRZEJDŹ DO MOTOR":"PRZEJDŹ DO FASHION"} →</a></section>
  </main>;
}
