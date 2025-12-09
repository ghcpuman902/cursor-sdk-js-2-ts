import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // For Turbopack (Next.js 16+ default)
  // Ignore LICENSE.txt files from packages (e.g., @cursor-ai/january)
  turbopack: {
    rules: {
      "*.LICENSE.txt": {
        loaders: ["raw-loader"],
        as: "*.js", // raw-loader outputs JS (module.exports = "...content...")
      },
    },
  }
};

export default nextConfig;
