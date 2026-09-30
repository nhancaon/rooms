"use client";

import { useEffect, useRef, useState } from "react";
import { CLOSE_MIN, OPEN_MIN, STEP_MIN, WORK_END_MIN, WORK_START_MIN } from "@/lib/config";
import { nowVN, toHHmm, toMinutes } from "@/lib/time";
import type { PublicBooking } from "@/lib/types";

const HOUR_PX = 64;
const GUTTER_PX = 56;
const HOURS = (CLOSE_MIN - OPEN_MIN) / 60;
const BODY_H = HOURS * HOUR_PX;

const minToY = (m: number) => ((m - OPEN_MIN) / 60) * HOUR_PX;
const yToMin = (y: number) => OPEN_MIN + (y / HOUR_PX) * 60;
const clamp = (m: number) => Math.min(Math.max(m, OPEN_MIN), CLOSE_MIN);
const snapDown = (m: number) => clamp(Math.floor(m / STEP_MIN) * STEP_MIN);
const snapUp = (m: number) => clamp(Math.ceil(m / STEP_MIN) * STEP_MIN);

export type GridColumn = {
  key: string;
  roomId: string;
  date: string;
  header: React.ReactNode;
};

type Props = {
  columns: GridColumn[];
  bookings: PublicBooking[];
  colorOf: (roomId: string) => string;
  /** thời điểm hiện tại theo đồng hồ server (ms) */
  nowMs: number;
  colMin: number;
  onSelect: (col: GridColumn, start: number, end: number) => void;
  onInvalid: (reason: "past" | "busy") => void;
  onOpen: (b: PublicBooking) => void;
};

type Press = { key: string; anchor: number; y0: number; mouse: boolean; moved: boolean; range: [number, number] };

/**
 * Lưới giờ kiểu Google Calendar: mỗi cột là 1 phòng (xem ngày) hoặc 1 ngày (xem tuần).
 * Bấm vào chỗ trống = chọn 1 giờ, kéo chuột = chọn khoảng tuỳ ý; chỗ đã đặt hoặc đã qua bị chặn.
 */
