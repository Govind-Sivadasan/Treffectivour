import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "tesseract.js",
    "jimp",
    "@libsql/client",
    "@prisma/adapter-libsql",
    "libsql",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
