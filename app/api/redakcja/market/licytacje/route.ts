import { jsonError } from "../../../../../lib/server-security";

const allowedRoles = new Set(["dealer", "editor_in_chief", "deputy_editor_in_chief"]);

async function fetchTimed(input: RequestInfo | URL, init: RequestInit = {}, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

async function getCaller(url:string, anonKey:string, token:string){
  const response=await fetchTimed(`${url}/auth/v1/user`,{headers:{apikey:anonKey,Authorization:`Bearer ${token}`},cache:"no-store"},8000);
  if(!response.ok)return null;
  return await response.json() as {email?:string};
}

async function getRole(url:string, serviceKey:string, email:string){
  const response=await fetchTimed(`${url}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email.toLowerCase())}&active=eq.true&select=role&limit=1`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},cache:"no-store"},8000);
  if(!response.ok)return null;
  const rows = await response.json() as Array<{role:string}>;
  return rows[0]?.role||null;
}

function num(value:unknown,fallback:number|null=null){
  if(value===null||value===undefined||value==="")return fallback;
  const n=Number(value);
  return Number.isFinite(n)?n:fallback;
}
function text(value:unknown){return typeof value==="string"&&value.trim()?value.trim():null;}
function errorMessage(error:unknown){
  if(error instanceof Error && error.name==="AbortError")return "Przekroczono czas połączenia z Supabase. Spróbuj ponownie.";
  return error instanceof Error?error.message:"Nieznany błąd.";
}

async function authorize(request:Request){
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
  if(!url||!anonKey||!serviceKey)return {error:jsonError("Zapis licytacji nie jest skonfigurowany.",503,"not_configured")};
  const authHeader=request.headers.get("authorization")||"";
  const token=authHeader.toLowerCase().startsWith("bearer ")?authHeader.slice(7).trim():"";
  if(!token)return {error:jsonError("Brak autoryzacji.",401,"unauthorized")};
  const caller=await getCaller(url,anonKey,token);
  const email=caller?.email?.toLowerCase()||"";
  const role=email?await getRole(url,serviceKey,email):null;
  if(!email||!role||!allowedRoles.has(role))return {error:jsonError("Nie masz uprawnień do zarządzania licytacjami.",403,"forbidden")};
  return {url,serviceKey,email};
}

export async function POST(request:Request){
  try{
    const auth=await authorize(request);
    if("error" in auth)return auth.error;
    const {url,serviceKey,email}=auth;

    const body=await request.json();
    const brand=text(body.brand); const model=text(body.model);
    const start=num(body.auction_start_price); const increment=Math.max(1,num(body.auction_min_increment,500)??500);
    const ends=text(body.auction_ends_at);
    if(!brand||!model)return jsonError("Podaj markę i model.",400,"invalid_vehicle");
    if(start===null||start<0)return jsonError("Podaj poprawną cenę startową.",400,"invalid_start_price");
    if(!ends||Number.isNaN(Date.parse(ends)))return jsonError("Podaj poprawny termin zakończenia.",400,"invalid_end_date");
    if(new Date(ends).getTime()<=Date.now())return jsonError("Koniec licytacji musi być w przyszłości.",400,"end_date_in_past");

    const payload={
      brand,model,
      year:num(body.year),price:num(body.price,0)??0,mileage:num(body.mileage),
      drivetrain:text(body.drivetrain),transmission:text(body.transmission),engine:text(body.engine),color:text(body.color),description:text(body.description),
      image_url:text(body.image_url),gallery:Array.isArray(body.gallery)?body.gallery.filter((x:unknown)=>typeof x==="string").slice(0,8):[],
      seller_name:text(body.seller_name)||"Tow & Trade",seller_phone:text(body.seller_phone),
      status:["available","reserved","sold"].includes(body.status)?body.status:"available",featured:Boolean(body.featured),
      sale_mode:"auction",auction_start_price:start,auction_min_increment:increment,auction_current_bid:null,auction_bid_count:0,
      auction_ends_at:new Date(ends).toISOString(),created_by:email,updated_at:new Date().toISOString()
    };

    const response=await fetchTimed(`${url}/rest/v1/market_vehicles`,{
      method:"POST",
      headers:{"Content-Type":"application/json",apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,Prefer:"return=representation"},
      body:JSON.stringify(payload),cache:"no-store"
    },10000);
    const result=await response.json().catch(()=>null);
    if(!response.ok)return jsonError(typeof result?.message==="string"?result.message:`Supabase odrzucił zapis licytacji (${response.status}).`,500,"auction_insert_failed");
    const row=Array.isArray(result)?result[0]:null;
    if(!row?.id||row.sale_mode!=="auction")return jsonError("Licytacja nie została poprawnie zapisana.",500,"auction_not_persisted");
    return Response.json({ok:true,auction:row});
  }catch(error){
    console.error("Auction create failed",error);
    return jsonError(errorMessage(error),500,"auction_create_failed");
  }
}

export async function PATCH(request:Request){
  try{
    const auth=await authorize(request);
    if("error" in auth)return auth.error;
    const {url,serviceKey}=auth;

    const body=await request.json();
    const id=num(body.id); if(!id)return jsonError("Brak ID licytacji.",400,"missing_id");
    const ends=text(body.auction_ends_at);
    if(!ends||Number.isNaN(Date.parse(ends)))return jsonError("Podaj poprawny termin zakończenia.",400,"invalid_end_date");

    const payload={
      brand:text(body.brand),model:text(body.model),year:num(body.year),price:num(body.price,0)??0,mileage:num(body.mileage),
      drivetrain:text(body.drivetrain),transmission:text(body.transmission),engine:text(body.engine),color:text(body.color),description:text(body.description),
      image_url:text(body.image_url),gallery:Array.isArray(body.gallery)?body.gallery.filter((x:unknown)=>typeof x==="string").slice(0,8):[],
      seller_name:text(body.seller_name)||"Tow & Trade",seller_phone:text(body.seller_phone),status:["available","reserved","sold"].includes(body.status)?body.status:"available",featured:Boolean(body.featured),
      sale_mode:"auction",auction_start_price:num(body.auction_start_price,0)??0,auction_min_increment:Math.max(1,num(body.auction_min_increment,500)??500),auction_ends_at:new Date(ends).toISOString(),updated_at:new Date().toISOString()
    };

    const response=await fetchTimed(`${url}/rest/v1/market_vehicles?id=eq.${id}&sale_mode=eq.auction`,{
      method:"PATCH",headers:{"Content-Type":"application/json",apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,Prefer:"return=representation"},body:JSON.stringify(payload),cache:"no-store"
    },10000);
    const result=await response.json().catch(()=>null);
    if(!response.ok)return jsonError(typeof result?.message==="string"?result.message:`Nie udało się zaktualizować licytacji (${response.status}).`,500,"auction_update_failed");
    const row=Array.isArray(result)?result[0]:null;
    if(!row?.id)return jsonError("Nie znaleziono licytacji do aktualizacji.",404,"auction_not_found");
    return Response.json({ok:true,auction:row});
  }catch(error){
    console.error("Auction update failed",error);
    return jsonError(errorMessage(error),500,"auction_update_failed");
  }
}
