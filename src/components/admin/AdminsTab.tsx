"use client";

import { Mail, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { api, errMsg } from "@/lib/fetcher";
import { formatDateTimeVN } from "@/lib/time";
import type { AdminListItem } from "@/lib/types";
import { useApi } from "@/lib/use-api";
import { Alert, btnGhost, btnPrimary, inputCls } from "../ui";

/** Quản lý danh sách admin ngay trên web (lưu trong tab Admins của Google Sheet), không cần sửa biến môi trường hay deploy lại. */
export default function AdminsTab({ currentEmail }: { currentEmail: string }) {
  const { data, error, loading, reload } = useApi<{ admins: AdminListItem[] }>("/api/admin/admins");
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const me = currentEmail.toLowerCase();
  const mail = useApi<{ configured: boolean; from: string }>("/api/admin/mail");
  const [mailBusy, setMailBusy] = useState(false);
  const [mailMsg, setMailMsg] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  async function testMail() {
    setMailBusy(true);
    setMailMsg(null);
    try {
      const r = await api<{ to: string }>("/api/admin/mail", { method: "POST" });
      setMailMsg({ kind: "success", text: `Đã gửi email thử tới ${r.to}. Hãy kiểm tra hộp thư (cả mục Spam nếu chưa thấy).` });
    } catch (err) {
      setMailMsg({ kind: "error", text: errMsg(err) });
    } finally {
      setMailBusy(false);
    }
  }

  async function add(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    try {
      await api("/api/admin/admins", { method: "POST", json: { email } });
      setMsg({ kind: "success", text: `Đã thêm ${email.trim().toLowerCase()} làm quản trị viên. Họ có quyền ngay khi tải lại trang (tối đa 30 giây).` });
      setEmail("");
      await reload();
    } catch (err) {
      setMsg({ kind: "error", text: errMsg(err) });
    } finally {
      setBusy(false);
    }
  }

  async function remove(a: AdminListItem) {
    if (!window.confirm(`Gỡ quyền quản trị của ${a.email}?`)) return;
    setMsg(null);
    try {
      await api(`/api/admin/admins?email=${encodeURIComponent(a.email)}`, { method: "DELETE" });
      setMsg({ kind: "success", text: `Đã gỡ quyền của ${a.email}.` });
      await reload();
    } catch (err) {
      setMsg({ kind: "error", text: errMsg(err) });
    }
  }

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-slate-600">
        Quản trị viên được xem toàn bộ thông tin, sửa/hủy/xóa lịch, duyệt lịch và quản lý phòng. Người được thêm phải đăng nhập bằng <b>đúng email Google</b> này.
      </p>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center gap-3">
          <Mail size={18} className="text-slate-500" />
          <div className="min-w-0 flex-1">
            <div className="text-sm font-semibold text-slate-900">Thông báo qua email</div>
            <div className="text-xs text-slate-600">
              {mail.data?.configured
                ? `Đang gửi từ ${mail.data.from}. Hệ thống tự gửi khi có lịch cần duyệt và khi lịch được duyệt, từ chối, hủy hoặc điều chỉnh.`
                : mail.data
                  ? "Chưa cấu hình: thêm SMTP_USER và SMTP_PASS (Mật khẩu ứng dụng Gmail) vào biến môi trường, hệ thống sẽ tự gửi email."
                  : "Đang kiểm tra..."}
            </div>
          </div>
          <button onClick={testMail} disabled={mailBusy || !mail.data?.configured} className={btnGhost}>
            {mailBusy ? "Đang gửi..." : "Gửi email thử cho tôi"}
          </button>
        </div>
        {mailMsg && (
          <div className="mt-3">
            <Alert kind={mailMsg.kind}>{mailMsg.text}</Alert>
          </div>
        )}
      </div>

      <form onSubmit={add} className="flex flex-wrap gap-2">
        <input className={`${inputCls} max-w-sm flex-1`} type="email" required placeholder="email@congty.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        <button disabled={busy} className={btnPrimary}>
          <UserPlus size={16} /> Thêm quản trị viên
        </button>
      </form>

      {msg && <Alert kind={msg.kind}>{msg.text}</Alert>}
      {error && <Alert>{error}</Alert>}
      {loading && !data && <p className="text-sm text-slate-500">Đang tải...</p>}

      <ul className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white shadow-sm">
        {data?.admins.map((a) => (
          <li key={a.email} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-medium text-slate-900">
                {a.email}
                {a.email === me && <span className="ml-2 rounded bg-indigo-50 px-1.5 py-0.5 text-xs font-semibold text-indigo-700">Bạn</span>}
              </div>
              <div className="text-xs text-slate-600">
                {a.source === "env"
                  ? "Admin gốc (khai báo trong cấu hình hệ thống, không gỡ được ở đây)"
                  : `Thêm bởi ${a.addedBy || "?"}${a.addedAt ? ` lúc ${formatDateTimeVN(a.addedAt)}` : ""}`}
              </div>
            </div>
            {a.source === "sheet" && a.email !== me && (
              <button onClick={() => remove(a)} title="Gỡ quyền" aria-label={`Gỡ quyền ${a.email}`} className="rounded-md p-1.5 text-slate-500 hover:bg-red-50 hover:text-red-600">
                <Trash2 size={16} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
