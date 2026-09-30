import type { AdminEntry, Booking, BookingStatus, Room } from "../types";

/**
 * Lớp truy cập dữ liệu. Toàn bộ app chỉ nói chuyện với interface này,
 * nên khi cần chuyển từ Google Sheets sang Postgres chỉ việc viết thêm 1 implementation.
 *
 * Quy ước: listBookings trả về theo THỨ TỰ GHI trong từng tháng (dòng trên = ghi trước).
 * Thứ tự này dùng làm "trọng tài" khi 2 người đặt trùng giờ cùng lúc. Mọi lịch của cùng 1 ngày
 * luôn nằm cùng 1 nơi lưu nên việc so thứ tự chỉ cần trong phạm vi 1 tháng.
 * updateBooking/deleteBooking không được làm đổi thứ tự tương đối của các dòng còn lại.
 */
export interface BookingRepository {
  /** Tất cả phòng, kể cả phòng đã ẩn (active=false), theo thứ tự trong sheet. */
  listRooms(opts?: { fresh?: boolean }): Promise<Room[]>;
  /** Thêm mới hoặc cập nhật theo id. */
  saveRoom(room: Room): Promise<void>;
  deleteRoom(id: string): Promise<void>;

  /**
   * Lịch trong khoảng [from, to] (YYYY-MM-DD, bỏ trống = không giới hạn đầu/cuối).
   * Implementation được phép trả thừa (vd. cả tháng chứa khoảng đó); nơi gọi tự lọc theo ngày.
   * fresh=true: bỏ qua cache, đọc thẳng từ nguồn (dùng khi kiểm tra trùng lịch).
   */
  listBookings(opts?: { fresh?: boolean; from?: string; to?: string }): Promise<Booking[]>;
  /** Tìm 1 lịch theo id (không biết ngày), luôn đọc mới. null nếu không có. */
  findBooking(id: string): Promise<Booking | null>;
  appendBooking(booking: Booking): Promise<void>;
  /** Ghi đè toàn bộ 1 booking theo id. Nếu đổi sang tháng khác thì chuyển sang nơi lưu của tháng đó. */
  updateBooking(booking: Booking): Promise<void>;
  setBookingStatus(id: string, status: BookingStatus): Promise<void>;
  /** Xóa vĩnh viễn. */
  deleteBooking(id: string): Promise<void>;

  /** Quản trị viên được cấp trong Google Sheet (tab Admins), ngoài danh sách ADMIN_EMAILS. */
  listAdmins(opts?: { fresh?: boolean }): Promise<AdminEntry[]>;
  addAdmin(entry: AdminEntry): Promise<void>;
  removeAdmin(email: string): Promise<void>;
}
