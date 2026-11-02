/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    unoptimized: true,
  },
  experimental: {
    serverComponentsExternalPackages: ['playwright-chromium', 'playwright-core'],
  },
  allowedDevOrigins: [
    'washbasin-penpal-muppet.ngrok-free.dev',
    '*.ngrok-free.dev',
    '*.ngrok-free.app',
    '*.trycloudflare.com',
  ],
  async rewrites() {
    return [
      {
        source: '/vis-deck',
        destination: '/vis',
      },
      {
        source: '/vis-presentation',
        destination: '/vis',
      },
    ];
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'ngrok-skip-browser-warning', value: 'true' },
        ],
      },
    ];
  },
};

export default nextConfig;
