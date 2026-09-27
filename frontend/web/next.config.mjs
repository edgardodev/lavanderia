/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === 'production';

function apiOrigin() {
  try {
    return new URL(process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000/api').origin;
  } catch {
    return 'http://localhost:4000';
  }
}

const scriptSources = [
  "'self'",
  "'unsafe-inline'",
  ...(isProduction ? [] : ["'unsafe-eval'"]),
  'https://checkout.wompi.co',
];

const contentSecurityPolicy = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'none'",
  "form-action 'self' https://checkout.wompi.co https://*.wompi.co",
  "font-src 'self' data:",
  "img-src 'self' data: blob: https://storage.googleapis.com https://firebasestorage.googleapis.com",
  `script-src ${scriptSources.join(' ')}`,
  "style-src 'self' 'unsafe-inline'",
  `connect-src 'self' ${apiOrigin()} https://*.googleapis.com https://*.firebaseio.com https://*.wompi.co`,
  "frame-src https://checkout.wompi.co https://*.wompi.co",
  "worker-src 'self' blob:",
  ...(isProduction ? ['upgrade-insecure-requests'] : []),
].join('; ');

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {},
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'Content-Security-Policy', value: contentSecurityPolicy },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
          { key: 'X-DNS-Prefetch-Control', value: 'off' },
          ...(isProduction
            ? [{ key: 'Strict-Transport-Security', value: 'max-age=31536000' }]
            : []),
        ],
      },
    ];
  },
};

export default nextConfig;
