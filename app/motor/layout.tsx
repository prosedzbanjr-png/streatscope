import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Motor",
  description: "Street Motor — samochody, buildy i kultura motoryzacyjna Los Santos w StreetScope.",
  alternates: { canonical: "/motor" },
  openGraph: {
    title: "Motor | StreetScope",
    description: "Samochody, buildy i kultura motoryzacyjna Los Santos w StreetScope.",
    url: "/motor",
    images: [{ url: "/images/hero.png", alt: "StreetScope Motor" }],
  },
  twitter: { card: "summary_large_image", title: "Motor | StreetScope", description: "Samochody, buildy i kultura motoryzacyjna Los Santos w StreetScope.", images: ["/images/hero.png"] },
};

export default function MotorLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
