"use client";

import { useEffect } from "react";
import "./not-found.css";

export default function ErrorPage({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {}, []);
  return <main className="not-found"><a className="wordmark" href="/">STREET<span>SCOPE</span></a><div><p className="kicker"><i /> BŁĄD SYSTEMU</p><h1>COŚ POSZŁO<br /><em>NIE TAK.</em></h1><p>Materiał nie załadował się poprawnie. Spróbuj jeszcze raz albo wróć do strony głównej.</p><div className="not-found-actions"><button className="red-button" onClick={() => reset()}>SPRÓBUJ PONOWNIE</button><a href="/">← STRONA GŁÓWNA</a></div></div><small>STREETSCOPE · NEWS THAT HITS HOME</small></main>;
}
