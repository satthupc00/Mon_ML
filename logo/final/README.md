# Mon Inkdays — bộ logo / icon

**Ý tưởng:** cuốn sổ lò xo nhật kí, chữ **M** (Mon / Mondiro) như con dấu in vào góc dưới trái trang sổ.
Các trang lót bên dưới mang 3 màu tag của app (tích cực · tiêu cực · du lịch).

## File gốc (dựng bằng `build.py`)
| File | Dùng cho |
|---|---|
| `icon.svg`, `icon-1024.png` | Icon chính (nền bo góc) — app, favicon, store |
| `round.svg` | Icon tròn (Android launcher cũ) |
| `foreground.svg` + `background.svg` | Adaptive icon Android (lớp trước / lớp nền) |
| `monochrome.svg` | Themed icon Android 13+ (đơn sắc) |

Xuất ra Windows (`build/icon.ico`, `build/icon.png`), Android (mipmap, splash) và `src/icon.svg`:
`PLAYWRIGHT_PATH=<playwright> node scripts/make-icons.mjs`

## Màu
| Vai trò | HEX |
|---|---|
| Nền (chuyển màu) | `#FFF3E6` → `#FFD9C7` |
| Đầu sổ | `#4A54C9` → `#2E347F` |
| Chữ M | `#FF6B5E` → `#D7263D` |
| Khoen lò xo | `#C6A15B` / `#FFF0C2` / `#A47E3B` |
| Trang lót (tag) | `#F9D3DF` · `#C9A48C` · `#CDEFD5` |

## Quy tắc dùng
- Giữ nguyên tỉ lệ, không kéo méo, không đổi góc nghiêng chữ M.
- Kích thước tối thiểu: 24 px (dưới mức này chữ M chỉ còn là chấm đỏ).
- Khoảng trống quanh icon tối thiểu = 1/8 cạnh icon.
- Trên nền tối dùng nguyên icon có nền bo góc; không đặt cuốn sổ trơn lên nền tối.

Created by Mondiro
