// Bảng màu gán cho phòng (hiển thị trên lịch). Admin có thể chọn màu khác khi sửa phòng.
export const ROOM_COLORS = [
  "#2563eb",
  "#16a34a",
  "#d97706",
  "#dc2626",
  "#7c3aed",
  "#0891b2",
  "#db2777",
  "#65a30d",
  "#ea580c",
  "#4f46e5",
  "#0d9488",
  "#a21caf",
] as const;

export const colorFor = (index: number) => ROOM_COLORS[index % ROOM_COLORS.length];

export const HEX_RE = /^#[0-9a-fA-F]{6}$/;
