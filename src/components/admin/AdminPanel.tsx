"use client";

import { useState } from "react";
import { nowVN } from "@/lib/time";
import type { Booking, Room } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import AdminsTab from "./AdminsTab";
import BookingsTab from "./BookingsTab";
import OverviewTab from "./OverviewTab";
import PendingTab from "./PendingTab";
import RoomsTab from "./RoomsTab";

type TabId = "pending" | "overview" | "bookings" | "rooms" | "admins";

export default function AdminPanel({ currentEmail }: { currentEmail: string }) {
  const [tab, setTab] = useState<TabId>("pending");
  const rooms = useApi<{ rooms: Room[] }>("/api/admin/rooms");
  const today = nowVN().date;
  const pending = useApi<{ bookings: Booking[] }>(`/api/admin/bookings?status=pending&from=${today}`);
  const roomList = rooms.data?.rooms ?? [];
  const pendingCount = pending.data?.bookings.length ?? 0;

  const tabs: { id: TabId; label: string; badge?: number }[] = [
    { id: "pending", label: "Chờ duyệt", badge: pendingCount },
    { id: "overview", label: "Tổng quan" },
    { id: "bookings", label: "Lịch đặt phòng" },
    { id: "rooms", label: "Phòng" },
    { id: "admins", label: "Quản trị viên" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl font-semibold text-slate-900">Quản trị</h1>
        <p className="text-sm text-slate-600">Duyệt lịch, xem toàn bộ thông tin đặt phòng, chỉnh sửa, hủy, xóa, quản lý phòng và quản trị viên.</p>
      </div>

      <div className="flex gap-1 overflow-x-auto border-b border-slate-200">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`-mb-px flex shrink-0 items-center gap-2 border-b-2 px-4 py-2 text-sm font-medium ${
              tab === t.id ? "border-indigo-600 text-indigo-700" : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {t.label}
            {!!t.badge && <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white">{t.badge}</span>}
          </button>
        ))}
      </div>

      {!rooms.data && !rooms.error ? (
        <p className="text-sm text-slate-500">Đang tải...</p>
      ) : (
        <>
          {tab === "pending" && <PendingTab bookings={pending.data?.bookings} error={pending.error} rooms={roomList} onChanged={() => void pending.reload()} />}
          {tab === "overview" && <OverviewTab rooms={roomList.filter((r) => r.active)} />}
          {tab === "bookings" && <BookingsTab rooms={roomList} />}
          {tab === "rooms" && <RoomsTab rooms={roomList} error={rooms.error} onChanged={rooms.reload} />}
          {tab === "admins" && <AdminsTab currentEmail={currentEmail} />}
        </>
      )}
    </div>
  );
}
