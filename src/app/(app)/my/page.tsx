import { redirect } from "next/navigation";
import MyBookings from "@/components/MyBookings";
import { getUser } from "@/lib/session";

export default async function MyPage() {
  const user = await getUser();
  if (!user) redirect("/login?callbackUrl=%2Fmy");

  return <MyBookings />;
}
