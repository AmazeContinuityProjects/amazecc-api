import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcrypt", "canvas", "pdf-parse", "tesseract.js", "@napi-rs/canvas"],
};

export default nextConfig;
