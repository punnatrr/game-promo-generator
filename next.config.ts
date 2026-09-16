import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp loads libvips dynamically, so include its Linux binaries explicitly.
  outputFileTracingIncludes: {
    "/api/admin/daily-images": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
