"use client";

import { formatDateVi, nowVN, toHHmm, toMinutes } from "@/lib/time";
import type { PublicBooking, Room } from "@/lib/types";
import { useBoard, useServerNow } from "@/lib/use-board";

type Status = {
  current: PublicBooking | undefined;
  next: PublicBooking | undefined;
};

function statusOf(list: PublicBooking[], nowMin: number): Status {
  return {
    current: list.find((b) => toMinutes(b.start) <= nowMin && nowMin < toMinutes(b.end)),
    next: list.find((b) => toMinutes(b.start) > nowMin),
  };
}

/** Màn hình cho TV: không cần đăng nhập, tự làm mới. roomId có -> chỉ hiện 1 phòng (đặt trước cửa phòng). */
export default function DisplayBoard({ roomId }: { roomId?: string }) {
  const { data, error, offset } = useBoard();
  const nowMs = useServerNow(offset, 1000);
  const now = nowVN(nowMs);

  if (!data) {
    return <div className="grid min-h-screen place-items-center text-2xl text-slate-300">{error ?? "Đang tải..."}</div>;
  }

  const rooms = roomId ? data.rooms.filter((r) => r.id === roomId) : data.rooms;
  if (roomId && rooms.length === 0) {
    return <div className="grid min-h-screen place-items-center text-2xl text-slate-300">Không tìm thấy phòng “{roomId}”.</div>;
  }

  const clock = `${toHHmm(now.minutes)}:${String(now.seconds).padStart(2, "0")}`;

  return (
    <div className="min-h-screen p-6 sm:p-10">
      <div className="mb-8 flex items-end justify-between gap-6">
        <div>
          <h1 className="text-2xl font-bold tracking-wide sm:text-4xl">{roomId ? rooms[0].name : "TÌNH TRẠNG PHÒNG HỌP"}</h1>
          <p className="mt-1 text-lg text-slate-400">{formatDateVi(data.date)}</p>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold tabular-nums sm:text-7xl">{clock}</div>
          {error && <div className="text-sm text-amber-400">Mất kết nối — dữ liệu có thể chưa mới</div>}
        </div>
      </div>

      {roomId ? (
        <SingleRoom room={rooms[0]} list={data.bookings.filter((b) => b.roomId === roomId)} nowMin={now.minutes} />
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 xl:grid-cols-3">
          {rooms.map((room) => (
            <RoomCard key={room.id} room={room} list={data.bookings.filter((b) => b.roomId === room.id)} nowMin={now.minutes} />
          ))}
        </div>
      )}
    </div>
  );
}

function RoomCard({ room, list, nowMin }: { room: Room; list: PublicBooking[]; nowMin: number }) {
  const { current, next } = statusOf(list, nowMin);
  const busy = !!current;

  return (
    <div className={`rounded-2xl border-l-8 bg-slate-800 p-5 shadow-lg ${busy ? "border-red-500" : "border-emerald-500"}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-xl font-bold">{room.name}</div>
          {room.location && <div className="truncate text-sm text-slate-400">{room.location}</div>}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-bold ${busy ? "bg-red-500/20 text-red-300" : "bg-emerald-500/20 text-emerald-300"}`}>
          {busy ? "ĐANG SỬ DỤNG" : "TRỐNG"}
        </span>
      </div>

      <div className="mt-4 min-h-[4.5rem]">
        {current ? (
          <>
            <div className="truncate text-lg font-semibold">{current.title}</div>
            <div className="text-slate-300">
              {current.start}–{current.end}{current.requesterName && ` · ${current.requesterName}`}
            </div>
          </>
        ) : (
          <div className="text-slate-300">{next ? `Trống đến ${next.start}` : "Trống đến hết ngày"}</div>
        )}
      </div>

      {next && (
        <div className="mt-3 border-t border-slate-700 pt-3 text-sm text-slate-400">
          Tiếp theo: <span className="font-semibold text-slate-200">{next.start}–{next.end}</span> · {next.title}
        </div>
      )}
    </div>
  );
}

function SingleRoom({ room, list, nowMin }: { room: Room; list: PublicBooking[]; nowMin: number }) {
  const { current, next } = statusOf(list, nowMin);
  const busy = !!current;

  return (
    <div className="grid gap-8 lg:grid-cols-[2fr_1fr]">
      <div className={`rounded-3xl p-8 sm:p-12 ${busy ? "bg-red-600" : "bg-emerald-600"}`}>
        <div className="text-2xl font-semibold opacity-90 sm:text-4xl">{busy ? "ĐANG SỬ DỤNG" : "PHÒNG TRỐNG"}</div>
        {room.location && <div className="mt-1 opacity-80">{room.location}</div>}
        {current ? (
          <div className="mt-8">
            <div className="text-3xl font-bold sm:text-6xl">{current.title}</div>
            <div className="mt-3 text-xl sm:text-3xl">
              {current.start}–{current.end}
            </div>
            {current.requesterName && <div className="mt-1 text-lg opacity-90 sm:text-2xl">{current.requesterName}</div>}
          </div>
        ) : (
          <div className="mt-8 text-2xl sm:text-4xl">{next ? `Trống đến ${next.start}` : "Trống đến hết ngày"}</div>
        )}
        {next && (
          <div className="mt-10 border-t border-white/30 pt-4 text-lg sm:text-2xl">
            Tiếp theo: <b>{next.start}–{next.end}</b> · {next.title}
          </div>
        )}
      </div>

      <div className="rounded-3xl bg-slate-800 p-6">
        <h2 className="mb-4 text-xl font-bold">Lịch hôm nay</h2>
        {list.length === 0 && <p className="text-slate-400">Chưa có lịch.</p>}
        <ul className="space-y-3">
          {list.map((b) => {
            const past = toMinutes(b.end) <= nowMin;
            return (
              <li key={b.id} className={past ? "opacity-40" : ""}>
                <div className="font-semibold tabular-nums">
                  {b.start}–{b.end}
                </div>
                <div className="truncate text-slate-300">{b.title}</div>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}
