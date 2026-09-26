const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.log("[seed-mafuyu-fashion-draft] Supabase env unavailable, skipping.");
  process.exit(0);
}
const headers={apikey:serviceKey,Authorization:`Bearer ${serviceKey}`,"Content-Type":"application/json"};
const title="MAFUYU SHIRAYUKI";
const existingRes=await fetch(`${url}/rest/v1/street_features?kind=eq.fashion&title=eq.${encodeURIComponent(title)}&archived_at=is.null&select=id&order=id.desc&limit=1`,{headers});
if(!existingRes.ok) throw new Error(`lookup failed ${existingRes.status}`);
const existing=await existingRes.json();
if(Array.isArray(existing)&&existing.length){console.log("[seed-mafuyu-fashion-draft] Existing, skipping.");process.exit(0);}
const description=`Mafuyu Shirayuki, dla większości po prostu Mafufu, idzie w zupełnie inną stronę niż większość ulicznych fitów w Los Santos. Mniej krzyku, więcej spokoju. Jasne kolory, proste fasony i taki vibe, jakby wszystko było przypadkowe, chociaż oczywiście nic nie jest przypadkowe.

U Mafufu siedzi przede wszystkim soft casual z lekkim Y2K i clean girl vibem.

Jasne topy, dopasowane spodnie, proste swetry, mała torba i długie czarne włosy. Wszystko jest raczej spokojne kolorystycznie, dużo beżu, bieli, szarości i czerni.

Nie ma tu miliona warstw ani wielkich grafik. Fit ma wyglądać lekko i schludnie, a nie walczyć o uwagę z billboardem obok.

Najbardziej działa prostota.

Outfity są lekkie, czyste i dobrze siedzą na sylwetce. Do tego małe dodatki, okulary, biżuteria i torba robią dokładnie tyle, ile trzeba.

Nie ma efektu „ubrałam pół szafy, żeby było modnie”. I całe szczęście.

Na pewno długie czarne włosy, okulary i spokojna paleta kolorów.

Mafufu trzyma się bardziej subtelnych rzeczy, przez co nawet zwykły sweter czy prosty top wygląda u niej trochę bardziej dopracowanie.

To też styl, który dobrze działa w różnych miejscach. Przy aucie, na ulicy, przy Vinewood. Nie trzeba co pięć minut zmieniać postaci razem z outfitem.

Najbliżej tutaj do miksu soft casualu, Y2K, clean girl, minimal streetwearu i trochę coquette bez przesady.

Czyli rzeczy kobiece i lekkie, ale bez robienia z tego cukierkowego kostiumu.`;
const payload={
  kind:"fashion",
  title,
  subtitle:"Mniej krzyku, więcej spokoju. Mafuyu Shirayuki stawia na jasne kolory, proste fasony i lekki clean vibe.",
  description,
  person_name:"Mafuyu Shirayuki",
  location:"Los Santos",
  details:"Soft casual / Y2K / clean girl / minimal streetwear / coquette · okulary · biżuteria · mała torba · jasna paleta",
  badge:"STREET LOOK",
  editor_take:"Mafufu nie próbuje przekrzyczeć miasta outfitem i właśnie dlatego dobrze wypada. Jej styl jest prosty, spokojny i rozpoznawalny. Bez miliona dodatków, bez przekombinowania i bez potrzeby udowadniania czegokolwiek. Czysto, lekko i bardzo w jej klimacie.",
  featured:false,
  published:false,
  review_status:"draft",
  gallery:[],
  image_url:null,
  updated_at:new Date().toISOString()
};
const res=await fetch(`${url}/rest/v1/street_features?select=id,title,published,review_status`,{method:"POST",headers:{...headers,Prefer:"return=representation"},body:JSON.stringify(payload)});
if(!res.ok) throw new Error(`insert failed ${res.status}: ${await res.text()}`);
console.log("[seed-mafuyu-fashion-draft] Inserted:", await res.json());