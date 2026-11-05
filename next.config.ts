import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: { 
    remotePatterns: [
      { protocol: "https", hostname: "cdn.example.com" },      
      { protocol: "https", hostname: "*.amazonaws.com" },    
    ],
  },           
    
  webpack(config) {   
    config.module.rules.push({        
      test: /\.svg$/,
      use: ["@svgr/webpack"],   
    });
    return config;   
  },

  turbopack: {
    rules: {
      "*.svg": {
        loaders: ["@svgr/webpack"],
        as: "*.js",
      },
    },
  },
};

export default nextConfig;
