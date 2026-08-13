import { HomeNewsBoard } from "./home-news-board";
import { PopularStories } from "./popular-stories";

export default function Home() {
  const ticker = ["NEWS THAT HITS HOME.", "LA MESA · LOS SANTOS", "ZGŁOŚ TEMAT REDAKCJI", "NOWE MATERIAŁY KAŻDEGO DNIA"];
  return <main>
    <div className="ticker" aria-label="StreetScope"><div className="ticker-track">{[...ticker, ...ticker].map((item, index) => <span key={`${item}-${index}`}><b>●</b>{item}</span>)}</div></div>
    <header className="nav stage31-nav">
      <a href="/" className="wordmark">STREET<span>SCOPE</span></a>
      <nav><a href="/wiadomosci">WIADOMOŚCI</a><a href="/miasto">MIASTO</a><a href="/o-redakcji">O REDAKCJI</a><a href="/zglos-temat">ZGŁOŚ TEMAT</a></nav>
      <div className="nav-actions"><a className="recruit" href="/dolacz">DOŁĄCZ DO REDAKCJI</a></div>
    </header>

    <HomeNewsBoard />
    <PopularStories />

    <section className="street-intro">
      <div className="street-brand"><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>NIEZALEŻNA REDAKCJA ULICZNA</p><strong>Z ULICY. DLA LUDZI. Z MIASTA.</strong></div>
      <div className="street-copy"><p className="kicker"><i /> NEWS THAT HITS HOME.</p><h2>MIASTO NIE CZEKA.<br/><em>MY TEŻ NIE.</em></h2><p>Relacje, ludzie, lokalne konflikty, kultura, biznes i nocne życie Los Santos — z perspektywy ulicy.</p><div className="street-actions"><a href="/o-redakcji">POZNAJ REDAKCJĘ →</a><a href="/zglos-temat">ZGŁOŚ TEMAT →</a></div></div>
    </section>

    <section className="join-strip"><div><span>MASZ COŚ, O CZYM POWINNO WIEDZIEĆ MIASTO?</span><h2>DAJ NAM SYGNAŁ.</h2></div><a href="/zglos-temat">NAPISZ DO REDAKCJI →</a></section>

    <footer className="stage31-footer"><div><a href="/" className="wordmark">STREET<span>SCOPE</span></a><p>© 2026 StreetScope</p></div><nav><a href="/wiadomosci">WIADOMOŚCI</a><a href="/miasto">MIASTO</a><a href="/o-redakcji">O REDAKCJI</a><a href="/dolacz">DOŁĄCZ</a></nav><p>NEWS THAT <b>HITS</b> HOME.</p></footer>
  </main>;
}
