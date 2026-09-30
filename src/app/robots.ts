import type { MetadataRoute } from "next";

// Công cụ nội bộ: không cho công cụ tìm kiếm lập chỉ mục.
export default function robots(): MetadataRoute.Robots {
  return { rules: { userAgent: "*", disallow: "/" } };
}
