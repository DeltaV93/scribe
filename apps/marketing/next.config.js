/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  transpilePackages: ['@inkra/ui'],
  // Trailing slashes help with static hosting
  trailingSlash: true,
};

module.exports = nextConfig;
