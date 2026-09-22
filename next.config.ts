import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output:
    process.env.DOCKER === "true" || process.env.BUILD_STANDALONE === "true"
      ? "standalone"
      : undefined,
};

export default nextConfig;
