import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import Google from "next-auth/providers/google";

const hasGoogle = !!(process.env.AUTH_GOOGLE_ID && process.env.AUTH_GOOGLE_SECRET);
const isProd = process.env.NODE_ENV === "production";

// Đăng nhập Google (đọc AUTH_GOOGLE_ID / AUTH_GOOGLE_SECRET).
// Khi dev mà chưa có khóa Google thì bật "đăng nhập thử" bằng email tự nhập; production không bao giờ bật.
const providers: NextAuthConfig["providers"] = [];
if (hasGoogle) {
  providers.push(Google);
} else if (!isProd) {
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { email: {}, name: {} },
      authorize: (c) => {
        const email = String(c?.email ?? "").trim().toLowerCase();
        if (!email) return null;
        return { id: email, email, name: String(c?.name ?? "").trim() || email };
      },
    }),
  );
}

/** "google": đăng nhập Google; "dev": đăng nhập thử (chỉ khi phát triển); "none": production nhưng thiếu cấu hình Google. */
export const authMode: "google" | "dev" | "none" = hasGoogle ? "google" : isProd ? "none" : "dev";

/** Giới hạn tên miền email được đăng nhập (ALLOWED_EMAIL_DOMAINS="congty.com,doitac.vn"). Bỏ trống = ai có tài khoản Google cũng vào được. */
export function allowedDomains(): string[] {
  return (process.env.ALLOWED_EMAIL_DOMAINS ?? "")
    .split(",")
    .map((d) => d.trim().toLowerCase().replace(/^@/, ""))
    .filter(Boolean);
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  pages: { signIn: "/login", error: "/login" },
  // Không ép trustHost: Auth.js tự tin cậy khi chạy trên Vercel (hoặc khi có AUTH_URL / AUTH_TRUST_HOST).
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  callbacks: {
    signIn({ account, profile, user }) {
      const email = (user?.email ?? "").toLowerCase();
      if (!email) return false;
      // Quyền admin và quyền sở hữu lịch dựa trên email, nên chỉ nhận email Google đã xác minh.
      if (account?.provider === "google" && profile?.email_verified !== true) return false;
      const domains = allowedDomains();
      if (domains.length && !domains.includes(email.split("@")[1] ?? "")) return false;
      return true;
    },
  },
});
