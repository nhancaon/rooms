import type { NextRequest } from "next/server";
import { handle, json, requireAdmin } from "@/lib/api";
import { adminListBookings } from "@/lib/booking-service";
import { isValidDate } from "@/lib/time";
import { HttpError } from "@/lib/types";

// Admin xem toàn bộ (đầy đủ email/SĐT/ghi chú). ?from&to&roomId&status=confirmed|cancelled|all&q=
export function GET(req: NextRequest) {
  return handle(async () => {
    await requireAdmin();
    const p = req.nextUrl.searchParams;

    const from = p.get("from") || undefined;
    const to = p.get("to") || undefined;
    for (const d of [from, to]) {
      if (d && !isValidDate(d)) throw new HttpError(400, "Ngày không hợp lệ.");
    }
    const status = p.get("status") ?? "confirmed";
    if (status !== "confirmed" && status !== "cancelled" && status !== "all") {
      throw new HttpError(400, "Trạng thái không hợp lệ.");
    }

    const bookings = await adminListBookings({
      from,
      to,
      status,
      roomId: p.get("roomId") || undefined,
      q: p.get("q") || undefined,
    });
    return json({ bookings });
  });
}
