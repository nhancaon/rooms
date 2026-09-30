let tail: Promise<unknown> = Promise.resolve();

/** Xếp hàng các lần ghi để trong cùng 1 process không có 2 lần kiểm tra-rồi-ghi chen nhau. */
export function withLock<T>(fn: () => Promise<T>): Promise<T> {
  const run = tail.then(fn, fn);
  tail = run.catch(() => undefined);
  return run;
}
