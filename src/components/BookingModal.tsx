"use client";

import { useState } from "react";
import { CLOSE_MIN } from "@/lib/config";
import { api, errMsg } from "@/lib/fetcher";
import { overlaps } from "@/lib/overlap";
import { bookingSchema } from "@/lib/schema";
import { formatDateVi, nowVN, toHHmm, toMinutes } from "@/lib/time";
import { TIME_OPTIONS } from "@/lib/time-options";
import type { PublicBooking, Room } from "@/lib/types";
import { useBoard } from "@/lib/use-board";
import DatePicker from "./DatePicker";
import { Alert, btnGhost, btnPrimary, Field, inputCls, Modal } from "./ui";

export type Draft = { roomId: string; date: string; start: string; end: string };

type Props = {
  rooms: Room[];
  draft: Draft;
  user: { name: string; email: string };
  onClose: () => void;
  onCreated: (b: PublicBooking) => void;
};

export default function BookingModal({ rooms, draft, user, onClose, onCreated }: Props) {
  const [roomId, setRoomId] = useState(draft.roomId);
  const [date, setDate] = useState(draft.date);
  const [start, setStart] = useState(draft.start);
  const [end, setEnd] = useState(draft.end);
  const [title, setTitle] = useState("");
  const [attendees, setAttendees] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const { data, reload } = useBoard(date, date);
  const ready = data?.from === date;
  const dayBookings = ready ? data.bookings : [];
  const validRange = toMinutes(end) > toMinutes(start);
  const busy = (id: string) => validRange && dayBookings.some((b) => overlaps(b, { roomId: id, date, start, end }));
  const roomBusy = !!roomId && busy(roomId);
  const room = rooms.find((r) => r.id === roomId);
  const today = nowVN().date;

  function onStart(v: string) {
    setStart(v);
    if (toMinutes(end) <= toMinutes(v)) setEnd(toHHmm(Math.min(toMinutes(v) + 60, CLOSE_MIN)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = bookingSchema.safeParse({ roomId, date, start, end, title, attendees, notes });
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    if (roomBusy) return setError("Phòng đã có người đặt trong khung giờ này.");

    setSubmitting(true);
    try {
      const { booking } = await api<{ booking: PublicBooking }>("/api/bookings", { method: "POST", json: parsed.data });
      onCreated(booking);
    } catch (err) {
      if ((err as { status?: number }).status === 409) void reload();
      setError(errMsg(err));
      setSubmitting(false);
    }
  }

  const formId = "booking-form";

  return (
    <Modal
      title="Đặt phòng họp"
      subtitle={`${formatDateVi(date)} · ${start} – ${end}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={btnGhost}>
            Hủy
          </button>
          <button form={formId} disabled={submitting || roomBusy} className={btnPrimary}>
            {submitting ? "Đang gửi..." : "Đặt phòng"}
          </button>
        </>
      }
    >
      <form id={formId} onSubmit={submit} className="space-y-4">
        <Field label="Chủ đề cuộc họp" required>
          <input className={inputCls} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="VD: Họp triển khai kế hoạch quý 4" autoFocus />
        </Field>

        <Field label="Phòng" required>
          <div className="flex items-center gap-2">
            <span className="h-8 w-1.5 shrink-0 rounded-full" style={{ background: room?.color ?? "#cbd5e1" }} />
            <select className={inputCls} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              {rooms.map((r) => (
                <option key={r.id} value={r.id} disabled={busy(r.id) && r.id !== roomId}>
                  {r.name}
                  {r.location ? ` — ${r.location}` : ""}
                  {busy(r.id) ? " (đã có lịch)" : ""}
                </option>
              ))}
            </select>
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Ngày" required className="col-span-2">
            <DatePicker value={date} onChange={(d) => d && setDate(d)} min={today} ariaLabel="Chọn ngày" />
          </Field>
          <Field label="Từ" required>
            <select className={inputCls} value={start} onChange={(e) => onStart(e.target.value)}>
              {TIME_OPTIONS.slice(0, -1).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Đến" required>
            <select className={inputCls} value={end} onChange={(e) => setEnd(e.target.value)}>
              {TIME_OPTIONS.filter((t) => toMinutes(t) > toMinutes(start)).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        {roomBusy && <Alert>Phòng này đã có người đặt trong khung giờ {start}–{end}. Hãy chọn giờ hoặc phòng khác.</Alert>}

        <Field label="Số người tham dự" hint="Không bắt buộc, giúp bộ phận hành chính chuẩn bị phòng.">
          <input className={inputCls} type="number" min={1} inputMode="numeric" value={attendees} onChange={(e) => setAttendees(e.target.value)} placeholder="VD: 10" />
        </Field>

        <Field label="Yêu cầu khác">
          <textarea className={inputCls} rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="VD: cần máy chiếu, bố trí bàn chữ U, chuẩn bị nước..." />
        </Field>

        <p className="text-xs text-slate-600">
          Người đặt: <span className="font-medium text-slate-800">{user.name}</span> · {user.email}
        </p>

        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
