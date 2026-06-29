// Script để lấy Dropbox Refresh Token
// Hướng dẫn chạy:
// 1. Điền APP_KEY và APP_SECRET của bạn vào bên dưới
// 2. Mở trình duyệt truy cập đường link sau để lấy AUTH_CODE:
//    https://www.dropbox.com/oauth2/authorize?client_id=YOUR_APP_KEY&token_access_type=offline&response_type=code
// 3. Điền AUTH_CODE nhận được vào biến AUTH_CODE bên dưới
// 4. Chạy lệnh: node get_dropbox_token.js

const APP_KEY = 'z5n3x1bz6cj85wb'; // Thay bằng App Key của bạn
const APP_SECRET = 'SM5i9zTlN0kAAAAAAAAAAY39Whv5O4wJ9kHElbunshkB7YsWjNpoW-KqdJDGu8fg'; // Thay bằng App Secret của bạn
const AUTH_CODE = 'vT_x5TuN0V0AAAAAAABE2tpB-2P6Ntu0limn7OyrAOs'; // Thay bằng mã code hiển thị trên trình duyệt sau khi phân quyền

if (APP_KEY === 'YOUR_APP_KEY' || APP_SECRET === 'YOUR_APP_SECRET' || AUTH_CODE === 'YOUR_AUTH_CODE') {
  console.log("Vui lòng điền đầy đủ APP_KEY, APP_SECRET và AUTH_CODE vào file get_dropbox_token.js trước khi chạy!");
  console.log("Xem lại hướng dẫn chi tiết trong tin nhắn chat.");
  process.exit(1);
}

const params = new URLSearchParams();
params.append('code', AUTH_CODE);
params.append('grant_type', 'authorization_code');
params.append('client_id', APP_KEY);
params.append('client_secret', APP_SECRET);

fetch('https://api.dropboxapi.com/oauth2/token', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded'
  },
  body: params
})
.then(res => res.json())
.then(data => {
  console.log("\n=== KẾT QUẢ ĐĂNG NHẬP DROPBOX ===");
  if (data.error) {
    console.error("Lỗi:", data.error_description || data.error);
  } else {
    console.log("Access Token (Tạm thời):", data.access_token);
    console.log("Refresh Token (VĨNH VIỄN):", data.refresh_token);
    console.log("---------------------------------");
    console.log("Vui lòng lưu lại Refresh Token vĩnh viễn trên để cấu hình vào ứng dụng!");
  }
})
.catch(err => {
  console.error("Lỗi kết nối:", err);
});
