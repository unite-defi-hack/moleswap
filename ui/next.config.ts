import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Experimental configuration for better local package handling
  experimental: {
    // This helps with symlinked packages in pnpm workspaces
    externalDir: true,
  },
  // Ensure Next.js properly transpiles the local SDK
  transpilePackages: ['@1inch/cross-chain-sdk'],
  webpack: (config, { isServer, dev }) => {
    // Handle pino-pretty optional dependency
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
      };
    }
    
    // Handle optional dependencies that might not be available
    config.externals = config.externals || [];
    config.externals.push({
      'pino-pretty': 'pino-pretty',
    });

    // In development, watch for changes in the local SDK
    if (dev && config.watchOptions) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          '**/node_modules',
          '!**/node_modules/@1inch/cross-chain-sdk/**',
        ],
      };
    }

    return config;
  },
};

export default nextConfig;
