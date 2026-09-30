import { colorFor } from "../colors";
import type { Room } from "../types";

// Danh sách phòng ban đầu (theo phiếu đăng ký hiện tại). Được ghi vào tab "Rooms"
// khi tạo sheet lần đầu; sau đó quản lý trực tiếp trong Google Sheet.
const rooms: Room[] = [
  { id: "the-age", name: "THE AGE", location: "Phòng tổ chức sự kiện tầng 6 D25", capacity: null, active: true, color: "" },
  { id: "space", name: "SPACE", location: "Phòng họp lớn tầng 2 D25", capacity: null, active: true, color: "" },
  { id: "creation", name: "CREATION", location: "Phòng họp vừa tầng 6 D25", capacity: null, active: true, color: "" },
  { id: "revolution", name: "REVOLUTION", location: "Phòng họp nhỏ tầng 6 D25", capacity: null, active: true, color: "" },
  { id: "nic-hoa-lac", name: "Hội Trường Lớn NIC Hòa Lạc", location: "NIC Hòa Lạc", capacity: null, active: true, color: "" },
  { id: "meeting-room", name: "Meeting room", location: "", capacity: null, active: true, color: "" },
  { id: "khanh-tiet", name: "Phòng Khánh tiết", location: "", capacity: null, active: true, color: "" },
  { id: "eco-valley", name: "Eco-Valley", location: "", capacity: null, active: true, color: "" },
  { id: "su-kien-t8", name: "Phòng tổ chức sự kiện tầng 8 D25", location: "Tầng 8 D25", capacity: null, active: true, color: "" },
];

export const DEFAULT_ROOMS: Room[] = rooms.map((r, i) => ({ ...r, color: colorFor(i) }));
