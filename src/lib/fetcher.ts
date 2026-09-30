/** fetch JSON; lỗi HTTP -> throw Error(message của server) để hiển thị thẳng cho người dùng. */
export async function api<T = unknown>(url: string, init?: RequestInit & { json?: unknown }): Promise<T> {
  const { json, ...rest } = init ?? {};
  const res = await fetch(url, {
    cache: "no-store",
    ...rest,
    headers: { ...(json !== undefined ? { "Content-Type": "application/json" } : {}), ...rest.headers },
    body: json !== undefined ? JSON.stringify(json) : rest.body,
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(body.error ?? "Có lỗi xảy ra, vui lòng thử lại.") as Error & { status: number };
    err.status = res.status;
    throw err;
  }
  return body as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Có lỗi xảy ra, vui lòng thử lại.");
