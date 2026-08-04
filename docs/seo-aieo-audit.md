# Audit SEO + AIEO — trạng thái trước thay đổi

Ngày audit: 2026-08-04 (Asia/Ho_Chi_Minh). Phạm vi: repository hiện tại và phản hồi production của `https://dokinhthanh.io.vn` tại thời điểm kiểm tra. Không có dữ liệu Search Console, Bing Webmaster Tools, CrUX hoặc analytics được cung cấp.

## 1. Rendering và crawlability

### Kiến trúc trước thay đổi

- Dự án là một Vite 8 + React SPA/PWA, không phải Astro, SSR, SSG hoặc prerender.
- `index.html` chỉ chứa `<div id="root"></div>`; H1, nội dung, điều hướng, FAQ và chính sách dữ liệu chỉ xuất hiện sau khi bundle React chạy.
- `wrangler.jsonc` dùng Workers Static Assets với `not_found_handling: single-page-application` và Worker chỉ chạy trước `/api/*`.
- Production `GET /` trả `200`, `text/html`, 830 byte và HTML rỗng về nội dung chính. `GET /not-a-real-page` cũng trả `200` với cùng shell 830 byte: soft 404 có thể tạo vô hạn URL trùng lặp.
- HTML có `lang="vi"`, title `Đố Kinh Thánh Live` và một description chung; không có canonical, hreflang, robots meta, Open Graph, Twitter card, JSON-LD, breadcrumb hoặc nội dung khi tắt JavaScript.

### Routes trước thay đổi

| Route | Vai trò | HTML ban đầu | Index control trước thay đổi |
| --- | --- | --- | --- |
| `/` | Home + nhập mã | React shell | Không có noindex |
| `/create`, `/create/preview` | Builder/preview | Cùng React shell | Không có noindex |
| `/join/:code`, `/play/:code` | Player | Cùng React shell | Không có noindex |
| `/host/:code`, `/screen/:code` | Host/screen | Cùng React shell | Không có noindex |
| `/privacy` | Chính sách tiếng Việt | Cùng React shell | Không canonical/noindex |
| `*` | React NotFound UI | HTTP 200 do SPA fallback | Soft 404 |

Production chưa có DNS cho `game.dokinhthanh.io.vn` tại thời điểm audit (`curl: Could not resolve host`). Vì vậy kiến trúc public/game chưa được tách ở DNS/deployment.

## 2. Indexing controls trước thay đổi

- File repository `public/robots.txt` chỉ có `User-agent: *` và `Allow: /`; không có sitemap hoặc crawler policy riêng.
- Production `/robots.txt` bị Cloudflare Managed Content Signals chèn một khối lớn. Khối này có `search=yes, ai-train=no, use=reference` và chặn `GPTBot`, nhưng chưa có rule tường minh cho `OAI-SearchBot`, chưa khai báo sitemap và nội dung production khác file repository.
- Không có `sitemap.xml`, `llms.txt`, sitemap index, redirect map hoặc RSS.
- Không có canonical/query canonicalization, hreflang hoặc URL tiếng Anh.
- Không có `X-Robots-Tag` cho builder, host, join, play hoặc screen.
- API đã trả JSON status đúng và `Cache-Control: no-store`; static SPA fallback mới là nguồn soft 404.
- Missing room từ API trả 404. Không có lớp HTML route phân biệt mã phòng hợp lệ đã mất (410) với route sai (404).
- `_headers` đã có CSP, Permissions Policy, no-referrer, nosniff và DENY; asset hash được cache immutable.

## 3. Performance baseline

Baseline local đã chạy trước refactor:

| Hạng mục | Kết quả thực tế |
| --- | --- |
| Typecheck | Pass |
| Unit tests | 22/22 pass |
| Worker integration | 4/4 pass; cần chạy ngoài sandbox để Miniflare mở localhost |
| Build | Pass |
| Worker bundle | 38.34 KiB gzip |
| React JS ban đầu | 454.18 KiB raw / 139.63 KiB gzip |
| CSS ban đầu | 53.02 KiB raw / 11.58 KiB gzip |
| Static output | 21 files, 2.8 MiB gồm source maps |
| Free-tier audit | Pass |
| Lighthouse baseline | Chưa có dependency/cấu hình, nên không ghi điểm giả |

