"use client";

import { ChangeEvent, FormEvent, useEffect, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./market-admin.css";

type V={
  id:number;brand:string;model:string;year:number|null;price:number;mileage:number|null;
  drivetrain:string|null;transmission:string|null;engine:string|null;color:string|null;
  description:string|null;image_url:string|null;gallery:string[]|null;
  seller_name:string|null;seller_phone:string|null;listed_by_name:string|null;
  status:string;featured:boolean;sale_mode:"sale"|"auction";
  auction_start_price:number|null;auction_min_increment:number|null;
  auction_current_bid:number|null;auction_bid_count:number|null;auction_ends_at:string|null;
};

const empty={brand:"",model:"",year:"",price:"",mileage:"",drivetrain:"",transmission:"",engine:"",color:"",description:"",seller_name:"Tow & Trade",seller_phone:"",status:"available",featured:false,sale_mode:"sale",auction_start_price:"",auction_min_increment:"500",auction_ends_at:""};

function toLocalInput(value:string|null){
  if(!value)return "";
  const d=new Date(value),pad=(n:number)=>String(n).padStart(2,"0");
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function MarketAdmin(){
  const [allowed,setAllowed]=useState<boolean|null>(null);
  const [rows,setRows]=useState<V[]>([]);
  const [form,setForm]=useState<any>(empty);
  const [editing,setEditing]=useState<number|null>(null);
  const [cover,setCover]=useState<File|null>(null);
  const [gallery,setGallery]=useState<File[]>([]);
  const [existingCover,setExistingCover]=useState("");
  const [existingGallery,setExistingGallery]=useState<string[]>([]);
  const [message,setMessage]=useState("");
  const [busy,setBusy]=useState(false);
  const s=()=>getSupabase();

  const load=async()=>{
    const {data,error}=await s().from("market_vehicles").select("*").order("created_at",{ascending:false});
    if(error){setMessage(`Błąd ładowania ofert: ${error.message}`);return;}
    setRows((data as V[]|null)??[]);
  };

  useEffect(()=>{(async()=>{
    const {data}=await s().auth.getUser();
    if(!data.user){setAllowed(false);return;}
    setAllowed(true);await load();
  })()},[]);

  const valid=(f:File)=>f.type.startsWith("image/")&&f.size<=8*1024*1024;
  const upload=async(f:File)=>{
    if(!valid(f))throw new Error("Zdjęcie musi mieć maks. 8 MB.");
    const ext=f.name.split(".").pop()||"jpg",path=`market-${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const {error}=await s().storage.from("article-images").upload(path,f,{contentType:f.type});
    if(error)throw error;
    return s().storage.from("article-images").getPublicUrl(path).data.publicUrl;
  };
  const onGallery=(e:ChangeEvent<HTMLInputElement>)=>{
    const files=Array.from(e.target.files||[]).filter(valid);
    setGallery(files.slice(0,Math.max(0,8-existingGallery.length)));e.target.value="";
  };

  const save=async(e:FormEvent)=>{
    e.preventDefault();setBusy(true);setMessage("");
    try{
      if(form.sale_mode==="sale"&&(!form.price||Number(form.price)<=0))throw new Error("Przy zwykłej ofercie ustaw cenę sprzedaży.");
      if(form.sale_mode==="auction"&&(!form.auction_start_price||!form.auction_ends_at))throw new Error("Przy licytacji ustaw cenę startową i termin zakończenia.");
      const image_url=cover?await upload(cover):existingCover||null;
      const fresh:string[]=[];for(const f of gallery)fresh.push(await upload(f));
      const payload={
        brand:form.brand,model:form.model,year:form.year?Number(form.year):null,
        price:Number(form.price)||0,mileage:form.mileage?Number(form.mileage):null,
        drivetrain:form.drivetrain||null,transmission:form.transmission||null,engine:form.engine||null,color:form.color||null,
        description:form.description||null,image_url,gallery:[...existingGallery,...fresh].slice(0,8),
        seller_name:form.seller_name||"Tow & Trade",seller_phone:form.seller_phone||null,
        status:form.status,featured:Boolean(form.featured),sale_mode:form.sale_mode,
        auction_start_price:form.sale_mode==="auction"?Number(form.auction_start_price)||0:null,
        auction_min_increment:form.sale_mode==="auction"?Math.max(1,Number(form.auction_min_increment)||500):500,
        auction_ends_at:form.sale_mode==="auction"?new Date(form.auction_ends_at).toISOString():null,
        updated_at:new Date().toISOString()
      };
      const res=editing
        ?await s().from("market_vehicles").update(payload).eq("id",editing)
        :await s().from("market_vehicles").insert({...payload,auction_current_bid:null,auction_bid_count:0});
      if(res.error)throw res.error;
      setMessage(editing?"OFERTA ZAKTUALIZOWANA.":form.sale_mode==="auction"?"LICYTACJA WYSTAWIONA.":"OFERTA SPRZEDAŻY WYSTAWIONA.");
      setForm(empty);setEditing(null);setCover(null);setGallery([]);setExistingCover("");setExistingGallery([]);await load();
    }catch(err){setMessage(err instanceof Error?err.message:"Nie udało się zapisać.")}finally{setBusy(false)}
  };

  const edit=(v:V)=>{
    setMessage(`EDYTUJESZ: ${v.brand} ${v.model}`);
    setEditing(v.id);
    setForm({...v,year:v.year??"",mileage:v.mileage??"",auction_start_price:v.auction_start_price??"",auction_min_increment:v.auction_min_increment??500,auction_ends_at:toLocalInput(v.auction_ends_at)});
    setExistingCover(v.image_url||"");setExistingGallery(v.gallery||[]);setCover(null);setGallery([]);
    window.scrollTo({top:0,behavior:"smooth"});
  };

  const setStatus=async(v:V,status:string)=>{
    setBusy(true);setMessage("");
    try{
      const {error}=await s().from("market_vehicles").update({status,updated_at:new Date().toISOString()}).eq("id",v.id);
      if(error)throw error;
      setRows(prev=>prev.map(row=>row.id===v.id?{...row,status}:row));
      setMessage(`${v.brand} ${v.model}: status zmieniony na ${status==="available"?"AKTYWNE":status==="reserved"?"ZAREZERWOWANE":"SPRZEDANE"}.`);
    }catch(err){setMessage(err instanceof Error?`Nie udało się zmienić statusu: ${err.message}`:"Nie udało się zmienić statusu.");}
    finally{setBusy(false)}
  };

  const cancelEdit=()=>{setEditing(null);setForm(empty);setExistingCover("");setExistingGallery([]);setCover(null);setGallery([]);setMessage("")};

  if(allowed===null)return <main className="market-admin">ŁADOWANIE…</main>;
  if(!allowed)return <main className="market-admin"><h1>ZALOGUJ SIĘ.</h1><a href="/redakcja/logowanie">PRZEJDŹ DO LOGOWANIA →</a></main>;

  const auctions=rows.filter(v=>v.sale_mode==="auction");
  const offers=rows.filter(v=>v.sale_mode==="sale");

  const renderRow=(v:V)=>{
    const ended=v.sale_mode==="auction"&&Boolean(v.auction_ends_at)&&new Date(v.auction_ends_at as string).getTime()<=Date.now();
    const listedBy=v.listed_by_name?.trim()||"—";
    return <article key={v.id}>
      <div className="thumb" style={v.image_url?{backgroundImage:`url(${v.image_url})`}:undefined}/>
      <div>
        <small>{v.sale_mode==="auction"?(ended?"LICYTACJA ZAKOŃCZONA":"LICYTACJA"):v.status==="sold"?"SPRZEDANE":v.status==="reserved"?"ZAREZERWOWANE":"NA SPRZEDAŻ"}</small>
        <h3>{v.brand} {v.model}</h3>
        <b>{v.sale_mode==="auction"?`$${Number(v.auction_current_bid??v.auction_start_price??0).toLocaleString("en-US")} · ${v.auction_bid_count||0} ofert`:`$${Number(v.price||0).toLocaleString("en-US")}`}</b>
        <small style={{display:"block",marginTop:8}}>WYSTAWIŁ: <strong>{listedBy}</strong></small>
        {v.sale_mode==="sale"&&<small style={{display:"block",marginTop:5}}>SPRZEDAJĄCY: <strong>{v.seller_name||"Tow & Trade"}</strong>{v.seller_phone?` · ${v.seller_phone}`:""}</small>}
      </div>
      <div className="row-actions">
        <button type="button" disabled={busy} onClick={()=>edit(v)}>EDYTUJ</button>
        <button type="button" disabled={busy||v.status==="available"} onClick={()=>void setStatus(v,"available")}>AKTYWUJ</button>
        <button type="button" disabled={busy||v.status==="reserved"} onClick={()=>void setStatus(v,"reserved")}>REZERWUJ</button>
        <button type="button" disabled={busy||v.status==="sold"} onClick={()=>void setStatus(v,"sold")}>SPRZEDANE</button>
      </div>
    </article>;
  };

  return <main className="market-admin">
    <header><a href="/" className="logo">STREET<span>SCOPE</span></a><nav><a href="/market" target="_blank">OTWÓRZ TOW & TRADE</a><a href="/redakcja/dashboard">REDAKCJA</a></nav></header>
    <section className="admin-head"><p>STREETSCOPE × TOW & TRADE</p><h1>TOW<br/><em>& TRADE.</em></h1><span>{message||"Wystaw auto na sprzedaż albo wrzuć je na licytację."}</span></section>

    <form onSubmit={save} className="market-form">
      <label>TRYB OFERTY<select value={form.sale_mode} onChange={e=>setForm({...form,sale_mode:e.target.value})}><option value="sale">SPRZEDAŻ</option><option value="auction">LICYTACJA</option></select></label>
      <label>STATUS<select value={form.status} onChange={e=>setForm({...form,status:e.target.value})}><option value="available">AKTYWNE</option><option value="reserved">ZAREZERWOWANE</option><option value="sold">SPRZEDANE</option></select></label>
      <label>MARKA<input required value={form.brand} onChange={e=>setForm({...form,brand:e.target.value})}/></label>
      <label>MODEL<input required value={form.model} onChange={e=>setForm({...form,model:e.target.value})}/></label>
      <label>ROK<input type="number" value={form.year} onChange={e=>setForm({...form,year:e.target.value})}/></label>
      {form.sale_mode==="sale"&&<label>CENA SPRZEDAŻY $<input required type="number" min="1" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/></label>}
      <label>PRZEBIEG MI<input type="number" value={form.mileage} onChange={e=>setForm({...form,mileage:e.target.value})}/></label>
      <label>NAPĘD<input value={form.drivetrain} onChange={e=>setForm({...form,drivetrain:e.target.value})} placeholder="RWD / AWD / FWD"/></label>
      <label>SKRZYNIA<input value={form.transmission} onChange={e=>setForm({...form,transmission:e.target.value})}/></label>
      <label>SILNIK<input value={form.engine} onChange={e=>setForm({...form,engine:e.target.value})}/></label>
      <label>KOLOR<input value={form.color} onChange={e=>setForm({...form,color:e.target.value})}/></label>
      <label>SPRZEDAJĄCY<input value={form.seller_name} onChange={e=>setForm({...form,seller_name:e.target.value})} placeholder="Tow & Trade / imię właściciela"/></label>
      <label>TELEFON SPRZEDAJĄCEGO<input value={form.seller_phone} onChange={e=>setForm({...form,seller_phone:e.target.value})}/></label>
      {form.sale_mode==="auction"&&<>
        <div className="full auction-editor-title">USTAWIENIA LICYTACJI</div>
        <label>CENA STARTOWA $<input required type="number" min="0" value={form.auction_start_price} onChange={e=>setForm({...form,auction_start_price:e.target.value})}/></label>
        <label>MINIMALNE PODBICIE $<input required type="number" min="1" step="1" value={form.auction_min_increment} onChange={e=>setForm({...form,auction_min_increment:e.target.value})}/><small>Domyślnie $500.</small></label>
        <label className="full">KONIEC LICYTACJI<input required type="datetime-local" value={form.auction_ends_at} onChange={e=>setForm({...form,auction_ends_at:e.target.value})}/></label>
      </>}
      <label className="full">OPIS<textarea value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></label>
      <label className="full">OKŁADKA<input type="file" accept="image/*" onChange={e=>setCover(e.target.files?.[0]||null)}/>{existingCover&&<small>Obecna okładka zostanie zachowana, jeśli nie wybierzesz nowej.</small>}</label>
      <label className="full">GALERIA — DO 8 ZDJĘĆ<input type="file" accept="image/*" multiple onChange={onGallery}/><small>{existingGallery.length} obecnych + {gallery.length} nowych</small></label>
      <label className="check full"><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/> WYRÓŻNIONE</label>
      <div className="full actions"><button type="submit" disabled={busy}>{busy?"WYSYŁAM…":editing?"ZAPISZ ZMIANY":form.sale_mode==="auction"?"WYSTAW NA LICYTACJĘ":"WYSTAW OFERTĘ"}</button>{editing&&<button type="button" onClick={cancelEdit}>ANULUJ</button>}</div>
    </form>

    <section className="market-list market-list-auctions"><h2>LICYTACJE <span>{auctions.length}</span></h2>{auctions.length?auctions.map(renderRow):<p style={{padding:"20px 0",color:"#777"}}>BRAK LICYTACJI.</p>}</section>
    <section className="market-list market-list-sales"><h2>OFERTY SPRZEDAŻY <span>{offers.length}</span></h2>{offers.length?offers.map(renderRow):<p style={{padding:"20px 0",color:"#777"}}>BRAK OFERT SPRZEDAŻY.</p>}</section>
  </main>;
}
