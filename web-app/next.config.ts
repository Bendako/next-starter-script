import { NextConfig } from 'next'

const nextConfig: NextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['ws'],
  },
  env: {
    NEXT_PUBLIC_API_URL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
    NEXT_PUBLIC_WS_URL: process.env.NEXT_PUBLIC_WS_URL || 'ws://localhost:3001',
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  },
  async rewrites() {
    return [
      // Only proxy routes actually served by the legacy Express API.
      // A catch-all /api rewrite can intercept API paths not owned by Express.
      {
        source: '/api/project/:path*',
        destination: 'http://localhost:3001/api/project/:path*',
      },
      {
        source: '/api/templates',
        destination: 'http://localhost:3001/api/templates',
      },
      {
        source: '/api/health',
        destination: 'http://localhost:3001/api/health',
      },
    ];
  },
}

export default nextConfig
