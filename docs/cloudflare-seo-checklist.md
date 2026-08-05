# Checklist Cloudflare cho SEO/AIEO

## Live snapshot 2026-08-05

- [Push-triggered deploy run 30970905253](https://github.com/khiemnd777/dkt/actions/runs/30970905253) đã phát hành Worker version `98e76988-5d2a-4b69-a105-37278286e600` trên apex, `www` và `game` custom domain; version ID thay đổi ở mỗi release.
- Production smoke pass: root 308 sang `/vi/`, `www` 301 sang apex, public unknown 404, missing room 410, API/noindex/no-store đúng policy.
- Cả 26 sitemap URL trả 200 và self-canonical; sitemap, robots và llms có content type đúng.
- `game.dokinhthanh.io.vn` đã resolve với HTTPS; `TURNSTILE_SECRET_KEY` và client site key hoạt động, health trả `turnstileProtected: true`.
- Managed Content Signals vẫn prepend nhưng tương thích policy source: search được phép, OAI-SearchBot được phép, GPTBot bị chặn và sitemap hiện diện.
- GitHub environment `production` đã có Account ID, Turnstile site-key variable và `CLOUDFLARE_API_TOKEN`; workflow deploy không còn phụ thuộc vào phiên Wrangler local.

Account token `github-dkt-production-deploy` dùng template chính thức `Edit Cloudflare Workers`; policy zone được giới hạn cho `dokinhthanh.io.vn`, token hết hạn ngày 2027-08-06 và chỉ được lưu dưới dạng GitHub secret. [Workflow-dispatch run 30970621576](https://github.com/khiemnd777/dkt/actions/runs/30970621576) kiểm chứng secret độc lập; run 30970905253 tiếp tục kiểm chứng chuỗi push → CI → deploy → production smoke. Xoay token trước ngày hết hạn; không commit hoặc tái sử dụng OAuth token của Wrangler.

## DNS và domain

- [x] Apex `dokinhthanh.io.vn` active trên Worker hiện tại.
- [x] `www` active và redirect 301 một bước sang apex HTTPS.
- [x] `game.dokinhthanh.io.vn` active trên cùng Worker.
- [x] HTTPS/certificate hợp lệ cho apex, www và game qua production smoke.
- [x] Không có Redirect Rule xung đột với Worker root `/ → /vi/` hoặc www canonicalization.
- [x] Worker route/custom domain mapping không còn phục vụ Pages SPA cũ trên apex.

## Managed robots/content signals

- [ ] Dashboard → AI Crawl Control/Content Signals (tên mục có thể đổi) kiểm tra policy đang inject vào robots production.
- [x] Managed content không thay thế/mâu thuẫn file repository: search allowed, OAI-SearchBot allowed, GPTBot disallowed.
- [x] Robots production có sitemap và không có `Disallow: /` cho `*`/OAI-SearchBot.
- [x] Game robots không khai sitemap; crawler được phép nhận HTML noindex, API bị disallow.

## Bot/WAF

- [ ] Bot Fight Mode/Super Bot Fight/AI Labyrinth không challenge hoặc block Googlebot, Bingbot, OAI-SearchBot trên public HTML/assets.
- [ ] Nếu WAF allowlist dùng IP, lấy dải IP mới từ nguồn chính thức của Google/Bing/OpenAI; không hardcode từ tài liệu cũ.
- [ ] Managed Challenge, Browser Integrity Check, country block và rate limit không áp cho `/vi/*`, `/en/*`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, icons/social images.
- [ ] Public pages không CAPTCHA, cookie session, geolocation permission hoặc JS challenge.
- [ ] Turnstile chỉ dùng create-room khi configured; không áp cho tài liệu public/crawler files.
- [ ] API rate limit có thể nghiêm hơn nhưng không biến API error thành HTML shell.

## Cache và content types

- [x] Public HTML: `text/html`, cache revalidate/CDN an toàn; không noindex.
- [x] `/robots.txt`, `/llms.txt`: `text/plain; charset=utf-8`.
- [x] `/sitemap.xml`: `application/xml; charset=utf-8`.
- [ ] Hashed game assets: immutable; public site/social assets: finite CDN cache.
- [x] Operational HTML và API: `Cache-Control: no-store`; no private public-cache rule.
- [ ] Không cache response theo room/player ở Cache Rule hoặc Worker Cache API.

## Routing/status

- [x] Root apex 308 → `/vi/`; HTTPS www → apex một bước, không chain/loop.
- [x] 26 sitemap URL trả 200/self-canonical.
- [x] Unknown apex URL trả 404, không homepage 200.
- [x] Builder/host/join/play/screen trả `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`.
- [x] Valid-shaped missing room trả 410; malformed route 404.
- [ ] Room title/code/player/answer không xuất hiện trong initial HTML/OG.

## Observability không xâm phạm riêng tư

- [ ] Theo dõi status aggregate, crawler user agent, WAF action và route template; không log full dynamic URL/query/fragment.
- [ ] Không log body, display name, token, question, answer hoặc uploaded content.
- [ ] Ghi lại dashboard changes bằng ngày/người thực hiện; repository không được claim dashboard đã đổi khi chưa có bằng chứng.
