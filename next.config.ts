import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  "devIndicators":false,
  output: "standalone",
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,
};

export default nextConfig;
