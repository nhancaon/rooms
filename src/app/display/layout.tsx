import type { Metadata } from "next";

export const metadata: Metadata = { title: "Màn hình phòng họp" };

// Giao diện tối, toàn màn hình, không thanh điều hướng — dành cho TV/màn hình treo tường.
export default function DisplayLayout({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-slate-900 text-white">{children}</div>;
}
