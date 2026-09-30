/**
 * Cache 1 giá trị với TTL, kèm:
 *  - dedupe: nhiều request cùng lúc chỉ gọi nguồn 1 lần;
 *  - stale-on-error: nếu nguồn lỗi (vd. quota Google) thì trả bản cũ thay vì sập trang.
 * Đọc `fresh` (dùng khi kiểm tra trùng lịch) luôn đi thẳng nguồn và KHÔNG dùng bản cũ khi lỗi.
 */
export class TtlCache<T> {
  private value: T | undefined;
  private at = 0;
  private inflight: Promise<T> | undefined;

  constructor(private ttlMs: number) {}

  async get(loader: () => Promise<T>, fresh = false): Promise<T> {
    if (!fresh) {
      if (this.value !== undefined && Date.now() - this.at < this.ttlMs) return this.value;
      if (this.inflight) return this.inflight;
    }

    const p: Promise<T> = loader()
      .then((v) => {
        this.value = v;
        this.at = Date.now();
        return v;
      })
      .catch((err) => {
        if (!fresh && this.value !== undefined) {
          console.warn("[cache] đọc nguồn lỗi, dùng bản cũ:", err instanceof Error ? err.message : err);
          return this.value;
        }
        throw err;
      })
      .finally(() => {
        if (this.inflight === p) this.inflight = undefined;
      });

    if (!fresh) this.inflight = p;
    return p;
  }

  /** Giá trị còn trong hạn, hoặc undefined. */
  peek(): T | undefined {
    return this.value !== undefined && Date.now() - this.at < this.ttlMs ? this.value : undefined;
  }

  /** Giá trị cũ nhất còn giữ (kể cả quá hạn), dùng làm phương án dự phòng khi nguồn lỗi. */
  stale(): T | undefined {
    return this.value;
  }

  /** Ghi đè cache (dùng sau khi vừa ghi xong để lần đọc kế tiếp không bị cũ). */
  set(value: T) {
    this.value = value;
    this.at = Date.now();
  }

  invalidate() {
    this.at = 0;
  }
}
