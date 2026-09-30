import { adminEmails } from "./admins";
import { deliver, mailConfigured, sendMailLater, type Mail } from "./mailer";
import { getRepo } from "./repo";
import { formatDateVi } from "./time";
import type { Booking } from "./types";

// ---------- tiện ích soạn thư ----------

export const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");

/** Địa chỉ gốc của web, dùng cho nút "Mở" trong email. */
export function appUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const prod = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  if (prod) return `https://${prod}`;
  return "http://localhost:3000";
}

async function roomName(id: string): Promise<string> {
  try {
    return (await getRepo().listRooms()).find((r) => r.id === id)?.name ?? id;
  } catch {
    return id;
  }
}

type Detail = [string, string];

function details(b: Booking, room: string): Detail[] {
  const rows: Detail[] = [
    ["Chủ đề", b.title],
    ["Phòng", room],
    ["Thời gian", `${formatDateVi(b.date)}, ${b.start} – ${b.end}`],
    ["Người đặt", `${b.requesterName} (${b.requesterEmail})`],
  ];
  if (b.attendees > 0) rows.push(["Số người", `${b.attendees} người`]);
  if (b.notes) rows.push(["Yêu cầu khác", b.notes]);
  return rows;
}

type RenderOpts = {
  heading: string;
  intro: string;
  tone: "info" | "ok" | "bad";
  rows: Detail[];
  /** HTML đã được escape sẵn */
  extra?: string;
  cta?: { label: string; href: string };
};

