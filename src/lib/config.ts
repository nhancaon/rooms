// Khung giờ cho phép đặt phòng (phút trong ngày) và độ chia nhỏ nhất: cả ngày 00:00–24:00, bước 15 phút.
export const OPEN_MIN = 0;
export const CLOSE_MIN = 24 * 60;
export const STEP_MIN = 15;

// Khung giờ làm việc: lịch tự cuộn tới đây khi mở (không giới hạn việc đặt phòng).
export const WORK_START_MIN = 7 * 60;
export const WORK_END_MIN = 21 * 60;

// Cache đọc Google Sheets: giữ ngắn để tránh vượt quota (~60 lượt đọc/phút/user)
// mà vẫn đủ "tươi" cho người xem lịch.
export const BOOKINGS_CACHE_MS = 5_000;
// Tab của tháng đã qua gần như không đổi nên cache lâu hơn.
export const PAST_MONTH_CACHE_MS = 60_000;
export const ROOMS_CACHE_MS = 60_000;

// Tự làm mới lịch ở phía trình duyệt.
export const CLIENT_POLL_MS = 30_000;

// Chống lạm dụng (vì ai có tài khoản Google cũng đăng nhập được nếu không đặt ALLOWED_EMAIL_DOMAINS):
// mỗi người tối đa N lịch còn hiệu lực từ hôm nay trở đi (admin không bị giới hạn) và chỉ đặt trước tối đa M ngày.
export const MAX_ACTIVE_BOOKINGS_PER_USER = 30;
export const MAX_ADVANCE_DAYS = 366;

// Người CHƯA đăng nhập xem lịch được gì: "busy" = chỉ thấy khung giờ đã kín (tiêu đề "Đã có lịch", không tên người đặt);
// "full" = thấy cả chủ đề và tên người đặt. Người đã đăng nhập luôn thấy đầy đủ. Chỉnh bằng biến môi trường GUEST_VIEW.
export const GUEST_VIEW: "busy" | "full" = process.env.GUEST_VIEW === "full" ? "full" : "busy";
