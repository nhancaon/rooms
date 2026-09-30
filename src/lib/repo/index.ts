import { MemoryRepository } from "./memory";
import { SheetsRepository } from "./sheets";
import type { BookingRepository } from "./types";

const globalForRepo = globalThis as unknown as { __meetingRepo?: BookingRepository };

/** Singleton (giữ qua hot-reload khi dev). Có đủ biến môi trường Google -> dùng Sheets, không -> dùng RAM. */
export function getRepo(): BookingRepository {
  globalForRepo.__meetingRepo ??= createRepo();
  return globalForRepo.__meetingRepo;
}

export function isUsingSheets() {
  return getRepo() instanceof SheetsRepository;
}

function createRepo(): BookingRepository {
  const spreadsheetId = process.env.GOOGLE_SHEET_ID;
  const clientEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_PRIVATE_KEY;

  if (spreadsheetId && clientEmail && privateKey) {
    return new SheetsRepository({ spreadsheetId, clientEmail, privateKey });
  }
  if (process.env.NODE_ENV === "production") {
    throw new Error("Thiếu GOOGLE_SHEET_ID / GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY");
  }
  console.warn("[repo] Chưa cấu hình Google Sheets -> dùng dữ liệu trong RAM (mất khi restart).");
  return new MemoryRepository();
}
