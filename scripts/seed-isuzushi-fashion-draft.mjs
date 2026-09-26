const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.log("[seed-isuzushi-fashion-draft] Supabase env unavailable, skipping.");
  process.exit(0);
}
const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"};
const title="ISUZUSHI MUNENORI";
const existingRes=await fetch(`${url}/rest/v1/street_features?kind=eq.fashion&title=eq.${encodeURIComponent(title)}&archived_at=is.null&select=id&order=id.desc&limit=1`,{headers});
if(!existingRes.ok) throw new Error(`lookup failed ${existingRes.status}`);
const existing=await existingRes.json();
if(Array.isArray(existing)&&existing.length){console.log("[seed-isuzushi-fashion-draft] Existing, skipping.");process.exit(0);}
const description=`Isuzushi Munenori to gość, po którym od razu widać, że nie prowadzi Drip Zone przypadkiem. Raz luźny streetwear, raz bardziej schludny fit, a chwilę później coś dużo bardziej kolorowego. Niby różne klimaty, ale cały czas czuć, że to jedna osoba, a nie cztery presety z szafy.

U Isuzushiego najmocniej siedzi streetwear z domieszką bardziej eleganckich rzeczy.

Luźne koszulki, szerokie spodnie, sneakersy, okulary, biżuteria i mocniejsze grafiki. Z drugiej strony spokojnie potrafi wejść w koszulę z krawatem albo ciemniejszy, bardziej clean zestaw i dalej nie wygląda to sztucznie.

To nie jest styl oparty na jednej rzeczy. Bardziej na tym, że bierze różne klimaty i układa je po swojemu.

Najbardziej proporcje i dodatki.

Luźniejsza góra dobrze siedzi z szerokim dołem, a bardziej prosty outfit potrafi podbić zegarek, łańcuch, pierścionki czy okulary.

Nie wygląda to jak przebieranka ani jak katalog sklepu. I to chyba najlepszy komplement, jaki można dać komuś, kto faktycznie tym sklepem zarządza.

Na pewno tatuaże, okulary i biżuteria.

To są elementy, które wracają praktycznie w każdym looku i sprawiają, że nawet przy zmianie całej stylizacji dalej wiadomo, kto stoi przed obiektywem.

Do tego Isuzushi nie boi się mocniejszych kolorów. Róż, biel, ciemne zestawy, nadruki. Nie wszystko musi być czarne i wyglądać, jakby właściciel właśnie odkrył słowo „minimalizm”.

Najbliżej tutaj do miksu streetwearu, urban, casualu, Y2K i trochę smart-casualu.

Czyli rzeczy luźne i uliczne, ale przełamane bardziej schludnymi elementami wtedy, kiedy akurat ma to sens.`;
const payload={
  kind:"fashion",
  title,
  subtitle:"Szef Drip Zone, który potrafi przeskoczyć z luźnego streetwearu w bardziej clean fit i dalej wyglądać jak siebie.",
  description,
  person_name:"Isuzushi Munenori",
  location:"Los Santos",
  details:"Streetwear / urban / casual / Y2K / smart-casual · tatuaże · okulary · biżuteria · szerokie fasony",
  badge:"STREET LOOK",
  editor_take:"Isuzushi nie wygląda jak ktoś, kto po prostu prowadzi sklep z ciuchami. Wygląda jak ktoś, kto naprawdę siedzi w tym klimacie. Różne style, różne kolory, różne okazje, ale wszystko dalej wygląda jak jego. Nie jeden styl. Po prostu własny charakter.",
  featured:false,
  published:false,
  review_status:"draft",
  gallery:[],
  image_url:null,
  updated_at:new Date().toISOString()
};
const res=await fetch(`${url}/rest/v1/street_features?select=id,title,published,review_status`,{method:"POST",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify(payload)});
if(!res.ok) throw new Error(`insert failed ${res.status}: ${await res.text()}`);
console.log("[seed-isuzushi-fashion-draft] Inserted:", await res.json());