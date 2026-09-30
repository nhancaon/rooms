import CalendarView from "@/components/CalendarView";
import { getUser } from "@/lib/session";
import { isValidDate, nowVN } from "@/lib/time";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  const raw = Array.isArray(sp.date) ? sp.date[0] : sp.date;
  const initialDate = raw && isValidDate(raw) ? raw : nowVN().date;
  const user = await getUser();

  return <CalendarView initialDate={initialDate} user={user && { name: user.name, email: user.email, isAdmin: user.isAdmin }} />;
}
