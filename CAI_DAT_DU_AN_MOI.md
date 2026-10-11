# Hướng Dẫn Cài Đặt và Khởi Tạo Dự Án Mới: Tranh Đại Việt

Tài liệu này hướng dẫn chi tiết từng bước để thiết lập và đưa dự án **Tranh Đại Việt** vào vận hành độc lập với Firebase, GitHub và Vercel mới.

---

## 1. Tổng quan cấu hình

- **Tên dự án:** Tranh Đại Việt (`tranh-dai-viet`)
- **Frontend:** React + Vite + Tailwind CSS + TanStack Query
- **Backend / API:** Node.js (Express) + Firebase Admin SDK
- **Cơ sở dữ liệu & Xác thực:** Firebase (Firestore, Authentication, Storage, Cloud Messaging)
- **Triển khai:** Vercel (Hỗ trợ Serverless API & Cron jobs)

---

## 2. Thiết lập Firebase mới (`tranh-dai-viet`)

### Bước 2.1: Cấu hình Web App (Đã thực hiện)
Thông tin kết nối đã được cập nhật vào file `firebase-applet-config.json` và `public/firebase-messaging-sw.js`:
- **Project ID:** `tranh-dai-viet`
- **App ID:** `1:1023501475852:web:99cb8ea6ec484779c98e29`
- **API Key:** `AIzaSyCj1RgCc1jYf9EkUTsCx_i_wDhnP8lekP4`
- **Auth Domain:** `tranh-dai-viet.firebaseapp.com`
- **Storage Bucket:** `tranh-dai-viet.firebasestorage.app`

### Bước 2.2: Kích hoạt Firebase Authentication
1. Truy cập [Firebase Console](https://console.firebase.google.com/) > chọn dự án **Tranh Dai Viet**.
2. Vào **Build > Authentication** > bấm **Get Started**.
3. Tại tab **Sign-in method**, bật:
   - **Email/Password** (Bật mục "Email/Password", mục "Email link" có thể để tắt).
   - *(Tùy chọn)* **Google** nếu muốn hỗ trợ đăng nhập qua tài khoản Google.

### Bước 2.3: Kích hoạt Cloud Firestore
1. Vào **Build > Firestore Database** > bấm **Create database**.
2. Chọn vị trí cơ sở dữ liệu: Khuyên chọn **`asia-southeast1` (Singapore)** để tốc độ truy xuất tại Việt Nam nhanh nhất.
3. Chọn chế độ bắt đầu: Chọn **Start in production mode**.
4. Sau khi tạo xong, chuyển sang tab **Rules**:
   - Mở file `firestore.rules` trong thư mục dự án này.
   - Sao chép toàn bộ nội dung và dán vào tab **Rules** trên Firebase Console.
   - Bấm **Publish** để áp dụng.

### Bước 2.4: Kích hoạt Firebase Storage (Lưu trữ ảnh & tệp tin)
1. Vào **Build > Storage** > bấm **Get Started**.
2. Chọn vị trí lưu trữ (tương tự Firestore, ví dụ `asia-southeast1` hoặc theo mặc định).
3. Tại tab **Rules** của Storage, cho phép đọc/ghi theo người dùng đã đăng nhập:
   ```javascript
   rules_version = '2';
   service firebase.storage {
     match /b/{bucket}/o {
       match /{allPaths=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
4. Bấm **Publish**.

### Bước 2.5: Tạo Firebase Admin Service Account (Cho Backend & Cron)
1. Trên Firebase Console, bấm vào biểu tượng bánh răng ⚙️ (cạnh mục Project Overview) > chọn **Project settings**.
2. Chuyển sang tab **Service accounts**.
3. Bấm nút **Generate new private key** > xác nhận để tải về file `.json`.
4. Mở file `.json` vừa tải về, copy toàn bộ nội dung (hoặc thu gọn thành 1 dòng JSON) và gán vào biến môi trường:
   - Trong file `.env` cục bộ: `FIREBASE_SERVICE_ACCOUNT='{"type": "service_account", ...}'`
   - Trên cấu hình Environment Variables của Vercel (nếu deploy Vercel).

---

## 3. Tạo tài khoản Admin đầu tiên

Sau khi kích hoạt Authentication và Firestore:
1. Vào **Authentication > Users** > bấm **Add user**.
2. Nhập Email và Mật khẩu cho tài khoản Quản trị viên (Ví dụ: `admin@tranhdaiviet.vn`).
3. Sao chép **User UID** của tài khoản vừa tạo.
4. Chuyển sang **Firestore Database > Data**:
   - Bấm **Start collection**, nhập tên collection: `members`
   - Document ID: Dán **User UID** vừa sao chép ở trên.
   - Thêm các trường:
     - `name` (string): `Quản Trị Viên`
     - `email` (string): `admin@tranhdaiviet.vn`
     - `role` (string): `admin` (hoặc `manager`)
     - `active` (boolean): `true`
5. Bây giờ bạn có thể dùng tài khoản này đăng nhập vào hệ thống với đầy đủ quyền quản trị.

---

## 4. Thiết lập GitHub mới

Để tách khỏi repository cũ và liên kết với GitHub mới:
1. Tạo một repository mới trên GitHub (ví dụ: `tranh-dai-viet`).
2. Mở terminal tại thư mục dự án và chạy:
   ```bash
   # Xóa remote cũ
   git remote remove origin

   # Thêm remote mới của bạn
   git remote add origin https://github.com/<username>/<ten-repo-moi>.git

   # Đổi tên nhánh chính thành main (nếu chưa có)
   git branch -M main

   # Commit và push mã nguồn lên
   git add .
   git commit -m "feat: khoi tao du an Tranh Dai Viet"
   git push -u origin main --force
   ```

---

## 5. Triển khai lên Vercel

1. Đăng nhập vào [Vercel](https://vercel.com/).
2. Bấm **Add New... > Project** > Chọn Repository GitHub `tranh-dai-viet` bạn vừa tạo.
3. Trong phần **Configure Project**:
   - **Framework Preset:** Vite
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
4. Cấu hình **Environment Variables** trên Vercel:
   - `GEMINI_API_KEY`: Key Gemini AI của bạn (nếu dùng AI render / chat).
   - `VITE_IMGBB_API_KEY`: Key ImgBB (nếu có dùng).
   - `FIREBASE_SERVICE_ACCOUNT`: Toàn bộ nội dung chuỗi JSON của file Private Key lấy ở Bước 2.5.
5. Bấm **Deploy**.
6. Sau khi deploy xong, bạn có thể cấu hình tên miền riêng trong mục **Settings > Domains** trên Vercel.

---

## 6. Chạy và kiểm thử tại máy cục bộ (Local)

1. Cài đặt các gói phụ thuộc (nếu chưa):
   ```bash
   npm install
   ```
2. Khởi chạy server phát triển:
   ```bash
   npm run dev
   ```
3. Mở trình duyệt và truy cập: `http://localhost:3000` (hoặc cổng hiển thị trên terminal).
