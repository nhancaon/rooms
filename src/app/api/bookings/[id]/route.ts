import type { NextRequest } from "next/server";
import { handle, json, requireUser } from "@/lib/api";
import { cancelBooking } from "@/lib/booking-service";

export function DELETE(_req: NextRequest, ctx: RouteContext<"/api/bookings/[id]">) {
  return handle(async () => {
    const user = await requireUser();
    const { id } = await ctx.params;
    await cancelBooking(id, user);
    return json({ ok: true });
  });
}
