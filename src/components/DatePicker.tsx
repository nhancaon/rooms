"use client";

import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { addMonths, formatDateShort, monthGrid, nowVN } from "@/lib/time";

const MONTHS = ["Tháng 1", "Tháng 2", "Tháng 3", "Tháng 4", "Tháng 5", "Tháng 6", "Tháng 7", "Tháng 8", "Tháng 9", "Tháng 10", "Tháng 11", "Tháng 12"];
const WEEK = ["T2", "T3", "T4", "T5", "T6", "T7", "CN"];
const POP_W = 288;
const POP_H = 340;

type Props = {
  value: string; // YYYY-MM-DD, "" = chưa chọn
  onChange: (date: string) => void;
  min?: string;
  clearable?: boolean;
  placeholder?: string;
  className?: string;
  ariaLabel?: string;
};

/**
 * Chọn ngày theo chuẩn Việt Nam: hiển thị dd/mm/yyyy, tuần bắt đầu từ thứ hai, tháng bằng tiếng Việt.
 * (Ô <input type="date"> của trình duyệt hiển thị theo ngôn ngữ máy, thường là mm/dd/yyyy kiểu Mỹ.)
 */
export default function DatePicker({ value, onChange, min, clearable, placeholder = "dd/mm/yyyy", className = "w-full", ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const [month, setMonth] = useState((value || nowVN().date).slice(0, 7));
  const [pos, setPos] = useState({ top: 0, left: 0 });
  const btn = useRef<HTMLButtonElement>(null);
  const pop = useRef<HTMLDivElement>(null);
  const today = nowVN().date;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const t = e.target as Node;
      if (!btn.current?.contains(t) && !pop.current?.contains(t)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && (e.stopImmediatePropagation(), setOpen(false));
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  function toggle() {
    if (open) return setOpen(false);
    const r = btn.current!.getBoundingClientRect();
    const left = Math.max(8, Math.min(r.left, window.innerWidth - POP_W - 8));
    const below = r.bottom + 6;
    const top = below + POP_H > window.innerHeight && r.top - POP_H - 6 > 8 ? r.top - POP_H - 6 : below;
    setPos({ top, left });
    setMonth((value || today).slice(0, 7));
    setOpen(true);
  }

  function pick(d: string) {
    onChange(d);
    setOpen(false);
  }

  const [y, m] = month.split("-");

  return (
    <>
      <button
        ref={btn}
        type="button"
        onClick={toggle}
        aria-label={ariaLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        className={`flex items-center justify-between gap-2 rounded-lg border border-slate-300 bg-white px-3 py-2 text-left text-sm text-slate-900 hover:border-slate-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100 ${className}`}
      >
        <span className={value ? "tabular-nums" : "text-slate-400"}>{value ? formatDateShort(value) : placeholder}</span>
        <CalendarDays size={16} className="shrink-0 text-slate-500" />
      </button>

      {open &&
        createPortal(
          <div
            ref={pop}
            role="dialog"
            aria-label="Chọn ngày"
            className="fixed z-[80] rounded-xl border border-slate-200 bg-white p-3 shadow-xl"
            style={{ top: pos.top, left: pos.left, width: POP_W }}
          >
            <div className="mb-2 flex items-center justify-between">
              <button type="button" onClick={() => setMonth(addMonths(month, -1))} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Tháng trước">
                <ChevronLeft size={18} />
              </button>
              <div className="text-sm font-semibold text-slate-900">
                {MONTHS[Number(m) - 1]}, {y}
              </div>
              <button type="button" onClick={() => setMonth(addMonths(month, 1))} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100" aria-label="Tháng sau">
                <ChevronRight size={18} />
              </button>
            </div>

            <div className="grid grid-cols-7 text-center text-xs font-semibold text-slate-600">
              {WEEK.map((w) => (
                <div key={w} className="py-1.5">
                  {w}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-7 gap-y-0.5 text-center text-sm">
              {monthGrid(month).map((d, i) => {
                if (!d) return <div key={i} />;
                const disabled = !!min && d < min;
                const selected = d === value;
                return (
                  <button
                    key={d}
                    type="button"
                    disabled={disabled}
                    onClick={() => pick(d)}
                    className={`mx-auto grid h-9 w-9 place-items-center rounded-full tabular-nums ${
                      selected
                        ? "bg-indigo-600 font-semibold text-white"
                        : disabled
                          ? "cursor-not-allowed text-slate-300"
                          : d === today
                            ? "font-semibold text-indigo-700 ring-1 ring-indigo-300 hover:bg-indigo-50"
                            : "text-slate-800 hover:bg-slate-100"
                    }`}
                  >
                    {Number(d.slice(8))}
                  </button>
                );
              })}
            </div>

            <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-2 text-sm">
              <button type="button" onClick={() => pick(today)} disabled={!!min && today < min} className="rounded-md px-2 py-1 font-medium text-indigo-700 hover:bg-indigo-50 disabled:text-slate-300">
                Hôm nay
              </button>
              {clearable && value && (
                <button type="button" onClick={() => pick("")} className="rounded-md px-2 py-1 font-medium text-slate-600 hover:bg-slate-100">
                  Xóa
                </button>
              )}
            </div>
          </div>,
          document.body,
        )}
    </>
  );
}
