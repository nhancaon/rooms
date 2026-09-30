"use client";

import { useState } from "react";
import { api, errMsg } from "@/lib/fetcher";
import { formatDateVi } from "@/lib/time";
import { Alert, btnDanger, btnGhost, btnPrimary, Field, inputCls, Modal } from "./ui";

type Target = { id: string; title: string; date: string; start: string; end: string; requesterName: string; requesterEmail?: string };

/** Hộp thoại admin duyệt hoặc từ chối 1 lịch đang chờ. Từ chối cho nhập lý do để gửi kèm email. */
export default function DecisionDialog({
  booking: b,
  mode,
  roomName,
  onClose,
  onDone,
}: {
  booking: Target;
  mode: "approve" | "reject";
  roomName: string;
  onClose: () => void;
  /** message: câu thông báo cho admin (đã nói rõ có gửi email hay không) */
  onDone: (message: string) => void;
}) {
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const approve = mode === "approve";

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const res = await api<{ mailSent: boolean }>(`/api/admin/bookings/${b.id}/decision`, {
        method: "POST",
        json: { decision: mode, note },
      });
      const who = b.requesterEmail ?? b.requesterName;
      onDone(
        `${approve ? "Đã duyệt" : "Đã từ chối"} lịch của ${b.requesterName}.` +
          (res.mailSent ? ` Email thông báo đang được gửi tới ${who}.` : " Chưa cấu hình email nên hệ thống không gửi thông báo."),
      );
    } catch (e) {
      setError(errMsg(e));
      setBusy(false);
    }
  }

  return (
    <Modal
      title={approve ? "Duyệt lịch đặt phòng" : "Từ chối lịch đặt phòng"}
      onClose={onClose}
      width="max-w-md"
      footer={
        <>
          <button onClick={onClose} className={btnGhost}>
            Quay lại
          </button>
          <button onClick={submit} disabled={busy} className={approve ? btnPrimary : btnDanger}>
            {busy ? "Đang xử lý..." : approve ? "Duyệt" : "Từ chối"}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="rounded-lg bg-slate-50 p-3 text-sm">
          <div className="font-semibold text-slate-900">{b.title}</div>
          <div className="text-slate-700">
            {roomName} · {formatDateVi(b.date)} · {b.start} – {b.end}
          </div>
          <div className="text-slate-600">
            {b.requesterName}
            {b.requesterEmail && ` · ${b.requesterEmail}`}
          </div>
        </div>
        {approve ? (
          <p className="text-sm text-slate-700">Người đặt sẽ nhận email báo lịch đã được duyệt.</p>
        ) : (
          <Field label="Lý do từ chối" hint="Không bắt buộc. Lý do sẽ được gửi kèm email cho người đặt.">
            <textarea className={inputCls} rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="VD: Phòng đã dành cho sự kiện khác, bạn vui lòng chọn phòng THE AGE." autoFocus />
          </Field>
        )}
        {error && <Alert>{error}</Alert>}
      </div>
    </Modal>
  );
}
