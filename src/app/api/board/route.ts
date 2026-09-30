import type { NextRequest } from "next/server";
import { handle, json } from "@/lib/api";
import { getBoard } from "@/lib/booking-service";
import { getUser } from "@/lib/session";
import { isValidDate } from "@/lib/time";
import { HttpError } from "@/lib/types";

// Công khai (ai cũng xem được lịch phòng); thông tin liên hệ chỉ trả cho chủ lịch/admin.
// ?date=YYYY-MM-DD (1 ngày) hoặc ?from=...&to=... (tối đa 42 ngày)
export function GET(req: NextRequest) {
  return handle(async () => {
    const p = req.nextUrl.searchParams;
    const date = p.get("date") ?? undefined;
    const from = p.get("from") ?? date;
    const to = p.get("to") ?? date ?? from;
    for (const d of [from, to]) {
      if (d && !isValidDate(d)) throw new HttpError(400, "Ngày không hợp lệ.");
    }
    return json(await getBoard({ from, to }, await getUser()));
  });
}
