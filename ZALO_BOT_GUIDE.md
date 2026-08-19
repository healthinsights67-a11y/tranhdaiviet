# HƯỚNG DẪN CẤU HÌNH ZALO BOT & WEBHOOK

Tài liệu này hướng dẫn chi tiết các bước thiết lập, xác thực tên miền, cấu hình Webhook và lấy mã ID nhóm/cá nhân để tích hợp Zalo Bot thông báo cho các dự án sau này.

---

## 1. Cấu hình Zalo App & Lấy Token
1. Truy cập trang quản trị ứng dụng Zalo: **[developers.zalo.me](https://developers.zalo.me)**.
2. Tạo một ứng dụng mới hoặc chọn ứng dụng hiện tại.
3. Truy cập mục **Zalo Bot Platform** (hoặc trang tạo Bot).
4. Tạo Bot và sao chép **Bot Token** có định dạng `<App_ID>:<Chuỗi_Token_Bảo_Mật>`.
   *(Token này sẽ được điền vào ô "Token Bot" trong phần Cấu hình hệ thống).*

---

## 2. Xác thực quyền sở hữu tên miền (Domain Verification)
Khi Zalo yêu cầu xác thực tên miền (ví dụ: `https://inoithat.vercel.app/`), thực hiện đồng thời 2 cách sau:

### Cách A: Tải tệp HTML xác thực (Khuyên dùng)
1. Zalo sẽ cung cấp một tệp HTML có tên dạng `zalo_verifierS_-Y49FrCJDNW9yujeeg1JQXf2BQrtvwE30q.html`.
2. Tạo tệp này nằm trong thư mục **`public/`** của dự án với nội dung:
   ```html
   <!DOCTYPE html>
   <html>
   <head>
       <meta name="zalo-platform-site-verification" content="MÃ_XÁC_MINH_ZALO" />
   </head>
   <body>
   MÃ_XÁC_MINH_ZALO
   </body>
   </html>
   ```
3. Sau khi build và deploy lên Vercel, Zalo có thể truy cập tệp trực tiếp tại đường dẫn `https://<domain>/zalo_verifier<MÃ>.html`.

### Cách B: Thêm thẻ Meta vào trang chủ
1. Mở file **`index.html`** ở thư mục gốc của dự án.
2. Thêm hoặc cập nhật thẻ meta sau trong phần `<head>`:
   ```html
   <meta name="zalo-platform-site-verification" content="MÃ_XÁC_MINH_ZALO" />
   ```

---

## 3. Cấu hình Vercel Serverless Routing (`vercel.json`)
Để Vercel chuyển tiếp chính xác tất cả các subpath của API (như `/api/webhook-logs` và `/api/webhooks/zalo`) tới Express serverless function mà không bị rewrite nhầm về trang chủ `index.html` của SPA, file **`vercel.json`** bắt buộc phải cấu hình như sau:

```json
{
  "rewrites": [
    {
      "source": "/api/(.*)",
      "destination": "/api/index"
    },
    {
      "source": "/uploads/(.*)",
      "destination": "/api/index"
    },
    {
      "source": "/((?!api|uploads|zalo_verifier).*)",
      "destination": "/index.html"
    }
  ]
}
```

---

## 4. Cấu hình Webhook trên Cổng Zalo Developers
1. Truy cập trang cấu hình Webhook của ứng dụng: **`developers.zalo.me/app/<APP_ID>/webhook`** (hoặc trang quản lý Bot của bạn trên **`bot.zaloplatforms.com`**).
2. Thiết lập **Webhook URL** chính xác trỏ đến endpoint API:
   ```text
   https://<tên-miền-của-bạn>/api/webhooks/zalo
   ```
3. Bấm **"Kiểm tra"** để nhận kết quả `HTTP Code 200 OK`, sau đó nhấn **"Cập nhật"** (hoặc Lưu).
4. **Bật nhận sự kiện (Event Subscriptions - Quan trọng):**
   Gạt công tắc sang trạng thái **BẬT (Màu xanh)** cho các sự kiện:
   - `user_send_text` (Người dùng gửi tin nhắn text - dùng để lấy ID).
   - `user_send_location` (Người dùng gửi vị trí - dùng để sale check-in).
   - `user_send_image` (Người dùng gửi hình ảnh - nếu cần thiết).

---

## 5. Hướng dẫn lấy mã ID Cá nhân & ID Nhóm Chat
Hệ thống có trang nhật ký webhook được lưu trực tiếp vào Firestore để hiển thị bền vững trên serverless tại đường dẫn:
👉 **`https://<tên-miền-của-bạn>/api/webhook-logs`**

### Bước A: Gửi tin nhắn kích hoạt Webhook
- **Lấy ID cá nhân:** Mở chat riêng 1-1 với Bot trên Zalo và gửi chữ `id` hoặc `/id`.
- **Lấy ID Nhóm:** Thêm Bot vào nhóm Zalo, gán quyền Quản trị viên cho Bot, sau đó tag tên Bot trong nhóm và nhắn:
  ```text
  @Tên_Bot id
  ```

### Bước B: Đọc mã ID
1. Truy cập vào trang nhật ký webhook của bạn: `https://<tên-miền-của-bạn>/api/webhook-logs`.
2. Dữ liệu tin nhắn mới nhất sẽ hiển thị dưới dạng JSON:
   - **Mã User ID cá nhân:** Nằm ở mục `body -> sender -> id` (hoặc do Bot trả lời trực tiếp trong chat 1-1).
   - **Mã Group Chat ID (Nhóm):** Nằm ở mục `body -> message -> chat -> id` (khi gửi tin nhắn trong nhóm).

---

## 6. Thiết lập thông báo trên phần mềm
1. Đăng nhập vào trang quản trị phần mềm -> Mở mục **Cấu hình hệ thống** -> Tab **Bot Thông Báo**.
2. Nhập **Bot Token** thu được ở **Mục 1**.
3. Nhập **Chat ID** (Mã User ID hoặc Group ID) thu được ở **Mục 5**.
4. Nhấn **"Lưu cấu hình"** và bấm **"Gửi Tin Nhắn Test"** để nhận tin nhắn kiểm tra.
