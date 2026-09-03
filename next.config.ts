import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: [
    "sharp",
    "@prisma/client",
    "prisma",
    "esbuild",
    "@gltf-transform/core",
    "@gltf-transform/functions",
    "@gltf-transform/extensions",
    "meshoptimizer",
  ],
  async redirects() {
    return [
      { source: "/brands", destination: "/templates", permanent: false },
      { source: "/brands/:id", destination: "/templates/:id", permanent: false },
    ];
  },
};

export default nextConfig;
