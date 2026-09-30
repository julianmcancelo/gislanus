import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '50mb',
    },
  },
  async rewrites() {
    return [
      {
        source: '/api/bitacora-gps/api/bitacora-gps',
        destination: '/api/bitacora-gps',
      },
      {
        source: '/api/bitacora-gps/',
        destination: '/api/bitacora-gps',
      },
      {
        source: '/api/lineas-transporte/api/lineas-transporte',
        destination: '/api/lineas-transporte',
      },
      {
        source: '/api/lineas-transporte/',
        destination: '/api/lineas-transporte',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin-allow-popups',
          },
        ],
      },
    ];
  },
};

export default nextConfig;
