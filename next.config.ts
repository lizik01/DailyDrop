import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // Pin the root: a stray lockfile in a parent folder otherwise confuses Turbopack.
  turbopack: { root: import.meta.dirname },
  serverExternalPackages: ['rss-parser'],
}

export default nextConfig
