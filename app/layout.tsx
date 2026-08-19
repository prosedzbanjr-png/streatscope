import type { Metadata } from "next";
import "./globals.css";
import "./pages.css";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = {
  metadataBase: new URL("https://streetscope.vercel.app"),
  title: {
    default: "StreetScope | News That Hits Home",
    template: "%s | StreetScope",
  },
  description: "StreetScope — niezależna redakcja z Los Santos. Wiadomości, ulica, kultura i historie mieszkańców.",
  alternates: { canonical: "https://streetscope.vercel.app" },
  robots: { index: true, follow: true },
  keywords: ["StreetScope", "Los Santos", "wiadomości", "miasto", "relacje"],
  openGraph: {
    title: "StreetScope | News That Hits Home",
    description: "Niezależne relacje z miasta. Tematy, które trafiają w punkt.",
    siteName: "StreetScope",
    locale: "pl_PL",
    type: "website",
    url: "https://streetscope.vercel.app",
    images: [{ url: "/images/hero.png", width: 900, height: 600, alt: "StreetScope" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "StreetScope | News That Hits Home",
    description: "Niezależne relacje z miasta. Tematy, które trafiają w punkt.",
    images: ["/images/hero.png"],
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('streetscope-theme');if(t!=='dark'&&t!=='light')t='light';document.documentElement.dataset.theme=t;document.documentElement.style.colorScheme=t;}catch(e){document.documentElement.dataset.theme='light';}})();` }} />
      </head>
      <body>{children}<ThemeToggle /></body>
    </html>
  );
}
