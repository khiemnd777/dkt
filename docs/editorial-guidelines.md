# Hướng dẫn biên tập

## 1. Giọng điệu và thuật ngữ

- Tiếng Việt dùng tự nhiên các thuật ngữ: Kinh Thánh, Hội Thánh, Trường Chúa Nhật, thanh thiếu niên. Không trộn thuật ngữ hệ phái khi chưa có ngữ cảnh.
- English là localization tự nhiên, không dịch từng chữ. Dùng “Bible quiz”, “host”, “live room”, “turn-based”, “fastest-answer” nhất quán.
- Viết answer-first: câu trả lời trực tiếp xuất hiện gần đầu, đứng độc lập về nghĩa và nêu rõ entity/tính năng.
- Tránh “tốt nhất”, “số một”, “đáng tin cậy nhất”, guarantee ranking hoặc claim quy mô khi không có bằng chứng.

## 2. Xác minh claim sản phẩm

Nguồn ưu tiên: code/config/test hiện tại, sau đó README/tài liệu được cập nhật cùng code. Trước publish phải đối chiếu:

- Routes và trạng thái HTTP trong `worker/index.ts`.
- Hai mode và scoring trong `worker/room/scoring.ts`, `ranking.ts`.
- Bốn question types trong `shared/schemas.ts` và builder.
- TTL/xóa trong `shared/limits.ts`, `GameRoom.ts`.
- Store/binding trong `wrangler.jsonc`; hiện không có D1/R2/upload server.
- Browser persistence bằng search `sessionStorage`, `localStorage`, `IndexedDB`.

Không publish exact capacity, uptime, latency, giá hoặc thời gian xóa nếu code/config không xác nhận. Free-tier design không đồng nghĩa “free forever” hoặc không giới hạn.

## 3. Nội dung Kinh Thánh và bản quyền

- Ghi sách/chương/câu khi câu hỏi dựa vào phân đoạn cụ thể.
- Khi trích nguyên văn phải ghi bản dịch và kiểm tra license; ưu tiên reference thay vì trích dài.
- Không bịa câu, reference, quotation hoặc cách giải thích thần học.
- Không biến nội dung AI chưa duyệt thành facts. Trường review khi có question collection: `draft`, `reviewStatus`, author/reviewer thật, sources.
- Nội dung chưa duyệt: `draft: true`, `noindex: true`, không sitemap.

## 4. Author, reviewer và ngày

- Chỉ ghi author/reviewer/publisher/organization khi có danh tính thật và đồng ý công bố. Repository hiện chưa có dữ liệu này nên schema cố ý bỏ trống.
- `datePublished`: ngày xuất bản thật.
- `dateModified`: chỉ đổi khi sửa nội dung có ý nghĩa; build không tự đổi ngày.
- Chỉ thêm address, social profile, contact hoặc credential sau khi chủ sở hữu xác nhận. Các kênh liên hệ hiện được xác nhận trong `shared/contact.ts`; mọi thay đổi tiếp theo phải được xác nhận lại.

## 5. AI-assisted content

AI có thể hỗ trợ outline, kiểm tra consistency và localization. Người chịu trách nhiệm phải kiểm tra lại claim, source, link, religious terminology, copyright và duplicate intent. Lịch sử repository cần thể hiện thay đổi nguồn; không dùng AI để sinh hàng trăm trang mỏng.

## 6. Quy trình sửa lỗi

1. Xác định nội dung sai và nguồn ảnh hưởng.
2. Nếu có rủi ro thần học/pháp lý/quyền riêng tư, chuyển draft/noindex hoặc gỡ khỏi sitemap ngay trong cùng release.
3. Sửa source registry, alternate, schema và docs liên quan.
4. Cập nhật `dateModified` thật và chạy toàn bộ gate.
5. Ghi nhận yêu cầu qua GitHub Issues, phản hồi phạm vi sửa và không lưu dữ liệu người báo cáo quá nhu cầu.

Kênh sửa lỗi công khai là `https://github.com/khiemnd777/dkt/issues/new`; người dùng cũng có thể liên hệ qua các kênh được xác nhận trong `shared/contact.ts`. Không yêu cầu hoặc đưa mã phòng, token, tên người chơi, câu hỏi riêng hay dữ liệu phiên vào bất kỳ kênh nào. Không invent email hoặc danh tính reviewer.

## 7. Những cách bị cấm

- Keyword stuffing, meta keywords, hidden text, cloaking, doorway pages.
- FAQ/schema ẩn hoặc schema khác visible content.
- Fake rating/review/user count/date/author/testimonial.
- Programmatic room/player/chapter/search/filter pages.
- Copy competitor content hoặc publish translation chưa review.
