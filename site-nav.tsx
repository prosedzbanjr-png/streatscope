import Link from "next/link";

export function SiteNav() {
  return <header className="article-nav"><Link href="/" className="wordmark">STREET<span>SCOPE</span></Link><nav className="sub-nav"><Link href="/wiadomosci">WIADOMOŚCI</Link><Link href="/miasto">MIASTO</Link><Link href="/o-redakcji">O REDAKCJI</Link><Link href="/zglos-temat">ZGŁOŚ TEMAT</Link></nav></header>;
}
