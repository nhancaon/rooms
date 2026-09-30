import { handle, json, parseBody, requireUser } from "@/lib/api";
import { createBooking, getUpcoming, toPublic } from "@/lib/booking-service";
import { bookingSchema } from "@/lib/schema";

// Lịch sắp tới của tôi
export function GET() {
  return handle(async () => {
    const user = await requireUser();
    return json({ bookings: await getUpcoming(user) });
  });
}

export function POST(req: Request) {
  return handle(async () => {
    const user = await requireUser();
    const input = await parseBody(req, bookingSchema);
    const booking = await createBooking(input, user);
    return json({ booking: toPublic(booking, user) }, { status: 201 });
  });
}
