import "./not-found.css";

export default function NotFound() {
  return <main className="not-found"><a className="wordmark" href="/">STREET<span>SCOPE</span></a><div><p className="kicker"><i /> BŁĄD 404</p><h1>TUTAJ NIE MA<br /><em>ŻADNEGO TEMATU.</em></h1><p>Link jest nieaktualny albo materiał został usunięty przez redakcję.</p><div className="not-found-actions"><a href="/" className="red-button">← STRONA GŁÓWNA</a><a href="/wiadomosci">PRZEJDŹ DO ARCHIWUM →</a></div></div><small>STREETSCOPE · NEWS THAT HITS HOME</small></main>;
}
