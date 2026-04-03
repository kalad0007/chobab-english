import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Cloudflare Workers 호환을 위해 Webpack 사용
  bundlePagesRouterDependencies: true,
};

export default nextConfig;
