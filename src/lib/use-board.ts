"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { CLIENT_POLL_MS } from "./config";
import type { BoardResponse } from "./types";

/**
 * Tải lịch phòng + tự làm mới định kỳ (và khi quay lại tab).
 * `offset` = chênh lệch giữa đồng hồ server và đồng hồ máy này, để màn hình phòng luôn đúng giờ
 * kể cả khi đồng hồ máy bị lệch.
 */
export function useBoard(from?: string, to?: string) {
  const [data, setData] = useState<BoardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [offset, setOffset] = useState(0);
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    try {
      const qs = from ? `?from=${from}&to=${to ?? from}` : "";
      const res = await fetch(`/api/board${qs}`, { cache: "no-store" });
      const body = await res.json();
      if (id !== seq.current) return; // đã có yêu cầu mới hơn (vd. đổi ngày nhanh)
      if (!res.ok) throw new Error(body.error ?? "Không tải được dữ liệu");
      setData(body as BoardResponse);
      setOffset((body as BoardResponse).serverTime - Date.now());
      setError(null);
    } catch (e) {
      if (id !== seq.current) return;
      setError(e instanceof Error ? e.message : "Không tải được dữ liệu");
    }
  }, [from, to]);

  useEffect(() => {
    // Tải dữ liệu khi mount/đổi ngày: setState nằm sau `await` nên không gây render lồng nhau.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void reload();
    const timer = setInterval(() => void reload(), CLIENT_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void reload();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [reload]);

  return { data, error, offset, reload };
}

/** Thời điểm hiện tại (ms) theo đồng hồ server, cập nhật mỗi `intervalMs`. */
export function useServerNow(offset: number, intervalMs = 15_000) {
  const [local, setLocal] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setLocal(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return local + offset;
}
