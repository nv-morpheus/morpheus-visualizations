/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: { esmExternals: true },
  eslint: {
    ignoreDuringBuilds: true,
  },
};

module.exports = nextConfig;
