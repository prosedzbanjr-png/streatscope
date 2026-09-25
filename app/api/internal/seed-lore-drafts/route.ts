import { NextResponse } from "next/server";

const TOKEN = "ss-drafts-20260925-7f3b2c91";

const drafts = [
  {
    title: "Ammu-Nation. Sklep, który w Los Santos nikogo już nie dziwi",
    excerpt: "W mieście pełnym pościgów, napadów i dziwnych decyzji Ammu-Nation zdążyło stać się czymś tak zwyczajnym jak sklep spożywczy.",
    category: "OPINIE",
    body: "<p>W Los Santos można wpaść po kawę, zatankować samochód i chwilę później wyjść ze sklepu z bronią. I nikogo specjalnie to nie dziwi.</p><p>Ammu-Nation od lat jest jednym z najbardziej rozpoznawalnych punktów na mapie San Andreas. Charakterystyczne logo, reklamy krzyczące o samoobronie i półki, na których broń wygląda jak kolejny zwykły produkt, zrobiły swoje.</p><p>Najciekawsze nie jest jednak to, co sprzedaje Ammu-Nation. Ciekawsze jest to, jak bardzo mieszkańcy przywykli do jego obecności.</p><p>W innym mieście sklep z karabinami na każdym rogu mógłby robić wrażenie. W Los Santos jest po prostu miejscem, obok którego przejeżdżasz w drodze do pracy.</p><p>I chyba właśnie to najlepiej podsumowuje to miasto.</p>",
  },
  {
    title: "iFruit. Kawałek Los Santos, który każdy nosi w kieszeni",
    excerpt: "Telefony iFruit są praktycznie wszędzie. Pytanie tylko, kiedy zwykłe urządzenie stało się obowiązkowym elementem życia w Los Santos.",
    category: "OPINIE",
    body: "<p>Rozejrzyj się przez chwilę po Los Santos. Na chodniku, w restauracji, na stacji benzynowej. Prędzej czy później ktoś wyciągnie telefon z charakterystycznym logo iFruit.</p><p>Marka stała się czymś więcej niż producentem elektroniki. Telefon to dziś bank, aparat, mapa, komunikator i pół życia mieszkańca zamknięte w jednym kawałku szkła.</p><p>iFruit świetnie sprzedaje też coś jeszcze: poczucie, że poprzedni model nagle jest za stary, mimo że wczoraj działał bez problemu.</p><p>Nowa wersja, kilka reklam, parę nowych funkcji i Los Santos znowu zaczyna patrzeć na swoje telefony jak na zabytki.</p><p>Można się z tego śmiać, ale prawda jest prosta. Gdyby jutro iFruit zniknęło z miasta, spora część mieszkańców najpierw straciłaby kontakt ze znajomymi, a pięć minut później drogę do domu.</p>",
  },
  {
    title: "Lifeinvader. Miasto, które samo opowiada o sobie wszystko",
    excerpt: "Mieszkańcy Los Santos wrzucają do sieci miejsca, znajomych, auta i całe swoje życie. Lifeinvader musi tylko patrzeć.",
    category: "OPINIE",
    body: "<p>Nowy samochód? Zdjęcie. Wieczór ze znajomymi? Zdjęcie. Restauracja, mieszkanie, praca, wakacje? Najlepiej wszystko wrzucić od razu.</p><p>Lifeinvader nie musiał długo przekonywać mieszkańców Los Santos, żeby dzielili się swoim życiem. Wystarczyło dać im miejsce, w którym mogą pokazać je innym.</p><p>Z czasem platforma zaczęła wiedzieć coraz więcej: gdzie bywamy, z kim się znamy, co lubimy i czym chcemy się pochwalić.</p><p>I właśnie tutaj robi się ciekawie. Ludzie potrafią narzekać na brak prywatności, a kilka minut później sami oznaczają lokalizację, znajomych i samochód stojący pod domem.</p><p>Lifeinvader nie musi więc nikogo śledzić po ciemnych zaułkach. Los Santos samo dostarcza mu raport. Codziennie, za darmo i często ze zdjęciem.</p>",
  },
];

export async function GET(request: Request) {
  const url = new URL(request.url);
  if (url.searchParams.get("token") !== TOKEN) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !serviceKey) {
    return NextResponse.json({ error: "not_configured" }, { status: 503 });
  }

  const headers = {
    "Content-Type": "application/json",
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  };

  const results: Array<{ title: string; status: string; id?: number }> = [];

  for (const draft of drafts) {
    const check = await fetch(
      `${supabaseUrl}/rest/v1/articles?select=id,title&title=eq.${encodeURIComponent(draft.title)}&limit=1`,
      { headers, cache: "no-store" }
    );
    const existing = check.ok ? await check.json() : [];
    if (Array.isArray(existing) && existing[0]?.id) {
      results.push({ title: draft.title, status: "exists", id: existing[0].id });
      continue;
    }

    const payload = {
      ...draft,
      image_url: null,
      gallery: [],
      social_title: null,
      social_description: null,
      social_image: null,
      status: "draft",
      review_status: "draft",
      author_email: "streetscope@mail.eyefind.info",
      author_name: "StreetScope",
      author_role: "DZIENNIKARZ",
      scheduled_for: null,
      published_at: null,
      review_note: null,
      reviewed_by: null,
      updated_at: new Date().toISOString(),
    };

    const saved = await fetch(`${supabaseUrl}/rest/v1/articles`, {
      method: "POST",
      headers: { ...headers, Prefer: "return=representation" },
      body: JSON.stringify(payload),
      cache: "no-store",
    });

    const body = await saved.json().catch(() => null);
    if (!saved.ok) {
      return NextResponse.json({ error: "insert_failed", status: saved.status, body, results }, { status: 500 });
    }
    results.push({ title: draft.title, status: "created", id: body?.[0]?.id });
  }

  return NextResponse.json({ ok: true, results });
}
