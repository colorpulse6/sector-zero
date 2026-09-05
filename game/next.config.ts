import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  // The framework badge otherwise intercepts the lower-left touch controls.
  devIndicators: false,
  output: "export",
  images: {
    unoptimized: true,
  },
  trailingSlash: true,
  ...(basePath ? { basePath, assetPrefix: basePath } : {}),
};

export default nextConfig;
