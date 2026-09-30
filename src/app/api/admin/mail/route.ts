import { handle, json, requireAdmin } from "@/lib/api";
import { mailStatus, sendTestMail } from "@/lib/notify";

/** Trạng thái cấu hình email (đã cấu hình chưa, gửi từ địa chỉ nào). */
export function GET() {
  return handle(async () => {
    await requireAdmin();
    return json(mailStatus());
  });
}

/** Gửi 1 email thử tới chính admin đang đăng nhập. */
export function POST() {
  return handle(async () => {
    const admin = await requireAdmin();
    await sendTestMail(admin.email);
    return json({ ok: true, to: admin.email });
  });
}
