"use client";

import { Download, Pencil, Search, Trash2, XCircle } from "lucide-react";
import { useState } from "react";
import { api, errMsg } from "@/lib/fetcher";
import { addDays, formatDateShort, formatDateTimeVN, formatDateVi, nowVN } from "@/lib/time";
import type { Booking, Room } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import BookingEditDialog from "../BookingEditDialog";
import DatePicker from "../DatePicker";
import { Alert, btnGhost, inputCls } from "../ui";

type Status = "confirmed" | "cancelled" | "all";

// Excel/Sheets sẽ chạy công thức nếu ô bắt đầu bằng = + - @ nên thêm dấu ' phía trước.
function csvCell(v: string | number) {
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return `"${s.replace(/"/g, '""')}"`;
}

function exportCsv(rows: Booking[], roomName: (id: string) => string) {
  const head = ["Ngày", "Từ", "Đến", "Phòng", "Chủ đề cuộc họp", "Người đặt", "Email", "Số người", "Yêu cầu khác", "Trạng thái", "Đặt lúc"];
  const lines = rows.map((b) =>
    [formatDateShort(b.date), b.start, b.end, roomName(b.roomId), b.title, b.requesterName, b.requesterEmail, b.attendees || "", b.notes, b.status === "confirmed" ? "Hiệu lực" : "Đã hủy", formatDateTimeVN(b.createdAt)]
      .map(csvCell)
      .join(","),
  );
  const blob = new Blob(["﻿" + [head.map(csvCell).join(","), ...lines].join("\r\n")], { type: "text/csv;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `lich-dat-phong-${nowVN().date}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function BookingsTab({ rooms }: { rooms: Room[] }) {
  const today = nowVN().date;
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(addDays(today, 30));
  const [roomId, setRoomId] = useState("");
  const [status, setStatus] = useState<Status>("confirmed");
  const [qInput, setQInput] = useState("");
  const [q, setQ] = useState("");
  const [editing, setEditing] = useState<Booking | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  const params = new URLSearchParams({ status });
  if (from) params.set("from", from);
  if (to) params.set("to", to);
  if (roomId) params.set("roomId", roomId);
  if (q) params.set("q", q);
  const { data, error, loading, reload } = useApi<{ bookings: Booking[] }>(`/api/admin/bookings?${params}`);

  const roomOf = (id: string) => rooms.find((r) => r.id === id);
  const roomName = (id: string) => roomOf(id)?.name ?? id;
  const rows = data?.bookings ?? [];

  const preset = (days: number | null) => {
    if (days === null) {
      setFrom("");
      setTo("");
    } else if (days === 0) {
      setFrom(today);
      setTo(today);
    } else {
      setFrom(today);
      setTo(addDays(today, days));
    }
  };

  async function act(fn: () => Promise<unknown>) {
    setActionError(null);
    try {
      await fn();
      await reload();
    } catch (e) {
      setActionError(errMsg(e));
    }
  }

  const cancel = (b: Booking) =>
    window.confirm(`Hủy lịch "${b.title}"?\nLịch vẫn được giữ trong sheet với trạng thái "Đã hủy".`) &&
    act(() => api(`/api/bookings/${b.id}`, { method: "DELETE" }));

  const remove = (b: Booking) =>
    window.confirm(`XÓA VĨNH VIỄN lịch "${b.title}"?\nDòng này sẽ bị xóa khỏi Google Sheet và không khôi phục được.`) &&
    act(() => api(`/api/admin/bookings/${b.id}`, { method: "DELETE" }));

  return (
    <div className="space-y-4">
      {/* Bộ lọc */}
      <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-end gap-3">
          <div className="text-xs font-medium text-slate-700">
            Từ ngày
            <DatePicker value={from} onChange={setFrom} clearable placeholder="Tất cả" className="mt-1 w-40" ariaLabel="Từ ngày" />
          </div>
          <div className="text-xs font-medium text-slate-700">
            Đến ngày
            <DatePicker value={to} onChange={setTo} clearable placeholder="Tất cả" className="mt-1 w-40" ariaLabel="Đến ngày" />
          </div>
          <label className="text-xs font-medium text-slate-600">
            Phòng
            <select className={`${inputCls} mt-1 w-auto!`} value={roomId} onChange={(e) => setRoomId(e.target.value)}>
              <option value="">Tất cả phòng</option>
              {rooms.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.name}
                  {r.active ? "" : " (đã ẩn)"}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs font-medium text-slate-600">
            Trạng thái
            <select className={`${inputCls} mt-1 w-auto!`} value={status} onChange={(e) => setStatus(e.target.value as Status)}>
              <option value="confirmed">Đang hiệu lực</option>
              <option value="cancelled">Đã hủy</option>
              <option value="all">Tất cả</option>
            </select>
          </label>
          <form
            className="flex min-w-[14rem] flex-1 items-end gap-2"
            onSubmit={(e) => {
              e.preventDefault();
              setQ(qInput.trim());
            }}
          >
            <label className="flex-1 text-xs font-medium text-slate-600">
              Tìm kiếm
              <div className="relative mt-1">
                <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input className={`${inputCls} pl-9`} placeholder="Chủ đề, người đặt, email..." value={qInput} onChange={(e) => setQInput(e.target.value)} />
              </div>
            </label>
            <button className={btnGhost}>Tìm</button>
          </form>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="text-slate-500">Nhanh:</span>
          {[
            ["Hôm nay", 0],
            ["7 ngày tới", 7],
            ["30 ngày tới", 30],
            ["Tất cả thời gian", null],
          ].map(([label, d]) => (
            <button key={String(label)} onClick={() => preset(d as number | null)} className="rounded-full bg-slate-100 px-3 py-1 font-medium text-slate-600 hover:bg-slate-200">
              {label}
            </button>
          ))}
          <span className="ml-auto text-slate-500">
            {loading ? "Đang tải..." : `${rows.length} lịch`}
            {rows.length >= 2000 && " (hiển thị tối đa 2000)"}
          </span>
          <button onClick={() => exportCsv(rows, roomName)} disabled={rows.length === 0} className={btnGhost}>
            <Download size={15} /> Xuất CSV
          </button>
        </div>
      </div>

      {(error || actionError) && <Alert>{actionError ?? error}</Alert>}

      {/* Bảng */}
      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full min-w-[900px] text-left text-sm">
          <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3 font-semibold">Thời gian</th>
              <th className="px-4 py-3 font-semibold">Phòng</th>
              <th className="px-4 py-3 font-semibold">Chủ đề cuộc họp</th>
              <th className="px-4 py-3 font-semibold">Người đặt</th>
              <th className="px-4 py-3 text-right font-semibold">Số người</th>
              <th className="px-4 py-3 font-semibold">Trạng thái</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((b) => {
              const active = b.status === "confirmed";
              return (
                <tr key={b.id} className={`align-top hover:bg-slate-50/60 ${active ? "" : "text-slate-400"}`}>
                  <td className="whitespace-nowrap px-4 py-3">
                    <div className="font-medium text-slate-900">{formatDateVi(b.date)}</div>
                    <div className="text-xs font-medium text-slate-700">
                      {b.start} – {b.end}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-2">
                      <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: roomOf(b.roomId)?.color ?? "#94a3b8" }} />
                      {roomName(b.roomId)}
                    </span>
                  </td>
                  <td className="max-w-xs px-4 py-3">
                    <div className="font-medium text-slate-900">{b.title}</div>
                    {b.notes && <div className="mt-0.5 text-xs italic text-slate-600">“{b.notes}”</div>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium text-slate-900">{b.requesterName}</div>
                    <div className="text-xs text-slate-600">{b.requesterEmail}</div>
                    <div className="text-xs text-slate-500">Đặt lúc {formatDateTimeVN(b.createdAt)}</div>
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">{b.attendees > 0 ? b.attendees : "—"}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${active ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                      {active ? "Hiệu lực" : "Đã hủy"}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-right">
                    <div className="inline-flex gap-1">
                      {active && (
                        <>
                          <button onClick={() => setEditing(b)} title="Chỉnh sửa" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-indigo-600">
                            <Pencil size={16} />
                          </button>
                          <button onClick={() => cancel(b)} title="Hủy lịch (giữ lại lịch sử)" className="rounded-md p-1.5 text-slate-500 hover:bg-slate-100 hover:text-amber-600">
                            <XCircle size={16} />
                          </button>
                        </>
                      )}
                      <button onClick={() => remove(b)} title="Xóa vĩnh viễn" className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600">
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              );
            })}
            {!loading && rows.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                  Không có lịch nào khớp bộ lọc.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <BookingEditDialog
          booking={editing}
          rooms={rooms}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            void reload();
          }}
        />
      )}
    </div>
  );
}
