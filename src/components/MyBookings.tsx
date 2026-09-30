"use client";

import { CalendarX2, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { api, errMsg } from "@/lib/fetcher";
import { dayMonth, formatDateVi, nowVN, shortDayVi } from "@/lib/time";
import type { PublicBooking, Room } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { Alert, btnGhost } from "./ui";

export default function MyBookings() {
  const mine = useApi<{ bookings: PublicBooking[] }>("/api/bookings");
  const board = useApi<{ rooms: Room[] }>("/api/board");
  const [error, setError] = useState<string | null>(null);

  const rooms = board.data?.rooms ?? [];
  const room = (id: string) => rooms.find((r) => r.id === id);
  const today = nowVN().date;

  async function cancel(b: PublicBooking) {
    if (!window.confirm(`Hủy lịch "${b.title}"?`)) return;
    setError(null);
    try {
      await api(`/api/bookings/${b.id}`, { method: "DELETE" });
      await mine.reload();
    } catch (e) {
      setError(errMsg(e));
    }
  }

  const list = mine.data?.bookings;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Lịch đặt phòng của tôi</h1>
          <p className="text-sm text-slate-500">Các lịch sắp diễn ra do bạn đặt.</p>
        </div>
        <Link href="/" className={`${btnGhost} ml-auto`}>
          Đặt phòng mới
        </Link>
      </div>

      {(mine.error || error) && <Alert>{error ?? mine.error}</Alert>}
      {!list && !mine.error && <p className="text-sm text-slate-500">Đang tải...</p>}

      {list?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <CalendarX2 className="mx-auto text-slate-300" size={36} />
          <p className="mt-2 text-sm text-slate-500">Bạn chưa có lịch nào sắp tới.</p>
        </div>
      )}

      <ul className="space-y-3">
        {list?.map((b) => {
          const r = room(b.roomId);
          return (
            <li key={b.id} className="flex items-stretch gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="w-14 shrink-0 text-center">
                <div className="text-xs font-medium text-slate-400">{shortDayVi(b.date)}</div>
                <div className="text-lg font-semibold text-slate-900">{dayMonth(b.date)}</div>
                {b.date === today && <div className="mt-0.5 rounded bg-indigo-50 text-[10px] font-semibold text-indigo-600">Hôm nay</div>}
              </div>
              <div className="w-1 shrink-0 rounded-full" style={{ background: r?.color ?? "#94a3b8" }} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold text-slate-900">{b.title}</div>
                <div className="text-sm text-slate-600">
                  {r?.name ?? b.roomId} · {b.start} – {b.end}
                </div>
                <div className="mt-0.5 flex items-center gap-1 text-xs text-slate-600" title={formatDateVi(b.date)}>
                  {b.attendees > 0 && (
                    <>
                      <Users size={13} /> {b.attendees} người
                    </>
                  )}
                  {b.attendees > 0 && b.notes && " · "}
                  {b.notes && <span className="truncate">{b.notes}</span>}
                </div>
              </div>
              <button onClick={() => cancel(b)} className="self-center rounded-lg border border-red-200 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50">
                Hủy
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
