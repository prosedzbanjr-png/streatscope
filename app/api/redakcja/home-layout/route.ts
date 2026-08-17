import { jsonError } from "../../../../lib/server-security";

const allowedSlots = new Set(["hero","card1","card2","card3","card4","brief1","brief2","brief3","brief4","brief5"]);
const allowedTypes = new Set(["article","fashion","motor","guide"]);

async function getCaller(url:string, anonKey:string, token:string){
  const response=await fetch(`${url}/auth/v1/user`,{headers:{apikey:anonKey,Authorization:`Bearer ${token}`},cache:"no-store"});
  if(!response.ok)return null;
  return await response.json() as {email?:string};
}

async function isChief(url:string, serviceKey:string, email:string){
  const response=await fetch(`${url}/rest/v1/staff_accounts?email=eq.${encodeURIComponent(email.toLowerCase())}&active=eq.true&select=role&limit=1`,{headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`},cache:"no-store"});
  if(!response.ok)return false;
  const rows=await response.json() as Array<{role:string}>;
  return Boolean(rows[0]&&["editor_in_chief","deputy_editor_in_chief"].includes(rows[0].role));
}

export async function POST(request:Request){
  try{
    const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
    const anonKey=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    const serviceKey=process.env.SUPABASE_SERVICE_ROLE_KEY;
    if(!url||!anonKey||!serviceKey)return jsonError("Układ głównej nie jest skonfigurowany.",503,"not_configured");

    const authHeader=request.headers.get("authorization")||"";
    const token=authHeader.toLowerCase().startsWith("bearer ")?authHeader.slice(7).trim():"";
    if(!token)return jsonError("Brak autoryzacji.",401,"unauthorized");
    const caller=await getCaller(url,anonKey,token);
    const email=caller?.email?.toLowerCase()||"";
    if(!email||!(await isChief(url,serviceKey,email)))return jsonError("Nie masz uprawnień do ustawiania głównej.",403,"forbidden");

    const body=await request.json();
    const slots=body?.slots&&typeof body.slots==="object"?body.slots:{};
    const rows:Array<{slot:string;source_type:string;source_id:number;updated_at:string;updated_by:string}>=[];
    for(const [slot,value] of Object.entries(slots)){
      if(!allowedSlots.has(slot)||!value||typeof value!=="object")continue;
      const sourceType=String((value as any).source_type||"");
      const sourceId=Number((value as any).source_id||0);
      if(!allowedTypes.has(sourceType)||!Number.isInteger(sourceId)||sourceId<=0)continue;
      rows.push({slot,source_type:sourceType,source_id:sourceId,updated_at:new Date().toISOString(),updated_by:email});
    }

    await fetch(`${url}/rest/v1/homepage_slots`,{method:"DELETE",headers:{apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,Prefer:"return=minimal"},cache:"no-store"});
    if(rows.length){
      const save=await fetch(`${url}/rest/v1/homepage_slots`,{method:"POST",headers:{"Content-Type":"application/json",apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,Prefer:"return=minimal"},body:JSON.stringify(rows),cache:"no-store"});
      if(!save.ok)throw new Error(`Homepage layout save failed: ${save.status}`);
    }
    return Response.json({ok:true,count:rows.length});
  }catch(error){
    console.error("StreetScope homepage layout save failed",error);
    return jsonError("Nie udało się zapisać układu głównej.",500,"save_failed");
  }
}
