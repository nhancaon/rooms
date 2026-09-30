# Đặt phòng họp

Web đặt phòng họp / tổ chức sự kiện. Dữ liệu lưu trong **Google Sheets**, giao diện **Next.js**.

| Trang | Đường dẫn | Ai dùng |
|---|---|---|
| Lịch phòng kiểu Google Calendar (xem ngày / tuần, cả ngày 00:00–24:00, kéo chuột trên ô trống để đặt phòng, bước 15 phút) | `/` | Xem: mọi người. Đặt phòng: cần đăng nhập Google |
| Lịch của tôi, hủy lịch | `/my` | Cần đăng nhập |
| **Quản trị**: tổng quan, xem toàn bộ thông tin, sửa/hủy/xóa lịch, xuất CSV, quản lý phòng | `/admin` | Chỉ admin |
| Màn hình TV, tất cả phòng | `/display` | Công khai, tự làm mới 30 giây |
| Màn hình trước cửa 1 phòng | `/display/<id-phòng>` vd. `/display/space` | Công khai |

### Trang quản trị (`/admin`)

- **Tổng quan**: số lịch hôm nay / 7 ngày tới, giờ sử dụng 30 ngày qua, mức sử dụng từng phòng.
- **Lịch đặt phòng**: lọc theo ngày, phòng, trạng thái, tìm theo tên sự kiện / người đặt / email / đơn vị. Xem đầy đủ người đặt, email, số người, yêu cầu khác, thời điểm đặt. **Sửa** (đổi phòng, giờ, thông tin; vẫn chặn trùng giờ), **Hủy** (giữ lại lịch sử với trạng thái "Đã hủy"), **Xóa vĩnh viễn** (xóa dòng khỏi Google Sheet), **Xuất CSV**.
- **Chờ duyệt**: danh sách yêu cầu đặt phòng cần admin quyết định. **Duyệt** hoặc **Từ chối** (kèm lý do); người đặt nhận email kết quả. Số lịch chờ duyệt hiện ngay trên menu "Quản trị".
- **Phòng**: thêm / sửa tên, vị trí, sức chứa, màu trên lịch, **bật "Cần admin duyệt"** cho từng phòng / ẩn phòng / xóa phòng. Phòng đang có lịch đặt không xóa được (hãy ẩn phòng hoặc hủy lịch trước).
- Admin còn thấy nút **Chỉnh sửa** ngay trong cửa sổ chi tiết của bất kỳ lịch nào trên trang lịch.

- **Quản trị viên**: thêm / gỡ admin ngay trên web (lưu trong tab `Admins` của Google Sheet), không cần deploy lại. Admin "gốc" khai báo trong `ADMIN_EMAILS` thì không gỡ được ở đây (tránh tự khóa mình). Có nút **Gửi email thử** để kiểm tra cấu hình email.

Ai là admin: những email trong `ADMIN_EMAILS` (admin gốc) cộng với danh sách trong tab `Admins`. Người không phải admin vào `/admin` sẽ bị từ chối, và mọi API `/api/admin/*` đều kiểm tra quyền ở phía server.

## Chạy thử ngay (không cần cấu hình gì)

```bash
npm install
# tạo .env.local với một dòng AUTH_SECRET=<chuỗi ngẫu nhiên>  (npx auth secret)
npm run dev
```

Chưa có khóa Google thì app tự dùng **dữ liệu trong RAM** và **đăng nhập thử** (nhập email bất kỳ). Hai chế độ này bị tắt khi `NODE_ENV=production`; thiếu cấu hình Google Sheets trong production sẽ báo lỗi ngay.

## Cấu hình thật

Sao chép `.env.example` thành `.env.local` và điền:

1. **Đăng nhập Google**: Google Cloud Console → Credentials → OAuth client ID (Web). Redirect URI: `https://<domain>/api/auth/callback/google` (và `http://localhost:3000/api/auth/callback/google`).
2. **Google Sheets**: tạo Service Account, bật Google Sheets API, tạo key JSON. Tạo một Sheet trống, **Share cho email service account với quyền Editor**, rồi điền `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`.
3. Lần chạy đầu app tự tạo tab **Rooms** (9 phòng mẫu). Tab lịch đặt phòng được tạo **theo tháng** khi có lịch đầu tiên của tháng đó (xem mục "Dữ liệu lớn dần"). Sau đó thêm/sửa/tắt phòng trực tiếp trong tab Rooms (cột `active` = `FALSE` để ẩn).
4. `ADMIN_EMAILS`: danh sách email admin, phân tách bằng dấu phẩy (vd. `a@gmail.com,b@gmail.com`). Đổi biến này cần khởi động lại / deploy lại. Khi chạy thử bằng "đăng nhập thử", email `admin@example.com` là admin (cấu hình trong `.env.local`).

