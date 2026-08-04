# Checklist Cloudflare cho SEO/AIEO

## DNS và domain

- [ ] Apex `dokinhthanh.io.vn` active trên Worker hiện tại.
- [ ] `www` active và redirect 301 một bước sang apex HTTPS.
- [ ] Tạo/activate custom domain `game.dokinhthanh.io.vn` cho cùng Worker; tại audit 2026-08-04 DNS này chưa resolve.
- [ ] SSL/TLS mode **Full (strict)**, Universal/valid certificate cho apex, www, game.
- [ ] Không có Redirect Rule xung đột với Worker root `/ → /vi/` hoặc www canonicalization.
- [ ] Kiểm tra Worker route/custom domain mapping sau deploy; không map một Pages SPA cũ lên apex.

## Managed robots/content signals

- [ ] Dashboard → AI Crawl Control/Content Signals (tên mục có thể đổi) kiểm tra policy đang inject vào robots production.
- [ ] Tránh để managed content thay thế/mâu thuẫn file repository. Policy đích: search allowed, OAI-SearchBot allowed, GPTBot disallowed.
- [ ] Sau thay đổi, `curl https://dokinhthanh.io.vn/robots.txt` phải có sitemap và không có `Disallow: /` cho `*`/OAI-SearchBot.
- [ ] Game robots không khai sitemap; crawler được phép nhận HTML noindex, API bị disallow.

## Bot/WAF

- [ ] Bot Fight Mode/Super Bot Fight/AI Labyrinth không challenge hoặc block Googlebot, Bingbot, OAI-SearchBot trên public HTML/assets.
- [ ] Nếu WAF allowlist dùng IP, lấy dải IP mới từ nguồn chính thức của Google/Bing/OpenAI; không hardcode từ tài liệu cũ.
- [ ] Managed Challenge, Browser Integrity Check, country block và rate limit không áp cho `/vi/*`, `/en/*`, `/robots.txt`, `/sitemap.xml`, `/llms.txt`, icons/social images.
- [ ] Public pages không CAPTCHA, cookie session, geolocation permission hoặc JS challenge.
- [ ] Turnstile chỉ dùng create-room khi configured; không áp cho tài liệu public/crawler files.
- [ ] API rate limit có thể nghiêm hơn nhưng không biến API error thành HTML shell.

## Cache và content types

- [ ] Public HTML: `text/html`, cache revalidate/CDN an toàn; không noindex.
- [ ] `/robots.txt`, `/llms.txt`: `text/plain; charset=utf-8`.
- [ ] `/sitemap.xml`: `application/xml; charset=utf-8`.
- [ ] Hashed game assets: immutable; public site/social assets: finite CDN cache.
- [ ] Operational HTML và API: `Cache-Control: no-store`; no private public-cache rule.
- [ ] Không cache response theo room/player ở Cache Rule hoặc Worker Cache API.

## Routing/status

- [ ] Root apex 308 → `/vi/`; HTTP → HTTPS; www → apex; không chain/loop.
- [ ] 26 sitemap URL trả 200/self-canonical.
- [ ] Unknown apex URL trả 404, không homepage 200.
- [ ] Builder/host/join/play/screen trả `X-Robots-Tag: noindex, nofollow, noarchive, nosnippet`.
- [ ] Valid-shaped missing room trả 410; malformed route 404.
- [ ] Room title/code/player/answer không xuất hiện trong initial HTML/OG.

## Observability không xâm phạm riêng tư

- [ ] Theo dõi status aggregate, crawler user agent, WAF action và route template; không log full dynamic URL/query/fragment.
- [ ] Không log body, display name, token, question, answer hoặc uploaded content.
- [ ] Ghi lại dashboard changes bằng ngày/người thực hiện; repository không được claim dashboard đã đổi khi chưa có bằng chứng.
