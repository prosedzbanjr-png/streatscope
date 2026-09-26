const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.log("[seed-mei-fashion-draft] Supabase env unavailable, skipping.");
  process.exit(0);
}

const headers = {
  apikey: serviceKey,
  Authorization: `Bearer ${serviceKey}`,
  "Content-Type": "application/json",
};

const title = "MEI HIMURA";

const existingResponse = await fetch(
  `${url}/rest/v1/street_features?kind=eq.fashion&title=eq.${encodeURIComponent(title)}&archived_at=is.null&select=id,title,published,review_status&order=id.desc&limit=1`,
  { headers, cache: "no-store" },
);

if (!existingResponse.ok) {
  throw new Error(`Draft lookup failed: ${existingResponse.status} ${await existingResponse.text()}`);
}

const existing = await existingResponse.json();
if (Array.isArray(existing) && existing.length > 0) {
  console.log(`[seed-mei-fashion-draft] Existing entry #${existing[0].id}, skipping.`);
  process.exit(0);
}

const description = `Mei Himura to chyba jedna z tych osób, które nie potrafią wyjść z domu ubrani po prostu normalnie. I dobrze, bo normalnych fitów Los Santos ma już wystarczająco dużo.

Na co dzień pracuje w Drip Zone, więc ciuchy to dla niej raczej nie jest temat typu „byle coś pasowało”. Widać, że lubi się tym bawić i nie siedzi w jednym klimacie.

U Mei jest trochę wszystkiego. Raz luźny streetwear, raz sportowo, raz bardziej kobieco, czasem coś totalnie clean, a czasem fit, który już z daleka mówi, że był robiony z jakimś pomysłem.

Szerokie spodnie, krótkie topy, koszule, gorsety, kurtki, czapki, okulary. Dużo dodatków, ale bez robienia z siebie choinki, co już samo w sobie jest jakimś osiągnięciem.

Najbardziej działa to, że te fity nie wyglądają jak składane z katalogu. Jak góra jest mocniejsza, dół często jest prostszy. Jak outfit jest bardziej basic, wtedy wjeżdżają okulary, biżuteria, tatuaże albo jakiś mocniejszy kolor.

Tatuaże, okulary i włosy robią tu połowę roboty. Mei może zmienić cały outfit, kolory i klimat, a dalej wygląda jak Mei.

Najbliżej jej do miksu streetwearu, Y2K, sportu, casualu i trochę alternatywy. Czyli trochę miasta, trochę sportu, trochę rzeczy, które spokojnie mogłyby wisieć na wieszaku w Drip Zone i trochę własnego kombinowania.`;

const payload = {
  kind: "fashion",
  title,
  subtitle: "Raz streetwear, raz sportowo, raz bardziej kobieco. Mei Himura nie siedzi w jednym klimacie i właśnie dlatego jej fity nie zaczynają wyglądać jak kopiuj-wklej.",
  description,
  person_name: "Mei Himura",
  location: "Los Santos",
  details: "Streetwear / Y2K / sport / casual / alternative · okulary · tatuaże · biżuteria · luźne fasony",
  badge: "STREET LOOK",
  editor_take: "Mei nie ma jednego konkretnego stylu i chyba właśnie dlatego dobrze się ją ogląda. Jednego dnia może wyglądać sportowo, drugiego bardziej clean, a trzeciego wejść w coś totalnie innego i dalej nie ma wrażenia, że ktoś przypadkiem przebrał postać. Dużo zmienia, ale dalej wszystko wygląda jak jej.",
  featured: false,
  published: false,
  review_status: "draft",
  gallery: [],
  image_url: null,
  updated_at: new Date().toISOString(),
};

const insertResponse = await fetch(`${url}/rest/v1/street_features?select=id,title,published,review_status`, {
  method: "POST",
  headers: { ...headers, Prefer: "return=representation" },
  body: JSON.stringify(payload),
});

if (!insertResponse.ok) {
  throw new Error(`Draft insert failed: ${insertResponse.status} ${await insertResponse.text()}`);
}

const inserted = await insertResponse.json();
console.log("[seed-mei-fashion-draft] Inserted:", inserted);
