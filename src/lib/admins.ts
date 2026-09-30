import { getRepo } from "./repo";
import { HttpError, type AdminListItem } from "./types";

/** Admin "gốc": khai báo trong biến môi trường ADMIN_EMAILS, không xóa được trên giao diện (tránh tự khóa mình ra ngoài). */
export function envAdminEmails(): string[] {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

/** Kiểm tra quyền admin ở MỌI request: admin gốc (env) hoặc có tên trong tab Admins của Google Sheet (cache 30 giây). */
export async function isAdminEmail(email: string): Promise<boolean> {
  const e = email.toLowerCase();
  if (envAdminEmails().includes(e)) return true;
  try {
    return (await getRepo().listAdmins()).some((a) => a.email === e);
  } catch (err) {
    // Không đọc được Sheet thì coi như KHÔNG phải admin (an toàn hơn là cấp nhầm quyền).
    console.error("[admins] không đọc được danh sách admin:", err instanceof Error ? err.message : err);
    return false;
  }
}

export async function listAdmins(): Promise<AdminListItem[]> {
  const fromEnv: AdminListItem[] = envAdminEmails().map((email) => ({ email, addedBy: "", addedAt: "", source: "env" }));
  const sheet = (await getRepo().listAdmins({ fresh: true })).filter((a) => !fromEnv.some((e) => e.email === a.email));
  return [...fromEnv, ...sheet.map((a) => ({ ...a, source: "sheet" as const }))];
}

/** Email của tất cả admin (để gửi thông báo có lịch mới cần duyệt). */
export async function adminEmails(): Promise<string[]> {
  try {
    return (await listAdmins()).map((a) => a.email);
  } catch {
    return envAdminEmails();
  }
}

export async function addAdmin(email: string, by: string) {
  const all = await listAdmins();
  if (all.some((a) => a.email === email)) throw new HttpError(409, "Email này đã là quản trị viên.");
  await getRepo().addAdmin({ email, addedBy: by, addedAt: new Date().toISOString() });
}

export async function removeAdmin(email: string, by: string) {
  if (email === by.toLowerCase()) throw new HttpError(400, "Bạn không thể tự gỡ quyền của chính mình.");
  if (envAdminEmails().includes(email)) {
    throw new HttpError(400, "Đây là admin gốc khai báo trong cấu hình hệ thống (ADMIN_EMAILS), không gỡ được ở đây.");
  }
  const sheet = await getRepo().listAdmins({ fresh: true });
  if (!sheet.some((a) => a.email === email)) throw new HttpError(404, "Không tìm thấy quản trị viên này.");
  await getRepo().removeAdmin(email);
}
