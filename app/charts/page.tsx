import { SiteNav } from "../site-nav";
import "./charts.css";

const tracks = [
  { pos: 1, title: "NO SIGNAL", artist: "Los Santos", views: "128.4K", move: "+18.2K", trend: "up" },
  { pos: 2, title: "NIGHT SHIFT", artist: "Davis", views: "103.7K", move: "+12.9K", trend: "up" },
  { pos: 3, title: "RED LIGHTS", artist: "Vinewood", views: "94.1K", move: "+8.4K", trend: "up" },
  { pos: 4, title: "SOUTHBOUND", artist: "Strawberry", views: "81.6K", move: "+3.1K", trend: "same" },
  { pos: 5, title: "AFTER HOURS", artist: "La Mesa", views: "76.9K", move: "-1.2K", trend: "down" },
  { pos: 6, title: "STATIC", artist: "Little Seoul", views: "69.3K", move: "+6.8K", trend: "up" },
  { pos: 7, title: "NO SLEEP", artist: "Hawick", views: "61.8K", move: "+2.7K", trend: "up" },
  { pos: 8, title: "CITY HEAT", artist: "Rancho", views: "57.4K", move: "-900", trend: "down" },
  { pos: 9, title: "MIRROR", artist: "Rockford", views: "49.2K", move: "+4.2K", trend: "up" },
  { pos: 10, title: "LAST CALL", artist: "Vespucci", views: "43.5K", move: "+1.1K", trend: "same" },
];

const certs = [
  { name: "BRONZE", threshold: "25K", className: "bronze" },
  { name: "SILVER", threshold: "50K", className: "silver" },
  { name: "GOLD", threshold: "100K", className: "gold" },
  { name: "PLATINUM", threshold: "250K", className: "platinum" },
];

export const metadata = {
  title: "Scope Charts | StreetScope",
  description: "Niezależne notowanie muzyczne Los Santos.",
};

export default function ChartsPage() {
  return (
    <main className="charts-page">
      <SiteNav />
      <section className="charts-hero" id="top">
        <div className="charts-kicker">STREETSCOPE PRESENTS</div>
        <h1>SCOPE <span>CHARTS</span></h1>
        <p>Niezależne notowanie muzyczne Los Santos. Liczby zamiast układów.</p>
        <div className="charts-meta"><b>LIVE CHART</b><span>Aktualizacja co godzinę</span></div>
      </section>

      <nav className="charts-tabs" aria-label="Sekcje Scope Charts">
        <a href="#top10">TOP 10</a><a href="#rising">ROSNĄCE</a><a href="#artists">ARTYŚCI</a><a href="#certs">CERTYFIKATY</a><a href="#history">KRONIKA</a>
      </nav>

      <section className="chart-section" id="top10">
        <div className="section-heading"><div><small>NOTOWANIE</small><h2>TOP 10</h2></div><p>Najczęściej odtwarzane numery w mieście</p></div>
        <div className="number-one">
          <div className="giant-rank">01</div>
          <div><span className="eyebrow">#1 W LOS SANTOS</span><h3>{tracks[0].title}</h3><p>{tracks[0].artist}</p></div>
          <div className="hero-stat"><strong>{tracks[0].views}</strong><span>WYŚWIETLEŃ</span><b>▲ {tracks[0].move}</b></div>
        </div>
        <div className="chart-list">
          {tracks.slice(1).map((t) => <article className="chart-row" key={t.pos}>
            <span className="rank">{String(t.pos).padStart(2,"0")}</span>
            <div className="cover">{t.title.slice(0,2)}</div>
            <div className="track"><strong>{t.title}</strong><span>{t.artist}</span></div>
            <span className="views">{t.views}</span>
            <span className={"movement "+t.trend}>{t.trend==="up"?"▲":t.trend==="down"?"▼":"•"} {t.move}</span>
          </article>)}
        </div>
      </section>

      <section className="chart-section split" id="rising">
        <div><div className="section-heading"><div><small>TYDZIEŃ DO TYGODNIA</small><h2>ROSNĄCE</h2></div></div>
          <div className="rising-grid">{tracks.filter(t=>t.trend==="up").slice(0,4).map((t,i)=><div className="rising-card" key={t.pos}><span>0{i+1}</span><strong>{t.title}</strong><small>{t.artist}</small><b>+{t.move.replace("+","")}</b></div>)}</div>
        </div>
        <div id="artists"><div className="section-heading"><div><small>SCENA</small><h2>ARTYŚCI</h2></div></div>
          <div className="artist-board">{["Los Santos","Davis","Vinewood","Little Seoul"].map((a,i)=><div key={a}><span>{i+1}</span><strong>{a}</strong><small>{[128.4,103.7,94.1,69.3][i]}K łącznych wyświetleń</small></div>)}</div>
        </div>
      </section>

      <section className="chart-section cert-section" id="certs">
        <div className="section-heading"><div><small>ODZNACZENIA</small><h2>CERTYFIKATY</h2></div><p>Przyznawane automatycznie po przekroczeniu progu wyświetleń</p></div>
        <div className="cert-grid">{certs.map(c=><div className={"cert "+c.className} key={c.name}><span>SS</span><strong>{c.name}</strong><small>{c.threshold} WYŚWIETLEŃ</small></div>)}</div>
        <div className="next-cert"><span>NAJBLIŻEJ KOLEJNEGO PROGU</span><strong>NO SIGNAL</strong><div><i style={{width:"51%"}}></i></div><small>128.4K / 250K</small></div>
      </section>

      <section className="chart-section history" id="history">
        <div className="section-heading"><div><small>ARCHIWUM</small><h2>KRONIKA #1</h2></div><p>Kto i jak długo trzymał szczyt</p></div>
        <div className="history-line"><div><b>01</b><strong>NO SIGNAL</strong><span>obecny lider</span></div><div><b>02</b><strong>NIGHT SHIFT</strong><span>2 tygodnie na #1</span></div><div><b>03</b><strong>RED LIGHTS</strong><span>1 tydzień na #1</span></div></div>
      </section>

      <footer className="charts-footer"><b>STREET<span>SCOPE</span></b><p>News That Hits Home · Scope Charts</p></footer>
    </main>
  );
}
