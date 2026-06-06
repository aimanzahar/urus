import type { NextConfig } from "next";

const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["better-sqlite3"],
  basePath: basePath || undefined,
  experimental: {
    serverActions: {
      // Headroom above the 5 MB per-file image upload limit so cover +
      // image-field uploads don't get rejected by the body size guard.
      bodySizeLimit: "8mb",
    },
  },
};

export default nextConfig;
