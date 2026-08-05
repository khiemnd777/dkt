# Checklist phát hành SEO + AIEO

Local verification ngày 2026-08-05 đã pass typecheck, lint, 28 unit tests, 8 Worker tests, 32 E2E tests, load UAT 100 người, build, free-tier gate, Lighthouse 5 URL và Wrangler deploy dry-run. Worker đạt 40.41 KiB gzip; initial game JavaScript đạt 76.82 KiB gzip; Lighthouse đạt 100/100 ở bốn category với LCP 906–912 ms, CLS 0 và TBT 0. Các checkbox dưới đây vẫn để trống vì mỗi release và mọi bước DNS/dashboard/production phải được người phát hành xác nhận lại.

## Trước deploy

- [ ] `bun install --frozen-lockfile`
- [ ] `bun run typecheck`
- [ ] `bun run lint`
- [ ] `bun run test`
- [ ] `bun run build`
- [ ] `bun run check:free-tier`
- [ ] `bun run test:e2e`
- [ ] `bun run test:lighthouse`
- [ ] `bunx wrangler deploy --dry-run`
- [ ] Inspect `dist/client`: 26 localized HTML, `app-shell.html`, sitemap, robots, llms, two 1200×630 social PNG.
- [ ] JSON-LD parse; không fake author/publisher/rating/review/organization.
- [ ] Internal links không room code/tracking query; language switch reciprocal.
- [ ] Confirm scoring, builder, WebSocket và hard-delete code không đổi ngoài routing shell.

## DNS/Cloudflare trước cutover

- [ ] Activate `game.dokinhthanh.io.vn` custom domain và certificate.
- [ ] Full (strict) SSL; no stale Pages/Worker route.
- [ ] Review Managed Content Signals so production robots matches owner policy.
- [ ] Verify WAF/bot rules allow Googlebot, Bingbot, OAI-SearchBot and required public assets.
- [ ] Store real `TURNSTILE_SECRET_KEY` if Turnstile is used; `/api/health` on game host reports protected.
- [ ] Optional IndexNow: store real `INDEXNOW_KEY`, never commit it.

## Smoke test ngay sau deploy

- [ ] `/` 308 → `/vi/`; `www` → apex; no chain.
- [ ] `/vi/`, `/en/`, one guide, one nested question page return 200 useful HTML with JS disabled.
- [ ] Canonical, hreflang, lang, title, description, H1, OG, social image, JSON-LD đúng locale.
- [ ] `/robots.txt`, `/sitemap.xml`, `/llms.txt` return 200 + correct content type.
- [ ] Sitemap XML valid; every URL 200/indexable/self-canonical; no game URL.
- [ ] Unknown apex returns 404.
- [ ] Game `/create` and an active room return noindex/no-store; initial HTML generic.
- [ ] Missing valid room returns 410; malformed route 404.
- [ ] API JSON/no-store; no SPA shell on API errors.
- [ ] Social card renders Vietnamese diacritics; icon/alt/dimensions valid.
- [ ] Mobile navigation, skip link, focus, contrast and reduced motion work.

## Regression game

- [ ] Create game and room; builder draft clears only after success.
- [ ] Join player; host/screen fragment token moves to sessionStorage and leaves address bar.
- [ ] Turn-based and fastest-answer scoring unchanged.
- [ ] Multiple choice, true/false, typed answer and crossword run end-to-end.
- [ ] Pause/resume, reveal, leaderboard and completion work.
- [ ] Immediate delete and alarm delete call `deleteAll`; client token clears on event.
- [ ] No R2/D1 cleanup claim: bindings do not exist; no room response enters CDN cache.

## Search engines và đo lường

- [ ] Verify Search Console Domain property through real Cloudflare DNS TXT.
- [ ] Submit sitemap; inspect vi home, en home, guide and question page; record date.
- [ ] Add/import Bing; submit sitemap; inspect same URLs.
- [ ] Submit only materially changed canonical URLs to IndexNow; temporary failure does not block deploy.
- [ ] Record Lighthouse lab results separately from field CWV.
- [ ] Monitor 404/410/crawler/sitemap/structured-data errors without logging private data.
- [ ] Do not claim ranking, index inclusion or AI citation before first-party evidence.
