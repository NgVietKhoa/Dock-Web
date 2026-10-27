# Dock Web

Cửa sổ trình duyệt nhỏ, luôn nổi trên cùng màn hình: vừa xem YouTube, chat hay tra cứu, vừa làm việc ở app khác mà không phải chuyển qua lại.

![Giao diện Dock Web](docs/screenshot.png)

## Tải về

Tải file **`Dock-Web-Setup-x.y.z.exe`** ở trang [Releases](https://github.com/NgVietKhoa/Dock-Web/releases/latest), mở ra và làm theo hướng dẫn. Chỉ hỗ trợ Windows 10/11 (64-bit).

> Bộ cài chưa được ký số nên Windows có thể hiện *"Windows protected your PC"*. Bấm **More info** → **Run anyway** để cài tiếp.

Cài bản mới đè lên bản cũ là được; tab, dấu trang, lịch sử và các tài khoản đã đăng nhập vẫn giữ nguyên.

## Tính năng

**Cửa sổ nổi**
- Luôn nằm trên cùng, kể cả trên game hoặc app toàn màn hình (bật/tắt bằng nút 📌).
- Kéo ở chỗ trống trên thanh tab để di chuyển, kéo mép hoặc góc để đổi kích thước. Vị trí và kích thước được nhớ lại.
- Gắn nhanh vào cạnh trái / phải / trên / dưới màn hình, chỉnh độ trong suốt (menu ⋯).
- **Xuyên chuột:** cửa sổ mờ đi và mọi cú bấm rơi xuống app bên dưới — tiện khi vừa xem video vừa làm việc.
- Nút ✕ chỉ ẩn xuống khay hệ thống; thoát hẳn qua menu ⋯ hoặc chuột phải icon ở khay.

**Duyệt web như Chrome**
- Nhiều tab: kéo thả để sắp xếp, chuột giữa để đóng, `Ctrl+Shift+T` mở lại tab vừa đóng. Mở app lại thì tab cũ vẫn còn (chỉ tải tab đang xem cho nhẹ máy).
- Ô địa chỉ gõ được cả địa chỉ lẫn từ khoá, có gợi ý từ lịch sử và gợi ý tìm kiếm của Google.
- Thanh dấu trang: ☆ để lưu trang, chuột phải để đổi tên hoặc xoá.
- Thu phóng theo từng trang web (`Ctrl + lăn chuột`), tìm trong trang (`Ctrl+F`), tắt tiếng từng tab (🔊).
- Giữ đăng nhập giữa các lần mở app. Popup "Đăng nhập bằng Google/Facebook" mở thành cửa sổ riêng.
- Kéo link, file hoặc URL từ trình duyệt khác thả vào cửa sổ để mở thành tab mới.

## Phím tắt

| Phím | Tác dụng |
|---|---|
| `Ctrl+Shift+Space` | Ẩn / hiện cửa sổ (dùng được ở mọi app) |
| `Ctrl+Alt+Space` | Bật / tắt xuyên chuột (dùng được ở mọi app) |
| `Ctrl+T` / `Ctrl+W` | Tab mới / đóng tab |
| `Ctrl+Shift+T` | Mở lại tab vừa đóng |
| `Ctrl+Tab`, `Ctrl+Shift+Tab`, `Ctrl+1…9` | Chuyển tab (`Ctrl+9` = tab cuối) |
| `Ctrl+L`, `Alt+D`, `F6` | Vào ô địa chỉ |
| `F5`, `Ctrl+R` / `Ctrl+Shift+R` | Tải lại / tải lại bỏ qua cache |
| `Alt+←` / `Alt+→` | Lùi / tới |
| `Ctrl+D` | Lưu / bỏ dấu trang |
| `Ctrl+F` | Tìm trong trang |
| `Ctrl +` / `Ctrl -` / `Ctrl+0` | Phóng to / thu nhỏ / về 100% |

Nếu `Ctrl+Shift+Space` hoặc `Ctrl+Alt+Space` đã bị app khác chiếm (Unikey, app chụp màn hình…), Dock Web sẽ báo ở khay hệ thống khi mở; lúc đó dùng icon ở khay thay thế.

## Lưu ý

- **Đăng nhập Google:** Google đôi khi chặn đăng nhập trong app nhúng trình duyệt ("This browser or app may not be secure"). Dock Web đã xử lý để qua được trong đa số trường hợp; nếu vẫn bị, thử lại sau ít phút hoặc tắt VPN.
- **Dữ liệu** (tab, dấu trang, lịch sử, cookie đăng nhập) nằm ở `%APPDATA%\dock-web`. Xoá thư mục này để đưa app về như mới.
- Khi gõ vào ô địa chỉ, chữ đang gõ được gửi tới Google để lấy gợi ý tìm kiếm (giống Chrome).

## Chạy từ mã nguồn

Cần [Node.js](https://nodejs.org/) 20 trở lên.

```bash
git clone https://github.com/NgVietKhoa/Dock-Web.git
cd Dock-Web
npm install
npm start          # chạy thử
npm run dist       # build bộ cài vào thư mục dist/
```

Mã nguồn gồm 3 file chính, viết bằng [Electron](https://www.electronjs.org/):

| File | Vai trò |
|---|---|
| `main.js` | Cửa sổ, khay hệ thống, phím tắt toàn hệ thống, xử lý đăng nhập Google |
| `preload.js` | Cầu nối an toàn giữa giao diện và `main.js` |
| `index.html` | Toàn bộ giao diện: tab, ô địa chỉ, dấu trang, menu |

Phát hành bản mới: tăng `version` trong `package.json`, chạy `npm run dist`, rồi tải file `dist/Dock-Web-Setup-<version>.exe` lên một Release mới trên GitHub.
