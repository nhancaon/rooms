"use client";

import { CalendarPlus, ChevronLeft, ChevronRight, LogIn } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { CLOSE_MIN, OPEN_MIN, STEP_MIN } from "@/lib/config";
import { api, errMsg } from "@/lib/fetcher";
import {
  addDays,
  dayMonth,
  formatDateVi,
  nowVN,
  shortDayVi,
  toHHmm,
  weekStart,
} from "@/lib/time";
import type { PublicBooking, Room } from "@/lib/types";
import { useBoard, useServerNow } from "@/lib/use-board";
import BookingEditDialog from "./BookingEditDialog";
import BookingModal, { type Draft } from "./BookingModal";
import DatePicker from "./DatePicker";
import TimeGrid, { type GridColumn } from "./TimeGrid";
import { Alert, btnDanger, btnGhost, btnPrimary, inputCls, Modal } from "./ui";

type View = "day" | "week";
type User = { name: string; email: string; isAdmin: boolean } | null;

export default function CalendarView({ initialDate, user }: { initialDate: string; user: User }) {
  const [date, setDate] = useState(initialDate);
  const [view, setView] = useState<View>("day");
  const [roomFilter, setRoomFilter] = useState("all");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [detail, setDetail] = useState<PublicBooking | null>(null);
  const [editing, setEditing] = useState<PublicBooking | null>(null);
  const [loginPrompt, setLoginPrompt] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; text: string } | null>(null);

  const from = view === "week" ? weekStart(date) : date;
  const to = view === "week" ? addDays(from, 6) : date;
  const { data, error, offset, reload } = useBoard(from, to);
  const nowMs = useServerNow(offset);
  const now = nowVN(nowMs);

  const loading = !data || data.from !== from || data.to !== to;
  const rooms = data?.rooms ?? [];
  const bookings = loading ? [] : data.bookings;
  const colorOf = (id: string) => rooms.find((r) => r.id === id)?.color ?? "#64748b";
  const roomOf = (id: string) => rooms.find((r) => r.id === id);

  // Xem tuần luôn theo 1 phòng.
  const weekRoom = roomFilter !== "all" && roomOf(roomFilter) ? roomOf(roomFilter) : rooms[0];

  const columns: GridColumn[] =
    view === "day"
      ? rooms
          .filter((r) => roomFilter === "all" || r.id === roomFilter)
          .map((r) => ({ key: r.id, roomId: r.id, date, header: <RoomHeader room={r} /> }))
      : weekRoom
        ? Array.from({ length: 7 }, (_, i) => {
            const d = addDays(from, i);
            return { key: d, roomId: weekRoom.id, date: d, header: <DayHeader date={d} today={d === now.date} /> };
          })
        : [];

  function flash(kind: "success" | "error", text: string) {
    setToast({ kind, text });
    setTimeout(() => setToast(null), 4000);
  }

  function go(d: string) {
    setDate(d);
    window.history.replaceState(null, "", d === nowVN().date ? "/" : `/?date=${d}`);
  }

  function step(dir: 1 | -1) {
    go(addDays(date, dir * (view === "week" ? 7 : 1)));
  }

  function changeView(v: View) {
    setView(v);
    if (v === "week" && roomFilter === "all" && rooms[0]) setRoomFilter(rooms[0].id);
  }

  function startBooking(d: Draft) {
    if (!user) return setLoginPrompt(true);
    setDraft(d);
  }

  function newBooking() {
    const day = date < now.date ? now.date : date;
    const s = day === now.date ? Math.min(Math.max(Math.ceil((now.minutes + 1) / STEP_MIN) * STEP_MIN, OPEN_MIN), CLOSE_MIN - 60) : 9 * 60;
    startBooking({
      roomId: (view === "week" ? weekRoom : roomFilter !== "all" ? roomOf(roomFilter) : rooms[0])?.id ?? "",
      date: day,
      start: toHHmm(s),
      end: toHHmm(s + 60),
    });
  }

  const title =
    view === "day"
      ? formatDateVi(date)
      : `${dayMonth(from)} – ${dayMonth(to)}/${to.slice(0, 4)}`;

  return (
    <div className="space-y-4">
      {/* Thanh công cụ */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-1">
          <button onClick={() => step(-1)} className={`${btnGhost} px-2`} aria-label="Trước">
            <ChevronLeft size={18} />
          </button>
          <button onClick={() => step(1)} className={`${btnGhost} px-2`} aria-label="Sau">
            <ChevronRight size={18} />
          </button>
        </div>
        <button onClick={() => go(now.date)} className={btnGhost}>
          Hôm nay
        </button>
        <h1 className="min-w-0 px-1 text-lg font-semibold text-slate-900 sm:text-xl">
          {title}
          {view === "day" && date === now.date && <span className="ml-2 rounded-full bg-indigo-50 px-2 py-0.5 align-middle text-xs font-medium text-indigo-700">Hôm nay</span>}
        </h1>

        <div className="ml-auto flex flex-wrap items-center gap-2">
          <DatePicker value={date} onChange={(d) => d && go(d)} className="w-40" ariaLabel="Chọn ngày" />
          <select value={roomFilter} onChange={(e) => setRoomFilter(e.target.value)} className={`${inputCls} w-auto! max-w-56`} aria-label="Lọc theo phòng">
            {view === "day" && <option value="all">Tất cả phòng</option>}
            {rooms.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
          <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5 text-sm">
            {(["day", "week"] as const).map((v) => (
              <button
                key={v}
                onClick={() => changeView(v)}
                className={`rounded-md px-3 py-1.5 font-medium ${view === v ? "bg-indigo-600 text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}
              >
                {v === "day" ? "Ngày" : "Tuần"}
              </button>
            ))}
          </div>
          <button onClick={newBooking} className={btnPrimary}>
            <CalendarPlus size={16} /> Đặt phòng
          </button>
        </div>
      </div>

      {error && <Alert>{error} — đang hiển thị dữ liệu gần nhất (nếu có).</Alert>}

      {loading && columns.length === 0 ? (
        <div className="grid h-72 place-items-center rounded-2xl border border-slate-200 bg-white text-sm text-slate-500">Đang tải lịch...</div>
      ) : (
        <TimeGrid
          columns={columns}
          bookings={bookings}
          colorOf={colorOf}
          nowMs={nowMs}
          colMin={view === "week" ? 120 : 170}
          onSelect={(col, s, e) => startBooking({ roomId: col.roomId, date: col.date, start: toHHmm(s), end: toHHmm(e) })}
          onInvalid={(why) => flash("error", why === "past" ? "Không thể đặt thời điểm đã qua." : "Khoảng giờ này đã có lịch.")}
          onOpen={setDetail}
        />
      )}

      <p className="text-xs text-slate-500">
        Bấm hoặc kéo trên ô trống để đặt phòng · bấm vào lịch để xem chi tiết.
        {!user && (
          <>
            {" "}
            <Link href="/login" className="font-medium text-indigo-600 hover:underline">
              Đăng nhập
            </Link>{" "}
            để đặt phòng.
          </>
        )}
      </p>

      {/* Modal */}
      {draft && user && (
        <BookingModal
          rooms={rooms}
          draft={draft}
          user={user}
          onClose={() => setDraft(null)}
          onCreated={(b) => {
            setDraft(null);
            flash("success", `Đã đặt ${roomOf(b.roomId)?.name ?? "phòng"} · ${dayMonth(b.date)} · ${b.start}–${b.end}`);
            void reload();
          }}
        />
      )}

      {detail && (
        <DetailDialog
          booking={detail}
          room={roomOf(detail.roomId)}
          isAdmin={!!user?.isAdmin}
          onClose={() => setDetail(null)}
          onEdit={() => {
            setEditing(detail);
            setDetail(null);
          }}
          onCancelled={() => {
            setDetail(null);
            flash("success", "Đã hủy lịch.");
            void reload();
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
            flash("success", "Đã cập nhật lịch.");
            void reload();
          }}
        />
      )}

      {loginPrompt && (
        <Modal
          title="Đăng nhập để đặt phòng"
          onClose={() => setLoginPrompt(false)}
          width="max-w-sm"
          footer={
            <>
              <button onClick={() => setLoginPrompt(false)} className={btnGhost}>
                Để sau
              </button>
              <Link href="/login?callbackUrl=%2F" className={btnPrimary}>
                <LogIn size={16} /> Đăng nhập
              </Link>
            </>
          }
        >
          <p className="text-sm text-slate-600">Bạn cần đăng nhập bằng tài khoản Google để đặt phòng và quản lý lịch của mình.</p>
        </Modal>
      )}

      {toast && (
        <div className="pointer-events-none fixed inset-x-0 bottom-6 z-[60] flex justify-center px-4">
          <div
            className={`pointer-events-auto rounded-xl px-4 py-3 text-sm font-medium text-white shadow-lg ${
              toast.kind === "success" ? "bg-slate-900" : "bg-red-600"
            }`}
          >
            {toast.text}
          </div>
        </div>
      )}
    </div>
  );
}

function RoomHeader({ room }: { room: Room }) {
  return (
    <div className="flex items-start gap-2">
      <span className="mt-1 h-3 w-3 shrink-0 rounded-full" style={{ background: room.color }} />
      <div className="min-w-0">
        <div className="truncate text-sm font-semibold text-slate-900" title={room.name}>
          {room.name}
        </div>
        <div className="truncate text-xs text-slate-500" title={room.location}>
          {room.location || (room.capacity ? `${room.capacity} chỗ` : " ")}
        </div>
      </div>
    </div>
  );
}

function DayHeader({ date, today }: { date: string; today: boolean }) {
  return (
    <div className="text-center">
      <div className={`text-xs font-medium ${today ? "text-indigo-600" : "text-slate-500"}`}>{shortDayVi(date)}</div>
      <div
        className={`mx-auto mt-0.5 grid h-8 w-8 place-items-center rounded-full text-sm font-semibold ${today ? "bg-indigo-600 text-white" : "text-slate-900"}`}
      >
        {Number(date.slice(8))}
      </div>
    </div>
  );
}

function DetailDialog({
  booking: b,
  room,
  isAdmin,
  onClose,
  onEdit,
  onCancelled,
}: {
  booking: PublicBooking;
  room: Room | undefined;
  isAdmin: boolean;
  onClose: () => void;
  onEdit: () => void;
  onCancelled: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function cancel() {
    if (!window.confirm("Hủy lịch đặt phòng này?")) return;
    setBusy(true);
    setErr(null);
    try {
      await api(`/api/bookings/${b.id}`, { method: "DELETE" });
      onCancelled();
    } catch (e) {
      setErr(errMsg(e));
      setBusy(false);
    }
  }

  const rows: [string, string | undefined][] = [
    ["Phòng", room ? `${room.name}${room.location ? ` — ${room.location}` : ""}` : b.roomId],
    ["Thời gian", `${formatDateVi(b.date)}, ${b.start} – ${b.end}`],
    ["Người đặt", b.requesterName],
    ["Email", b.requesterEmail],
    ["Số người", b.attendees > 0 ? `${b.attendees} người` : undefined],
    ["Yêu cầu khác", b.notes],
  ];

  return (
    <Modal
      title={b.title}
      subtitle={b.mine ? "Lịch của bạn" : undefined}
      onClose={onClose}
      footer={
        <>
          {b.canCancel && (
            <button onClick={cancel} disabled={busy} className={btnDanger}>
              {busy ? "Đang hủy..." : "Hủy lịch"}
            </button>
          )}
          {isAdmin && (
            <button onClick={onEdit} className={btnPrimary}>
              Chỉnh sửa
            </button>
          )}
          <button onClick={onClose} className={btnGhost}>
            Đóng
          </button>
        </>
      }
    >
      <div className="mb-4 h-1.5 rounded-full" style={{ background: room?.color ?? "#64748b" }} />
      <dl className="space-y-2.5 text-sm">
        {rows
          .filter(([, v]) => v)
          .map(([k, v]) => (
            <div key={k} className="flex gap-3">
              <dt className="w-28 shrink-0 text-slate-600">{k}</dt>
              <dd className="min-w-0 break-words font-medium text-slate-900">{v}</dd>
            </div>
          ))}
      </dl>
      {err && (
        <div className="mt-3">
          <Alert>{err}</Alert>
        </div>
      )}
    </Modal>
  );
}
