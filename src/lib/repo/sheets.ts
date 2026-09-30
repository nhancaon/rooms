import { google, type sheets_v4 } from "googleapis";
import { colorFor, HEX_RE } from "../colors";
import { BOOKINGS_CACHE_MS, PAST_MONTH_CACHE_MS, ROOMS_CACHE_MS } from "../config";
import { DATE_RE, nowVN, toHHmm, toMinutes } from "../time";
import { TtlCache } from "../ttl-cache";
import type { AdminEntry, Booking, BookingStatus, Room } from "../types";
import { DEFAULT_ROOMS } from "./default-rooms";
import type { BookingRepository } from "./types";

const ROOMS_TAB = "Rooms";
const ADMINS_TAB = "Admins";

// Mỗi tháng 1 tab: "Bookings_2026-10". Lịch thuộc tab theo NGÀY DIỄN RA (không phải ngày đặt).
// Muốn dọn dữ liệu cũ chỉ cần xóa tab của tháng đó trong Google Sheet.
const MONTH_PREFIX = "Bookings_";
const MONTH_TAB_RE = /^Bookings_(\d{4}-\d{2})$/;
const monthTab = (date: string) => `${MONTH_PREFIX}${date.slice(0, 7)}`;

// Tab "Bookings" cũ (mọi tháng chung 1 tab) sẽ được tự tách ra rồi đổi tên + ẩn đi làm bản sao lưu.
const LEGACY_TAB = "Bookings";
const LEGACY_WORKING_TAB = "_Bookings_dang_chuyen";
const LEGACY_DONE_TAB = "_Bookings_cu";

const ROOM_COLS = ["id", "name", "location", "capacity", "active", "color", "requiresApproval"] as const;
const ADMIN_COLS = ["email", "addedBy", "addedAt"] as const;

const BOOKING_COLS = [
  "id",
  "roomId",
  "date",
  "start",
  "end",
  "title",
  "attendees",
  "notes",
  "requesterName",
  "requesterEmail",
  "status",
  "createdAt",
  "decisionNote",
  "decidedBy",
  "decidedAt",
] as const satisfies readonly (keyof Booking)[];

const colLetter = (i: number) => String.fromCharCode(65 + i); // đủ cho < 26 cột
const LAST_BOOKING_COL = colLetter(BOOKING_COLS.length - 1);
const STATUS_COL = colLetter(BOOKING_COLS.indexOf("status"));
const LAST_ROOM_COL = colLetter(ROOM_COLS.length - 1);

/** Tên tab có dấu "-" hoặc khoảng trắng phải đặt trong nháy đơn khi viết địa chỉ ô. */
const rng = (tab: string, a1: string) => `'${tab.replace(/'/g, "''")}'!${a1}`;

export type SheetsConfig = {
  spreadsheetId: string;
  clientEmail: string;
  privateKey: string;
};

export class SheetsRepository implements BookingRepository {
  private api: sheets_v4.Sheets;
  private roomsCache = new TtlCache<Room[]>(ROOMS_CACHE_MS);
  private adminsCache = new TtlCache<AdminEntry[]>(30_000);
  /** tên tab tháng -> sheetId (chỉ các tab đúng dạng Bookings_YYYY-MM) */
  private tabsCache = new TtlCache<Map<string, number>>(30_000);
  private monthCaches = new Map<string, TtlCache<Booking[]>>();
  /** id -> tab đã thấy lần gần nhất, để khỏi phải quét mọi tab khi sửa/hủy/xóa */
  private idTab = new Map<string, string>();
  private inflight = new Map<string, Promise<void>>();
  private schemaReady: Promise<void> | undefined;

  constructor(private cfg: SheetsConfig) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: cfg.clientEmail,
        // Trong .env / biến môi trường Vercel, xuống dòng thường bị viết thành "\n"
        // Dán vào Vercel đôi khi kèm dấu ngoặc kép bao quanh: bỏ đi để khỏi lỗi "invalid PEM".
        private_key: cfg.privateKey.trim().replace(/^["']|["']$/g, "").replace(/\\n/g, "\n"),
      },
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    this.api = google.sheets({ version: "v4", auth });
  }

  // ---------- phòng ----------

