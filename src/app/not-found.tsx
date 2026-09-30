import Link from "next/link";

export default function NotFound() {
  return (
    <div className="mx-auto mt-24 max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-lg font-semibold text-slate-900">Không tìm thấy trang</h1>
      <p className="mt-1 text-sm text-slate-600">Địa chỉ bạn mở không tồn tại hoặc đã bị đổi.</p>
      <Link href="/" className="mt-5 inline-block rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700">
        Về trang lịch
      </Link>
    </div>
  );
}
