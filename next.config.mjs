const nextConfig = {
  distDir: process.env.STUDY_UI_TEST === '1' ? '.next-ui' : '.next',
  poweredByHeader: false,
  async headers() {
    return [{ source: '/:path*', headers: [
      { key: 'X-Content-Type-Options', value: 'nosniff' },
      { key: 'X-Frame-Options', value: 'DENY' },
      { key: 'Referrer-Policy', value: 'no-referrer' },
      { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
      { key: 'Cache-Control', value: 'no-store' }
    ] }];
  }
};
export default nextConfig;