export function render(opts: RenderOpts): Pick<Mail, "html" | "text"> {
  const color = { info: "#4f46e5", ok: "#059669", bad: "#dc2626" }[opts.tone];
  const rows = opts.rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:6px 12px 6px 0;color:#64748b;vertical-align:top;white-space:nowrap">${esc(k)}</td>` +
        `<td style="padding:6px 0;color:#0f172a;font-weight:600">${esc(v).replace(/\n/g, "<br>")}</td></tr>`,
    )
    .join("");
  const html =
    `<!doctype html><html><body style="margin:0;background:#f1f5f9;padding:24px;font-family:Segoe UI,Arial,sans-serif">` +
    `<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden;border:1px solid #e2e8f0">` +
    `<div style="height:6px;background:${color}"></div><div style="padding:24px">` +
    `<h1 style="margin:0 0 8px;font-size:18px;color:#0f172a">${esc(opts.heading)}</h1>` +
    `<p style="margin:0 0 16px;color:#334155;font-size:14px;line-height:1.5">${esc(opts.intro)}</p>` +
    `<table style="border-collapse:collapse;font-size:14px;width:100%">${rows}</table>` +
    (opts.extra
      ? `<div style="margin-top:16px;padding:12px;border-radius:8px;background:#f8fafc;color:#334155;font-size:14px;line-height:1.5">${opts.extra}</div>`
      : "") +
    (opts.cta
      ? `<p style="margin:20px 0 0"><a href="${esc(opts.cta.href)}" style="display:inline-block;background:${color};color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-size:14px;font-weight:600">${esc(opts.cta.label)}</a></p>`
      : "") +
    `</div></div>` +
    `<p style="text-align:center;color:#94a3b8;font-size:12px;margin:16px 0 0">Email tự động từ hệ thống đặt phòng họp.</p>` +
    `</body></html>`;
  const text = [
    opts.heading,
    "",
    opts.intro,
    "",
    ...opts.rows.map(([k, v]) => `${k}: ${v}`),
    ...(opts.extra ? ["", opts.extra.replace(/<br>/g, "\n").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")] : []),
    ...(opts.cta ? ["", `${opts.cta.label}: ${opts.cta.href}`] : []),
  ].join("\n");
  return { html, text };
}

// ---------- các loại thông báo ----------

/** Có lịch mới cần duyệt -> gửi tất cả admin. */
export function notifyNewPending(b: Booking) {
  sendMailLater(async () => {
    const to = await adminEmails();
    if (!to.length) return null;
    const room = await roomName(b.roomId);
    return {
      to,
      replyTo: b.requesterEmail,
      subject: `[Cần duyệt] ${room} · ${formatDateVi(b.date)} ${b.start}–${b.end}`,
      ...render({
        heading: "Có yêu cầu đặt phòng mới cần duyệt",
        intro: `${b.requesterName} vừa gửi yêu cầu đặt phòng. Lịch đang giữ chỗ và chờ bạn duyệt hoặc từ chối.`,
        tone: "info",
        rows: details(b, room),
        cta: { label: "Mở trang duyệt", href: `${appUrl()}/admin` },
      }),
    };
  });
}

/** Admin duyệt / từ chối -> báo người đặt. */
export function notifyDecision(b: Booking, approved: boolean) {
  sendMailLater(async () => {
    const room = await roomName(b.roomId);
    const note = b.decisionNote ? `<b>Lý do:</b> ${esc(b.decisionNote).replace(/\n/g, "<br>")}` : undefined;
    return {
      to: b.requesterEmail,
      subject: `${approved ? "[Đã duyệt]" : "[Bị từ chối]"} ${room} · ${formatDateVi(b.date)} ${b.start}–${b.end}`,
      ...render({
        heading: approved ? "Lịch đặt phòng của bạn đã được duyệt" : "Yêu cầu đặt phòng của bạn đã bị từ chối",
        intro: approved
          ? "Quản trị viên đã duyệt. Phòng đã được giữ cho bạn theo thông tin dưới đây."
          : "Rất tiếc, yêu cầu đặt phòng của bạn không được chấp nhận. Phòng đã được giải phóng, bạn có thể chọn khung giờ hoặc phòng khác.",
        tone: approved ? "ok" : "bad",
        rows: details(b, room),
        extra: approved ? undefined : note,
        cta: { label: approved ? "Xem lịch của tôi" : "Đặt lại", href: approved ? `${appUrl()}/my` : appUrl() },
      }),
    };
  });
}

/** Admin hủy lịch của người khác -> báo người đặt. */
export function notifyCancelledByAdmin(b: Booking) {
  sendMailLater(async () => {
    const room = await roomName(b.roomId);
    return {
      to: b.requesterEmail,
      subject: `[Đã hủy] ${room} · ${formatDateVi(b.date)} ${b.start}–${b.end}`,
      ...render({
        heading: "Lịch đặt phòng của bạn đã bị hủy",
        intro: "Quản trị viên đã hủy lịch đặt phòng dưới đây. Nếu cần, vui lòng liên hệ quản trị viên hoặc đặt lại.",
        tone: "bad",
        rows: details(b, room),
        cta: { label: "Mở lịch phòng", href: appUrl() },
      }),
    };
  });
}

/** Admin đổi phòng/giờ của lịch -> báo người đặt. */
export function notifyEditedByAdmin(before: Booking, after: Booking) {
  sendMailLater(async () => {
    const moved =
      before.roomId !== after.roomId || before.date !== after.date || before.start !== after.start || before.end !== after.end;
    if (!moved) return null;
    const [oldRoom, newRoom] = await Promise.all([roomName(before.roomId), roomName(after.roomId)]);
    return {
      to: after.requesterEmail,
      subject: `[Đã điều chỉnh] ${newRoom} · ${formatDateVi(after.date)} ${after.start}–${after.end}`,
      ...render({
        heading: "Lịch đặt phòng của bạn đã được điều chỉnh",
        intro: "Quản trị viên đã thay đổi phòng hoặc giờ của lịch đặt phòng. Thông tin mới:",
        tone: "info",
        rows: details(after, newRoom),
        extra: `<b>Trước đó:</b> ${esc(oldRoom)}, ${esc(formatDateVi(before.date))}, ${before.start} – ${before.end}`,
        cta: { label: "Xem lịch của tôi", href: `${appUrl()}/my` },
      }),
    };
  });
}

/** Thông tin cấu hình email hiển thị cho admin. */
export function mailStatus() {
  return { configured: mailConfigured(), from: process.env.SMTP_USER ?? "" };
}

/** Gửi email thử cho chính admin để kiểm tra cấu hình Gmail SMTP. Ném lỗi (có giải thích) nếu không gửi được. */
export async function sendTestMail(to: string) {
  await deliver({
    to,
    subject: "[Thử] Email thông báo của hệ thống đặt phòng họp",
    ...render({
      heading: "Gửi email thử thành công",
      intro: "Nếu bạn đọc được thư này nghĩa là cấu hình Gmail SMTP đã đúng. Hệ thống sẽ tự gửi email khi có lịch cần duyệt và khi lịch được duyệt hoặc từ chối.",
      tone: "ok",
      rows: [
        ["Người gửi", process.env.SMTP_USER ?? ""],
        ["Địa chỉ web", appUrl()],
      ],
      cta: { label: "Mở hệ thống", href: appUrl() },
    }),
  });
}
