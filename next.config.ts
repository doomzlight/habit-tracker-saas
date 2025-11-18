import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  experimental: {
    allowedDevOrigins: ["http://192.168.0.124:3000"],
  },
  reactCompiler: true,
};

export default nextConfig;
