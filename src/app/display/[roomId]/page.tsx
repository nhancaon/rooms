import DisplayBoard from "@/components/DisplayBoard";

export default async function RoomDisplayPage({ params }: PageProps<"/display/[roomId]">) {
  const { roomId } = await params;
  let id = roomId;
  try {
    id = decodeURIComponent(roomId);
  } catch {
    /* địa chỉ hỏng (vd. "%"): giữ nguyên, sẽ báo không tìm thấy phòng */
  }
  return <DisplayBoard roomId={id} />;
}
