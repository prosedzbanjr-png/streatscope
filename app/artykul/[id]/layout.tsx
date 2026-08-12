import type { Metadata } from "next";

type ArticleMeta = { title: string; excerpt: string; image_url: string | null; category: string; social_title: string | null; social_description: string | null; social_image: string | null };

async function getArticle(id: string): Promise<ArticleMeta | null> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !/^\d+$/.test(id)) return null;
  try {
    const query = new URLSearchParams({ id: `eq.${id}`, status: "eq.published", published_at: `lte.${new Date().toISOString()}`, select: "title,excerpt,image_url,category,social_title,social_description,social_image", limit: "1" });
    const response = await fetch(`${url}/rest/v1/articles?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 60 } });
    if (!response.ok) return null;
    const data = await response.json() as ArticleMeta[];
    return data[0] ?? null;
  } catch { return null; }
}

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const article = await getArticle(id);
  if (!article) return { title: "Materiał niedostępny | StreetScope", description: "StreetScope — niezależne relacje z miasta." };
  const image = article.social_image || article.image_url || "/images/hero.png";
  const socialTitle = article.social_title || article.title;
  const description = article.social_description || article.excerpt;
  const title = `${socialTitle} | StreetScope`;
  return {
    title,
    description,
    openGraph: { title, description, type: "article", siteName: "StreetScope", images: [{ url: image, alt: socialTitle }], section: article.category },
    twitter: { card: "summary_large_image", title, description, images: [image] },
  };
}

export default function ArticleLayout({ children }: Readonly<{ children: React.ReactNode }>) { return children; }
