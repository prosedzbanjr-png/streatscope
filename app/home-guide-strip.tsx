"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";
import { optimizedImageUrl } from "../lib/image-optimization";
import "./home-guide-strip.css";

type GuidePlace = {
  id: number;
  name: string;
  category: string;
  neighborhood: string | null;
  short_description: string | null;
  image_url: string | null;
  price_level: string | null;
  featured_label: string | null;
};

const categoryLabel: Record<string, string> = {
  food: "JEDZENIE",
  nightlife: "NOCNE ŻYCIE",
  motor: "MOTORYZACJA",
  shopping: "ZAKUPY",
  services: "USŁUGI",
  entertainment: "ROZRYWKA",
};

export function HomeGuideStrip() {
  const [places, setPlaces] = useState<GuidePlace[]>([]);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const supabase = getSupabase();
        const select = "id,name,category,neighborhood,short_description,image_url,price_level,featured_label";
        const { data: promoted } = await supabase
          .from("guide_places")
          .select(select)
          .eq("active", true)
          .is("archived_at", null)
          .eq("featured_home", true)
          .order("featured_order", { ascending: true })
          .order("created_at", { ascending: false })
          .limit(3);

        let result = (promoted as GuidePlace[] | null) ?? [];
        if (result.length === 0) {
          const { data: fallback } = await supabase
            .from("guide_places")
            .select(select)
            .eq("active", true)
            .is("archived_at", null)
            .order("featured", { ascending: false })
            .order("created_at", { ascending: false })
            .limit(3);
          result = (fallback as GuidePlace[] | null) ?? [];
        }
        if (alive) setPlaces(result);
      } catch {
        if (alive) setPlaces([]);
      }
    })();
    return () => { alive = false; };
  }, []);

  return <section className="scope-guide-home">
    <div className="scope-guide-home__head">
      <div><p className="kicker"><i/> SCOPE GUIDE</p><h2>GDZIE W <em>LOS SANTOS?</em></h2><p>Jedzenie, nocne życie, warsztaty, usługi i miejsca warte sprawdzenia.</p></div>
      <a href="/guide">OTWÓRZ PRZEWODNIK →</a>
    </div>

    {places.length > 0 ? <div className="scope-guide-home__grid">
      {places.map(place => <a className="scope-guide-home__card" href={`/guide/${place.id}`} key={place.id}>
        <div className="scope-guide-home__image" style={place.image_url ? { backgroundImage: `url(${optimizedImageUrl(place.image_url, 1080)})` } : undefined}>
          <span>{place.featured_label || "SCOPE GUIDE"}</span>
        </div>
        <div className="scope-guide-home__body">
          <small>{categoryLabel[place.category] || place.category}{place.neighborhood ? ` · ${place.neighborhood}` : ""}</small>
          <h3>{place.name}</h3>
          <p>{place.short_description || "Sprawdź miejsce w Scope Guide."}</p>
          <b>{place.price_level || ""} <em>SPRAWDŹ →</em></b>
        </div>
      </a>)}
    </div> : <div className="scope-guide-home__empty">
      <div><span>NOWOŚĆ</span><h3>SCOPE GUIDE</h3><p>Wkrótce pojawią się tutaj miejsca z Los Santos.</p></div>
      <a href="/guide">ZOBACZ GUIDE →</a>
    </div>}
  </section>;
}
