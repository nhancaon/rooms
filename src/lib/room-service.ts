import { withLock } from "./lock";
import { getRepo } from "./repo";
import { HttpError, holdsSlot, type Room, type RoomInput } from "./types";

/** "Phòng Họp Lớn Đà Nẵng" -> "phong-hop-lon-da-nang" */
export function slugify(name: string): string {
  const s = name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return s || "phong";
}

function uniqueId(name: string, taken: Set<string>): string {
  const base = slugify(name);
  let id = base;
  for (let n = 2; taken.has(id); n++) id = `${base}-${n}`;
  return id;
}

const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Tất cả phòng kể cả phòng đã ẩn. */
export function adminListRooms(): Promise<Room[]> {
  return getRepo().listRooms({ fresh: true });
}

export function createRoom(input: RoomInput): Promise<Room> {
  const repo = getRepo();
  return withLock(async () => {
    const rooms = await repo.listRooms({ fresh: true });
    if (rooms.some((r) => sameName(r.name, input.name))) throw new HttpError(409, "Đã có phòng trùng tên này.");
    const room: Room = { ...input, id: uniqueId(input.name, new Set(rooms.map((r) => r.id))) };
    await repo.saveRoom(room);
    return room;
  });
}

/** id không đổi được (lịch đã đặt tham chiếu theo id). */
export function updateRoom(id: string, input: RoomInput): Promise<Room> {
  const repo = getRepo();
  return withLock(async () => {
    const rooms = await repo.listRooms({ fresh: true });
    if (!rooms.some((r) => r.id === id)) throw new HttpError(404, "Không tìm thấy phòng.");
    if (rooms.some((r) => r.id !== id && sameName(r.name, input.name))) throw new HttpError(409, "Đã có phòng trùng tên này.");
    const room: Room = { ...input, id };
    await repo.saveRoom(room);
    return room;
  });
}

/** Chỉ xóa được phòng chưa từng có lịch còn hiệu lực. Phòng đã có lịch thì nên ẩn thay vì xóa. */
export function deleteRoom(id: string): Promise<void> {
  const repo = getRepo();
  return withLock(async () => {
    const rooms = await repo.listRooms({ fresh: true });
    if (!rooms.some((r) => r.id === id)) throw new HttpError(404, "Không tìm thấy phòng.");
    const bookings = await repo.listBookings({ fresh: true });
    const used = bookings.filter((b) => b.roomId === id && holdsSlot(b)).length;
    if (used > 0) {
      throw new HttpError(409, `Phòng này có ${used} lịch đặt. Hãy hủy các lịch đó hoặc chọn "Ẩn phòng" thay vì xóa.`);
    }
    await repo.deleteRoom(id);
  });
}
