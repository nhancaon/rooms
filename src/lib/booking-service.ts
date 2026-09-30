import { GUEST_VIEW, MAX_ACTIVE_BOOKINGS_PER_USER, MAX_ADVANCE_DAYS } from "./config";
import { withLock } from "./lock";
import { overlaps } from "./overlap";
import { getRepo } from "./repo";
import { addDays, daysBetween, nowVN, toMinutes } from "./time";
import {
  ConflictError,
  HttpError,
  type BoardResponse,
  type Booking,
  type BookingPatch,
  type NewBookingInput,
  type PublicBooking,
  type SessionUser,
} from "./types";

const isActive = (b: Booking) => b.status === "confirmed";
const sameUser = (b: Booking, u: SessionUser | null) => !!u && b.requesterEmail.toLowerCase() === u.email.toLowerCase();

// ---------- đặt phòng ----------

export async function createBooking(input: NewBookingInput, user: SessionUser): Promise<Booking> {
  const repo = getRepo();

  // Đọc mới (bỏ qua cache) để phòng vừa bị admin ẩn ở instance khác không còn đặt được.
  const rooms = await repo.listRooms({ fresh: true });
  if (!rooms.some((r) => r.id === input.roomId && r.active)) {
    throw new HttpError(400, "Phòng không tồn tại hoặc đã ngừng sử dụng.");
  }

  const now = nowVN();
  if (input.date < now.date || (input.date === now.date && toMinutes(input.end) <= now.minutes)) {
    throw new HttpError(400, "Không thể đặt phòng cho thời điểm đã qua.");
  }
  if (input.date > addDays(now.date, MAX_ADVANCE_DAYS)) {
    throw new HttpError(400, `Chỉ được đặt trước tối đa ${MAX_ADVANCE_DAYS} ngày.`);
  }
  if (!user.isAdmin) {
    const upcoming = (await repo.listBookings({ from: now.date })).filter((b) => isActive(b) && b.date >= now.date && sameUser(b, user));
    if (upcoming.length >= MAX_ACTIVE_BOOKINGS_PER_USER) {
      throw new HttpError(429, `Bạn đang có ${upcoming.length} lịch sắp tới (tối đa ${MAX_ACTIVE_BOOKINGS_PER_USER}). Hãy hủy bớt lịch không dùng rồi đặt lại.`);
    }
  }

  return withLock(async () => {
    // 1) Kiểm tra trùng trên dữ liệu MỚI NHẤT (bỏ qua cache).
    const before = await repo.listBookings({ fresh: true, from: input.date, to: input.date });
    if (before.some((b) => isActive(b) && overlaps(b, input))) throw new ConflictError();

    const booking: Booking = {
      ...input,
      id: crypto.randomUUID(),
      requesterName: user.name,
      requesterEmail: user.email,
      status: "confirmed",
      createdAt: new Date().toISOString(),
    };
    await repo.appendBooking(booking);

    // 2) Xác nhận lại. Google Sheets không có transaction, và khi chạy nhiều instance (Vercel)
    //    khóa ở trên không đủ. Nếu có lịch trùng nằm TRƯỚC lịch của mình trong sheet thì mình thua.
    const after = await repo.listBookings({ fresh: true, from: input.date, to: input.date });
    const mine = after.findIndex((b) => b.id === booking.id);
    const lost = mine === -1 || after.some((b, i) => i < mine && isActive(b) && overlaps(b, booking));
    if (lost) {
      if (mine !== -1) await repo.setBookingStatus(booking.id, "cancelled");
      throw new ConflictError();
    }
    return booking;
  });
}

/** Người đặt hoặc admin hủy (đánh dấu cancelled, vẫn giữ trong sheet để tra cứu). */
export async function cancelBooking(id: string, user: SessionUser): Promise<void> {
  const repo = getRepo();
  const booking = await repo.findBooking(id);
  if (!booking || !isActive(booking)) throw new HttpError(404, "Không tìm thấy lịch đặt phòng.");
  if (!canCancel(booking, user)) throw new HttpError(403, "Bạn không có quyền hủy lịch này.");
  await repo.setBookingStatus(id, "cancelled");
}

// ---------- admin ----------

export type AdminFilter = {
  from?: string;
  to?: string;
  roomId?: string;
  status?: "confirmed" | "cancelled" | "all";
  q?: string;
};

const ADMIN_LIST_LIMIT = 2000;

export async function adminListBookings(f: AdminFilter): Promise<Booking[]> {
  const q = f.q?.trim().toLowerCase();
  const status = f.status ?? "confirmed";
  const all = await getRepo().listBookings({ fresh: true, from: f.from, to: f.to });
  return all
    .filter(
      (b) =>
        (status === "all" || b.status === status) &&
        (!f.from || b.date >= f.from) &&
        (!f.to || b.date <= f.to) &&
        (!f.roomId || b.roomId === f.roomId) &&
        (!q ||
          [b.title, b.requesterName, b.requesterEmail, b.notes]
            .join("\n")
            .toLowerCase()
            .includes(q)),
    )
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .slice(0, ADMIN_LIST_LIMIT);
}

