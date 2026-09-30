"use client";

import { EyeOff, Pencil, Plus, Trash2 } from "lucide-react";
import { useState } from "react";
import { ROOM_COLORS } from "@/lib/colors";
import { api, errMsg } from "@/lib/fetcher";
import { roomSchema } from "@/lib/schema";
import type { Room, RoomInput } from "@/lib/types";
import { Alert, btnGhost, btnPrimary, Field, inputCls, Modal } from "../ui";

type Props = { rooms: Room[]; error?: string; onChanged: () => void };

export default function RoomsTab({ rooms, error, onChanged }: Props) {
  // null = đóng, "new" = thêm mới, Room = sửa
  const [dialog, setDialog] = useState<Room | "new" | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function act(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      onChanged();
    } catch (e) {
      setActionError(errMsg(e));
    }
  }

  const toInput = (r: Room, patch: Partial<RoomInput> = {}): RoomInput => ({
    name: r.name,
    location: r.location,
    capacity: r.capacity,
    color: r.color,
    active: r.active,
    requiresApproval: r.requiresApproval,
    ...patch,
  });

  const toggle = (r: Room) => act(() => api(`/api/admin/rooms/${r.id}`, { method: "PATCH", json: toInput(r, { active: !r.active }) }));

  const remove = (r: Room) =>
    window.confirm(`Xóa phòng "${r.name}"?\nChỉ xóa được khi phòng chưa có lịch đặt nào còn hiệu lực. Nếu chỉ muốn ngừng cho đặt, hãy chọn "Ẩn phòng".`) &&
    act(() => api(`/api/admin/rooms/${r.id}`, { method: "DELETE" }));

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <p className="text-sm text-slate-500">
          {rooms.length} phòng · phòng bị ẩn sẽ không hiện trên lịch và không thể đặt, nhưng lịch cũ vẫn được giữ.
        </p>
        <button onClick={() => setDialog("new")} className={`${btnPrimary} ml-auto`}>
          <Plus size={16} /> Thêm phòng
        </button>
      </div>

      {(error || actionError) && <Alert>{actionError ?? error}</Alert>}

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Phòng</th>
              <th className="px-4 py-3 font-semibold">Vị trí</th>
              <th className="px-4 py-3 text-right font-semibold">Sức chứa</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rooms.map((r) => (
              <tr key={r.id} className={r.active ? "" : "text-slate-400"}>
                <td className="px-4 py-3">
                  <span className="flex items-center gap-2 font-medium text-slate-900">
                    <span className="h-3 w-3 shrink-0 rounded-full" style={{ background: r.color }} />
                    <span className={r.active ? "" : "text-slate-500"}>{r.name}</span>
                  </span>
                  <div className="ml-5 text-xs text-slate-500">/display/{r.id}</div>
                </td>
                <td className="px-4 py-3">{r.location || "—"}</td>
                <td className="px-4 py-3 text-right tabular-nums">{r.capacity ?? "—"}</td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${r.active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {r.active ? "Đang hoạt động" : "Đã ẩn"}
                    </span>
                    {r.requiresApproval && (
                      <span className="inline-flex rounded-full bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-800 ring-1 ring-inset ring-amber-200">Cần duyệt</span>
                    )}
                  </div>
                </td>
                <td className="whitespace-nowrap px-4 py-3 text-right">
                  <div className="inline-flex gap-1">
                    <button onClick={() => setDialog(r)} title="Chỉnh sửa" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600">
                      <Pencil size={16} />
                    </button>
                    <button onClick={() => toggle(r)} title={r.active ? "Ẩn phòng" : "Hiện phòng"} className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-600">
                      <EyeOff size={16} />
                    </button>
                    <button onClick={() => remove(r)} title="Xóa phòng" className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {rooms.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-slate-500">
                  Chưa có phòng nào. Bấm “Thêm phòng” để bắt đầu.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {dialog && (
        <RoomDialog
          room={dialog === "new" ? null : dialog}
          nextColor={ROOM_COLORS[rooms.length % ROOM_COLORS.length]}
          onClose={() => setDialog(null)}
          onSaved={() => {
            setDialog(null);
            onChanged();
          }}
        />
      )}
    </div>
  );
}

function RoomDialog({
  room,
  nextColor,
  onClose,
  onSaved,
}: {
  room: Room | null;
  nextColor: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [f, setF] = useState({
    name: room?.name ?? "",
    location: room?.location ?? "",
    capacity: room?.capacity == null ? "" : String(room.capacity),
    color: room?.color ?? nextColor,
    active: room?.active ?? true,
    requiresApproval: room?.requiresApproval ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const parsed = roomSchema.safeParse(f);
    if (!parsed.success) return setError(parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ");
    setSaving(true);
    try {
      if (room) await api(`/api/admin/rooms/${room.id}`, { method: "PATCH", json: parsed.data });
      else await api("/api/admin/rooms", { method: "POST", json: parsed.data });
      onSaved();
    } catch (err) {
      setError(errMsg(err));
      setSaving(false);
    }
  }

  return (
    <Modal
      title={room ? "Chỉnh sửa phòng" : "Thêm phòng"}
      onClose={onClose}
      footer={
        <>
          <button type="button" onClick={onClose} className={btnGhost}>
            Hủy
          </button>
          <button form="room-form" disabled={saving} className={btnPrimary}>
            {saving ? "Đang lưu..." : "Lưu"}
          </button>
        </>
      }
    >
      <form id="room-form" onSubmit={submit} className="space-y-4">
        <Field label="Tên phòng" required>
          <input className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoFocus />
        </Field>
        <Field label="Vị trí / mô tả">
          <input className={inputCls} value={f.location} onChange={(e) => setF({ ...f, location: e.target.value })} placeholder="VD: Phòng họp lớn tầng 2 D25" />
        </Field>
        <Field label="Sức chứa (người)">
          <input className={inputCls} type="number" min={1} value={f.capacity} onChange={(e) => setF({ ...f, capacity: e.target.value })} />
        </Field>
        <div>
          <span className="mb-1.5 block text-xs font-medium text-slate-600">Màu trên lịch</span>
          <div className="flex flex-wrap items-center gap-2">
            {ROOM_COLORS.map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setF({ ...f, color: c })}
                aria-label={`Màu ${c}`}
                className={`h-7 w-7 rounded-full ring-offset-2 ${f.color.toLowerCase() === c ? "ring-2 ring-slate-900" : "hover:ring-2 hover:ring-slate-300"}`}
                style={{ background: c }}
              />
            ))}
            <input type="color" value={f.color} onChange={(e) => setF({ ...f, color: e.target.value })} className="h-7 w-9 cursor-pointer rounded border border-slate-300" aria-label="Chọn màu khác" />
          </div>
        </div>
        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.requiresApproval} onChange={(e) => setF({ ...f, requiresApproval: e.target.checked })} className="mt-0.5 h-4 w-4 rounded border-slate-300" />
          <span>
            <b>Cần admin duyệt</b> trước khi có hiệu lực
            <span className="block text-xs text-slate-500">Lịch đặt phòng này sẽ ở trạng thái «Chờ duyệt» (vẫn giữ chỗ) và admin nhận email. Admin tự đặt thì có hiệu lực ngay.</span>
          </span>
        </label>
        <label className="flex items-center gap-2 text-sm text-slate-700">
          <input type="checkbox" checked={f.active} onChange={(e) => setF({ ...f, active: e.target.checked })} className="h-4 w-4 rounded border-slate-300" />
          Cho phép đặt phòng này
        </label>
        {error && <Alert>{error}</Alert>}
      </form>
    </Modal>
  );
}
