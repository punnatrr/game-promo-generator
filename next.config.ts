import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Sharp loads libvips dynamically, so include its Linux binaries explicitly.
  outputFileTracingIncludes: {
    "/api/admin/daily-images": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/assets/**/preview": [
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/frame/**/preview": [
      "./node_modules/@expo-google-fonts/prompt/400Regular/Prompt_400Regular.ttf",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
    "/api/internal/media/drain": [
      "./node_modules/ffmpeg-static/ffmpeg",
      "./node_modules/ffprobe-static/bin/**/*",
      "./node_modules/@expo-google-fonts/prompt/400Regular/Prompt_400Regular.ttf",
      "./node_modules/@img/sharp-linux-x64/**/*",
      "./node_modules/@img/sharp-libvips-linux-x64/**/*",
    ],
  },
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
