import { headers } from "next/headers";
import type { z } from "zod";
import { getUser } from "./session";
import { HttpError, type SessionUser } from "./types";

/** Bọc route handler: đổi lỗi nghiệp vụ thành JSON {error} với đúng mã HTTP. */
export async function handle(fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof HttpError) {
      return Response.json({ error: err.message }, { status: err.status });
    }
    console.error(err);
    return Response.json({ error: "Có lỗi hệ thống, vui lòng thử lại sau." }, { status: 500 });
  }
}

export function json(data: unknown, init?: ResponseInit) {
  return Response.json(data, { ...init, headers: { "Cache-Control": "no-store", ...init?.headers } });
}

/**
 * Chặn request do trang web KHÁC kích hoạt (CSRF). Trình duyệt hiện đại luôn gửi Sec-Fetch-Site;
 * chỉ nhận "same-origin" (fetch từ chính app) hoặc "none" (người dùng tự gõ địa chỉ).
 * Không có header (curl, máy chủ gọi máy chủ) thì không mang theo cookie đăng nhập nên bỏ qua.
 */
async function assertSameOrigin() {
  const site = (await headers()).get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") {
    throw new HttpError(403, "Yêu cầu không hợp lệ (khác nguồn).");
  }
}

export async function requireUser(): Promise<SessionUser> {
  await assertSameOrigin();
  const user = await getUser();
  if (!user) throw new HttpError(401, "Vui lòng đăng nhập để tiếp tục.");
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAdmin) throw new HttpError(403, "Chỉ quản trị viên mới có quyền thực hiện thao tác này.");
  return user;
}

/** Đọc + kiểm tra JSON body; lỗi đầu tiên được trả về cho người dùng. */
export async function parseBody<T extends z.ZodType>(req: Request, schema: T): Promise<z.output<T>> {
  const body = await req.json().catch(() => null);
  const parsed = schema.safeParse(body);
  if (!parsed.success) throw new HttpError(400, parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ.");
  return parsed.data;
}
