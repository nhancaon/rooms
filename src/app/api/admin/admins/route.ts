import type { NextRequest } from "next/server";
import { handle, json, parseBody, requireAdmin } from "@/lib/api";
import { addAdmin, listAdmins, removeAdmin } from "@/lib/admins";
import { adminEmailSchema } from "@/lib/schema";
import { HttpError } from "@/lib/types";

export function GET() {
  return handle(async () => {
    await requireAdmin();
    return json({ admins: await listAdmins() });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const admin = await requireAdmin();
    const { email } = await parseBody(req, adminEmailSchema);
    await addAdmin(email, admin.email);
    return json({ ok: true }, { status: 201 });
  });
}

/** DELETE /api/admin/admins?email=... */
export function DELETE(req: NextRequest) {
  return handle(async () => {
    const admin = await requireAdmin();
    const email = (req.nextUrl.searchParams.get("email") ?? "").trim().toLowerCase();
    if (!email) throw new HttpError(400, "Thiếu email.");
    await removeAdmin(email, admin.email);
    return json({ ok: true });
  });
}
