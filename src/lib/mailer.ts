import nodemailer, { type Transporter } from "nodemailer";
import { after } from "next/server";
import { HttpError } from "./types";

export type Mail = {
  to: string | string[];
  subject: string;
  html: string;
  text: string;
  replyTo?: string;
};

/**
 * Gửi email qua Gmail SMTP. Cần 2 biến môi trường:
 *   SMTP_USER = địa chỉ Gmail gửi đi,  SMTP_PASS = "Mật khẩu ứng dụng" (App Password) 16 ký tự của tài khoản đó.
 * Tùy chọn: MAIL_FROM_NAME (tên người gửi hiển thị).
 * Chưa cấu hình thì bỏ qua việc gửi (chỉ ghi nhật ký), các chức năng khác vẫn chạy bình thường.
 */
export const mailConfigured = () => !!(process.env.SMTP_USER && process.env.SMTP_PASS);

let transport: Transporter | null | undefined;
let testSink: ((m: Mail) => Promise<void> | void) | undefined;

/** Chỉ dùng cho test: chặn email lại thay vì gửi. */
export function __setMailSink(fn: typeof testSink) {
  testSink = fn;
}

function getTransport(): Transporter | null {
  if (transport === undefined) {
    transport = mailConfigured()
      ? nodemailer.createTransport({
          host: "smtp.gmail.com",
          port: 465,
          secure: true,
          auth: { user: process.env.SMTP_USER!, pass: process.env.SMTP_PASS!.replace(/\s+/g, "") },
        })
      : null;
  }
  return transport;
}

/** Tiêu đề email không được chứa xuống dòng (chống chèn header). */
export const oneLine = (s: string) => s.replace(/[\r\n]+/g, " ").trim();

/** Đổi lỗi kỹ thuật của SMTP thành câu dễ hiểu cho admin. */
function explain(err: unknown): string {
  const e = err as { code?: string; responseCode?: number; message?: string };
  const msg = e?.message ?? String(err);
  if (e?.code === "EAUTH" || e?.responseCode === 535 || /invalid login|username and password not accepted|application-specific password/i.test(msg)) {
    return "Gmail từ chối đăng nhập. Hãy kiểm tra SMTP_USER và dùng \"Mật khẩu ứng dụng\" 16 ký tự của chính tài khoản đó (không phải mật khẩu đăng nhập Gmail; tài khoản phải bật xác thực 2 bước).";
  }
  if (/ETIMEDOUT|ECONNREFUSED|ECONNECTION|ENOTFOUND|EAI_AGAIN|ESOCKET/.test(`${e?.code} ${msg}`)) {
    return "Không kết nối được tới máy chủ Gmail (smtp.gmail.com). Vui lòng thử lại sau.";
  }
  return `Gửi email thất bại: ${msg}`;
}

/** Gửi 1 email và BÁO LỖI nếu thất bại (dùng cho nút "Gửi email thử"). */
export async function deliver(m: Mail): Promise<void> {
  if (testSink) return void (await testSink(m));
  const to = (Array.isArray(m.to) ? m.to : [m.to]).map((a) => a.trim()).filter(Boolean);
  if (!to.length) return;
  const t = getTransport();
  if (!t) throw new HttpError(400, "Chưa cấu hình email: thiếu SMTP_USER / SMTP_PASS trong biến môi trường.");
  const name = (process.env.MAIL_FROM_NAME ?? "Đặt phòng họp").replace(/["\r\n<>]/g, "");
  try {
    await t.sendMail({
      from: `"${name}" <${process.env.SMTP_USER}>`,
      to,
      subject: oneLine(m.subject),
      html: m.html,
      text: m.text,
      replyTo: m.replyTo,
    });
  } catch (err) {
    throw new HttpError(502, explain(err));
  }
  console.log(`[mail] đã gửi tới ${to.length} người | ${oneLine(m.subject)}`);
}

/** Gửi 1 email. KHÔNG bao giờ ném lỗi: gửi thư hỏng không được làm hỏng thao tác của người dùng. */
export async function sendMail(m: Mail): Promise<void> {
  try {
    if (!testSink && !mailConfigured()) {
      const to = (Array.isArray(m.to) ? m.to : [m.to]).join(",");
      console.log(`[mail] chưa cấu hình SMTP_USER/SMTP_PASS nên không gửi: tới=${to} | ${m.subject}`);
      return;
    }
    await deliver(m);
  } catch (err) {
    console.error("[mail] gửi lỗi:", err instanceof Error ? err.message : err);
  }
}

/**
 * Gửi SAU khi đã trả lời người dùng (không làm chậm thao tác). `after` của Next.js giữ hàm chạy
 * trên Vercel cho tới khi gửi xong.
 */
export function sendMailLater(build: () => Promise<Mail | null> | Mail | null) {
  const run = async () => {
    try {
      const m = await build();
      if (m) await sendMail(m);
    } catch (err) {
      console.error("[mail] lỗi soạn thư:", err instanceof Error ? err.message : err);
    }
  };
  try {
    after(run);
  } catch {
    void run(); // ngoài phạm vi 1 request (vd. chạy script)
  }
}
