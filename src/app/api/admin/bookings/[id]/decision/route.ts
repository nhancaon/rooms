import { handle, json, parseBody, requireAdmin } from "@/lib/api";
import { decideBooking } from "@/lib/booking-service";
import { mailConfigured } from "@/lib/mailer";
import { decisionSchema } from "@/lib/schema";

/** Admin duyệt hoặc từ chối 1 lịch đang chờ. Body: { decision: "approve" | "reject", note?: string } */
export function POST(req: Request, ctx: RouteContext<"/api/admin/bookings/[id]/decision">) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const { decision, note } = await parseBody(req, decisionSchema);
    const booking = await decideBooking(id, decision, note, admin);
    // mailSent: hệ thống có cấu hình gửi email hay không (để giao diện báo đúng cho admin)
    return json({ booking, mailSent: mailConfigured() });
  });
}
