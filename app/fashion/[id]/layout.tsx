import type { Metadata } from "next";

type FeatureMeta = { title:string; subtitle:string|null; description:string|null; image_url:string|null; gallery:string[]|null };

async function getFeature(id:string):Promise<FeatureMeta|null>{
  const url=process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key=process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if(!url||!key||!/^\d+$/.test(id)) return null;
  try{
    const query=new URLSearchParams({id:`eq.${id}`,kind:"eq.fashion",published:"eq.true",archived_at:"is.null",select:"title,subtitle,description,image_url,gallery",limit:"1"});
    const response=await fetch(`${url}/rest/v1/street_features?${query}`,{headers:{apikey:key,Authorization:`Bearer ${key}`},next:{revalidate:60}});
    if(!response.ok)return null;
    const data=await response.json() as FeatureMeta[];
    return data[0]??null;
  }catch{return null;}
}

export async function generateMetadata({params}:{params:Promise<{id:string}>}):Promise<Metadata>{
  const {id}=await params;
  const feature=await getFeature(id);
  if(!feature)return {title:"Look niedostępny | Fashion",robots:{index:false,follow:false}};
  const description=feature.subtitle||feature.description||"Street Fashion w StreetScope.";
  const image=feature.image_url||feature.gallery?.find(Boolean)||"/images/hero.png";
  const canonical=`/fashion/${id}`;
  return {title:feature.title,description,alternates:{canonical},openGraph:{title:`${feature.title} | StreetScope`,description,url:canonical,siteName:"StreetScope",images:[{url:image,alt:feature.title}]},twitter:{card:"summary_large_image",title:`${feature.title} | StreetScope`,description,images:[image]}};
}

export default function FashionDetailLayout({children}:Readonly<{children:React.ReactNode}>){return children;}
