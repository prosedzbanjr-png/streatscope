"use client";

import { useEffect, useState } from "react";
import { getSupabase } from "../lib/supabase";

type Story = { tag: string; title: string; image: string; large?: boolean; excerpt?: string };

const fallbackStories: Story[] = [
  { tag: "GŁÓWNY TEMAT", title: "NOCNY SPOT ZATRZYMANY PRZEZ JEDNOSTKI LSPD", image: "/images/hero.png", large: true },
  { tag: "MIASTO", title: "GŁOS ULICY: CO DZIEJE SIĘ W LA MESA?", image: "/images/hq.png" },
  { tag: "REPORTAŻ", title: "MIASTO PO ZMROKU — Z BLISKA", image: "/images/mural.png" },
];

export function PublishedStories() {
  const [stories, setStories] = useState<Story[]>(fallbackStories);
  useEffect(() => {
    getSupabase().from("articles").select("title,category,excerpt").eq("status", "published").order("published_at", { ascending: false }).limit(3).then(({ data }) => {
      const items = data ?? [];
      if (!items.length) return;
      setStories(items.map((item, index) => ({ tag: item.category, title: item.title, excerpt: item.excerpt, image: ["/images/hero.png", "/images/hq.png", "/images/mural.png"][index % 3], large: index === 0 })));
    });
  }, []);
  return <div className="story-grid">{stories.map((story) => <article key={story.title} className={story.large ? "story featured" : "story"}><img src={story.image} alt=""/><div className="story-overlay"/><div className="story-copy"><p>{story.tag}</p><h2>{story.title}</h2><span>{story.excerpt ?? "CZYTAJ HISTORIĘ →"}</span></div></article>)}</div>;
}
