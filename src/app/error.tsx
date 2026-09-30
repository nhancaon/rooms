"use client";

export default function GlobalError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="mx-auto mt-24 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Có lỗi xảy ra</h1>
      <p className="mt-1 text-sm text-slate-600">Hệ thống gặp sự cố tạm thời. Bạn thử tải lại trang, nếu vẫn lỗi hãy báo quản trị viên.</p>
      <button onClick={reset} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        Thử lại
      </button>
    </div>
  );
}
