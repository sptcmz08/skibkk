import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: '/',
        destination: '/courts',
        permanent: false, // temporary redirect (307)
      },
    ]
  },
  async headers() {
    return [
      {
        // Root path - force no-cache/no-store
        source: '/',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
      {
        // Don't cache HTML pages and any other document
        source: '/((?!_next/static|_next/image|favicon.ico|uploads).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
      {
        // Explicitly prevent caching for all API routes
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-cache, no-store, must-revalidate',
          },
          {
            key: 'Pragma',
            value: 'no-cache',
          },
        ],
      },
    ]
  },
};

export default nextConfig;
