import type { NextConfig } from "next";

// Tiêu đề bảo mật áp dụng cho mọi trang. (HSTS do Vercel tự thêm cho tên miền HTTPS.)
const securityHeaders = [
  // Không cho nhúng app vào iframe của trang khác (chống clickjacking)
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
