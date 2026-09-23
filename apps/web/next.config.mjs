/** @type {import('next').NextConfig} */
const nextConfig = {
  // Required so Next.js/SWC transpiles the TypeScript-source workspace package
  // (packages/domain/package.json points "main" to ./src/index.ts directly).
  transpilePackages: ['@premium-share/domain'],
  experimental: {
    serverComponentsExternalPackages: ['argon2', '@prisma/client', 'prisma'],
  },
  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
        ],
      },
    ]
  },
}

export default nextConfig
