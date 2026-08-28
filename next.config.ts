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
};

export default nextConfig;