- Public content phải tải toàn bộ game bundle trước khi đọc được nội dung.
- Không có font bên thứ ba; dùng system font.
- Không có analytics hoặc third-party marketing script. Turnstile chỉ xuất hiện trong builder khi cấu hình.
- Không có ảnh hero thật trên public SPA; phần minh họa là DOM/CSS. Các icon PWA có kích thước rõ.
- Không có dữ liệu trường để khẳng định LCP/INP/CLS ở percentile 75. INP cần RUM hoặc CrUX/Search Console sau deploy.

## 4. Content và product-claim baseline

- Nội dung public chỉ gồm home tiếng Việt và `/privacy`; chưa có English, feature docs, guides, FAQ, about, editorial policy hoặc content lifecycle đầy đủ.
- README xác nhận bốn loại câu hỏi, hai chế độ, điểm số, hard deletion, sessionStorage và Durable Object lifecycle.
- Repository không có D1, R2, upload ảnh server, localStorage, IndexedDB hoặc analytics SDK. Dữ liệu phòng nằm trong SQLite-backed Durable Object; cleanup gọi `deleteAll()`.
- Phòng active hết hạn sau 2 giờ không có host activity, tuổi thọ tuyệt đối 6 giờ; kết quả hoàn tất giữ 5 phút, cảnh báo phút cuối. Các số này được lấy từ `shared/limits.ts`, không phải ước đoán.
- Trình duyệt xóa builder draft sau create-room; token role được xóa khi client nhận `room.deleted`. File `.dkt.json` do người dùng tải về nằm ngoài khả năng xóa của ứng dụng.
- Home SPA trước thay đổi dùng số người/mã phòng minh họa tĩnh (`24`, `DKT234`). Chúng không nằm trong metadata nhưng dễ bị hiểu là số liệu thật khi được crawl sau hydration; lớp public mới không dùng claim này.

## 5. Kết quả kiểm chứng sau triển khai local

Kết quả này là laboratory/local CI ngày 2026-08-04, không phải dữ liệu production hay field Core Web Vitals:

| Gate | Kết quả |
| --- | --- |
| Typecheck / lint | Pass |
| Unit tests | 28/28 pass, gồm static SEO gates |
| Worker integration | 8/8 pass |
| E2E đa trình duyệt | 32/32 pass trên Chromium, Firefox, WebKit, Pixel 7 và iPhone 13 profiles |
| Load UAT | 100 join + WebSocket + answer; 100/100 answer accepted |
| Lighthouse 5 URL | Mỗi URL đạt 100 Performance / 100 Accessibility / 100 Best Practices / 100 SEO |
| Lighthouse LCP | 905–912 ms; CLS 0; TBT 0 ms trong lần chạy cuối |
| Build / free-tier / deploy dry-run | Pass; Worker 40.43 KiB gzip ở free-tier gate, 40.52 KiB gzip ở Wrangler dry-run |
| Static output | 26 HTML vi/en; hai social card PNG 1200×630; sitemap, robots và llms |

## 6. Kiến trúc áp dụng sau audit

- Public site được sinh build-time bằng TypeScript thành 26 HTML tĩnh, không có client JavaScript. Không thêm Astro để tránh thay package architecture và runtime; kết quả vẫn là SSG đúng yêu cầu crawlability.
- React game được giữ nguyên; build bảo toàn shell tại `dist/client/app-shell.html`.
- Worker host-aware tách apex và `game.`; public unknown route là 404, valid-shaped missing room là 410, operational HTML là noindex/no-store.
- Static public routes vẫn do Cloudflare Static Assets phục vụ tại edge; Worker chỉ chạy trước cho API, root/redirects, crawler files và operational game HTML.
- `robots.txt`, sitemap, `llms.txt`, structured data, social cards và quality gates đều được sinh/kiểm tra từ registry chung.

## 7. Giới hạn của audit

- Không có quyền Search Console/Bing/Cloudflare dashboard nên không thể kiểm chứng index coverage, WAF events, bot challenge logs hoặc field Core Web Vitals.
- Cloudflare Managed Content Signals có thể tiếp tục biến đổi `robots.txt` sau deploy; cần tắt/quy hoạch trong dashboard để production khớp policy repository.
- DNS `game.` và custom-domain activation là bước ngoài repository.
- Không có Git metadata trong workspace (`.git` không tồn tại), nên không thể phân biệt diff theo commit hoặc ghi hash baseline.
