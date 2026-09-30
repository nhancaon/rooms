import type { Booking, BookingStatus, Room } from "../types";
import { DEFAULT_ROOMS } from "./default-rooms";
import type { BookingRepository } from "./types";

/** Repo chạy trong RAM, dùng khi chưa cấu hình Google Sheets (dev/demo). Mất dữ liệu khi restart. */
export class MemoryRepository implements BookingRepository {
  private rooms: Room[] = DEFAULT_ROOMS.map((r) => ({ ...r }));
  private bookings: Booking[] = [];

  async listRooms() {
    return this.rooms.map((r) => ({ ...r }));
  }

  async saveRoom(room: Room) {
    const i = this.rooms.findIndex((r) => r.id === room.id);
    if (i === -1) this.rooms.push({ ...room });
    else this.rooms[i] = { ...room };
  }

  async deleteRoom(id: string) {
    this.rooms = this.rooms.filter((r) => r.id !== id);
  }

  async listBookings(opts: { from?: string; to?: string } = {}) {
    return this.bookings
      .filter((b) => (!opts.from || b.date >= opts.from) && (!opts.to || b.date <= opts.to))
      .map((b) => ({ ...b }));
  }

  async findBooking(id: string) {
    const b = this.bookings.find((x) => x.id === id);
    return b ? { ...b } : null;
  }

  async appendBooking(booking: Booking) {
    this.bookings.push({ ...booking });
  }

  async updateBooking(booking: Booking) {
    const i = this.bookings.findIndex((b) => b.id === booking.id);
    if (i === -1) throw new Error(`Không tìm thấy booking ${booking.id}`);
    this.bookings[i] = { ...booking };
  }

  async setBookingStatus(id: string, status: BookingStatus) {
    const b = this.bookings.find((x) => x.id === id);
    if (!b) throw new Error(`Không tìm thấy booking ${id}`);
    b.status = status;
  }

  async deleteBooking(id: string) {
    this.bookings = this.bookings.filter((b) => b.id !== id);
  }
}
