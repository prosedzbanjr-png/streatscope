"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../lib/supabase";

type Story = {
  id?: number;
  title: string;
  category: string;
  excerpt?: string | null;
  image_url?: string | null;
  published_at?: string | null;
};

const fallback: Story[] = [
  { title: "Nocna akcja służb w La Mesa", category: "PILNE", excerpt: "Kilka radiowozów, blokady ulic i interwencja służb. Sprawdzamy, co wydarzyło się wczoraj wieczorem.", image_url: "/images/hero.png" },
  { title: "Co zmienia się dziś w centrum Los Santos?", category: "MIASTO", excerpt: "Najważniejsze miejskie informacje w jednym miejscu.", image_url: "/images/hq.png" },
  { title: "Nowy mural przyciąga uwagę mieszkańców", category: "KULTURA", excerpt: "Ulica znów dostała własny głos.", image_url: "/images/mural.png" },
  { title: "Car meet zakończony interwencją", category: "MOTO", excerpt: "Nocne spotkanie przerwane przez służby.", image_url: "/images/hero.png" },
  { title: "Redakcja czeka na sygnały od mieszkańców", category: "STREETSCOPE", excerpt: "Masz temat? Napisz do nas.", image_url: "/images/hq.png" },
  { title: "Miasto po zmroku — z bliska", category: "REPORTAŻ", excerpt: "Historie, których nie widać za dnia.", image_url: "/images/mural.png" },
];

function dateLabel(value?: string | null) {
  if (!value) return "DZISIAJ";
  try {
    return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
  } catch {
    return "DZISIAJ";
  }
}

export function HomeNewsBoard() {
  const [stories, setStories] = useState<Story[]>(fallback);

  useEffect(() => {
    getSupabase()
      .from("articles")
      .select("id,title,category,excerpt,image_url,published_at,pinned")
      .eq("status", "published")
      .is("archived_at", null)
      .lte("published_at", new Date().toISOString())
      .order("pinned", { ascending: false })
      .order("published_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data?.length) setStories(data as Story[]);
      });
  }, []);

  const hero = stories[0] ?? fallback[0];
  const quick = useMemo(() => stories.slice(1, 6), [stories]);
  const cards = useMemo(() => {
    const rest = stories.slice(1, 5);
    return rest.length >= 4 ? rest : [...rest, ...fallback].slice(0, 4);
  }, [stories]);

  const heroHref = hero.id ? `/artykul/${hero.id}` : "/wiadomosci";

  return <>
    <section className="home-lead">
      <article className="lead-story">
        <img src={hero.image_url || "/images/hero.png"} alt="" />
        <div className="lead-shade" />
        <div className="lead-copy">
          <span className="lead-badge">{hero.category || "NAJNOWSZE"}</span>
          <h1>{hero.title}</h1>
          <p>{hero.excerpt || "StreetScope sprawdza, co dzieje się w mieście — bez filtra i bez zbędnego szumu."}</p>
          <div className="lead-meta"><a href={heroHref}>CZYTAJ WIĘCEJ <b>→</b></a><span>{dateLabel(hero.published_at)}</span></div>
        </div>
      </article>

      <aside className="news-brief">
        <div className="brief-head"><b>REDAKCYJNY SKRÓT</b><span>NAJWAŻNIEJSZE Z MIASTA</span></div>
        <div className="brief-list">
          {quick.map((story, index) => <a href={story.id ? `/artykul/${story.id}` : "/wiadomosci"} key={`${story.id ?? story.title}-${index}`}>
            <small>{index === 0 ? "TERAZ" : `0${index + 1}`}</small>
            <strong>{story.title}</strong>
          </a>)}
        </div>
        <a className="brief-all" href="/wiadomosci">WSZYSTKIE WIADOMOŚCI <b>→</b></a>
      </aside>
    </section>

    <section className="latest-board" id="stories">
      <div className="board-title"><div><i /> <h2>NAJNOWSZE</h2></div><a href="/wiadomosci">ZOBACZ WSZYSTKIE →</a></div>
      <div className="latest-grid">
        {cards.map((story, index) => <article className="latest-card" key={`${story.id ?? story.title}-${index}`}>
          <a href={story.id ? `/artykul/${story.id}` : "/wiadomosci"} className="latest-image"><img src={story.image_url || ["/images/hq.png","/images/mural.png","/images/hero.png"][index % 3]} alt="" /><span>{story.category}</span></a>
          <div className="latest-meta"><span>{dateLabel(story.published_at)}</span><b>•</b><span>STREETSCOPE</span></div>
          <h3><a href={story.id ? `/artykul/${story.id}` : "/wiadomosci"}>{story.title}</a></h3>
          <p>{story.excerpt || "Najważniejsze informacje, kontekst i relacja z miejsca wydarzeń."}</p>
          <a className="latest-arrow" href={story.id ? `/artykul/${story.id}` : "/wiadomosci"}>→</a>
        </article>)}
      </div>
    </section>
  </>;
}
