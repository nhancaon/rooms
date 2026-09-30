"use client";

import { CalendarDays, MonitorPlay, ShieldCheck, Ticket } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const ITEMS = [
  { href: "/", label: "Lịch phòng", icon: CalendarDays },
  { href: "/my", label: "Lịch của tôi", icon: Ticket },
  { href: "/display", label: "Màn hình phòng", icon: MonitorPlay, newTab: true },
  { href: "/admin", label: "Quản trị", icon: ShieldCheck, adminOnly: true },
] as const;

const base = "inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition-colors";
const idle = "font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900";
const active = "bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-200";

/** Thanh menu: mục của trang đang mở được tô màu để khỏi bấm nhầm. */
export default function NavLinks({ isAdmin, pending = 0 }: { isAdmin: boolean; pending?: number }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-wrap items-center gap-1">
      {ITEMS.filter((i) => !("adminOnly" in i) || isAdmin).map((i) => {
        const isActive = i.href === "/" ? pathname === "/" : pathname === i.href || pathname.startsWith(`${i.href}/`);
        return (
          <Link
            key={i.href}
            href={i.href}
            target={"newTab" in i ? "_blank" : undefined}
            aria-current={isActive ? "page" : undefined}
            className={`${base} ${isActive ? active : idle}`}
          >
            <i.icon size={16} /> {i.label}
            {"adminOnly" in i && pending > 0 && (
              <span className="rounded-full bg-amber-500 px-1.5 py-0.5 text-[11px] font-bold leading-none text-white" title={`${pending} lịch đang chờ duyệt`}>
                {pending}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