  async listRooms(opts: { fresh?: boolean } = {}) {
    return this.roomsCache.get(async () => {
      await this.ensureSchema();
      const res = await this.api.spreadsheets.values.get({
        spreadsheetId: this.cfg.spreadsheetId,
        range: rng(ROOMS_TAB, `A2:${LAST_ROOM_COL}`),
      });
      return (res.data.values ?? []).map(parseRoom).filter((r): r is Room => r !== null);
    }, opts.fresh);
  }

  async saveRoom(room: Room) {
    await this.ensureSchema();
    const row = await this.findRow(ROOMS_TAB, room.id);
    const values = [roomToRow(room)];
    if (row) {
      await this.api.spreadsheets.values.update({
        spreadsheetId: this.cfg.spreadsheetId,
        range: rng(ROOMS_TAB, `A${row}:${LAST_ROOM_COL}${row}`),
        valueInputOption: "RAW",
        requestBody: { values },
      });
    } else {
      await this.api.spreadsheets.values.append({
        spreadsheetId: this.cfg.spreadsheetId,
        range: rng(ROOMS_TAB, `A:${LAST_ROOM_COL}`),
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
    }
    this.roomsCache.invalidate();
  }

  async deleteRoom(id: string) {
    await this.ensureSchema();
    const row = await this.findRow(ROOMS_TAB, id);
    if (!row) throw new Error(`Không tìm thấy phòng ${id}`);
    await this.deleteRow(ROOMS_TAB, row);
    this.roomsCache.invalidate();
  }

  // ---------- quản trị viên (tab Admins) ----------

  async listAdmins(opts: { fresh?: boolean } = {}) {
    return this.adminsCache.get(async () => {
      await this.ensureSchema();
      const res = await this.api.spreadsheets.values.get({
        spreadsheetId: this.cfg.spreadsheetId,
        range: rng(ADMINS_TAB, "A2:C"),
      });
      return (res.data.values ?? [])
        .map((r) => ({ email: str(r[0]).toLowerCase(), addedBy: str(r[1]), addedAt: str(r[2]) }))
        .filter((a) => a.email);
    }, opts.fresh);
  }

  async addAdmin(entry: AdminEntry) {
    await this.ensureSchema();
    await this.api.spreadsheets.values.append({
      spreadsheetId: this.cfg.spreadsheetId,
      range: rng(ADMINS_TAB, "A:C"),
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values: [[entry.email, entry.addedBy, entry.addedAt]] },
    });
    this.adminsCache.invalidate();
  }

  async removeAdmin(email: string) {
    await this.ensureSchema();
    const res = await this.api.spreadsheets.values.get({
      spreadsheetId: this.cfg.spreadsheetId,
      range: rng(ADMINS_TAB, "A2:A"),
    });
    // So sánh không phân biệt hoa thường vì người dùng có thể tự gõ email vào Sheet.
    const idx = (res.data.values ?? []).findIndex((r) => str(r[0]).toLowerCase() === email.toLowerCase());
    if (idx !== -1) await this.deleteRow(ADMINS_TAB, idx + 2);
    this.adminsCache.invalidate();
  }

  // ---------- lịch đặt phòng ----------

  async listBookings(opts: { fresh?: boolean; from?: string; to?: string } = {}) {
    await this.ensureSchema();
    const fresh = !!opts.fresh;
    let tabs: string[];
    if (fresh && opts.from && opts.to && opts.from.slice(0, 7) === opts.to.slice(0, 7)) {
      // Kiểm tra trùng giờ: biết chắc tab nào, khỏi tốn thêm 1 lượt gọi để liệt kê tab.
      tabs = [monthTab(opts.from)];
    } else {
      const lo = opts.from?.slice(0, 7);
      const hi = opts.to?.slice(0, 7);
      tabs = [...(await this.monthTabs(fresh)).keys()]
        .sort()
        .filter((t) => {
          const m = t.slice(MONTH_PREFIX.length);
          return (!lo || m >= lo) && (!hi || m <= hi);
        });
    }
    return (await this.readTabs(tabs, fresh)).flat();
  }

  async findBooking(id: string) {
    await this.ensureSchema();
    const loc = await this.locate(id);
    if (!loc) return null;
    const res = await this.api.spreadsheets.values.get({
      spreadsheetId: this.cfg.spreadsheetId,
      range: rng(loc.tab, `A${loc.row}:${LAST_BOOKING_COL}${loc.row}`),
    });
    const row = res.data.values?.[0];
    return row ? parseBooking(row) : null;
  }

  async appendBooking(booking: Booking) {
    await this.ensureSchema();
    const tab = monthTab(booking.date);
    await this.ensureMonthTab(tab);
    await this.appendRows(tab, [bookingToRow(booking)]);
    this.idTab.set(booking.id, tab);
  }

  async updateBooking(booking: Booking) {
    await this.ensureSchema();
    const loc = await this.mustLocate(booking.id);
    const dest = monthTab(booking.date);
    if (dest === loc.tab) {
      await this.api.spreadsheets.values.update({
        spreadsheetId: this.cfg.spreadsheetId,
        range: rng(loc.tab, `A${loc.row}:${LAST_BOOKING_COL}${loc.row}`),
        valueInputOption: "RAW",
        requestBody: { values: [bookingToRow(booking)] },
      });
      this.monthCache(loc.tab).invalidate();
      return;
    }
    // Đổi sang tháng khác: ghi sang tab mới TRƯỚC rồi mới xóa ở tab cũ, để không có lúc nào mất dữ liệu.
    await this.ensureMonthTab(dest);
    await this.appendRows(dest, [bookingToRow(booking)]);
    const row = await this.findRow(loc.tab, booking.id);
    if (row) await this.deleteRow(loc.tab, row);
    this.monthCache(loc.tab).invalidate();
    this.idTab.set(booking.id, dest);
  }

  async setBookingStatus(id: string, status: BookingStatus) {
    await this.ensureSchema();
    const loc = await this.mustLocate(id);
    await this.api.spreadsheets.values.update({
      spreadsheetId: this.cfg.spreadsheetId,
      range: rng(loc.tab, `${STATUS_COL}${loc.row}`),
      valueInputOption: "RAW",
      requestBody: { values: [[status]] },
    });
    this.monthCache(loc.tab).invalidate();
  }

  async deleteBooking(id: string) {
    await this.ensureSchema();
    const loc = await this.mustLocate(id);
    await this.deleteRow(loc.tab, loc.row);
    this.idTab.delete(id);
    this.monthCache(loc.tab).invalidate();
  }

  // ---------- đọc theo tab tháng ----------

  private monthCache(tab: string): TtlCache<Booking[]> {
    let c = this.monthCaches.get(tab);
    if (!c) {
      // Tháng đã qua gần như không đổi nên giữ cache lâu hơn, đỡ tốn lượt đọc.
      const past = tab.slice(MONTH_PREFIX.length) < nowVN().date.slice(0, 7);
      c = new TtlCache<Booking[]>(past ? PAST_MONTH_CACHE_MS : BOOKINGS_CACHE_MS);
      this.monthCaches.set(tab, c);
    }
    return c;
  }

  private monthTabs(fresh = false): Promise<Map<string, number>> {
    return this.tabsCache.get(async () => {
      const meta = await this.api.spreadsheets.get({
        spreadsheetId: this.cfg.spreadsheetId,
        fields: "sheets.properties(sheetId,title)",
      });
      const tabs = new Map<string, number>();
      for (const s of meta.data.sheets ?? []) {
        const title = s.properties?.title ?? "";
        if (MONTH_TAB_RE.test(title) && s.properties?.sheetId != null) tabs.set(title, s.properties.sheetId);
      }
      return tabs;
    }, fresh);
  }

  /** Đọc nhiều tab trong 1 lượt gọi; tab nào còn cache thì dùng luôn. */
  private async readTabs(tabs: string[], fresh: boolean): Promise<Booking[][]> {
    const need = tabs.filter((t) => fresh || this.monthCache(t).peek() === undefined);
    if (need.length) {
      if (fresh) {
        await this.fetchTabs(need);
      } else {
        const key = need.join("|");
        let p = this.inflight.get(key);
        if (!p) {
          p = this.fetchTabs(need).finally(() => this.inflight.delete(key));
          this.inflight.set(key, p);
        }
        try {
          await p;
        } catch (err) {
          // Google lỗi (vd. hết quota): còn bản cũ thì dùng tạm thay vì làm sập trang.
          if (!need.every((t) => this.monthCaches.get(t)?.stale() !== undefined)) throw err;
          console.warn("[sheets] đọc lỗi, dùng bản cũ:", err instanceof Error ? err.message : err);
        }
      }
    }
    return tabs.map((t) => this.monthCaches.get(t)?.stale() ?? []);
  }

  private async fetchTabs(tabs: string[]): Promise<void> {
    let list = tabs;
    for (let attempt = 0; attempt < 2 && list.length; attempt++) {
      try {
        const res = await this.api.spreadsheets.values.batchGet({
          spreadsheetId: this.cfg.spreadsheetId,
          ranges: list.map((t) => rng(t, `A2:${LAST_BOOKING_COL}`)),
        });
        (res.data.valueRanges ?? []).forEach((vr, i) => {
          const parsed = (vr.values ?? []).map(parseBooking).filter((b): b is Booking => b !== null);
          this.monthCache(list[i]).set(parsed);
          for (const b of parsed) this.idTab.set(b.id, list[i]);
        });
        return;
      } catch (err) {
        if (attempt === 1 || !isBadRange(err)) throw err;
        // Có tab vừa bị xóa tay trong Google Sheet: cập nhật danh sách tab rồi đọc lại phần còn lại.
        const existing = await this.monthTabs(true);
        for (const t of list) if (!existing.has(t)) this.monthCaches.delete(t);
        list = list.filter((t) => existing.has(t));
      }
    }
  }

  // ---------- định vị / ghi dòng ----------

  /**
   * Tìm tab + số dòng (bắt đầu từ 1) của 1 lịch. Luôn xác minh lại trong sheet thay vì tin cache,
   * vì có thể ai đó đã chèn/xóa dòng hay xóa cả tab trực tiếp trong sheet.
   */
  private async locate(id: string): Promise<{ tab: string; row: number } | null> {
    const hint = this.idTab.get(id);
    if (hint) {
      try {
        const row = await this.findRow(hint, id);
        if (row) return { tab: hint, row };
      } catch (err) {
        if (!isBadRange(err)) throw err;
        this.tabsCache.invalidate();
      }
      this.idTab.delete(id);
    }
    const tabs = [...(await this.monthTabs(true)).keys()];
    if (!tabs.length) return null;
    const res = await this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.cfg.spreadsheetId,
      ranges: tabs.map((t) => rng(t, "A2:A")),
    });
    const found = (res.data.valueRanges ?? []).flatMap((vr, i) => {
      const idx = (vr.values ?? []).findIndex((r) => r[0] === id);
      return idx === -1 ? [] : [{ tab: tabs[i], row: idx + 2 }];
    })[0];
    if (found) this.idTab.set(id, found.tab);
    return found ?? null;
  }

  private async mustLocate(id: string) {
    const loc = await this.locate(id);
    if (!loc) throw new Error(`Không tìm thấy booking ${id}`);
    return loc;
  }

  private async findRow(tab: string, id: string): Promise<number | null> {
    const res = await this.api.spreadsheets.values.get({
      spreadsheetId: this.cfg.spreadsheetId,
      range: rng(tab, "A2:A"),
    });
    const idx = (res.data.values ?? []).findIndex((r) => r[0] === id);
    return idx === -1 ? null : idx + 2;
  }

  private async appendRows(tab: string, values: string[][]) {
    const append = () =>
      this.api.spreadsheets.values.append({
        spreadsheetId: this.cfg.spreadsheetId,
        range: rng(tab, `A:${LAST_BOOKING_COL}`),
        // RAW: giữ nguyên chuỗi, Sheets không tự đổi "08:30"/"2026-10-01" thành giờ/ngày
        // và không thực thi công thức nếu người dùng nhập "=..." vào ô.
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
    try {
      await append();
    } catch (err) {
      if (!isBadRange(err)) throw err;
      // Tab vừa bị xóa tay trong Google Sheet trong lúc danh sách tab còn nằm trong cache: tạo lại rồi ghi.
      this.tabsCache.invalidate();
      await this.ensureMonthTab(tab);
      await append();
    }
    this.monthCache(tab).invalidate();
  }

  private async deleteRow(tab: string, row: number) {
    const meta = await this.api.spreadsheets.get({
      spreadsheetId: this.cfg.spreadsheetId,
      fields: "sheets.properties(sheetId,title)",
    });
    const sheetId = meta.data.sheets?.find((s) => s.properties?.title === tab)?.properties?.sheetId;
    if (sheetId == null) throw new Error(`Không tìm thấy tab ${tab}`);
    await this.api.spreadsheets.batchUpdate({
      spreadsheetId: this.cfg.spreadsheetId,
      requestBody: {
        requests: [{ deleteDimension: { range: { sheetId, dimension: "ROWS", startIndex: row - 1, endIndex: row } } }],
      },
    });
  }

  /**
   * Tạo tab của tháng nếu chưa có. Tạo tab + tiêu đề + định dạng trong CÙNG 1 lệnh nên nếu 2 instance
   * tạo cùng lúc thì 1 bên thất bại nguyên khối ("already exists"), không bao giờ có tab thiếu tiêu đề.
   */
  private async ensureMonthTab(tab: string) {
    if ((await this.monthTabs()).has(tab)) return;
    const month = tab.slice(MONTH_PREFIX.length);
    const sheetId = Number(month.replace("-", "")); // vd. 202610: duy nhất cho mỗi tháng
    try {
      await this.api.spreadsheets.batchUpdate({
        spreadsheetId: this.cfg.spreadsheetId,
        requestBody: {
          requests: [
            { addSheet: { properties: { title: tab, sheetId, gridProperties: { frozenRowCount: 1 } } } },
            {
              appendCells: {
                sheetId,
                rows: [{ values: BOOKING_COLS.map((c) => ({ userEnteredValue: { stringValue: c } })) }],
                fields: "userEnteredValue",
              },
            },
            {
              // cột ngày/giờ (C..E) là Plain text để Sheets không tự đổi kiểu
              repeatCell: {
                range: { sheetId, startColumnIndex: 2, endColumnIndex: 5, startRowIndex: 1 },
                cell: { userEnteredFormat: { numberFormat: { type: "TEXT" } } },
                fields: "userEnteredFormat.numberFormat",
              },
            },
          ],
        },
      });
    } catch (err) {
      if (!/already exists/i.test(err instanceof Error ? err.message : String(err))) throw err;
    }
    this.tabsCache.invalidate();
  }

  // ---------- khởi tạo sheet ----------

  /** Tự tạo tab Rooms + phòng mẫu, tách tab Bookings cũ theo tháng. Chỉ chạy 1 lần / instance. */
  private ensureSchema() {
    this.schemaReady ??= this.initSchema().catch((err) => {
      this.schemaReady = undefined; // cho phép thử lại lần sau
      throw err;
    });
    return this.schemaReady;
  }

  private async initSchema() {
    const spreadsheetId = this.cfg.spreadsheetId;
    const meta = await this.api.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
    const existing = new Set((meta.data.sheets ?? []).map((s) => s.properties?.title));

    const addTabs = [ROOMS_TAB, ADMINS_TAB].filter((t) => !existing.has(t));
    if (addTabs.length) {
      await this.api.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: addTabs.map((title) => ({ addSheet: { properties: { title } } })) },
      });
    }

    const probe = await this.api.spreadsheets.values.get({ spreadsheetId, range: rng(ROOMS_TAB, `A1:${LAST_ROOM_COL}2`) });
    const top = probe.data.values ?? [];
    const data: sheets_v4.Schema$ValueRange[] = [];
    if (!top[0]?.[0]) {
      data.push({ range: rng(ROOMS_TAB, "A1"), values: [[...ROOM_COLS]] });
    } else if (top[0].length < ROOM_COLS.length) {
      // sheet tạo từ phiên bản cũ thiếu cột mới (color, requiresApproval...): chỉ bổ sung phần tiêu đề còn thiếu
      const n = top[0].length;
      data.push({ range: rng(ROOMS_TAB, `${colLetter(n)}1`), values: [[...ROOM_COLS.slice(n)]] });
    }
    // Phòng mẫu nếu tab Rooms chưa có dòng dữ liệu nào
    if (!top[1]?.[0]) data.push({ range: rng(ROOMS_TAB, "A2"), values: DEFAULT_ROOMS.map(roomToRow) });
    // Tab Admins mới tạo: ghi tiêu đề
    const adminProbe = await this.api.spreadsheets.values.get({ spreadsheetId, range: rng(ADMINS_TAB, "A1:C1") });
    if (!adminProbe.data.values?.[0]?.[0]) data.push({ range: rng(ADMINS_TAB, "A1"), values: [[...ADMIN_COLS]] });
    if (data.length) {
      await this.api.spreadsheets.values.batchUpdate({ spreadsheetId, requestBody: { valueInputOption: "RAW", data } });
    }

    await this.migrateLegacyBookings();
    await this.upgradeMonthHeaders();
    this.tabsCache.invalidate();
  }

  /** Tab tháng tạo từ phiên bản cũ thiếu các cột mới (vd. decisionNote): bổ sung tiêu đề, dữ liệu giữ nguyên. */
  private async upgradeMonthHeaders() {
    const tabs = [...(await this.monthTabs(true)).keys()];
    if (!tabs.length) return;
    const res = await this.api.spreadsheets.values.batchGet({
      spreadsheetId: this.cfg.spreadsheetId,
      ranges: tabs.map((t) => rng(t, `A1:${LAST_BOOKING_COL}1`)),
    });
    const data: sheets_v4.Schema$ValueRange[] = [];
    (res.data.valueRanges ?? []).forEach((vr, i) => {
      const head = (vr.values?.[0] ?? []).map((c) => str(c));
      while (head.length && head[head.length - 1] === "") head.pop();
      if (head.length && head.length < BOOKING_COLS.length && head.every((h, k) => h === BOOKING_COLS[k])) {
        data.push({ range: rng(tabs[i], `${colLetter(head.length)}1`), values: [[...BOOKING_COLS.slice(head.length)]] });
      }
    });
    if (data.length) {
      await this.api.spreadsheets.values.batchUpdate({
        spreadsheetId: this.cfg.spreadsheetId,
        requestBody: { valueInputOption: "RAW", data },
      });
    }
  }

  /**
   * Bản cũ lưu mọi tháng trong 1 tab "Bookings" (có thể còn bố cục cột cũ). Đọc theo TÊN cột, chia theo
   * tháng vào các tab Bookings_YYYY-MM rồi đổi tên + ẩn tab cũ làm bản sao lưu (không xóa).
   * An toàn khi bị ngắt giữa chừng: chạy lại sẽ bỏ qua các id đã chép.
   */
  private async migrateLegacyBookings() {
    const spreadsheetId = this.cfg.spreadsheetId;
    const meta = await this.api.spreadsheets.get({ spreadsheetId, fields: "sheets.properties(sheetId,title)" });
    const props = (title: string) => meta.data.sheets?.find((s) => s.properties?.title === title)?.properties;
    const working = props(LEGACY_WORKING_TAB);
    const legacy = props(LEGACY_TAB);
    const rename = (sheetId: number, title: string) =>
      this.api.spreadsheets.batchUpdate({
        spreadsheetId,
        requestBody: { requests: [{ updateSheetProperties: { properties: { sheetId, title, hidden: true }, fields: "title,hidden" } }] },
      });

    let sheetId = working?.sheetId;
    if (sheetId == null && legacy?.sheetId != null) {
      // "Giành quyền" bằng cách đổi tên: nếu có instance khác đã đổi trước thì lệnh này lỗi và ta bỏ qua.
      try {
        await rename(legacy.sheetId, LEGACY_WORKING_TAB);
      } catch {
        return;
      }
      sheetId = legacy.sheetId;
    }
    if (sheetId == null) return;

    const res = await this.api.spreadsheets.values.get({ spreadsheetId, range: rng(LEGACY_WORKING_TAB, "A1:Z") });
    const rows = res.data.values ?? [];
    const head = (rows[0] ?? []).map((c) => str(c));
    const at = new Map(head.map((name, i) => [name, i] as const));

    const byMonth = new Map<string, string[][]>();
    let skipped = 0;
    if (head[0] === "id") {
      for (const r of rows.slice(1)) {
        const cells = BOOKING_COLS.map((c) => (at.has(c) ? str(r[at.get(c)!]) : ""));
        if (!cells[0]) continue;
        cells[BOOKING_COLS.indexOf("date")] = normDate(cells[BOOKING_COLS.indexOf("date")]);
        const date = cells[BOOKING_COLS.indexOf("date")];
        if (!DATE_RE.test(date)) {
          skipped++;
          continue;
        }
        const list = byMonth.get(monthTab(date)) ?? [];
        list.push(cells);
        byMonth.set(monthTab(date), list);
      }
    }

    for (const [tab, list] of [...byMonth].sort(([a], [b]) => a.localeCompare(b))) {
      await this.ensureMonthTab(tab);
      const have = await this.api.spreadsheets.values.get({ spreadsheetId, range: rng(tab, "A2:A") });
      const ids = new Set((have.data.values ?? []).map((r) => r[0]));
      const fresh = list.filter((c) => !ids.has(c[0]));
      if (fresh.length) await this.appendRows(tab, fresh);
    }
    if (skipped) console.warn(`[sheets] ${skipped} dòng ở tab cũ có ngày không hợp lệ, giữ nguyên trong tab ${LEGACY_DONE_TAB}.`);

    const done = props(LEGACY_DONE_TAB) ? `${LEGACY_DONE_TAB}_${Date.now()}` : LEGACY_DONE_TAB;
    await rename(sheetId, done);
    this.tabsCache.invalidate();
    console.log(`[sheets] đã tách tab Bookings cũ thành ${byMonth.size} tab theo tháng; bản sao lưu: ${done}`);
  }
}

