import type { NextConfig } from "next";

type InstrumentEnabled = NextConfig & {
  experimental: {
    instrumentationHook: boolean;
  };
};

const nextConfig: NextConfig = {

  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'utfs.io',
        port: '',
        pathname: '/**', // This allows all paths under utfs.io
      },
      {
        protocol: 'https',
        hostname: '**.ufs.sh',
        port: '',
        pathname: '/**', // Allow all ufs.sh subdomains (e.g., sf2jdmaodp.ufs.sh)
      },
      {
        protocol: 'https',
        hostname: 'ufs.sh',
        port: '',
        pathname: '/**',
      },
    ]
  },


  /* config options here */

  async rewrites() {
    return [
      {
        source: "/ingest/static/:path*",
        destination: "https://us-assets.i.posthog.com/static/:path*",
      },
      {
        source: "/ingest/:path*",
        destination: "https://us.i.posthog.com/:path*",
      },
      {
        source: "/ingest/flags",
        destination: "https://us.i.posthog.com/flags",
      },
    ];
  },


  experimental: {
      instrumentationHook: true,

  } ,
  // This is required to support PostHog trailing slash API requests
  skipTrailingSlashRedirect: true,
} as InstrumentEnabled;

export default nextConfig;
