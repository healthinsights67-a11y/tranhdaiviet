# Nguyên tắc định hướng phát triển (Development Guidelines)

Tất cả các thay đổi và phát triển mới phải tuân thủ các nguyên tắc sau:

1. **Hiệu suất & Trải nghiệm người dùng:**
   - Ưu tiên sử dụng `TanStack Query` để quản lý dữ liệu thay vì `useEffect` thủ công.
   - Luôn áp dụng Code Splitting (lazy loading) cho các trang (pages) và component nặng.

2. **Độ ổn định & Code Quality:**
   - Bắt buộc sử dụng `Zod` để validate dữ liệu đầu vào và cấu trúc dữ liệu gửi lên Firebase (bảo vệ toàn vẹn dữ liệu).
   - Duy trì kiến trúc modular, tách biệt rõ ràng logic (services) và UI (components).

3. **Bảo mật (Zero-Trust):**
   - Tuân thủ nghiêm ngặt quy tắc Firestore Security Rules đã thiết lập.
   - Không đặt logic xử lý bảo mật phía Client (Client-side), mọi truy vấn phải được rules bảo vệ và validate dữ liệu ở phía Backend (Firestore Rules).

4. **Kỹ thuật:*
   - Luôn ưu tiên TypeScript strict mode và hạn chế tối đa `any`.
   - Error handling phải tập trung, hiển thị thông báo lỗi rõ ràng nhưng không để lộ thông tin nhạy cảm của hệ thống.
