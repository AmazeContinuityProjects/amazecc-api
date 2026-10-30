import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["bcrypt", "canvas"],
  experimental: {
    agentUpgrade: "security",
  },
};

export default nextConfig;
