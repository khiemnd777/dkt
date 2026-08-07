# Content roadmap

Nguyên tắc: chỉ publish khi nội dung có search intent riêng, đủ bằng chứng sản phẩm, được người thật duyệt và không lặp lại landing hiện có. Mọi ý tưởng dưới đây hiện là **draft roadmap**, không có route production, không vào sitemap và không được xem là tính năng đã cam kết.

## Ưu tiên 1 — nội dung theo tình huống sử dụng

| Ý tưởng vi | English equivalent | Intent hypothesis | Điều kiện trước publish | Trạng thái |
| --- | --- | --- | --- | --- |
| Đố Kinh Thánh cho Hội Thánh | Bible quiz for churches | Tổ chức chương trình chung | Phỏng vấn/duyệt bởi người tổ chức thật; ví dụ không chứa nội dung Kinh Thánh chưa duyệt | Roadmap |
| Đố Kinh Thánh cho Trường Chúa Nhật | Sunday school Bible quiz | Hoạt động lớp học | Có hướng dẫn lứa tuổi/an toàn phù hợp; không claim giáo dục chưa có bằng chứng | Roadmap |
| Đố Kinh Thánh cho thanh thiếu niên | Bible quiz for youth groups | Sinh hoạt thanh thiếu niên | Duyệt ngôn ngữ, safeguarding và mục tiêu học tập | Roadmap |
| Trò chơi Kinh Thánh cho nhóm nhỏ | Bible trivia for small groups | Nhóm nhỏ tại nhà | Nội dung khác biệt với trang church/youth và có workflow thực tế | Roadmap |
| Cách tổ chức cuộc thi Đố Kinh Thánh online | How to host an online Bible quiz competition | Competition planning | Có format tổ chức, checklist và giới hạn đã kiểm chứng; không lặp host guide | Roadmap |

## Ưu tiên 2 — nâng chất lượng nội dung hiện có

- Thêm ảnh chụp sản phẩm đã xóa sạch room code, token, tên người chơi và câu hỏi riêng.
- Thêm video hướng dẫn chỉ khi có transcript HTML và caption.
- Thêm changelog/updates collection và RSS chỉ khi dự án có nhịp xuất bản thật. Hiện không tạo feed rỗng.
- Duy trì các kênh liên hệ/correction thật đã được chủ sở hữu xác nhận; About, Editorial policy và Privacy phải được cập nhật khi kênh hoặc cách xử lý dữ liệu thay đổi.
- Dùng dữ liệu Search Console/Bing thật để xác nhận hoặc loại bỏ hypothesis; không mua volume hoặc tạo số liệu giả.

## Không đưa vào roadmap xuất bản

- Trang cho từng room code, người chơi, game tạm, kết quả hoặc search query.
- Trang tự sinh cho mọi sách/chương/câu Kinh Thánh.
- Tag/filter trống hoặc biến thể từ khóa cùng intent.
- Kho câu hỏi AI chưa review.
- Comparison/review/rating page không có dữ liệu thật.

## Gate biên tập

1. Ghi translation key, owner thật, source và review status.
2. Xác nhận claim bằng code/config hoặc dữ liệu first-party.
3. Nếu có câu/trích dẫn Kinh Thánh: ghi reference, bản dịch, quyền dùng và reviewer.
4. Viết vi/en tự nhiên; không dịch máy chưa duyệt.
5. Chạy `bun run test:seo`, build, Lighthouse và kiểm tra link.
6. Chỉ thêm sitemap sau khi page indexable trả 200, tự canonical và có alternate đúng.
