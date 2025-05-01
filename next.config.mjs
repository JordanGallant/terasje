// next.config.mjs
import nextPWA from 'next-pwa';
import { join } from 'path';

const withPWA = nextPWA({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development',
  buildExcludes: [/middleware-manifest\.json$/],
});

const nextConfig = {
  reactStrictMode: true,
  // Add any other Next.js config here
};

export default withPWA(nextConfig);
