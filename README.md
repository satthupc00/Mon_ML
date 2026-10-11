# Mon ML

Nhật ký "My Life" của Mondiro: viết trên **Windows** và **Android (Z Fold 7)**, dữ liệu đồng bộ qua **Firebase**.

## Tính năng
- **Dòng chảy**: viết liên tục theo ngày như Google Docs ("8/10 t5 …"). Ngày đã qua chưa viết vẫn hiện nhãn ngày, để trống.
- Nút **+** cuối trang: tự thêm ngày tiếp theo.
- **Lịch** cuộn dọc qua 12 tháng: ngày đã viết màu xanh nhạt, tag hồng (tích cực) / nâu (tiêu cực), ô có từ khóa tìm kiếm sáng vàng.
- Đổi chế độ bằng nút hoặc vuốt mạnh trái/phải. Màn trong Z Fold và PC hiện cả 2 cột.
- Chuyển năm, tìm kiếm, xuất (.json / .txt) và nhập (file hoặc dán văn bản Google Docs).
- Khóa: điện thoại nhập mã lần đầu rồi dùng vân tay, PC nhập mật khẩu. Mặc định **0935**.
- Tự cập nhật từ GitHub Releases (cả Windows và Android).

## Cấu trúc
| Thư mục | Nội dung |
|---|---|
| `src/` | Giao diện dùng chung (HTML/CSS/JS) |
| `electron/` | Vỏ app Windows |
| `android/` | Project Android (Capacitor) |
| `scripts/` | Build web, vẽ icon |
| `.github/workflows/release.yml` | Tự build .exe + .apk khi đẩy tag `v*` |

## Phát hành bản mới
1. Tăng `version` trong `package.json` (vd 1.0.1).
2. Commit, rồi đẩy tag cùng số: `git tag v1.0.1 && git push origin v1.0.1`.
3. GitHub Actions build `MonML-Setup-1.0.1.exe` và `MonML-1.0.1.apk` lên trang Releases. App cũ sẽ tự báo có bản mới.

## Firebase
- Bật **Authentication → Email/Password** và tạo **Firestore Database**.
- Dán nội dung `firestore.rules` vào tab **Rules** của Firestore.
- Dán `firebaseConfig` vào `src/firebase-config.js` (gắn sẵn cho mọi máy) hoặc dán trong app ở mục **Đồng bộ**.

Created by Mondiro
