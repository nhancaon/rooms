import type { BookingStatus } from "@/lib/types";

const MAP: Record<BookingStatus, { label: string; cls: string }> = {
  pending: { label: "Chờ duyệt", cls: "bg-amber-50 text-amber-800 ring-amber-200" },
  confirmed: { label: "Hiệu lực", cls: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  rejected: { label: "Bị từ chối", cls: "bg-red-50 text-red-700 ring-red-200" },
  cancelled: { label: "Đã hủy", cls: "bg-slate-100 text-slate-600 ring-slate-200" },
};

export const statusLabel = (s: BookingStatus) => MAP[s].label;

export default function StatusBadge({ status, className = "" }: { status: BookingStatus; className?: string }) {
  const m = MAP[status];
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${m.cls} ${className}`}>
      {m.label}
    </span>
  );
}