Email thông báo (Gmail SMTP): `SMTP_USER` (địa chỉ Gmail gửi đi) và `SMTP_PASS` (Mật khẩu ứng dụng 16 ký tự, tạo tại myaccount.google.com/apppasswords sau khi bật Xác minh 2 bước). Không đặt thì hệ thống vẫn chạy, chỉ không gửi email.

Biến tùy chọn: `MAIL_FROM_NAME`, `APP_URL`, `ALLOWED_EMAIL_DOMAINS` (chỉ cho email thuộc tên miền công ty đăng nhập) và `GUEST_VIEW` (xem mục Bảo mật).

## Deploy lên Vercel

1. Đưa code lên GitHub (repo **private**). Trước khi push chạy `git status` để chắc chắn không có file `.env*` hay file `.json` khóa Google trong danh sách.
2. vercel.com → **Add New… → Project** → import repo. Framework tự nhận Next.js, giữ nguyên các mặc định.
3. Trước khi bấm Deploy, vào **Environment Variables** khai báo: `AUTH_SECRET` (chuỗi mới), `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`, `ADMIN_EMAILS`, `GOOGLE_SHEET_ID`, `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `SMTP_USER`, `SMTP_PASS` (+ tùy chọn `MAIL_FROM_NAME`, `ALLOWED_EMAIL_DOMAINS`, `GUEST_VIEW`). Không cần `AUTH_URL` vì Vercel tự nhận. Nên bật **Sensitive** cho các biến bí mật.
4. Deploy xong có địa chỉ `https://<dự-án>.vercel.app`. Vào Google Cloud → Google Auth Platform → Clients → mở client → thêm **Authorized redirect URI**: `https://<dự-án>.vercel.app/api/auth/callback/google` (thêm cả tên miền riêng nếu dùng). Chờ 1 đến 5 phút để Google áp dụng.
5. Google Auth Platform → Audience → **Publish app** (để không bị giới hạn 100 email test).
6. Mở địa chỉ, đăng nhập, đặt thử một lịch và kiểm tra Google Sheet.

`vercel.json` đặt vùng chạy ở Singapore (`sin1`) cho gần người dùng Việt Nam. Bản Preview (mỗi nhánh/PR một địa chỉ) không đăng nhập Google được vì địa chỉ khác redirect URI: bình thường, chỉ dùng bản Production.

## Bảo mật

- **Bí mật** nằm trong biến môi trường, không nằm trong code hay bundle gửi cho trình duyệt (đã quét bản build). `.env*` và file khóa `.json` bị `.gitignore` chặn.
- **Đăng nhập** chỉ nhận email Google đã xác minh. Đặt `ALLOWED_EMAIL_DOMAINS` để giới hạn theo tên miền công ty. Chế độ "đăng nhập thử" chỉ có khi phát triển, tự tắt trong production.
- **Phân quyền ở server**: mọi API `/api/admin/*` kiểm tra quyền admin; người dùng chỉ hủy được lịch của mình.
- **Chống CSRF**: API từ chối yêu cầu do trang web khác kích hoạt (kiểm tra `Sec-Fetch-Site`), cookie phiên `SameSite=Lax`.
- **Riêng tư**: mặc định người chưa đăng nhập chỉ thấy khung giờ đã kín ("Đã có lịch"), không thấy chủ đề hay tên người đặt. Đặt `GUEST_VIEW=full` nếu muốn hiện cả chủ đề trên màn hình công khai (hoặc đăng nhập Google trên chính máy gắn TV). Email và yêu cầu khác chỉ chủ lịch và admin thấy.
- **Chống lạm dụng**: mỗi người tối đa 30 lịch sắp tới, chỉ đặt trước tối đa 366 ngày (admin không bị giới hạn). Chỉnh trong [src/lib/config.ts](src/lib/config.ts).
- **Dữ liệu ghi vào Sheet dạng văn bản thuần** (`RAW`), không chạy công thức; file CSV xuất ra có chặn công thức. Mọi chuỗi được giới hạn độ dài.
- **Tiêu đề bảo mật**: chặn nhúng iframe, `nosniff`, `Referrer-Policy`, `Permissions-Policy`; `robots.txt` chặn công cụ tìm kiếm.

## Thiết kế (những điểm cần biết)

