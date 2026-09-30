import { ShieldAlert } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import AdminPanel from "@/components/admin/AdminPanel";
import { getUser } from "@/lib/session";

export const metadata = { title: "Quản trị · Đặt phòng họp" };

export default async function AdminPage() {
  const user = await getUser();
  if (!user) redirect("/login?callbackUrl=%2Fadmin");

  if (!user.isAdmin) {
    return (
      <div className="mx-auto mt-16 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
        <ShieldAlert className="mx-auto text-amber-500" size={36} />
        <h1 className="mt-3 text-lg font-semibold text-slate-900">Bạn không có quyền truy cập</h1>
        <p className="mt-1 text-sm text-slate-500">
          Trang này chỉ dành cho quản trị viên. Tài khoản <b>{user.email}</b> chưa được cấp quyền.
        </p>
        <Link href="/" className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
          Về trang lịch
        </Link>
      </div>
    );
  }

  return <AdminPanel />;
}
