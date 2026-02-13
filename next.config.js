const { withSentryConfig } = require('@sentry/nextjs');

/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(self "https://*.twilio.com"), geolocation=(self)',
          },
          // HIPAA-compliant security headers
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=31536000; includeSubDomains; preload',
          },
          {
            key: 'Content-Security-Policy',
            value: "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://js.stripe.com https://*.sentry.io; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' https://*.supabase.co https://api.stripe.com wss://*.deepgram.com https://*.sentry.io https://*.ingest.sentry.io https://*.twilio.com wss://*.twilio.com https://sdk.twilio.com; frame-src https://js.stripe.com; media-src 'self' https://sdk.twilio.com https://*.twilio.com;",
          },
          {
            key: 'X-XSS-Protection',
            value: '1; mode=block',
          },
        ],
      },
    ];
  },
};

// Sentry configuration options
const sentryWebpackPluginOptions = {
  // For all available options, see:
  // https://github.com/getsentry/sentry-webpack-plugin#options

  // Only upload source maps in production
  silent: process.env.NODE_ENV !== 'production',

  // Org and project from env or defaults
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,

  // Auth token for source map uploads
  authToken: process.env.SENTRY_AUTH_TOKEN,

  // Hide source maps from client bundles
  hideSourceMaps: true,

  // Disable telemetry
  telemetry: false,

  // Automatically instrument the app
  autoInstrumentServerFunctions: true,
  autoInstrumentMiddleware: true,
  autoInstrumentAppDirectory: true,

  // Tunnel route for ad-blockers
  tunnelRoute: '/monitoring',

  // Disable logger for production builds
  disableLogger: true,

  // Wipe source map artifacts after upload
  widenClientFileUpload: true,
};

// Only wrap with Sentry if DSN is configured
const hasSentryConfig = process.env.SENTRY_DSN || process.env.NEXT_PUBLIC_SENTRY_DSN;

module.exports = hasSentryConfig
  ? withSentryConfig(nextConfig, sentryWebpackPluginOptions)
  : nextConfig;
