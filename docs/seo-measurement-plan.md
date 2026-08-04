# Kế hoạch đo lường SEO, AIEO và Core Web Vitals

## Nguyên tắc quyền riêng tư

Repository hiện không có analytics SDK. Chỉ thêm một giải pháp privacy-compatible sau khi owner phê duyệt. Tuyệt đối không gửi room code, edit/host/player token, tên hiển thị, câu hỏi, đáp án, điểm cá nhân, URL ảnh, file config hoặc free-form game content.

Nếu đo CTA/language switch trên public site, event chỉ gồm tên event, locale và canonical public pathname. Không gắn query/fragment. Game dynamic pathname phải được loại bỏ hoặc chuẩn hóa thành nhóm route (`/join/:code`, không phải code thật).

## Baseline

| Metric | Nguồn | Baseline 2026-08-04 | Chu kỳ |
| --- | --- | --- | --- |
| Google clicks, impressions, CTR, average position | Search Console | Chưa có quyền / not yet available | Tuần |
| Indexed pages, canonical selection, sitemap errors | Search Console | Not yet available | Tuần |
| Bing crawl/index/visibility | Bing Webmaster Tools | Not yet available | Tuần |
| ChatGPT referrals | Privacy-compatible analytics/server aggregate | Không có analytics | Tháng |
| Organic landing pages | Analytics/Search Console | Not yet available | Tuần |
| CTA click public → game | Privacy-compatible event | Chưa triển khai tracking | Tuần |
| Language switch | Privacy-compatible event | Chưa triển khai tracking | Tháng |
| LCP/INP/CLS field p75 | CrUX/Search Console/RUM an toàn | Not yet available | 28 ngày |
| 404/410 count | Cloudflare aggregate logs/analytics | Not yet available | Tuần |
| Crawler/WAF errors | Cloudflare + webmaster tools | Not yet available | Tuần |
| Structured data errors | Search Console/Rich Results Test | Not yet available | Tuần |

## Laboratory và CI

- `bun run test:lighthouse` chạy 5 route public; target Performance ≥90, Accessibility ≥95, Best Practices ≥95, SEO 100, LCP ≤2.5s, CLS ≤0.1, TBT ≤300ms.
- Lab LCP/TBT không chứng minh field INP. INP target p75 ≤200ms chỉ được báo khi có dữ liệu trường hợp lệ.
- `bun run test:seo` kiểm tra title, description, H1, canonical, hreflang, JSON-LD, links, sitemap, robots, llms và basic accessibility semantics.

Lần chạy cuối ngày 2026-08-04 trên local production preview:

| URL mẫu | Performance / Accessibility / Best Practices / SEO | LCP | CLS | TBT |
| --- | --- | --- | --- | --- |
| `/vi/` | 100 / 100 / 100 / 100 | 912 ms | 0 | 0 ms |
| `/en/` | 100 / 100 / 100 / 100 | 908 ms | 0 | 0 ms |
| `/vi/tinh-nang/` | 100 / 100 / 100 / 100 | 906 ms | 0 | 0 ms |
| `/en/guides/create-a-bible-quiz/` | 100 / 100 / 100 / 100 | 906 ms | 0 | 0 ms |
| `/vi/cau-hoi-thuong-gap/` | 100 / 100 / 100 / 100 | 905 ms | 0 | 0 ms |

Các số trên chỉ là lab evidence của một lần chạy, được làm tròn đến mili giây; không dùng thay cho CrUX/RUM p75 sau deploy.

## Kế hoạch RUM nhẹ

Nếu cần field data khi CrUX chưa đủ mẫu:

1. Chỉ chạy trên public apex, không chạy trong game app.
2. Dùng Web Vitals library nhỏ/deferred hoặc PerformanceObserver nội bộ sau consent/policy phù hợp.
3. Gửi metric name, rounded value, rating, locale, template id và coarse device class.
4. Không gửi full URL/query/referrer chứa data; chỉ allowlist 26 canonical paths.
5. Lấy mẫu thấp; không tạo identifier bền vững hoặc cross-site cookie.
6. Document retention và provider trước khi bật.

## Diễn giải AIEO

- Google AI Overviews/AI Mode được tính trong Search Console Web; không có report “AIEO ranking” riêng.
- OAI-SearchBot access được kiểm tra qua robots/WAF và crawl logs tổng hợp. ChatGPT referral là signal traffic, không phải bằng chứng guarantee inclusion.
- Không suy diễn absence referral trong thời gian ngắn thành lỗi kỹ thuật khi crawl/index mới triển khai.
