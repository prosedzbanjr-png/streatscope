import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      { userAgent: "*", allow: ["/", "/wiadomosci", "/miasto", "/o-redakcji", "/artykul/"], disallow: ["/redakcja/", "/api/"] },
    ],
    sitemap: "https://streatscope.vercel.app/sitemap.xml",
  };
}
