import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Scope Guide",
  description: "Scope Guide — miejsca w Los Santos wybrane i opisane przez StreetScope.",
  alternates: { canonical: "/guide" },
  openGraph: {
    title: "Scope Guide | StreetScope",
    description: "Miejsca w Los Santos wybrane i opisane przez StreetScope.",
    url: "/guide",
    images: [{ url: "/images/hero.png", alt: "Scope Guide — StreetScope" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Scope Guide | StreetScope",
    description: "Miejsca w Los Santos wybrane i opisane przez StreetScope.",
    images: ["/images/hero.png"],
  },
};

export default function GuideLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
