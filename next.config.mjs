/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // 민감 데이터이므로 바깥으로 새지 않게 기본 헤더를 좁혀 둔다.
  async headers() {
    return [
      {
        source: '/sw.js',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
          { key: 'Service-Worker-Allowed', value: '/' },
        ],
      },
      {
        source: '/(.*)',
        headers: [
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          {
            key: 'Permissions-Policy',
            value: 'geolocation=(), camera=(), microphone=(), interest-cohort=()',
          },
        ],
      },
    ]
  },
}

export default nextConfig
