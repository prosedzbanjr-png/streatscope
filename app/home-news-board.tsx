"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

type Story = {
  key?: string;
  id?: number;
  title: string;
  category: string;
  excerpt?: string | null;
  image_url?: string | null;
  published_at?: string | null;
  href?: string;
  pinned?: boolean;
};

const fallback: Story[] = [
  { title: "Nocna akcja służb w La Mesa", category: "PILNE", excerpt: "Kilka radiowozów, blokady ulic i interwencja służb. Sprawdzamy, co wydarzyło się wczoraj wieczorem.", image_url: "/images/hero.png", href: "/wiadomosci" },
  { title: "Co zmienia się dziś w centrum Los Santos?", category: "MIASTO", excerpt: "Najważniejsze miejskie informacje w jednym miejscu.", image_url: "/images/hq.png", href: "/wiadomosci" },
  { title: "Nowy mural przyciąga uwagę mieszkańców", category: "KULTURA", excerpt: "Ulica znów dostała własny głos.", image_url: "/images/mural.png", href: "/wiadomosci" },
  { title: "Car meet zakończony interwencją", category: "MOTO", excerpt: "Nocne spotkanie przerwane przez służby.", image_url: "/images/hero.png", href: "/motor" },
  { title: "Redakcja czeka na sygnały od mieszkańców", category: "STREETSCOPE", excerpt: "Masz temat? Napisz do nas.", image_url: "/images/hq.png", href: "/wiadomosci" },
  { title: "Miasto po zmroku — z bliska", category: "REPORTAŻ", excerpt: "Historie, których nie widać za dnia.", image_url: "/images/mural.png", href: "/wiadomosci" },
];

function dateLabel(value?: string | null) {
  if (!value) return "DZISIAJ";
  try {
    return new Intl.DateTimeFormat("pl-PL", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(value));
  } catch {
    return "DZISIAJ";
  }
}

function timeValue(value?: string | null) {
  const parsed = value ? new Date(value).getTime() : 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function HomeNewsBoard() {
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      try {
        const now = new Date().toISOString();
        const client = getSupabase();
        const [articlesResult, featuresResult, guideResult] = await Promise.all([
          client
            .from("articles")
            .select("id,title,category,excerpt,image_url,published_at,pinned")
            .eq("status", "published")
            .is("archived_at", null)
            .lte("published_at", now)
            .order("pinned", { ascending: false })
            .order("published_at", { ascending: false })
            .limit(12),
          client
            .from("street_features")
            .select("id,kind,title,subtitle,description,image_url,created_at,featured")
            .eq("published", true)
            .is("archived_at", null)
            .order("created_at", { ascending: false })
            .limit(12),
          client
            .from("guide_places")
            .select("id,name,category,short_description,description,image_url,updated_at,submitted_at,featured_home")
            .eq("active", true)
            .eq("review_status", "published")
            .is("archived_at", null)
            .order("updated_at", { ascending: false })
            .limit(12),
        ]);

        const articles: Story[] = (articlesResult.data || []).map((row: any) => ({
          key: `article-${row.id}`,
          id: row.id,
          title: row.title,
          category: row.category || "WIADOMOŚCI",
          excerpt: row.excerpt,
          image_url: row.image_url,
          published_at: row.published_at,
          href: `/artykul/${row.id}`,
          pinned: Boolean(row.pinned),
        }));

        const features: Story[] = (featuresResult.data || []).map((row: any) => ({
          key: `feature-${row.kind}-${row.id}`,
          id: row.id,
          title: row.title,
          category: row.kind === "fashion" ? "FASHION" : "MOTOR",
          excerpt: row.subtitle || row.description,
          image_url: row.image_url,
          published_at: row.created_at,
          href: `/${row.kind}/${row.id}`,
          pinned: Boolean(row.featured),
        }));

        const guide: Story[] = (guideResult.data || []).map((row: any) => ({
          key: `guide-${row.id}`,
          id: row.id,
          title: row.name,
          category: "SCOPE GUIDE",
          excerpt: row.short_description || row.description,
          image_url: row.image_url,
          published_at: row.updated_at || row.submitted_at,
          href: `/guide/${row.id}`,
          pinned: Boolean(row.featured_home),
        }));

        const merged = [...articles, ...features, ...guide]
          .sort((a, b) => Number(Boolean(b.pinned)) - Number(Boolean(a.pinned)) || timeValue(b.published_at) - timeValue(a.published_at))
          .slice(0, 12);

        if (!cancelled) setStories(merged.length ? merged : fallback);
      } catch {
        if (!cancelled) setStories(fallback);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    void load();
    return () => { cancelled = true; };
  }, []);

  if (loading) return <section className="home-loading" aria-label="Ładowanie najnowszych materiałów">
    <div className="skeleton skeleton-hero" />
    <div className="skeleton-side">
      <div className="skeleton skeleton-line short" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line" />
      <div className="skeleton skeleton-line medium" />
    </div>
  </section>;

  const hero = stories[0] ?? fallback[0];
  const quick = stories.slice(1, 6);
  const rest = stories.slice(1, 5);
  const cards = rest.length >= 4 ? rest : [...rest, ...fallback].slice(0, 4);
  const heroHref = hero.href || (hero.id ? `/artykul/${hero.id}` : "/wiadomosci");
  const hasQuick = quick.length > 0;

  return <>
    <section className={`home-lead${hasQuick ? "" : " no-brief"}`}>
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

      {hasQuick && <aside className="news-brief">
        <div className="brief-head"><b>REDAKCYJNY SKRÓT</b><span>NAJNOWSZE ZE STREETSCOPE</span></div>
        <div className="brief-list">
          {quick.map((story, index) => <a href={story.href || (story.id ? `/artykul/${story.id}` : "/wiadomosci")} key={story.key || `${story.id ?? story.title}-${index}`}>
            <small>{index === 0 ? "TERAZ" : `0${index + 1}`}</small>
            <strong>{story.title}</strong>
          </a>)}
        </div>
        <a className="brief-all" href="#stories">NAJNOWSZE MATERIAŁY <b>↓</b></a>
      </aside>}
    </section>

    <section className="latest-board" id="stories">
      <div className="board-title"><div><i /> <h2>NAJNOWSZE</h2></div><a href="/wiadomosci">WIADOMOŚCI →</a></div>
      <div className="latest-grid">
        {cards.map((story, index) => {
          const href = story.href || (story.id ? `/artykul/${story.id}` : "/wiadomosci");
          return <article className="latest-card" key={story.key || `${story.id ?? story.title}-${index}`}>
            <a href={href} className="latest-image"><img src={story.image_url || ["/images/hq.png","/images/mural.png","/images/hero.png"][index % 3]} alt="" /><span>{story.category}</span></a>
            <div className="latest-meta"><span>{dateLabel(story.published_at)}</span><b>•</b><span>STREETSCOPE</span></div>
            <h3><a href={href}>{story.title}</a></h3>
            <p>{story.excerpt || "Najważniejsze informacje, kontekst i relacja z miejsca wydarzeń."}</p>
            <a className="latest-arrow" href={href}>→</a>
          </article>;
        })}
      </div>
    </section>
  </>;
}
