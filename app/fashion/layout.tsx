import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Fashion",
  description: "Street Fashion — outfity, styl i ludzie Los Santos w obiektywie StreetScope.",
  alternates: { canonical: "/fashion" },
  openGraph: {
    title: "Fashion | StreetScope",
    description: "Outfity, styl i ludzie Los Santos w obiektywie StreetScope.",
    url: "/fashion",
    images: [{ url: "/images/hero.png", alt: "StreetScope Fashion" }],
  },
  twitter: { card: "summary_large_image", title: "Fashion | StreetScope", description: "Outfity, styl i ludzie Los Santos w obiektywie StreetScope.", images: ["/images/hero.png"] },
};

export default function FashionLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
