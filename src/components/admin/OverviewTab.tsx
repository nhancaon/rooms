"use client";

import { CalendarCheck, CalendarClock, Clock, Trophy } from "lucide-react";
import { addDays, dayMonth, nowVN, shortDayVi, toMinutes } from "@/lib/time";
import type { Booking, Room } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { Alert } from "../ui";

const hoursOf = (b: Booking) => (toMinutes(b.end) - toMinutes(b.start)) / 60;
const fmtH = (h: number) => `${Math.round(h * 10) / 10}h`;

export default function OverviewTab({ rooms }: { rooms: Room[] }) {
  const today = nowVN().date;
  const from = addDays(today, -29);
  const to = addDays(today, 30);
  const { data, error, loading } = useApi<{ bookings: Booking[] }>(`/api/admin/bookings?from=${from}&to=${to}&status=confirmed`);

  if (error) return <Alert>{error}</Alert>;
  if (loading || !data) return <p className="text-sm text-slate-500">Đang tải...</p>;

  const all = data.bookings;
  const past30 = all.filter((b) => b.date <= today);
  const todayCount = all.filter((b) => b.date === today).length;
  const next7 = all.filter((b) => b.date > today && b.date <= addDays(today, 7)).length;
  const upcoming = all.filter((b) => b.date >= today).slice(0, 8);

  const perRoom = rooms
    .map((r) => ({ room: r, hours: past30.filter((b) => b.roomId === r.id).reduce((s, b) => s + hoursOf(b), 0), count: past30.filter((b) => b.roomId === r.id).length }))
    .sort((a, b) => b.hours - a.hours);
  const maxH = Math.max(1, ...perRoom.map((x) => x.hours));
  const totalH = perRoom.reduce((s, x) => s + x.hours, 0);
  const top = perRoom[0]?.hours ? perRoom[0] : null;
  const roomName = (id: string) => rooms.find((r) => r.id === id)?.name ?? id;

  const stats = [
    { icon: CalendarCheck, label: "Lịch hôm nay", value: String(todayCount), tone: "bg-indigo-50 text-indigo-600" },
    { icon: CalendarClock, label: "7 ngày tới", value: String(next7), tone: "bg-sky-50 text-sky-600" },
    { icon: Clock, label: "Giờ sử dụng (30 ngày qua)", value: fmtH(totalH), tone: "bg-emerald-50 text-emerald-600" },
    { icon: Trophy, label: "Phòng dùng nhiều nhất", value: top?.room.name ?? "—", tone: "bg-amber-50 text-amber-600" },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <div className={`mb-3 grid h-9 w-9 place-items-center rounded-lg ${s.tone}`}>
              <s.icon size={18} />
            </div>
            <div className="truncate text-2xl font-semibold text-slate-900" title={s.value}>
              {s.value}
            </div>
            <div className="text-sm text-slate-500">{s.label}</div>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Mức sử dụng theo phòng (30 ngày qua)</h2>
          <ul className="space-y-3">
            {perRoom.map(({ room, hours, count }) => (
              <li key={room.id}>
                <div className="mb-1 flex items-baseline justify-between gap-2 text-sm">
                  <span className="flex min-w-0 items-center gap-2">
                    <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: room.color }} />
                    <span className="truncate">{room.name}</span>
                  </span>
                  <span className="shrink-0 text-xs text-slate-500">
                    {fmtH(hours)} · {count} lịch
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                  <div className="h-full rounded-full" style={{ width: `${(hours / maxH) * 100}%`, background: room.color }} />
                </div>
              </li>
            ))}
            {perRoom.length === 0 && <li className="text-sm text-slate-500">Chưa có phòng nào.</li>}
          </ul>
        </section>

        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-semibold text-slate-900">Sắp diễn ra</h2>
          {upcoming.length === 0 ? (
            <p className="text-sm text-slate-500">Không có lịch sắp tới.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {upcoming.map((b) => (
                <li key={b.id} className="flex items-center gap-3 py-2.5">
                  <div className="w-14 shrink-0 text-center">
                    <div className="text-[11px] font-medium text-slate-400">{shortDayVi(b.date)}</div>
                    <div className="text-sm font-semibold text-slate-900">{dayMonth(b.date)}</div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium text-slate-900">{b.title}</div>
                    <div className="truncate text-xs text-slate-500">
                      {roomName(b.roomId)} · {b.start}–{b.end} · {b.requesterName}
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