export default function TimeGrid({ columns, bookings, colorOf, nowMs, colMin, onSelect, onInvalid, onOpen }: Props) {
  const now = nowVN(nowMs);
  const scroller = useRef<HTMLDivElement>(null);
  const press = useRef<Press | null>(null);
  const [ghost, setGhost] = useState<{ key: string; s: number; e: number; bad: boolean } | null>(null);

  // Mở lịch ở khoảng giờ đang diễn ra (hoặc 8h sáng) thay vì 7h.
  useEffect(() => {
    const m = nowVN().minutes;
    const top = m >= WORK_START_MIN && m <= WORK_END_MIN ? m - 60 : WORK_START_MIN;
    scroller.current?.scrollTo({ top: minToY(top) });
  }, []);

  const inCol = (col: GridColumn) => bookings.filter((b) => b.roomId === col.roomId && b.date === col.date);

  function problem(col: GridColumn, s: number, e: number): "past" | "busy" | null {
    if (col.date < now.date || (col.date === now.date && e <= now.minutes)) return "past";
    if (inCol(col).some((b) => toMinutes(b.start) < e && s < toMinutes(b.end))) return "busy";
    return null;
  }

  function rangeFor(anchor: number, m: number): [number, number] {
    return m >= anchor ? [anchor, Math.max(snapUp(m), anchor + STEP_MIN)] : [snapDown(m), anchor + STEP_MIN];
  }

  /** Bấm 1 phát: 1 giờ, nhưng co lại nếu đụng lịch kế tiếp. */
  function clickRange(col: GridColumn, s: number): [number, number] {
    const next = inCol(col)
      .map((b) => toMinutes(b.start))
      .filter((m) => m > s)
      .sort((a, b) => a - b)[0];
    return [s, Math.min(s + 60, CLOSE_MIN, next ?? CLOSE_MIN)];
  }

  function down(col: GridColumn, e: React.PointerEvent<HTMLDivElement>) {
    if (e.button !== 0) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const anchor = snapDown(yToMin(e.clientY - rect.top));
    const mouse = e.pointerType === "mouse";
    press.current = { key: col.key, anchor, y0: e.clientY, mouse, moved: false, range: [anchor, anchor + STEP_MIN] };
    if (mouse) {
      e.currentTarget.setPointerCapture(e.pointerId);
      setGhost({ key: col.key, s: anchor, e: anchor + STEP_MIN, bad: !!problem(col, anchor, anchor + STEP_MIN) });
    }
  }

  function move(col: GridColumn, e: React.PointerEvent<HTMLDivElement>) {
    const p = press.current;
    if (!p || p.key !== col.key || !p.mouse) return;
    if (Math.abs(e.clientY - p.y0) > 4) p.moved = true;
    const rect = e.currentTarget.getBoundingClientRect();
    const [s, en] = rangeFor(p.anchor, yToMin(e.clientY - rect.top));
    p.range = [s, en];
    setGhost({ key: col.key, s, e: en, bad: !!problem(col, s, en) });
  }

  function up(col: GridColumn, e: React.PointerEvent<HTMLDivElement>) {
    const p = press.current;
    press.current = null;
    setGhost(null);
    if (!p || p.key !== col.key) return;
    if (!p.mouse && Math.abs(e.clientY - p.y0) > 8) return; // cuộn trang trên điện thoại, không phải chạm
    const [s, en] = p.moved ? p.range : clickRange(col, p.anchor);
    const why = en - s < STEP_MIN ? "busy" : problem(col, s, en);
    if (why) onInvalid(why);
    else onSelect(col, s, en);
  }

  const template = `${GUTTER_PX}px repeat(${columns.length}, minmax(${colMin}px, 1fr))`;

  return (
    <div ref={scroller} className="relative max-h-[calc(100dvh-14rem)] min-h-105 overflow-auto rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div style={{ minWidth: GUTTER_PX + columns.length * colMin }}>
        {/* Tiêu đề cột */}
        <div className="sticky top-0 z-30 grid border-b border-slate-200 bg-white/95 backdrop-blur" style={{ gridTemplateColumns: template }}>
          <div className="sticky left-0 z-10 bg-white" />
          {columns.map((c) => (
            <div key={c.key} className="min-w-0 border-l border-slate-100 px-2 py-2.5">
              {c.header}
            </div>
          ))}
        </div>

        {/* Thân lịch */}
        <div className="grid" style={{ gridTemplateColumns: template, height: BODY_H }}>
          <div className="sticky left-0 z-20 border-r border-slate-100 bg-white">
            {Array.from({ length: HOURS }, (_, i) => (
              <div
                key={i}
                className="absolute right-2 text-xs font-semibold tabular-nums text-slate-700"
                style={{ top: i * HOUR_PX + (i === 0 ? 2 : -7) }}
              >
                {toHHmm(OPEN_MIN + i * 60)}
              </div>
            ))}
          </div>

          {columns.map((col) => {
            const list = inCol(col);
            const isToday = col.date === now.date;
            const pastH = col.date < now.date ? BODY_H : isToday ? Math.max(0, Math.min(BODY_H, minToY(now.minutes))) : 0;
            return (
              <div
                key={col.key}
                className="relative cursor-crosshair touch-pan-y select-none border-l border-slate-100"
                style={{
                  backgroundImage:
                    "linear-gradient(to bottom, rgb(226 232 240) 1px, transparent 1px), linear-gradient(to bottom, rgb(241 245 249) 1px, transparent 1px)",
                  backgroundSize: `100% ${HOUR_PX}px, 100% ${HOUR_PX / 2}px`,
                }}
                onPointerDown={(e) => down(col, e)}
                onPointerMove={(e) => move(col, e)}
                onPointerUp={(e) => up(col, e)}
                onPointerCancel={() => {
                  press.current = null;
                  setGhost(null);
                }}
              >
                {pastH > 0 && (
                  <div
                    className="pointer-events-none absolute inset-x-0 top-0 bg-slate-100/70"
                    style={{ height: pastH }}
                  />
                )}

                {list.map((b) => {
                  const top = minToY(toMinutes(b.start));
                  const h = minToY(toMinutes(b.end)) - top;
                  const color = colorOf(b.roomId);
                  return (
                    <button
                      key={b.id}
                      type="button"
                      onPointerDown={(e) => e.stopPropagation()}
                      onClick={() => onOpen(b)}
                      title={`${b.start}–${b.end} · ${b.title}`}
                      className={`absolute inset-x-1 cursor-pointer overflow-hidden rounded-md px-2 text-left shadow-sm transition hover:brightness-95 hover:shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 ${h < 30 ? "py-0" : "py-1"}`}
                      style={{ top: top + 1, height: h - 2, background: `${color}26`, borderLeft: `4px solid ${color}` }}
                    >
                      <div className="flex items-center gap-1">
                        <span className={`truncate font-semibold leading-tight text-slate-900 ${h < 30 ? "text-xs" : "text-[13px]"}`}>{b.title}</span>
                        {b.mine && h >= 44 && (
                          <span className="shrink-0 rounded px-1 text-[10px] font-semibold text-white" style={{ background: color }}>
                            Bạn
                          </span>
                        )}
                        {h < 44 && (
                          <span className="ml-auto shrink-0 pl-1 text-[11px] font-medium tabular-nums text-slate-700">
                            {b.start}–{b.end}
                          </span>
                        )}
                      </div>
                      {h >= 44 && (
                        <div className="truncate text-[11px] font-medium leading-tight text-slate-700">
                          {b.start} – {b.end}
                        </div>
                      )}
                      {h >= 64 && b.requesterName && <div className="truncate text-[11px] leading-tight text-slate-600">{b.requesterName}</div>}
                    </button>
                  );
                })}

                {ghost?.key === col.key && (
                  <div
                    className={`pointer-events-none absolute inset-x-1 rounded-md border-2 px-2 py-1 text-[11px] font-semibold ${
                      ghost.bad ? "border-red-400 bg-red-100/70 text-red-700" : "border-indigo-500 bg-indigo-100/70 text-indigo-700"
                    }`}
                    style={{ top: minToY(ghost.s), height: minToY(ghost.e) - minToY(ghost.s) }}
                  >
                    {toHHmm(ghost.s)} – {toHHmm(ghost.e)}
                  </div>
                )}

                {isToday && now.minutes >= OPEN_MIN && now.minutes <= CLOSE_MIN && (
                  <div className="pointer-events-none absolute inset-x-0 z-10" style={{ top: minToY(now.minutes) }}>
                    <div className="absolute -left-1 -top-1 h-2 w-2 rounded-full bg-red-500" />
                    <div className="h-px bg-red-500" />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
