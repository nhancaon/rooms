import { z } from "zod";
import { HEX_RE } from "./colors";
import { CLOSE_MIN, OPEN_MIN, STEP_MIN } from "./config";
import { isValidDate, TIME_RE, toHHmm, toMinutes } from "./time";

const text = (label: string, max: number) =>
  z
    .string()
    .trim()
    .min(1, `Vui lòng nhập ${label}`)
    .max(max, `${label} quá dài (tối đa ${max} ký tự)`);

const shape = {
  roomId: z.string().trim().min(1, "Vui lòng chọn phòng"),
  date: z.string().refine(isValidDate, "Ngày không hợp lệ"),
  start: z.string().regex(TIME_RE, "Giờ bắt đầu không hợp lệ"),
  end: z.string().regex(TIME_RE, "Giờ kết thúc không hợp lệ"),
  title: text("chủ đề cuộc họp", 200),
  // Không bắt buộc; bỏ trống = 0 (không khai báo).
  attendees: z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? 0 : v),
    z.coerce.number("Số người phải là số").int("Số người phải là số nguyên").min(0, "Số người không hợp lệ").max(5000, "Số người quá lớn"),
  ),
  notes: z.string().trim().max(1000, "Yêu cầu khác quá dài (tối đa 1000 ký tự)").default(""),
};

function timeRules(v: { start: string; end: string }, ctx: z.core.$RefinementCtx) {
  if (!TIME_RE.test(v.start) || !TIME_RE.test(v.end)) return;
  const s = toMinutes(v.start);
  const e = toMinutes(v.end);
  if (e <= s) {
    ctx.addIssue({ code: "custom", path: ["end"], message: "Giờ kết thúc phải sau giờ bắt đầu" });
  }
  if (s < OPEN_MIN || e > CLOSE_MIN) {
    ctx.addIssue({
      code: "custom",
      path: ["start"],
      message: `Chỉ nhận đặt phòng từ ${toHHmm(OPEN_MIN)} đến ${toHHmm(CLOSE_MIN)}`,
    });
  }
  if (s % STEP_MIN !== 0 || e % STEP_MIN !== 0) {
    ctx.addIssue({ code: "custom", path: ["start"], message: `Giờ phải là bội số của ${STEP_MIN} phút` });
  }
}

/** Người dùng đặt phòng (họ tên, email lấy từ tài khoản đăng nhập). */
export const bookingSchema = z.object(shape).superRefine(timeRules);

/** Admin sửa lịch (thêm được họ tên người đặt). */
export const adminBookingSchema = z
  .object({ ...shape, requesterName: text("họ tên người đặt", 200) })
  .superRefine(timeRules);

export const roomSchema = z.object({
  name: text("tên phòng", 100),
  location: z.string().trim().max(200, "Vị trí quá dài (tối đa 200 ký tự)").default(""),
  capacity: z.preprocess(
    (v) => (v === "" || v === undefined ? null : v),
    z.coerce.number("Sức chứa phải là số").int("Sức chứa phải là số nguyên").min(1, "Sức chứa tối thiểu là 1").max(100000, "Sức chứa quá lớn").nullable(),
  ),
  color: z.string().regex(HEX_RE, "Màu không hợp lệ"),
  active: z.boolean().default(true),
});
