import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Note: standalone output is incompatible with @netlify/plugin-nextjs.
  // We use the default Next.js output so Netlify can serve API routes properly.
  allowedDevOrigins: ["*.space.z.ai"],
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, POST, DELETE, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "*" },
        ],
      },
    ];
  },
};

export default nextConfig;
