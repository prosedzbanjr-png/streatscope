import type { MetadataRoute } from "next";

const base = "https://streatscope.vercel.app";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: base, lastModified: now, changeFrequency: "hourly", priority: 1 },
    { url: `${base}/wiadomosci`, lastModified: now, changeFrequency: "hourly", priority: 0.9 },
    { url: `${base}/miasto`, lastModified: now, changeFrequency: "daily", priority: 0.7 },
    { url: `${base}/o-redakcji`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
  ];

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return staticPages;
  try {
    const query = new URLSearchParams({ status: "eq.published", archived_at: "is.null", published_at: `lte.${now.toISOString()}`, select: "id,updated_at,published_at", order: "published_at.desc", limit: "500" });
    const response = await fetch(`${url}/rest/v1/articles?${query}`, { headers: { apikey: key, Authorization: `Bearer ${key}` }, next: { revalidate: 300 } });
    if (!response.ok) return staticPages;
    const rows = await response.json() as Array<{id:number;updated_at?:string|null;published_at?:string|null}>;
    return [...staticPages, ...rows.map(row => ({ url: `${base}/artykul/${row.id}`, lastModified: new Date(row.updated_at || row.published_at || now), changeFrequency: "weekly" as const, priority: 0.8 }))];
  } catch { return staticPages; }
}
