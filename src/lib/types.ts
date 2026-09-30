export type Room = {
  id: string;
  name: string;
  location: string;
  capacity: number | null;
  active: boolean;
  color: string; // #rrggbb, màu hiển thị trên lịch
};

/** Dữ liệu admin gửi khi tạo/sửa phòng (id do hệ thống sinh, không đổi được). */
export type RoomInput = {
  name: string;
  location: string;
  capacity: number | null;
  color: string;
  active: boolean;
};

export type BookingStatus = "confirmed" | "cancelled";

export type Booking = {
  id: string;
  roomId: string;
  date: string; // YYYY-MM-DD (giờ Việt Nam)
  start: string; // HH:mm (24 giờ)
  end: string; // HH:mm, tối đa 24:00
  title: string; // chủ đề cuộc họp
  attendees: number; // số người tham dự, 0 = không khai báo
  notes: string; // yêu cầu khác
  requesterName: string;
  requesterEmail: string;
  status: BookingStatus;
  createdAt: string; // ISO
};

/** Dữ liệu client gửi lên (đã validate). Thông tin người đặt lấy từ phiên đăng nhập. */
export type NewBookingInput = {
  roomId: string;
  date: string;
  start: string;
  end: string;
  title: string;
  attendees: number;
  notes: string;
};

export type SessionUser = {
  email: string;
  name: string;
  isAdmin: boolean;
};

/** Dạng trả về cho trình duyệt: không lộ email/SĐT của người khác. */
export type PublicBooking = {
  id: string;
  roomId: string;
  date: string;
  start: string;
  end: string;
  title: string;
  attendees: number;
  requesterName: string;
  mine: boolean;
  canCancel: boolean;
  // chỉ có với chủ lịch / admin
  notes?: string;
  requesterEmail?: string;
};

export type BoardResponse = {
  from: string;
  to: string;
  /** = from (giữ cho màn hình phòng, chỉ xem 1 ngày) */
  date: string;
  serverTime: number;
  rooms: Room[];
  bookings: PublicBooking[];
};

/** Admin sửa lịch: cho đổi phòng/giờ/thông tin, không đổi email người đặt. */
export type BookingPatch = NewBookingInput & { requesterName: string };

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export class ConflictError extends HttpError {
  constructor(message = "Phòng đã có người đặt trong khung giờ này.") {
    super(409, message);
  }
}
