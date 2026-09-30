import { handle, json, parseBody, requireAdmin } from "@/lib/api";
import { adminDeleteBooking, adminUpdateBooking } from "@/lib/booking-service";
import { adminBookingSchema } from "@/lib/schema";

export function PATCH(req: Request, ctx: RouteContext<"/api/admin/bookings/[id]">) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { id } = await ctx.params;
    const patch = await parseBody(req, adminBookingSchema);
    return json({ booking: await adminUpdateBooking(id, patch, admin) });
  });
}

/** Xóa vĩnh viễn. (Hủy lịch thông thường dùng DELETE /api/bookings/[id].) */
export function DELETE(_req: Request, ctx: RouteContext<"/api/admin/bookings/[id]">) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    await adminDeleteBooking(id);
    return json({ ok: true });
  });
}
