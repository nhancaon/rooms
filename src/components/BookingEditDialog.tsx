"use client";

import { useState } from "react";
import { CLOSE_MIN } from "@/lib/config";
import { api, errMsg } from "@/lib/fetcher";
import { adminBookingSchema } from "@/lib/schema";
import { toHHmm, toMinutes } from "@/lib/time";
import { TIME_OPTIONS } from "@/lib/time-options";
import type { Booking, Room } from "@/lib/types";
import DatePicker from "./DatePicker";
import { Alert, btnGhost, btnPrimary, Field, inputCls, Modal } from "./ui";

export type Editable = Pick<Booking, "id" | "roomId" | "date" | "start" | "end" | "title" | "attendees" | "requesterName"> &
  Partial<Pick<Booking, "notes" | "requesterEmail">>;

/** Admin chỉnh sửa 1 lịch đã đặt. Server vẫn kiểm tra trùng giờ và báo lỗi nếu trùng. */
export default function BookingEditDialog({
  booking: b,
  rooms,
  onClose,
  onSaved,
}: {
  booking: Editable;
  rooms: Room[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    roomId: b.roomId,
    date: b.date,
    start: b.start,
    end: b.end,
    title: b.title,
    attendees: b.attendees > 0 ? String(b.attendees) : "",
    notes: b.notes ?? "",
    requesterName: b.requesterName,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) =>
    setF((p) => ({ ...p, [k]: e.target.value }));

  function onStart(v: string) {
    setF((p) => ({
      ...p,
      start: v,
      end: toMinutes(p.end) <= toMinutes(v) ? toHHmm(Math.min(toMinutes(v) + 60, CLOSE_MIN)) : p.end,
    }));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = adminBookingSchema.safeParse(f);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    setSaving(true);
    try {
      await api(`/api/admin/bookings/${b.id}`, { method: "PATCH", json: parsed.data });
      onSaved();
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title="Chỉnh sửa lịch đặt phòng"
      subtitle={b.requesterEmail}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={btnGhost}>
            Đóng
          </button>
          <button form="edit-form" disabled={saving} className={btnPrimary}>
            {saving ? "Đang lưu..." : "Lưu thay đổi"}
          </button>
        </>
      }
    >
      <form id="edit-form" onSubmit={submit} className="space-y-4">
        <Field label="Chủ đề cuộc họp" required>
          <input className={inputCls} value={f.title} onChange={set("title")} />
        </Field>
        <Field label="Phòng" required>
          <select className={inputCls} value={f.roomId} onChange={set("roomId")}>
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {r.active ? "" : " (đã ẩn)"}
              </option>
            ))}
          </select>
        </Field>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Field label="Ngày" required className="col-span-2">
            <DatePicker value={f.date} onChange={(d) => d && setF((p) => ({ ...p, date: d }))} ariaLabel="Chọn ngày" />
          </Field>
          <Field label="Từ" required>
            <select className={inputCls} value={f.start} onChange={(e) => onStart(e.target.value)}>
              {TIME_OPTIONS.slice(0, -1).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
          <Field label="Đến" required>
            <select className={inputCls} value={f.end} onChange={set("end")}>
              {TIME_OPTIONS.filter((t) => toMinutes(t) > toMinutes(f.start)).map((t) => (
                <option key={t}>{t}</option>
              ))}
            </select>
          </Field>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Họ tên người đặt" required>
            <input className={inputCls} value={f.requesterName} onChange={set("requesterName")} />
          </Field>
          <Field label="Số người tham dự">
            <input className={inputCls} type="number" min={1} value={f.attendees} onChange={set("attendees")} />
          </Field>
        </div>
        <Field label="Yêu cầu khác">
          <textarea className={inputCls} rows={3} value={f.notes} onChange={set("notes")} />
        </Field>
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
