# Thiết lập Google Search Console và Bing Webmaster Tools

Các bước này cần quyền tài khoản/DNS và chưa được thực hiện từ repository. Không tạo verification token giả.

## Google Search Console

1. Đăng nhập Search Console, chọn **Add property → Domain** và nhập `dokinhthanh.io.vn`.
2. Copy TXT verification do Google cấp.
3. Trong Cloudflare Dashboard → domain → DNS → Records → Add record TXT tại apex; paste đúng token, không proxy TXT.
4. Quay lại Search Console và Verify. Ghi ngày xác minh thật vào release record.
5. Mở Sitemaps, submit `https://dokinhthanh.io.vn/sitemap.xml` một lần. Không submit game sitemap.
6. URL Inspection lần lượt:
   - `https://dokinhthanh.io.vn/vi/`
   - `https://dokinhthanh.io.vn/en/`
   - `https://dokinhthanh.io.vn/vi/huong-dan/tao-game-do-kinh-thanh/`
   - `https://dokinhthanh.io.vn/en/question-types/horizontal-and-special-vertical-crossword/`
7. Trong rendered HTML, xác nhận H1/summary có sẵn, canonical tự tham chiếu, hreflang vi/en/x-default và không cần JS.
8. Theo dõi Page indexing, Sitemaps, Core Web Vitals và structured-data enhancements. FAQ rich result không được hứa; Article thiếu author/publisher cố ý vì chưa có identity thật.
9. So sánh Google-selected canonical với user canonical; kiểm tra cặp locale không bị xem là duplicate sai.
10. Ghi ngày submit/request indexing; không request lại hàng ngày.

## Bing Webmaster Tools

1. Add `dokinhthanh.io.vn` hoặc Import từ Search Console sau khi Google property verified.
2. Nếu xác minh riêng, dùng meta/DNS token thật do Bing cấp; không commit token nếu không cần build-time.
3. Submit `https://dokinhthanh.io.vn/sitemap.xml`.
4. URL Inspection cùng bốn URL mẫu ở trên; kiểm tra crawl/index và HTTP 200.
5. Theo dõi crawl errors, sitemap parsing và blocked resources.
6. IndexNow: tạo key 8–128 ký tự, lưu bằng `wrangler secret put INDEXNOW_KEY`, deploy, xác nhận `https://dokinhthanh.io.vn/<key>.txt` trả đúng key/plain text.
7. Chỉ submit URL public thay đổi đáng kể: `bun run indexnow -- /vi/.../ /en/.../`. Dùng `--deleted` cho URL public thật đã move/delete; không submit room/API.

## Verification meta tùy chọn

Site config không chứa placeholder token vì DNS Domain property là lựa chọn ưu tiên. Nếu sau này buộc dùng HTML verification, thêm env/config an toàn và render chỉ khi token thật tồn tại; test không được chấp nhận chuỗi placeholder.
