import { CalendarDays, LogOut } from "lucide-react";
import Link from "next/link";
import { signOut } from "@/auth";
import { countPending } from "@/lib/booking-service";
import { getUser } from "@/lib/session";
import NavLinks from "./NavLinks";

export default async function Header() {
  const user = await getUser();
  // Admin thấy số lịch đang chờ duyệt ngay trên menu; lỗi đọc dữ liệu thì bỏ qua, không làm hỏng trang.
  const pending = user?.isAdmin ? await countPending().catch(() => 0) : 0;
  const initial = (user?.name ?? "?").trim().charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-4 gap-y-1 px-4 py-2.5">
        <Link href="/" className="flex items-center gap-2.5">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-linear-to-br from-indigo-500 to-fuchsia-500 text-white shadow-sm">
            <CalendarDays size={18} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-slate-900">Đặt phòng họp</span>
        </Link>

        <NavLinks isAdmin={!!user?.isAdmin} pending={pending} />

        <div className="ml-auto flex items-center gap-2">
          {user ? (
            <>
              <div className="flex items-center gap-2" title={user.email}>
                <span className="grid h-8 w-8 place-items-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700">{initial}</span>
                <span className="hidden text-sm leading-tight sm:block">
                  <span className="block max-w-40 truncate font-medium text-slate-900">{user.name}</span>
                  {user.isAdmin && <span className="block text-xs text-indigo-600">Quản trị viên</span>}
                </span>
              </div>
              <form
                action={async () => {
                  "use server";
                  await signOut({ redirectTo: "/" });
                }}
              >
                <button className="rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900" aria-label="Đăng xuất" title="Đăng xuất">
                  <LogOut size={17} />
                </button>
              </form>
            </>
          ) : (
            <Link href="/login" className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-indigo-700">
              Đăng nhập
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