- **Không đặt trùng phòng**: server kiểm tra trùng trên dữ liệu mới nhất (bỏ qua cache) → ghi → **đọc lại để xác nhận**. Nếu 2 người (kể cả ở 2 instance khác nhau) đặt cùng lúc thì lịch nằm dòng trên trong sheet thắng, lịch còn lại tự bị hủy và người đặt nhận lỗi 409. Bên trong 1 instance các lần ghi còn được xếp hàng.
- **Không vượt quota Google** (~60 lượt đọc/phút): kết quả đọc được cache 5 giây, nhiều request cùng lúc gộp thành 1 lần gọi; nếu Google lỗi thì trả bản cache cũ thay vì sập trang.
- **Dễ đổi database**: mọi truy cập dữ liệu đi qua interface `BookingRepository` ([src/lib/repo/types.ts](src/lib/repo/types.ts)). Muốn chuyển sang Postgres chỉ cần viết thêm một implementation.
- **Ngày/giờ** lưu dạng chuỗi (`2026-10-01`, `08:30`) theo giờ Việt Nam, tránh lệch múi giờ; ghi bằng chế độ `RAW` nên Sheets không tự đổi kiểu và không chạy công thức nếu ai đó nhập `=...`.
- **Form đặt phòng gọn**: chỉ cần chủ đề cuộc họp, phòng, ngày, giờ; số người tham dự và yêu cầu khác không bắt buộc. Họ tên và email lấy từ tài khoản Google.
- **Định dạng Việt Nam**: ngày dd/mm/yyyy (có bộ chọn ngày riêng, tuần bắt đầu từ thứ hai, không phụ thuộc ngôn ngữ trình duyệt), giờ 24 giờ, múi giờ Asia/Ho_Chi_Minh. Trong Google Sheet, cột ngày lưu dạng `yyyy-mm-dd` để sắp xếp đúng; file xuất CSV dùng dd/mm/yyyy.
- **Luồng duyệt**: mỗi phòng có cờ "Cần admin duyệt". Lịch đặt ở phòng đó có trạng thái **Chờ duyệt** (vẫn giữ chỗ nên không ai đặt trùng được) cho tới khi admin duyệt hoặc từ chối; từ chối thì phòng được giải phóng. Admin tự đặt thì có hiệu lực ngay. Người đặt thấy trạng thái + lý do từ chối trong "Lịch của tôi". Lịch chờ duyệt không được tính là "đang sử dụng" trên màn hình phòng. Trạng thái: `pending`, `confirmed`, `rejected`, `cancelled`; ai quyết định và lúc nào được lưu trong các cột `decisionNote`, `decidedBy`, `decidedAt`.
- **Email**: gửi sau khi đã trả lời người dùng (không làm chậm thao tác), nội dung được escape, tiêu đề không chèn được xuống dòng, gửi lỗi không làm hỏng thao tác. Người đặt nhận email khi lịch được duyệt / bị từ chối / bị admin hủy / bị admin đổi phòng hoặc giờ; admin nhận email khi có lịch mới cần duyệt. Gmail cho gửi tối đa khoảng 500 thư mỗi ngày.
- **Dữ liệu lớn dần**: mỗi tháng một tab (`Bookings_2026-10`, `Bookings_2026-11`...), tab tự tạo khi có lịch đầu tiên của tháng. Lịch nằm ở tab theo **ngày diễn ra**. App chỉ đọc đúng tab của tháng đang xem nên không chậm đi theo thời gian; tab các tháng đã qua được cache lâu hơn. **Muốn dọn dữ liệu cũ: xóa thẳng tab của tháng đó trong Google Sheet** (app tự coi tháng đó là trống, không lỗi). Nếu admin đổi ngày của một lịch sang tháng khác, dòng đó được chuyển sang tab tháng mới.
- **Tự chuyển Sheet cũ**: nếu còn tab `Bookings` kiểu cũ (mọi tháng chung một tab, có thể còn các cột đơn vị/SĐT), app tự tách ra các tab theo tháng ở lần chạy đầu, đọc theo tên cột nên không lệch cột, rồi đổi tên + ẩn tab cũ thành `_Bookings_cu` làm bản sao lưu (không xóa; bạn tự xóa khi đã yên tâm). Bị ngắt giữa chừng thì chạy lại vẫn không nhân đôi dữ liệu.
- **Riêng tư**: người ngoài chỉ thấy giờ, chủ đề và tên người đặt. Email và yêu cầu khác chỉ chủ lịch và admin xem được.
- **Sửa lịch cũng an toàn**: admin sửa giờ/phòng cũng qua kiểm tra trùng + đọc lại xác nhận; nếu bị người khác chiếm chỗ giữa chừng thì tự hoàn tác về giá trị cũ.
- **Cột `color`** trong tab Rooms là màu hiển thị trên lịch; sheet tạo từ phiên bản cũ sẽ được tự thêm cột này.
- Bước thời gian (15 phút), khung giờ làm việc mặc định khi mở lịch, thời gian cache chỉnh trong [src/lib/config.ts](src/lib/config.ts).

## Giới hạn hiện tại

- Chưa có email nhắc trước giờ họp. Lịch chờ duyệt mà quá giờ vẫn nằm ở trạng thái chờ (chỉ hiện lịch từ hôm nay trở đi trong tab Chờ duyệt).
- Chưa có lịch lặp lại.
- Nếu một tháng có hơn vài chục nghìn lịch hoặc hàng trăm người dùng cùng lúc thì nên chuyển sang cơ sở dữ liệu thật (Postgres); lớp dữ liệu đã tách riêng nên chỉ cần viết thêm một phần lưu trữ.
