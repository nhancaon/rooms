import { handle, json, parseBody, requireAdmin } from "@/lib/api";
import { deleteRoom, updateRoom } from "@/lib/room-service";
import { roomSchema } from "@/lib/schema";

export function PATCH(req: Request, ctx: RouteContext<"/api/admin/rooms/[id]">) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    const input = await parseBody(req, roomSchema);
    return json({ room: await updateRoom(id, input) });
  });
}

export function DELETE(_req: Request, ctx: RouteContext<"/api/admin/rooms/[id]">) {
  return handle(async () => {
    await requireAdmin();
    const { id } = await ctx.params;
    await deleteRoom(id);
    return json({ ok: true });
  });
}
