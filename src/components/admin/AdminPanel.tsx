"use client";

import { useState } from "react";
import type { Room } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import BookingsTab from "./BookingsTab";
import OverviewTab from "./OverviewTab";
import RoomsTab from "./RoomsTab";

const TABS = [
  { id: "overview", label: "Tổng quan" },
  { id: "bookings", label: "Lịch đặt phòng" },
  { id: "rooms", label: "Phòng" },
] as const;

export default function AdminPanel() {
  const [tab, setTab] = useState<(typeof TABS)[number]["id"]>("overview");
  const { data, error, reload } = useApi<{ rooms: Room[] }>("/api/admin/rooms");
  const rooms = data?.rooms ?? [];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Quản trị</h1>
        <p className="text-sm text-slate-500">Xem toàn bộ thông tin đặt phòng, chỉnh sửa, hủy, xóa và quản lý danh sách phòng.</p>
      </div>

      <div className="flex gap-1 border-b border-slate-200">
        {TABS.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {!data && !error ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : (
        <>
          {tab === "overview" && <OverviewTab rooms={rooms.filter((r) => r.active)} />}
          {tab === "bookings" && <BookingsTab rooms={rooms} />}
          {tab === "rooms" && <RoomsTab rooms={rooms} error={error} onChanged={reload} />}
        </>
      )}
    </div>
  );
}
