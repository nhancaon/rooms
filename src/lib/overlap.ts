import { toMinutes } from "./time";

type Slot = { roomId: string; date: string; start: string; end: string };

/** Hai lịch trùng nhau khi cùng phòng, cùng ngày và khoảng giờ giao nhau (chạm đầu-cuối không tính là trùng). */
export function overlaps(a: Slot, b: Slot): boolean {
  return (
    a.roomId === b.roomId &&
    a.date === b.date &&
    toMinutes(a.start) < toMinutes(b.end) &&
    toMinutes(b.start) < toMinutes(a.end)
  );
}
