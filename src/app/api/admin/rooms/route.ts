import { handle, json, parseBody, requireAdmin } from "@/lib/api";
import { adminListRooms, createRoom } from "@/lib/room-service";
import { roomSchema } from "@/lib/schema";

export function GET() {
  return handle(async () => {
    await requireAdmin();
    return json({ rooms: await adminListRooms() });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    await requireAdmin();
    const input = await parseBody(req, roomSchema);
    return json({ room: await createRoom(input) }, { status: 201 });
  });
}
