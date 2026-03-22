import type { NextConfig } from "next";

const isVercel = process.env.VERCEL === '1';

const nextConfig: NextConfig = {
  ...(isVercel ? {} : { output: 'export' }),
  trailingSlash: true,
  images: {
    unoptimized: true,
  },
};

export default nextConfig;
