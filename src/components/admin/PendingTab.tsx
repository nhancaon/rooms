"use client";

import { Check, Pencil, X } from "lucide-react";
import { useState } from "react";
import { formatDateTimeVN, formatDateVi } from "@/lib/time";
import type { Booking, Room } from "@/lib/types";
import BookingEditDialog from "../BookingEditDialog";
import DecisionDialog from "../DecisionDialog";
import { Alert, btnDanger, btnGhost, btnPrimary } from "../ui";

type Props = {
  bookings: Booking[] | undefined;
  error?: string;
  rooms: Room[];
  onChanged: () => void;
};

/** Danh sách lịch đang chờ duyệt: admin duyệt hoặc từ chối ngay tại đây, người đặt nhận email kết quả. */
export default function PendingTab({ bookings, error, rooms, onChanged }: Props) {
  const [deciding, setDeciding] = useState<{ b: Booking; mode: "approve" | "reject" } | null>(null);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const room = (id: string) => rooms.find((r) => r.id === id);

  return (
    <div className="space-y-4">
      <p className="text-sm text-slate-600">
        Các yêu cầu đặt phòng đang chờ bạn quyết định (chỉ hiện lịch từ hôm nay trở đi). Lịch chờ duyệt vẫn giữ chỗ nên người khác không đặt trùng được.
      </p>
      {notice && <Alert kind="success">{notice}</Alert>}
      {error && <Alert>{error}</Alert>}
      {!bookings && !error && <p className="text-sm text-slate-500">Đang tải...</p>}
      {bookings?.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-600">
          Không có yêu cầu nào đang chờ duyệt.
        </div>
      )}

      <ul className="space-y-3">
        {bookings?.map((b) => {
          const r = room(b.roomId);
          return (
            <li key={b.id} className="flex flex-wrap items-stretch gap-4 rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
              <div className="w-1.5 shrink-0 rounded-full" style={{ background: r?.color ?? "#94a3b8" }} />
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-slate-900">{b.title}</div>
                <div className="text-sm text-slate-700">
                  {r?.name ?? b.roomId} · {formatDateVi(b.date)} · {b.start} – {b.end}
                </div>
                <div className="mt-1 text-sm text-slate-700">
                  <span className="font-medium">{b.requesterName}</span> · {b.requesterEmail}
                  {b.attendees > 0 && ` · ${b.attendees} người`}
                </div>
                {b.notes && <div className="mt-1 text-sm italic text-slate-600">“{b.notes}”</div>}
                <div className="mt-1 text-xs text-slate-500">Gửi lúc {formatDateTimeVN(b.createdAt)}</div>
              </div>
              <div className="flex flex-wrap items-center gap-2 self-center">
                <button onClick={() => setDeciding({ b, mode: "approve" })} className={btnPrimary}>
                  <Check size={16} /> Duyệt
                </button>
                <button onClick={() => setDeciding({ b, mode: "reject" })} className={btnDanger}>
                  <X size={16} /> Từ chối
                </button>
                <button onClick={() => setEditing(b)} className={btnGhost} title="Chỉnh sửa giờ/phòng trước khi duyệt" aria-label="Chỉnh sửa">
                  <Pencil size={15} />
                </button>
              </div>
            </li>
          );
        })}
      </ul>

      {deciding && (
        <DecisionDialog
          booking={deciding.b}
          mode={deciding.mode}
          roomName={room(deciding.b.roomId)?.name ?? deciding.b.roomId}
          onClose={() => setDeciding(null)}
          onDone={(msg) => {
            setDeciding(null);
            setNotice(msg);
            onChanged();
          }}
        />
      )}
      {editing && (
        <BookingEditDialog
          booking={editing}
          rooms={rooms}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}
