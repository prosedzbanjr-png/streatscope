import type { Metadata } from "next";
import "./globals.css";
import "./pages.css";

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
    <html lang="pl">
      <body>{children}</body>
    </html>
  );
}
