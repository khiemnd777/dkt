# Bản đồ search intent và từ khóa

Không có Search Console hoặc nguồn first-party trong workspace. Toàn bộ keyword dưới đây được gắn nhãn **Giả thuyết ý định tìm kiếm**, không có search volume giả. Một intent chỉ có một canonical page.

## Giả thuyết tiếng Việt

- đố Kinh Thánh online; game Đố Kinh Thánh; trò chơi Đố Kinh Thánh online
- tạo game Đố Kinh Thánh; tạo câu hỏi Kinh Thánh online; quiz Kinh Thánh trực tuyến
- phòng chơi Đố Kinh Thánh; Đố Kinh Thánh realtime
- ô chữ Kinh Thánh; trò chơi ô chữ Kinh Thánh
- Đố Kinh Thánh cho Hội Thánh, Trường Chúa Nhật, thanh thiếu niên: chỉ roadmap, chưa publish landing riêng

## English hypotheses

- Bible quiz online; live Bible quiz; Bible quiz game; realtime Bible trivia
- create a Bible quiz; host a Bible quiz room
- Bible crossword game
- Bible quiz for church, Sunday school, youth: roadmap only, not separate published landing pages

## Mapping tiếng Việt

| Route | Intent / chủ đề chính | Câu hỏi phụ | Title / H1 / description direction | Links in → out | CTA | Schema | Trạng thái |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/vi/` | Điều hướng + đố Kinh Thánh online | Có cần tài khoản? Chơi thế nào? | `Đố Kinh Thánh Live – Tạo phòng và chơi realtime` / `Tạo game… thời gian thực` / room code + 2 mode + 4 type | sitewide → feature, how, modes, types, guides, FAQ | Mở builder | WebSite + WebApplication | Published; hypothesis |
| `/vi/tinh-nang/` | Tính năng game Đố Kinh Thánh | Builder, PWA, screen, reconnect | `Tính năng Đố Kinh Thánh Live` / `Những tính năng đã có…` / capabilities verified | home/footer → how, modes, types, privacy | Dùng tính năng | WebPage | Published; hypothesis |
| `/vi/cach-hoat-dong/` | Đố Kinh Thánh realtime hoạt động thế nào | Draft, room, score, delete | `…hoạt động như thế nào?` / `Từ bản nháp đến phòng…` / flow end-to-end | home/features → 2 guides, privacy | Bắt đầu tạo | WebPage | Published; hypothesis |
| `/vi/che-do-choi/` | Chế độ chơi Đố Kinh Thánh | Điểm, pause, tie | `Chế độ Theo lượt…` / `Chọn chế độ…` / compare scoring | home/features → how, types, host guide | Chọn mode | WebPage | Published; hypothesis |
| `/vi/dang-cau-hoi/` | Tạo câu hỏi Kinh Thánh online | Exact matching, 4 types | `Bốn dạng câu hỏi…` / `Bốn dạng…` / explain supported types | home/features → crossword, editorial, create guide | Soạn câu hỏi | LearningResource | Published; hypothesis |
| `/vi/dang-cau-hoi/o-chu-ngang-va-o-doc/` | Ô chữ Kinh Thánh | Rows, vertical key, scoring | `Ô chữ hàng ngang…` / `Cách hoạt động…` / 3–10 rows + double value | types → types, modes, create guide | Tạo ô chữ | LearningResource + Breadcrumb | Published; hypothesis |
| `/vi/huong-dan/` | Hướng dẫn Đố Kinh Thánh | Tạo hay host? | `Hướng dẫn dùng…` / `Hướng dẫn tạo game…` / two verified guides | home/footer → create, host | Mở builder | WebPage | Published; hypothesis |
| `/vi/huong-dan/tao-game-do-kinh-thanh/` | Tạo game Đố Kinh Thánh | Mode, question, file, preview | `Hướng dẫn tạo game…` / `Cách tạo…` / step-by-step | guides/types → types, modes, host, editorial | Tạo game | Article + Breadcrumb | Published; hypothesis |
| `/vi/huong-dan/to-chuc-phong-choi/` | Tổ chức phòng chơi | Link/token, reveal, delete | `Hướng dẫn tổ chức phòng…` / `Cách tổ chức…` / hosting checklist | guides/how → how, modes, privacy | Mở app | Article + Breadcrumb | Published; hypothesis |
| `/vi/cau-hoi-thuong-gap/` | FAQ Đố Kinh Thánh | Account, save, offline, TTL | `Câu hỏi thường gặp…` / `Câu hỏi thường gặp` / factual answers | home/footer → detailed canonical pages | Mở app | FAQPage | Published; hypothesis |
| `/vi/gioi-thieu/` | Đố Kinh Thánh Live là gì | Scope, no accounts/history | `Giới thiệu…` / `Về…` / product purpose | footer → features, editorial, privacy | Trải nghiệm | AboutPage | Published; hypothesis |
| `/vi/chinh-sach-bien-tap/` | Độ chính xác câu hỏi Kinh Thánh | Reference, translation, AI review | `Chính sách biên tập…` / `Chính sách… kiểm chứng` / review rules | footer/types → types, about, privacy | Soạn nội dung duyệt | WebPage | Published; hypothesis |
| `/vi/quyen-rieng-tu-va-vong-doi-du-lieu/` | Dữ liệu phòng và xóa | DO, sessionStorage, cache, analytics | `Quyền riêng tư…` / `Dữ liệu phòng… xóa cứng` / lifecycle | footer/how → how, about, editorial | Mở app | WebPage | Published; hypothesis |

## English mapping

| Route | Intent / primary topic | Secondary questions | Title / H1 / description direction | Links in → out | CTA | Schema | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `/en/` | Bible quiz online / live Bible quiz | Accounts, rooms, modes | `Bible Quiz Live – Create a Room…` / `Create a Bible quiz…` / code + modes + types | sitewide → features, how, modes, types, guides, FAQ | Open builder | WebSite + WebApplication | Published; hypothesis |
| `/en/features/` | Bible quiz features | Builder, PWA, screen | `Bible Quiz Live Features` / `Features available…` / verified capabilities | home/footer → how, modes, types, privacy | Use features | WebPage | Published; hypothesis |
| `/en/how-it-works/` | How a live Bible quiz works | Draft, scoring, deletion | `How Bible Quiz Live Works` / `From a draft…` / end-to-end flow | home/features → guides, privacy | Start building | WebPage | Published; hypothesis |
| `/en/game-modes/` | Turn-based vs fastest-answer | Score, pause, ties | `Turn-Based and Fastest-Answer…` / `Choose the right…` / compare | home/features → how, types, host guide | Choose mode | WebPage | Published; hypothesis |
| `/en/question-types/` | Bible quiz question types | Typed matching, four types | `Four Bible Quiz Question Types` / `Four supported…` / types | home/features → crossword, editorial, guide | Build question | LearningResource | Published; hypothesis |
| `/en/question-types/horizontal-and-special-vertical-crossword/` | Bible crossword game | Rows, vertical answer, score | `Horizontal Crossword Rows…` / `How the… works` / 3–10 rows | types → types, modes, guide | Create crossword | LearningResource + Breadcrumb | Published; hypothesis |
| `/en/guides/` | Bible quiz guides | Create or host? | `Bible Quiz Live Guides` / `Guides for building…` / guide index | home/footer → 2 guides | Open builder | WebPage | Published; hypothesis |
| `/en/guides/create-a-bible-quiz/` | Create a Bible quiz | Modes, questions, export | `How to Create a Bible Quiz` / same / step-by-step | guides/types → types, modes, host, editorial | Create quiz | Article + Breadcrumb | Published; hypothesis |
| `/en/guides/host-a-live-quiz-room/` | Host a Bible quiz room | Tokens, screen, finish | `How to Host…` / same / hosting checklist | guides/how → how, modes, privacy | Open app | Article + Breadcrumb | Published; hypothesis |
| `/en/faq/` | Bible Quiz Live FAQ | Accounts, storage, TTL | `Bible Quiz Live FAQ` / `Frequently asked questions` / factual answers | home/footer → detail pages | Open app | FAQPage | Published; hypothesis |
| `/en/about/` | About Bible Quiz Live | Purpose, current scope | `About Bible Quiz Live` / same / no accounts/history | footer → features, editorial, privacy | Try app | AboutPage | Published; hypothesis |
| `/en/editorial-policy/` | Bible content accuracy | References, copyright, AI | `Bible Content Editorial Policy` / `Editorial… policy` / verification | footer/types → types, about, privacy | Open builder | WebPage | Published; hypothesis |
| `/en/privacy-and-data-lifecycle/` | Live room privacy/deletion | DO, browser, cache | `Privacy and Live Room Data Lifecycle` / `Live room data…` / hard deletion | footer/how → how, about, editorial | Open app | WebPage | Published; hypothesis |

Title, H1 và description đầy đủ được type-check và test từ `site/content.ts`; thay đổi keyword map phải cập nhật page registry, test uniqueness và internal-link gate trong cùng pull request.
