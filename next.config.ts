import type { NextConfig } from "next";

const noCacheHeaders = [
  { key: "Cache-Control", value: "no-store, no-cache, must-revalidate, max-age=0" },
  { key: "Pragma", value: "no-cache" },
  { key: "Expires", value: "0" },
];

const nextConfig: NextConfig = {
  images: {
    minimumCacheTTL: 2_678_400,
    remotePatterns: [
      {
        protocol: "https",
        hostname: "ftxpzdnglxubuyezqkqp.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
    ],
  },
  async headers() {
    return [
      { source: "/", headers: noCacheHeaders },
      { source: "/wiadomosci", headers: noCacheHeaders },
      { source: "/artykul/:path*", headers: noCacheHeaders },
      { source: "/guide", headers: noCacheHeaders },
      { source: "/guide/:path*", headers: noCacheHeaders },
      { source: "/fashion", headers: noCacheHeaders },
      { source: "/fashion/:path*", headers: noCacheHeaders },
      { source: "/motor", headers: noCacheHeaders },
      { source: "/motor/:path*", headers: noCacheHeaders },
      { source: "/market", headers: noCacheHeaders },
      { source: "/market/:path*", headers: noCacheHeaders },
      { source: "/licytacje", headers: noCacheHeaders },
    ];
  },
};

export default nextConfig;
