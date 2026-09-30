import { redirect } from "next/navigation";
import { allowedDomains, auth, authMode, signIn } from "@/auth";

// Chỉ cho quay lại đường dẫn nội bộ (tránh open redirect).
function safeRedirect(url: string | undefined) {
  return url && url.startsWith("/") && !url.startsWith("//") ? url : "/";
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.callbackUrl) ? sp.callbackUrl[0] : sp.callbackUrl;
  const redirectTo = safeRedirect(raw);
  const errCode = Array.isArray(sp.error) ? sp.error[0] : sp.error;

  if (await auth()) redirect(redirectTo);

  const domains = allowedDomains();
  const errorText = !errCode
    ? null
    : errCode === "AccessDenied"
      ? domains.length
        ? `Tài khoản này không được phép đăng nhập. Chỉ chấp nhận email thuộc: ${domains.map((d) => `@${d}`).join(", ")}.`
        : "Không đăng nhập được: email Google chưa được xác minh."
      : "Đăng nhập không thành công, vui lòng thử lại.";

  return (
    <div className="mx-auto mt-12 max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
      <h1 className="text-xl font-semibold text-slate-900">Đăng nhập</h1>
      <p className="mt-1 text-sm text-slate-500">Đăng nhập để đặt phòng và quản lý lịch của bạn.</p>
      {errorText && <p className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-100">{errorText}</p>}

      {authMode === "google" ? (
        <form
          className="mt-6"
          action={async () => {
            "use server";
            await signIn("google", { redirectTo });
          }}
        >
          <button className="flex w-full items-center justify-center gap-3 rounded-lg border border-slate-300 bg-white px-4 py-2.5 text-sm font-medium shadow-sm hover:bg-slate-50">
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden>
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.5 5.4 2.6 13.2l7.9 6.1C12.4 13.6 17.7 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.5 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.7c-.6 3-2.2 5.5-4.7 7.2l7.6 5.9c4.4-4.1 6.9-10.1 6.9-17.6z" />
              <path fill="#FBBC05" d="M10.5 28.7A14.5 14.5 0 0 1 9.5 24c0-1.6.3-3.2.8-4.7l-7.9-6.1A24 24 0 0 0 0 24c0 3.9.9 7.5 2.6 10.8l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.9-5.8l-7.6-5.9c-2.1 1.4-4.9 2.3-8.3 2.3-6.3 0-11.6-4.1-13.5-9.8l-7.9 6.1C6.5 42.6 14.6 48 24 48z" />
            </svg>
            Đăng nhập bằng Google
          </button>
        </form>
      ) : authMode === "none" ? (
        <p className="mt-6 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Hệ thống chưa cấu hình đăng nhập Google (thiếu AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET). Vui lòng liên hệ quản trị viên.
        </p>
      ) : (
        <form
          className="mt-6 space-y-3"
          action={async (formData: FormData) => {
            "use server";
            await signIn("dev", {
              email: String(formData.get("email") ?? ""),
              name: String(formData.get("name") ?? ""),
              redirectTo,
            });
          }}
        >
          <p className="rounded-lg bg-amber-50 p-3 text-xs text-amber-800">
            Chưa cấu hình Google (AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET) nên đang dùng chế độ đăng nhập thử.
            Chế độ này tự tắt khi chạy production.
          </p>
          <input name="name" placeholder="Họ tên" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100" />
          <input
            name="email"
            type="email"
            required
            placeholder="Email"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-100"
          />
          <button className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700">
            Đăng nhập thử
          </button>
        </form>
      )}
    </div>
  );
}
