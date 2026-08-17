import type { Metadata } from "next";

type GuideMeta = {
  name: string;
  short_description: string | null;
  description: string | null;
  image_url: string | null;
  gallery: string[] | null;
  neighborhood: string | null;
};

async function getGuidePlace(id: string): Promise<GuideMeta | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^\d+$/.test(id)) return null;

  try {
    const query = new URLSearchParams({
      id: `eq.${id}`,
      active: "eq.true",
      archived_at: "is.null",
      select: "name,short_description,description,image_url,gallery,neighborhood",
      limit: "1",
    });
    const response = await fetch(`${url}/rest/v1/guide_places?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
      next: { revalidate: 60 },
    });
    if (!response.ok) return null;
    const data = await response.json() as GuideMeta[];
    return data[0] ?? null;
  } catch {
    return null;
  }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const place = await getGuidePlace(id);
  if (!place) {
    return {
      title: "Miejsce niedostępne | Scope Guide",
      robots: { index: false, follow: false },
    };
  }

  const description = place.short_description || place.description || `${place.name} w Scope Guide StreetScope.`;
  const image = place.image_url || place.gallery?.find(Boolean) || "/images/hero.png";
  const pageTitle = `${place.name} | Scope Guide`;
  const canonical = `/guide/${id}`;

  return {
    title: pageTitle,
    description,
    alternates: { canonical },
    openGraph: {
      title: `${pageTitle} | StreetScope`,
      description,
      type: "website",
      url: canonical,
      siteName: "StreetScope",
      images: [{ url: image, alt: place.name }],
    },
    twitter: {
      card: "summary_large_image",
      title: `${pageTitle} | StreetScope`,
      description,
      images: [image],
    },
  };
}

export default function GuideDetailLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return children;
}
