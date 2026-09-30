// Ngày/giờ luôn lưu dạng chuỗi ("2026-10-01", "08:30") theo múi giờ Việt Nam,
// để tránh lệch múi giờ khi server chạy ở nước ngoài (Vercel) hay khi Google Sheets tự đổi kiểu.

export const TZ = "Asia/Ho_Chi_Minh";

const DAYS_VI = ["Chủ nhật", "Thứ hai", "Thứ ba", "Thứ tư", "Thứ năm", "Thứ sáu", "Thứ bảy"];

const vnFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

export function nowVN(ms: number = Date.now()) {
  const p: Record<string, string> = {};
  for (const part of vnFormatter.formatToParts(new Date(ms))) p[part.type] = part.value;
  return {
    date: `${p.year}-${p.month}-${p.day}`,
    minutes: Number(p.hour) * 60 + Number(p.minute),
    seconds: Number(p.second),
  };
}

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
// 24:00 chỉ hợp lệ làm giờ kết thúc (hết ngày).
export const TIME_RE = /^(?:(?:[01]\d|2[0-3]):[0-5]\d|24:00)$/;

export function isValidDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const d = new Date(`${date}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === date;
}

export function toMinutes(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

export function toHHmm(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function addDays(date: string, n: number): string {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

export function formatDateVi(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  const [y, m, day] = date.split("-");
  return `${DAYS_VI[d.getUTCDay()]}, ${day}/${m}/${y}`;
}

const DAYS_SHORT = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

/** Thứ hai đầu tuần chứa `date`. */
export function weekStart(date: string): string {
  const dow = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7; // 0 = thứ hai
  return addDays(date, -dow);
}

export function shortDayVi(date: string): string {
  return DAYS_SHORT[new Date(`${date}T00:00:00Z`).getUTCDay()];
}

/** "2026-09-29" -> "29/9" */
export function dayMonth(date: string): string {
  const [, m, d] = date.split("-");
  return `${Number(d)}/${Number(m)}`;
}

export function daysBetween(from: string, to: string): number {
  return Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / 86_400_000);
}

/** "2026-09-30" -> "30/09/2026" (định dạng ngày Việt Nam) */
export function formatDateShort(date: string): string {
  const [y, m, d] = date.split("-");
  return `${d}/${m}/${y}`;
}

/** ISO -> "30/09/2026 14:05" theo giờ Việt Nam, 24 giờ (ghép thủ công để thứ tự luôn là ngày rồi giờ) */
export function formatDateTimeVN(iso: string): string {
  const t = Date.parse(iso);
  if (Number.isNaN(t)) return iso;
  const p: Record<string, string> = {};
  for (const part of vnFormatter.formatToParts(new Date(t))) p[part.type] = part.value;
  return `${p.day}/${p.month}/${p.year} ${p.hour}:${p.minute}`;
}

/** "2026-09" + n tháng */
export function addMonths(ym: string, n: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

/** Lưới tháng bắt đầu từ thứ hai: mảng ngày "YYYY-MM-DD" hoặc null cho ô trống. */
export function monthGrid(ym: string): (string | null)[] {
  const first = `${ym}-01`;
  const lead = (new Date(`${first}T00:00:00Z`).getUTCDay() + 6) % 7;
  const [y, m] = ym.split("-").map(Number);
  const days = new Date(Date.UTC(y, m, 0)).getUTCDate();
  const cells: (string | null)[] = Array(lead).fill(null);
  for (let d = 1; d <= days; d++) cells.push(`${ym}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}