// ---------- parse ----------

type Row = (string | number | boolean | null | undefined)[];

const str = (v: unknown) => (v == null ? "" : String(v).trim());

function isBadRange(err: unknown): boolean {
  const e = err as { code?: number | string; message?: string };
  return Number(e?.code) === 400 && /range|parse/i.test(e?.message ?? "");
}

function roomToRow(r: Room): string[] {
  return [
    r.id,
    r.name,
    r.location,
    r.capacity == null ? "" : String(r.capacity),
    r.active ? "TRUE" : "FALSE",
    r.color,
    r.requiresApproval ? "TRUE" : "FALSE",
  ];
}

function bookingToRow(b: Booking): string[] {
  return BOOKING_COLS.map((c) => String(b[c] ?? ""));
}

function parseRoom(row: Row, index: number): Room | null {
  const [id, name, location, capacity, active, color, approval] = [0, 1, 2, 3, 4, 5, 6].map((i) => str(row[i]));
  if (!id || !name) return null;
  const cap = Number(capacity);
  return {
    id,
    name,
    location,
    capacity: capacity !== "" && Number.isFinite(cap) ? cap : null,
    active: !/^(false|0|no|n|không)$/i.test(active),
    color: HEX_RE.test(color) ? color : colorFor(index),
    requiresApproval: /^(true|1|yes|y|có)$/i.test(approval),
  };
}

/** Chấp nhận thêm dạng d/m/yyyy phòng khi ai đó sửa tay trong sheet. */
function normDate(v: string): string {
  if (DATE_RE.test(v)) return v;
  const m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return m ? `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}` : v;
}

/** "8:30", "08:30:00" -> "08:30" */
function normTime(v: string): string {
  const m = v.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  return m ? toHHmm(toMinutes(`${m[1]}:${m[2]}`)) : v;
}

function parseBooking(row: Row): Booking | null {
  const cells = Object.fromEntries(BOOKING_COLS.map((c, i) => [c, str(row[i])])) as Record<
    (typeof BOOKING_COLS)[number],
    string
  >;
  if (!cells.id || !cells.roomId) return null;
  const attendees = Number(cells.attendees);
  return {
    ...cells,
    date: normDate(cells.date),
    start: normTime(cells.start),
    end: normTime(cells.end),
    attendees: Number.isFinite(attendees) ? attendees : 0,
    status: parseStatus(cells.status),
  };
}

function parseStatus(v: string): BookingStatus {
  const s = v.trim().toLowerCase();
  return s === "cancelled" || s === "pending" || s === "rejected" ? s : "confirmed";
}
