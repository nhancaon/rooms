"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { api, errMsg } from "./fetcher";

/** GET JSON theo url (tải lại khi url đổi). `loading` = chưa có dữ liệu cho url hiện tại. */
export function useApi<T>(url: string) {
  const [state, setState] = useState<{ data?: T; error?: string; url?: string }>({});
  const seq = useRef(0);

  const reload = useCallback(async () => {
    const id = ++seq.current;
    try {
      const data = await api<T>(url);
      if (id === seq.current) setState({ data, url });
    } catch (e) {
      if (id === seq.current) setState((s) => ({ ...s, error: errMsg(e), url }));
    }
  }, [url]);

  useEffect(() => {
    // Tải dữ liệu khi mount/đổi url: setState nằm sau `await` nên không gây render lồng nhau.
    void reload();
  }, [reload]);

  return { data: state.data, error: state.error, loading: state.url !== url, reload };
}
