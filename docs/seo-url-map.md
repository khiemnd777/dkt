# Bản đồ URL SEO

Base canonical: `https://dokinhthanh.io.vn`. Mọi route dưới đây index/follow, trả HTML tĩnh, tự canonical, vào sitemap và có alternate vi/en/x-default. `dateModified` chỉ đổi khi nội dung thay đổi đáng kể.

| Route | Locale | Mục đích | Alternate | Chủ đề chính | Schema | Redirect source |
| --- | --- | --- | --- | --- | --- | --- |
| `/vi/` | vi | Landing mặc định | `/en/` | Đố Kinh Thánh realtime | WebSite, WebPage, WebApplication | `/` |
| `/vi/tinh-nang/` | vi | Khả năng sản phẩm | `/en/features/` | Tính năng | WebPage | — |
| `/vi/cach-hoat-dong/` | vi | Luồng end-to-end | `/en/how-it-works/` | Cách hoạt động | WebPage | — |
| `/vi/che-do-choi/` | vi | So sánh mode | `/en/game-modes/` | Theo lượt / nhanh nhất | WebPage | — |
| `/vi/dang-cau-hoi/` | vi | Tổng quan question types | `/en/question-types/` | Bốn dạng câu hỏi | WebPage, LearningResource | — |
| `/vi/dang-cau-hoi/o-chu-ngang-va-o-doc/` | vi | Chi tiết crossword | `/en/question-types/horizontal-and-special-vertical-crossword/` | Ô chữ ngang/dọc | WebPage, LearningResource, BreadcrumbList | — |
| `/vi/huong-dan/` | vi | Index hướng dẫn | `/en/guides/` | Hướng dẫn | WebPage | — |
| `/vi/huong-dan/tao-game-do-kinh-thanh/` | vi | Guide tạo game | `/en/guides/create-a-bible-quiz/` | Tạo game | WebPage, Article, BreadcrumbList | — |
| `/vi/huong-dan/to-chuc-phong-choi/` | vi | Guide host | `/en/guides/host-a-live-quiz-room/` | Tổ chức phòng | WebPage, Article, BreadcrumbList | — |
| `/vi/cau-hoi-thuong-gap/` | vi | FAQ canonical | `/en/faq/` | Câu hỏi thường gặp | WebPage, FAQPage | — |
| `/vi/gioi-thieu/` | vi | Product scope/trust | `/en/about/` | Giới thiệu | AboutPage | — |
| `/vi/chinh-sach-bien-tap/` | vi | Content integrity | `/en/editorial-policy/` | Biên tập Kinh Thánh | WebPage | — |
| `/vi/quyen-rieng-tu-va-vong-doi-du-lieu/` | vi | Privacy/lifecycle | `/en/privacy-and-data-lifecycle/` | Xóa dữ liệu tạm | WebPage | `/privacy` |
| `/en/` | en | English landing | `/vi/` | Live Bible quiz | WebSite, WebPage, WebApplication | — |
| `/en/features/` | en | Product capabilities | `/vi/tinh-nang/` | Features | WebPage | — |
| `/en/how-it-works/` | en | End-to-end flow | `/vi/cach-hoat-dong/` | How it works | WebPage | — |
| `/en/game-modes/` | en | Mode comparison | `/vi/che-do-choi/` | Turn-based / fastest | WebPage | — |
| `/en/question-types/` | en | Question overview | `/vi/dang-cau-hoi/` | Four question types | WebPage, LearningResource | — |
| `/en/question-types/horizontal-and-special-vertical-crossword/` | en | Crossword detail | `/vi/dang-cau-hoi/o-chu-ngang-va-o-doc/` | Horizontal/vertical crossword | WebPage, LearningResource, BreadcrumbList | — |
| `/en/guides/` | en | Guide index | `/vi/huong-dan/` | Guides | WebPage | — |
| `/en/guides/create-a-bible-quiz/` | en | Creation guide | `/vi/huong-dan/tao-game-do-kinh-thanh/` | Create a Bible quiz | WebPage, Article, BreadcrumbList | — |
| `/en/guides/host-a-live-quiz-room/` | en | Hosting guide | `/vi/huong-dan/to-chuc-phong-choi/` | Host a live room | WebPage, Article, BreadcrumbList | — |
| `/en/faq/` | en | Canonical FAQ | `/vi/cau-hoi-thuong-gap/` | FAQ | WebPage, FAQPage | — |
| `/en/about/` | en | Product scope/trust | `/vi/gioi-thieu/` | About | AboutPage | — |
| `/en/editorial-policy/` | en | Content integrity | `/vi/chinh-sach-bien-tap/` | Editorial policy | WebPage | — |
| `/en/privacy-and-data-lifecycle/` | en | Privacy/lifecycle | `/vi/quyen-rieng-tu-va-vong-doi-du-lieu/` | Hard deletion | WebPage | — |

## Routes không index

- `https://game.dokinhthanh.io.vn/`, `/create`, `/create/preview`, `/join/:code`, `/play/:code`, `/host/:code`, `/screen/:code`: `X-Robots-Tag` và HTML meta `noindex,nofollow,noarchive,nosnippet`; không sitemap; shell dùng title chung, không chứa room code/nội dung.
- API: JSON/no-store, không phải HTML.
- Valid-shaped missing room: 410/no-store/noindex. Route sai: 404/no-store/noindex.
- `/create`, `/join/*`, `/play/*`, `/host/*`, `/screen/*` trên apex redirect thẳng sang `game.`; không có chain.
- `www` redirect 301 sang apex HTTPS, giữ path/query. HTTP redirect 308 sang HTTPS.
