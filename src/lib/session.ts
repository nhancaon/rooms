import { auth } from "@/auth";
import type { SessionUser } from "./types";

function adminEmails(): Set<string> {
  return new Set(
    (process.env.ADMIN_EMAILS ?? "")
      .split(",")
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
}

export async function getUser(): Promise<SessionUser | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  return {
    email,
    name: session?.user?.name?.trim() || email,
    isAdmin: adminEmails().has(email),
  };
}
