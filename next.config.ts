import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: [
    "tesseract.js",
    "jimp",
    "@libsql/client",
    "@prisma/adapter-libsql",
    "@prisma/driver-adapter-utils",
    "libsql",
    "@libsql/linux-x64-musl",
  ],
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
