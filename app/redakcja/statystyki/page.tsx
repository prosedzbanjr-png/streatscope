"use client";

import { useEffect, useMemo, useState } from "react";
import { getSupabase } from "../../../lib/supabase";
import "./stats.css";

type Article = {
  id: number;
  title: string;
  category: string;
  status: "draft" | "published";
  published_at: string | null;
  views: number | null;
};

type Feature = {
  id: number;
  kind: "fashion" | "motor";
  title: string;
  published: boolean;
  created_at: string;
  reviewed_at: string | null;
  review_status: string | null;
  views: number | null;
};

type GuidePlace = {
  id: number;
  name: string;
  active: boolean;
  created_at: string;
  reviewed_at: string | null;
  review_status: string | null;
  views: number | null;
};

type Ranked = {
  key: string;
  label: string;
  title: string;
  views: number;
  href: string;
};

function dateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export default function StatystykiPage() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [articles, setArticles] = useState<Article[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [guide, setGuide] = useState<GuidePlace[]>([]);
  const [dateFrom, setDateFrom] = useState(() => dateInputValue(new Date(Date.now() - 6 * 86400000)));
  const [dateTo, setDateTo] = useState(() => dateInputValue(new Date()));

  useEffect(() => {
    const client = getSupabase();
    client.auth.getUser().then(async ({ data }) => {
      const email = data.user?.email?.toLowerCase() || "";
      const { data: person } = await client
        .from("staff_accounts")
        .select("role,active")
        .eq("email", email)
        .maybeSingle();

      const ok = Boolean(
        person?.active && ["editor_in_chief", "deputy_editor_in_chief"].includes(person.role)
      );
      setAllowed(ok);
      if (!ok) return;

      const [a, f, g] = await Promise.all([
        client
          .from("articles")
          .select("id,title,category,status,published_at,views")
          .is("archived_at", null),
        client
          .from("street_features")
          .select("id,kind,title,published,created_at,reviewed_at,review_status,views")
          .is("archived_at", null),
        client
          .from("guide_places")
          .select("id,name,active,created_at,reviewed_at,review_status,views")
          .is("archived_at", null),
      ]);

      setArticles((a.data as Article[] | null) ?? []);
      setFeatures((f.data as Feature[] | null) ?? []);
      setGuide((g.data as GuidePlace[] | null) ?? []);
    });
  }, []);

  const pa = useMemo(() => articles.filter((a) => a.status === "published"), [articles]);
  const looks = useMemo(
    () => features.filter((f) => f.kind === "fashion" && f.published && f.review_status === "published"),
    [features]
  );
  const builds = useMemo(
    () => features.filter((f) => f.kind === "motor" && f.published && f.review_status === "published"),
    [features]
  );
  const pg = useMemo(() => guide.filter((g) => g.active), [guide]);

  const totalViews =
    pa.reduce((s, a) => s + (a.views ?? 0), 0) +
    looks.reduce((s, a) => s + (a.views ?? 0), 0) +
    builds.reduce((s, a) => s + (a.views ?? 0), 0) +
    pg.reduce((s, a) => s + (a.views ?? 0), 0);

  const weekAgo = Date.now() - 7 * 86400000;
  const weekCount =
    pa.filter((a) => a.published_at && new Date(a.published_at).getTime() >= weekAgo).length +
    [...looks, ...builds].filter((f) => new Date(f.reviewed_at || f.created_at).getTime() >= weekAgo).length +
    pg.filter((g) => new Date(g.reviewed_at || g.created_at).getTime() >= weekAgo).length;

  const articlesInRange = useMemo(() => {
    const from = new Date(`${dateFrom}T00:00:00`);
    const to = new Date(`${dateTo}T23:59:59.999`);
    if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) return [];

    return pa
      .filter((article) => {
        if (!article.published_at) return false;
        const published = new Date(article.published_at);
        return published >= from && published <= to;
      })
      .sort(
        (a, b) =>
          new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime()
      );
  }, [pa, dateFrom, dateTo]);

  const ranked: Ranked[] = [
    ...pa.map((a) => ({
      key: `a${a.id}`,
      label: a.category,
      title: a.title,
      views: a.views ?? 0,
      href: `/artykul/${a.id}`,
    })),
    ...looks.map((a) => ({
      key: `f${a.id}`,
      label: "LOOK",
      title: a.title,
      views: a.views ?? 0,
      href: `/fashion/${a.id}`,
    })),
    ...builds.map((a) => ({
      key: `m${a.id}`,
      label: "BUILD",
      title: a.title,
      views: a.views ?? 0,
      href: `/motor/${a.id}`,
    })),
    ...pg.map((a) => ({
      key: `g${a.id}`,
      label: "GUIDE",
      title: a.name,
      views: a.views ?? 0,
      href: `/guide/${a.id}`,
    })),
  ]
    .sort((a, b) => b.views - a.views)
    .slice(0, 8);

  if (allowed === null)
    return (
      <main className="stats-page">
        <p className="kicker"><i /> ŁADOWANIE STATYSTYK</p>
      </main>
    );

  if (!allowed)
    return (
      <main className="stats-page">
        <a className="wordmark" href="/">STREET<span>SCOPE</span></a>
        <h1>DOSTĘP<br /><em>ZAMKNIĘTY.</em></h1>
      </main>
    );

  return (
    <main className="stats-page">
      <header>
        <a className="wordmark" href="/">STREET<span>SCOPE</span></a>
        <a href="/redakcja">← PANEL REDAKCJI</a>
      </header>

      <section className="stats-head">
        <p className="kicker"><i /> ANALITYKA REDAKCYJNA</p>
        <h1>ZASIĘG<br /><em>MATERIAŁÓW.</em></h1>
        <p>Wspólne statystyki artykułów, LOOK, BUILD i Scope Guide.</p>
      </section>

      <section className="stat-cards">
        <article><span>ŁĄCZNE ODSŁONY</span><b>{totalViews}</b></article>
        <article><span>OPUBLIKOWANE / 7 DNI</span><b>{weekCount}</b></article>
        <article><span>WSZYSTKIE PUBLIKACJE</span><b>{pa.length + looks.length + builds.length + pg.length}</b></article>
      </section>

      <section className="publication-range">
        <div className="publication-range-head">
          <div>
            <p className="kicker"><i /> HISTORIA PUBLIKACJI</p>
            <h2>ARTYKUŁY<br /><em>OD — DO.</em></h2>
          </div>
          <div className="range-controls">
            <label>
              <span>OD</span>
              <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </label>
            <label>
              <span>DO</span>
              <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </label>
          </div>
        </div>

        <div className="range-summary">
          <span>OPUBLIKOWANE ARTYKUŁY W ZAKRESIE</span>
          <b>{articlesInRange.length}</b>
        </div>

        <div className="range-list">
          {articlesInRange.length ? (
            articlesInRange.map((article) => (
              <article key={article.id}>
                <time dateTime={article.published_at || undefined}>
                  {article.published_at
                    ? new Date(article.published_at).toLocaleDateString("pl-PL", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                      })
                    : "—"}
                  <small>
                    {article.published_at
                      ? new Date(article.published_at).toLocaleTimeString("pl-PL", {
                          hour: "2-digit",
                          minute: "2-digit",
                        })
                      : ""}
                  </small>
                </time>
                <div>
                  <span>{article.category}</span>
                  <h3><a href={`/artykul/${article.id}`} target="_blank">{article.title}</a></h3>
                </div>
                <strong>{article.views ?? 0}<small>ODSŁON</small></strong>
              </article>
            ))
          ) : (
            <p className="range-empty">W tym zakresie nie opublikowano żadnego artykułu.</p>
          )}
        </div>
      </section>

      <section className="format-stats">
        <article><span>ARTYKUŁY</span><b>{pa.length}</b></article>
        <article><span>LOOK / FASHION</span><b>{looks.length}</b></article>
        <article><span>BUILD / MOTOR</span><b>{builds.length}</b></article>
        <article><span>SCOPE GUIDE</span><b>{pg.length}</b></article>
      </section>

      <section className="ranking">
        <div>
          <p className="kicker"><i /> TOP MATERIAŁY</p>
          <h2>CO LUDZIE<br /><em>OGLĄDAJĄ.</em></h2>
        </div>
        <ol>
          {ranked.length ? (
            ranked.map((r, i) => (
              <li key={r.key}>
                <span>{String(i + 1).padStart(2, "0")}</span>
                <div>
                  <b>{r.label}</b>
                  <h3><a href={r.href} target="_blank">{r.title}</a></h3>
                </div>
                <strong>{r.views}<small>ODSŁON</small></strong>
              </li>
            ))
          ) : (
            <p>Jeszcze nie ma opublikowanych materiałów.</p>
          )}
        </ol>
      </section>
    </main>
  );
}
