import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["sequelize", "sqlite3", "bcrypt", "canvas"],
};

export default nextConfig;
