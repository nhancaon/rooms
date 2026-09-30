import { auth } from "@/auth";
import { isAdminEmail } from "./admins";
import type { SessionUser } from "./types";

export async function getUser(): Promise<SessionUser | null> {
  const session = await auth();
  const email = session?.user?.email?.toLowerCase();
  if (!email) return null;
  return {
    email,
    name: session?.user?.name?.trim() || email,
    isAdmin: await isAdminEmail(email),
  };
}
