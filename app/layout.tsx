import type { Metadata } from "next";
import "./globals.css";
import "./pages.css";
import { ThemeToggle } from "./theme-toggle";

export const metadata: Metadata = {
  metadataBase: new URL("https://streatscope.vercel.app"),
  title: "StreetScope | News That Hits Home",
  description: "StreetScope — niezależna redakcja z Los Santos.",
  keywords: ["StreetScope", "Los Santos", "wiadomości", "miasto", "relacje"],
  openGraph: {
    title: "StreetScope | News That Hits Home",
    description: "Niezależne relacje z miasta. Tematy, które trafiają w punkt.",
    siteName: "StreetScope",
    locale: "pl_PL",
    type: "website",
    images: [{ url: "/images/hero.png", width: 900, height: 600, alt: "StreetScope" }],
  },
  twitter: { card: "summary_large_image", title: "StreetScope", description: "News That Hits Home" },
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