/** Admin sửa lịch (đổi phòng/giờ/thông tin). Cho phép sửa cả lịch đã qua, vẫn kiểm tra trùng giờ. */
export async function adminUpdateBooking(id: string, patch: BookingPatch): Promise<Booking> {
  const repo = getRepo();

  const rooms = await repo.listRooms();

  return withLock(async () => {
    const old = await repo.findBooking(id);
    if (!old) throw new HttpError(404, "Không tìm thấy lịch đặt phòng.");
    if (!isActive(old)) throw new HttpError(400, "Lịch đã hủy, không thể chỉnh sửa.");

    // Chỉ bắt buộc phòng còn hoạt động khi đổi sang phòng khác.
    const room = rooms.find((r) => r.id === patch.roomId);
    if (!room || (!room.active && patch.roomId !== old.roomId)) {
      throw new HttpError(400, "Phòng không tồn tại hoặc đã ngừng sử dụng.");
    }

    const next: Booking = { ...old, ...patch };
    const before = await repo.listBookings({ fresh: true, from: next.date, to: next.date });
    if (before.some((b) => b.id !== id && isActive(b) && overlaps(b, next))) throw new ConflictError();

    await repo.updateBooking(next);

    // Xác nhận lại như lúc đặt: nếu giữa chừng có người khác chiếm chỗ (dòng trên) thì hoàn tác.
    const after = await repo.listBookings({ fresh: true, from: next.date, to: next.date });
    const me = after.findIndex((b) => b.id === id);
    if (me !== -1 && after.some((b, i) => i < me && isActive(b) && overlaps(b, next))) {
      await repo.updateBooking(old);
      throw new ConflictError();
    }
    return next;
  });
}

/** Xóa vĩnh viễn khỏi sheet (khác với hủy). */
export async function adminDeleteBooking(id: string): Promise<void> {
  const repo = getRepo();
  await withLock(async () => {
    if (!(await repo.findBooking(id))) throw new HttpError(404, "Không tìm thấy lịch đặt phòng.");
    await repo.deleteBooking(id);
  });
}

// ---------- đọc dữ liệu cho giao diện ----------

function canCancel(b: Booking, user: SessionUser | null): boolean {
  return !!user && (user.isAdmin || sameUser(b, user));
}

export function toPublic(b: Booking, user: SessionUser | null): PublicBooking {
  const allowed = canCancel(b, user);
  const pub: PublicBooking = {
    id: b.id,
    roomId: b.roomId,
    date: b.date,
    start: b.start,
    end: b.end,
    title: b.title,
    attendees: b.attendees,
    requesterName: b.requesterName,
    mine: sameUser(b, user),
    canCancel: allowed,
  };
  // Email/ghi chú chỉ cho chủ lịch và admin.
  if (allowed) {
    pub.notes = b.notes;
    pub.requesterEmail = b.requesterEmail;
  }
  // Người chưa đăng nhập (mặc định) chỉ thấy khung giờ đã kín, không thấy chủ đề / tên người đặt.
  if (!user && GUEST_VIEW === "busy") {
    pub.title = "Đã có lịch";
    pub.requesterName = "";
    pub.attendees = 0;
  }
  return pub;
}

const MAX_RANGE_DAYS = 42;

export async function getBoard(
  range: { from?: string; to?: string },
  user: SessionUser | null,
): Promise<BoardResponse> {
  const from = range.from ?? nowVN().date;
  const to = range.to ?? from;
  if (to < from) throw new HttpError(400, "Khoảng ngày không hợp lệ.");
  if (daysBetween(from, to) >= MAX_RANGE_DAYS) throw new HttpError(400, `Chỉ xem tối đa ${MAX_RANGE_DAYS} ngày một lần.`);

  const repo = getRepo();
  const [rooms, bookings] = await Promise.all([repo.listRooms(), repo.listBookings({ from, to })]);
  const activeRoomIds = new Set(rooms.filter((r) => r.active).map((r) => r.id));
  return {
    from,
    to,
    date: from,
    serverTime: Date.now(),
    rooms: rooms.filter((r) => r.active),
    bookings: bookings
      .filter((b) => isActive(b) && b.date >= from && b.date <= to && activeRoomIds.has(b.roomId))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
      .map((b) => toPublic(b, user)),
  };
}

/** Các lịch còn hiệu lực từ hôm nay trở đi của 1 người. */
export async function getUpcoming(user: SessionUser): Promise<PublicBooking[]> {
  const today = nowVN().date;
  const bookings = await getRepo().listBookings({ from: today });
  return bookings
    .filter((b) => isActive(b) && b.date >= today && sameUser(b, user))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start))
    .map((b) => toPublic(b, user));
}
