"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

type Story = { id?: number; tag: string; title: string; image: string; large?: boolean; excerpt?: string };

const fallbackStories: Story[] = [
  { tag: "GŁÓWNY TEMAT", title: "NOCNY SPOT ZATRZYMANY PRZEZ JEDNOSTKI LSPD", image: "/images/hero.png", large: true },
  { tag: "MIASTO", title: "GŁOS ULICY: CO DZIEJE SIĘ W LA MESA?", image: "/images/hq.png" },
  { tag: "REPORTAŻ", title: "MIASTO PO ZMROKU — Z BLISKA", image: "/images/mural.png" },
];

export function PublishedStories() {
  const [stories, setStories] = useState<Story[]>(fallbackStories);
  useEffect(() => {
    getSupabase().from("articles").select("id,title,category,excerpt,image_url").eq("status", "published").order("published_at", { ascending: false }).limit(3).then(({ data }) => {
      const items = data ?? [];
      if (!items.length) return;
      setStories(items.map((item, index) => ({ id: item.id, tag: item.category, title: item.title, excerpt: item.excerpt, image: item.image_url || ["/images/hero.png", "/images/hq.png", "/images/mural.png"][index % 3], large: index === 0 })));
    });
  }, []);
  return <div className="story-grid">{stories.map((story) => <article key={story.id ?? story.title} className={story.large ? "story featured" : "story"}><img src={story.image} alt=""/><div className="story-overlay"/><div className="story-copy"><p>{story.tag}</p><h2>{story.title}</h2>{story.id ? <a href={`/artykul/${story.id}`}>CZYTAJ ARTYKUŁ →</a> : <span>{story.excerpt ?? "CZYTAJ HISTORIĘ →"}</span>}</div></article>)}</div>;
}
