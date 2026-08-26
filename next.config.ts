import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "i.pravatar.cc",
      },
      {
        // Everything this app uploads - avatars and workspace covers - is
        // served from here. Without the pattern next/image refuses the URL
        // outright rather than falling back to an unoptimised <img>.
        protocol: "https",
        hostname: "res.cloudinary.com",
      },
    ],
  },
};

export default nextConfig;