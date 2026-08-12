import { PublishedStories } from "./published-stories";

export default function Home() {
  const ticker = ["NOCNY SPOT PRZERWANY PRZEZ LSPD", "LA MESA: NOWE ZGŁOSZENIA OD MIESZKAŃCÓW", "STREETSCOPE: REPORTAŻ Z MIASTA", "Z NOTATNIKA REDAKCJI", "PILNE: UTRUDNIENIA W RUCHU NA DAVIS AVE."];
  return <main>
    <div className="ticker" aria-label="Najnowsze informacje"><div className="ticker-track">{[...ticker, ...ticker].map((item, index) => <span key={`${item}-${index}`}><b>●</b>{item}</span>)}</div></div>
    <header className="nav"><a href="#top" className="wordmark">STREET<span>SCOPE</span></a><nav><a href="/wiadomosci">WIADOMOŚCI</a><a href="/miasto">MIASTO</a><a href="/o-redakcji">O REDAKCJI</a></nav><a className="report" href="/zglos-temat">ZGŁOŚ TEMAT <b>↗</b></a></header>
    <section id="top" className="hero"><img src="/images/hero.png" alt="StreetScope na nocnym spotcie"/><div className="hero-shade"/><div className="hero-copy"><p className="kicker"><i/> NA ŻYWO · LA MESA</p><h1>NEWS<br/>THAT <em>HITS</em><br/>HOME.</h1><p>StreetScope obserwuje miasto tam, gdzie inne media nie dojeżdżają.</p><a href="#stories" className="red-button">ZOBACZ NAJNOWSZE <span>↓</span></a></div><div className="hero-date">WYDANIE 01<br/><strong>LOS SANTOS</strong></div></section>
    <section id="stories" className="stories"><div className="section-label"><span>01</span><p>NAJNOWSZE RELACJE</p><a href="#city">WSZYSTKIE TEMATY ↗</a></div><PublishedStories/><div className="news-strip"><span>W SKRÓCIE</span><p>Redakcja StreetScope jest na miejscu. Kolejne relacje już wkrótce.</p><a href="#contact">ZGŁOŚ TEMAT ↗</a></div></section>
    <section id="city" className="manifest"><div><p className="kicker"><i/> STREET LEVEL REPORTING</p><h2>WE DON&apos;T<br/>CHASE THE<br/><em>NOISE.</em></h2></div><div className="manifest-copy"><p>StreetScope to niezależna redakcja z La Mesa. Dokumentujemy ludzi, miejsca i historie, które naprawdę poruszają Los Santos.</p><a href="#about">POZNAJ STREETSCOPE <b>↗</b></a></div></section>
    <section id="about" className="about"><img src="/images/mural.png" alt="Mural StreetScope"/><div><p className="kicker"><i/> O REDAKCJI</p><h2>FROM THE<br/><em>STREET.</em></h2><p>Bez PR-owego filtra. Bez gadania pod dyktando. Tylko to, co dzieje się pod naszymi oknami.</p><div className="stats"><span><b>24/7</b> NA MIEŚCIE</span><span><b>LS</b> NASZ DOM</span><span><b>01</b> REDAKCJA</span></div></div></section>
    <section id="contact" className="contact"><p className="kicker"><i/> MASZ TEMAT?</p><h2>MAKE IT<br/><em>HIT HOME.</em></h2><a className="light-button" href="mailto:redakcja@streetscope.news">NAPISZ DO REDAKCJI ↗</a></section>
    <footer><a href="#top" className="wordmark">STREET<span>SCOPE</span></a><p>NEWS THAT <b>HITS</b> HOME</p><p>© 2026 STREET SCOPE</p></footer>
  </main>;
}
