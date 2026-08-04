import type { PublicPage } from "./types";

const REVIEW_DATE = "2026-08-04";

const vi = (page: Omit<PublicPage, "locale" | "dateModified" | "ogImageAlt">): PublicPage => ({
  ...page,
  locale: "vi",
  dateModified: REVIEW_DATE,
  ogImageAlt: "Đố Kinh Thánh Live — tạo phòng và chơi cùng nhau theo thời gian thực",
});

const en = (page: Omit<PublicPage, "locale" | "dateModified" | "ogImageAlt">): PublicPage => ({
  ...page,
  locale: "en",
  dateModified: REVIEW_DATE,
  ogImageAlt: "Bible Quiz Live — create a room and play together in real time",
});

export const PUBLIC_PAGES: PublicPage[] = [
  vi({
    translationKey: "home",
    path: "/vi/",
    kind: "home",
    title: "Đố Kinh Thánh Live – Tạo phòng và chơi realtime",
    description:
      "Tạo game Đố Kinh Thánh, mời người chơi bằng mã phòng và cùng thi đấu theo lượt hoặc đua tốc độ. Hỗ trợ trắc nghiệm, đúng/sai, điền đáp án và ô chữ.",
    h1: "Tạo game Đố Kinh Thánh và chơi cùng nhau theo thời gian thực",
    summary:
      "Đố Kinh Thánh Live là ứng dụng web không cần tài khoản: người dẫn soạn game, mở một phòng tạm thời, chia sẻ mã hoặc đường dẫn và điều khiển cuộc chơi trực tiếp cho cả nhóm.",
    audience:
      "Phù hợp cho người dẫn chương trình, giáo viên Trường Chúa Nhật và nhóm Hội Thánh muốn tự chuẩn bị nội dung rồi chơi đồng thời trên nhiều thiết bị.",
    sections: [
      {
        title: "Một luồng chơi rõ ràng",
        steps: [
          "Người dẫn tạo game bằng bốn dạng câu hỏi đã được hỗ trợ.",
          "Ứng dụng mở phòng và tạo mã gồm sáu ký tự cùng đường dẫn tham gia.",
          "Người chơi nhập tên hiển thị, chọn biểu tượng và trả lời trên thiết bị của mình.",
          "Người dẫn mở đáp án, bảng xếp hạng và hoàn tất game; phòng được xóa cứng theo vòng đời tạm thời.",
        ],
      },
      {
        title: "Hai cách thi đấu, cùng một nguyên tắc",
        paragraphs: [
          "Ở chế độ Theo lượt, mọi người trả lời đúng trong thời gian quy định nhận cùng mức điểm của vòng. Ở chế độ Ai trả lời nhanh nhất, mọi người trả lời đúng đều có điểm và câu trả lời nhanh hơn được nhiều điểm hơn.",
          "Điểm được tính ở máy chủ. Ứng dụng không tin thời gian hoặc điểm do trình duyệt gửi lên, nhờ đó luật chơi nhất quán cho cả phòng.",
        ],
      },
      {
        title: "Dữ liệu chỉ phục vụ phòng đang diễn ra",
        paragraphs: [
          "Không có tài khoản, thư viện game trên máy chủ hay bảng xếp hạng vĩnh viễn. Nội dung phòng, tên hiển thị và điểm số nằm trong Durable Object tạm thời rồi bị xóa cứng khi người dẫn xóa phòng, khi phòng hết hạn hoặc sau thời gian xem kết quả.",
        ],
      },
    ],
    faq: [
      {
        question: "Người chơi có cần tạo tài khoản không?",
        answer: "Không. Người chơi dùng mã phòng hoặc đường dẫn, nhập tên hiển thị và tham gia.",
      },
      {
        question: "Có thể lưu game để chỉnh sửa tiếp không?",
        answer:
          "Bản nháp được giữ trong sessionStorage của tab. Người tạo cũng có thể tải file .dkt.json về thiết bị và nhập lại sau; ứng dụng không tạo thư viện game lâu dài trên máy chủ.",
      },
    ],
    related: [
      "/vi/tinh-nang/",
      "/vi/cach-hoat-dong/",
      "/vi/che-do-choi/",
      "/vi/dang-cau-hoi/",
      "/vi/huong-dan/",
      "/vi/cau-hoi-thuong-gap/",
    ],
    ctaLabel: "Mở trình tạo game",
  }),
  vi({
    translationKey: "features",
    path: "/vi/tinh-nang/",
    kind: "webpage",
    title: "Tính năng Đố Kinh Thánh Live",
    description:
      "Khám phá trình tạo game, phòng realtime, bốn dạng câu hỏi, hai chế độ thi đấu, màn hình trình chiếu và vòng đời dữ liệu tạm thời.",
    h1: "Những tính năng đã có trong Đố Kinh Thánh Live",
    summary:
      "Đố Kinh Thánh Live kết hợp trình soạn game trong trình duyệt, phòng chơi realtime và ba giao diện tách biệt cho người dẫn, người chơi và màn hình trình chiếu.",
    audience:
      "Trang này giúp người tổ chức kiểm tra nhanh khả năng hiện có trước khi chuẩn bị chương trình.",
    sections: [
      {
        title: "Soạn và kiểm tra game",
        bullets: [
          "Tạo trắc nghiệm, đúng/sai, điền đáp án và ô chữ ngay trong trình duyệt.",
          "Xem thử câu hỏi trên bố cục điện thoại hoặc máy tính trước khi mở phòng.",
          "Tự khôi phục bản nháp trong phiên tab và tải–nhập file cấu hình .dkt.json.",
          "Không cần tài khoản và không tải file cấu hình lên máy chủ khi xuất file.",
        ],
      },
      {
        title: "Điều khiển một phòng trực tiếp",
        bullets: [
          "Mã phòng, đường dẫn tham gia và mã QR để chia sẻ.",
          "Phiên người dẫn, người chơi và màn hình trình chiếu có quyền riêng biệt.",
          "Tạm dừng, tiếp tục hoặc khóa câu hỏi sớm từ bảng điều khiển người dẫn.",
          "Kết nối lại trong cùng phiên tab bằng token tạm; token dài hạn không nằm trong query WebSocket.",
        ],
      },
      {
        title: "Hiển thị kết quả và hỗ trợ thiết bị",
        paragraphs: [
          "Bảng xếp hạng được cập nhật trong luồng chơi và hiển thị kết quả chung cuộc. Giao diện hỗ trợ màn hình hẹp, bàn phím, focus rõ, aria-live và tùy chọn giảm chuyển động.",
          "Vỏ PWA có thể được cài đặt, nhưng gameplay luôn cần mạng và dữ liệu phòng không được cache để chơi offline.",
        ],
      },
    ],
    related: [
      "/vi/cach-hoat-dong/",
      "/vi/che-do-choi/",
      "/vi/dang-cau-hoi/",
      "/vi/quyen-rieng-tu-va-vong-doi-du-lieu/",
    ],
    ctaLabel: "Dùng các tính năng trong trình tạo",
  }),
  vi({
    translationKey: "how-it-works",
    path: "/vi/cach-hoat-dong/",
    kind: "webpage",
    title: "Đố Kinh Thánh Live hoạt động như thế nào?",
    description:
      "Tìm hiểu luồng tạo game, mở phòng, mời người chơi, điều khiển câu hỏi, tính điểm và xóa dữ liệu của Đố Kinh Thánh Live.",
    h1: "Từ bản nháp đến phòng Đố Kinh Thánh trực tiếp",
    summary:
      "Người dẫn soạn game trên thiết bị của mình, gửi định nghĩa game hợp lệ để tạo phòng, rồi điều khiển từng vòng qua kết nối realtime; Durable Object của phòng là nguồn dữ liệu duy nhất ở máy chủ.",
    audience:
      "Dành cho người muốn hiểu luồng kỹ thuật và vận hành trước khi tổ chức một buổi chơi.",
    sections: [
      {
        title: "1. Chuẩn bị nội dung",
        paragraphs: [
          "Trình tạo giữ bản nháp trong sessionStorage của tab. Người tạo chọn chế độ, thời lượng mặc định và thêm các câu hỏi; bản xem thử giúp kiểm tra nội dung mà chưa tạo phòng.",
        ],
      },
      {
        title: "2. Tạo và chia sẻ phòng",
        paragraphs: [
          "Khi game hợp lệ, máy chủ sinh mã phòng ngẫu nhiên, token riêng cho người dẫn và màn hình, cùng đường dẫn tham gia công khai. Token quyền cao nằm trong fragment URL, được chuyển vào sessionStorage rồi xóa khỏi thanh địa chỉ.",
        ],
      },
      {
        title: "3. Chơi theo vòng",
        paragraphs: [
          "Mỗi người chơi đang hoạt động được trả lời một lần cho mỗi vòng áp dụng. Máy chủ mở deadline, xác thực đáp án, tính điểm và chỉ công bố đáp án khi người dẫn chuyển sang bước reveal.",
        ],
      },
      {
        title: "4. Kết thúc và xóa",
        paragraphs: [
          "Sau game, bảng kết quả được giữ tạm trong năm phút. Người dẫn có thể xóa ngay; phòng không hoạt động cũng có giới hạn hết hạn. Quá trình xóa đóng kết nối và gọi xóa toàn bộ storage của Durable Object.",
        ],
      },
    ],
    related: [
      "/vi/huong-dan/tao-game-do-kinh-thanh/",
      "/vi/huong-dan/to-chuc-phong-choi/",
      "/vi/quyen-rieng-tu-va-vong-doi-du-lieu/",
    ],
    ctaLabel: "Bắt đầu tạo một game",
  }),
  vi({
    translationKey: "game-modes",
    path: "/vi/che-do-choi/",
    kind: "webpage",
    title: "Chế độ Theo lượt và Ai trả lời nhanh nhất",
    description:
      "So sánh hai chế độ chơi của Đố Kinh Thánh Live: Theo lượt và Ai trả lời nhanh nhất, gồm cách tính điểm và tình huống phù hợp.",
    h1: "Chọn chế độ chơi phù hợp với nhóm",
    summary:
      "Đố Kinh Thánh Live có hai chế độ multiplayer: Theo lượt cho điểm bằng nhau với mọi đáp án đúng trong vòng, còn Ai trả lời nhanh nhất cho mọi đáp án đúng có điểm nhưng ưu tiên tốc độ.",
    audience:
      "Dành cho người dẫn cần chọn nhịp độ công bằng với mục tiêu học tập hoặc tạo không khí thi đua nhanh.",
    sections: [
      {
        title: "Theo lượt",
        paragraphs: [
          "Mỗi đáp án đúng trong thời gian quy định nhận 1.000 điểm ở vòng thường hoặc hàng ngang ô chữ. Từ khóa dọc đặc biệt nhận 2.000 điểm. Tốc độ không làm thay đổi điểm.",
          "Chế độ này phù hợp khi người dẫn muốn người chơi tập trung vào độ chính xác và có đủ thời gian đọc câu hỏi.",
        ],
      },
      {
        title: "Ai trả lời nhanh nhất",
        paragraphs: [
          "Mọi người trả lời đúng đều nhận điểm. Vòng thường nằm trong khoảng 500–1.000 điểm; từ khóa dọc trong khoảng 1.000–2.000 điểm. Điểm giảm theo thời gian phản hồi và được làm tròn đến 10 điểm.",
          "Thời gian tạm dừng không bị tính vào tốc độ. Khi bằng điểm, số câu đúng và tổng thời gian phản hồi được dùng để phân hạng trong chế độ này.",
        ],
      },
      {
        title: "Điểm chung cần nhớ",
        bullets: [
          "Mỗi người chơi chỉ gửi một đáp án cho mỗi vòng áp dụng.",
          "Đáp án gửi sau deadline bị từ chối ở máy chủ.",
          "Người vào giữa game bắt đầu từ vòng đủ điều kiện tiếp theo.",
          "Điểm bằng nhau dùng competition rank, ví dụ 1, 1, 3.",
        ],
      },
    ],
    related: ["/vi/cach-hoat-dong/", "/vi/dang-cau-hoi/", "/vi/huong-dan/to-chuc-phong-choi/"],
    ctaLabel: "Chọn chế độ trong trình tạo",
  }),
  vi({
    translationKey: "question-types",
    path: "/vi/dang-cau-hoi/",
    kind: "question-type",
    title: "Bốn dạng câu hỏi trong Đố Kinh Thánh Live",
    description:
      "Tìm hiểu trắc nghiệm, đúng/sai, điền đáp án và ô chữ hàng ngang với một từ khóa dọc đặc biệt trong Đố Kinh Thánh Live.",
    h1: "Bốn dạng câu hỏi đã được hỗ trợ",
    summary:
      "Trình tạo hiện hỗ trợ trắc nghiệm một đáp án, đúng/sai, điền đáp án khớp chính xác và ô chữ gồm nhiều hàng ngang cùng một từ khóa dọc đặc biệt.",
    audience:
      "Dành cho người soạn muốn phối hợp nhiều cách trả lời mà không công bố nội dung câu hỏi ra website public.",
    sections: [
      {
        title: "Trắc nghiệm và Đúng/Sai",
        paragraphs: [
          "Trắc nghiệm cho phép đặt các lựa chọn và xác định một lựa chọn đúng. Dạng Đúng/Sai đưa ra một nhận định để người chơi chọn giá trị đúng hoặc sai. Máy chủ kiểm tra loại đáp án, không chuyển một chuỗi văn bản thành đáp án đúng/sai.",
        ],
      },
      {
        title: "Điền đáp án",
        paragraphs: [
          "Người soạn nhập đáp án chuẩn và các cách viết thay thế rõ ràng. Khi chấm, ứng dụng chuẩn hóa chữ hoa, dấu tiếng Việt, khoảng trắng và dấu câu rồi so khớp chính xác; không dùng fuzzy matching hoặc AI để đoán ý.",
        ],
      },
      {
        title: "Ô chữ hàng ngang và từ khóa dọc",
        paragraphs: [
          "Mỗi ô chữ có từ ba đến mười hàng ngang. Một ký tự được chọn từ mỗi đáp án hàng ngang để tạo thành từ khóa dọc; các hàng được mở lần lượt trước khi vòng từ khóa dọc bắt đầu.",
        ],
      },
      {
        title: "Trách nhiệm biên tập",
        paragraphs: [
          "Ứng dụng không cung cấp sẵn kho câu hỏi Kinh Thánh. Người soạn chịu trách nhiệm kiểm tra câu hỏi, đáp án, tham chiếu câu Kinh Thánh và quyền sử dụng bản dịch trước khi chơi.",
        ],
      },
    ],
    related: [
      "/vi/dang-cau-hoi/o-chu-ngang-va-o-doc/",
      "/vi/chinh-sach-bien-tap/",
      "/vi/huong-dan/tao-game-do-kinh-thanh/",
    ],
    ctaLabel: "Soạn câu hỏi trong trình tạo",
  }),
  vi({
    translationKey: "crossword",
    path: "/vi/dang-cau-hoi/o-chu-ngang-va-o-doc/",
    kind: "question-type",
    title: "Ô chữ hàng ngang và một từ khóa dọc đặc biệt",
    description:
      "Cách hoạt động của dạng ô chữ Đố Kinh Thánh gồm 3–10 hàng ngang, ký tự giao nhau và một vòng từ khóa dọc nhân đôi điểm.",
    h1: "Cách hoạt động của ô chữ hàng ngang và từ khóa dọc",
    summary:
      "Một câu hỏi ô chữ trong Đố Kinh Thánh Live tạo nhiều vòng hàng ngang, sau đó ghép một ký tự đã chọn ở mỗi hàng thành từ khóa dọc đặc biệt có hệ số điểm gấp đôi.",
    audience: "Dành cho người soạn muốn tạo một chuỗi gợi ý liên kết thay vì các câu hỏi độc lập.",
    sections: [
      {
        title: "Cấu trúc ô chữ",
        bullets: [
          "Mỗi ô chữ có từ 3 đến 10 hàng ngang.",
          "Mỗi hàng có gợi ý, đáp án, alias tùy chọn và vị trí ký tự đặc biệt.",
          "Các ô dùng grapheme nên ký tự tiếng Việt có dấu được hiển thị như một ô.",
          "Các ký tự đặc biệt tự căn về cùng một cột trên bảng.",
        ],
      },
      {
        title: "Trình tự chơi",
        steps: [
          "Người chơi trả lời hàng ngang đang mở.",
          "Người dẫn khóa vòng, mở đáp án và xem bảng xếp hạng.",
          "Ứng dụng chuyển sang hàng kế tiếp và giữ các hàng đã reveal trên bảng.",
          "Sau hàng cuối, người chơi trả lời gợi ý từ khóa dọc.",
        ],
      },
      {
        title: "Chấm điểm và giới hạn",
        paragraphs: [
          "Hàng ngang dùng điểm vòng thường. Từ khóa dọc dùng hệ số 2 ở cả hai chế độ chơi. Đáp án điền được chuẩn hóa và so khớp chính xác với đáp án hoặc alias do người soạn khai báo.",
          "Người soạn nên kiểm tra vị trí ký tự đặc biệt và xem thử cả bố cục điện thoại lẫn màn hình lớn trước khi mở phòng.",
        ],
      },
    ],
    faq: [
      {
        question: "Có thể đoán từ khóa dọc trước khi mở hết hàng ngang không?",
        answer:
          "Luồng hiện tại mở vòng từ khóa dọc sau khi các vòng hàng ngang đã hoàn tất; đây không phải cơ chế giành quyền đoán sớm.",
      },
      {
        question: "Ứng dụng có tự tạo ô chữ từ câu Kinh Thánh không?",
        answer:
          "Không. Người soạn tự nhập gợi ý, đáp án, vị trí ký tự và từ khóa dọc rồi xem thử trước khi tạo phòng.",
      },
    ],
    related: ["/vi/dang-cau-hoi/", "/vi/che-do-choi/", "/vi/huong-dan/tao-game-do-kinh-thanh/"],
    ctaLabel: "Tạo một câu hỏi ô chữ",
  }),
  vi({
    translationKey: "guides",
    path: "/vi/huong-dan/",
    kind: "guide-index",
    title: "Hướng dẫn dùng Đố Kinh Thánh Live",
    description:
      "Các hướng dẫn đã kiểm chứng để tạo game Đố Kinh Thánh và tổ chức một phòng chơi trực tiếp từ lúc chuẩn bị đến khi xóa dữ liệu.",
    h1: "Hướng dẫn tạo game và tổ chức phòng chơi",
    summary:
      "Bộ hướng dẫn hiện có bao quát hai công việc chính: soạn một game hợp lệ trong trình tạo và vận hành phòng realtime cho người chơi cùng tham gia.",
    audience: "Dành cho người lần đầu sử dụng hoặc cần một checklist ngắn trước chương trình.",
    sections: [
      {
        title: "Tạo game Đố Kinh Thánh",
        paragraphs: [
          "Chọn chế độ, thêm câu hỏi, kiểm tra đáp án và dùng bản xem thử trước khi mở phòng. Hướng dẫn cũng giải thích bản nháp trong tab và file cấu hình do người dùng tự quản lý.",
        ],
      },
      {
        title: "Tổ chức phòng chơi trực tiếp",
        paragraphs: [
          "Chuẩn bị màn hình, chia sẻ đúng link, kiểm soát deadline, xử lý kết nối lại, hoàn tất bảng xếp hạng và xác nhận xóa phòng theo đúng vòng đời.",
        ],
      },
    ],
    related: ["/vi/huong-dan/tao-game-do-kinh-thanh/", "/vi/huong-dan/to-chuc-phong-choi/"],
    ctaLabel: "Mở trình tạo game",
  }),
  vi({
    translationKey: "create-guide",
    path: "/vi/huong-dan/tao-game-do-kinh-thanh/",
    kind: "guide",
    title: "Hướng dẫn tạo game Đố Kinh Thánh",
    description:
      "Từng bước tạo game Đố Kinh Thánh: chọn chế độ, soạn bốn dạng câu hỏi, xem thử, lưu file cấu hình và mở phòng realtime.",
    h1: "Cách tạo một game Đố Kinh Thánh",
    summary:
      "Mở trình tạo, đặt tên và chế độ, thêm câu hỏi với đáp án đã kiểm tra, xem thử trên nhiều kích thước rồi chỉ tạo phòng khi cấu hình hợp lệ.",
    audience: "Dành cho người chịu trách nhiệm chuẩn bị nội dung và đáp án trước buổi nhóm.",
    datePublished: REVIEW_DATE,
    sections: [
      {
        title: "1. Chọn nhịp thi đấu",
        paragraphs: [
          "Dùng Theo lượt nếu ưu tiên độ chính xác và điểm bằng nhau; dùng Ai trả lời nhanh nhất nếu muốn tốc độ ảnh hưởng đến điểm. Chọn thời lượng mặc định phù hợp với độ dài câu hỏi.",
        ],
      },
      {
        title: "2. Soạn từng câu hỏi",
        steps: [
          "Chọn một trong bốn dạng câu hỏi đã hỗ trợ.",
          "Viết câu dẫn rõ nghĩa và điền đáp án hoặc lựa chọn đúng.",
          "Với điền đáp án, chỉ thêm alias thực sự được chấp nhận.",
          "Với ô chữ, kiểm tra từng hàng, vị trí ký tự đặc biệt và từ khóa dọc.",
        ],
      },
      {
        title: "3. Kiểm tra nội dung và hiển thị",
        paragraphs: [
          "Dùng bản xem thử để kiểm tra thứ tự, thời lượng và bố cục. Với nội dung Kinh Thánh, kiểm tra tham chiếu, bản dịch và chính tả; ứng dụng không tự xác nhận độ chính xác thần học.",
        ],
      },
      {
        title: "4. Giữ bản nháp khi cần",
        paragraphs: [
          "Bản nháp tự lưu trong sessionStorage của tab. Để chuyển thiết bị hoặc làm tiếp vào ngày khác, tải file .dkt.json và tự bảo quản file. Khi nhập file, ứng dụng kiểm tra định dạng và hỏi trước khi thay nội dung đang mở.",
        ],
      },
      {
        title: "5. Tạo phòng",
        paragraphs: [
          "Khi validation thành công, ứng dụng gửi định nghĩa game lên máy chủ để tạo Durable Object tạm thời. Bản nháp trong tab được xóa sau khi tạo phòng thành công.",
        ],
      },
    ],
    related: [
      "/vi/dang-cau-hoi/",
      "/vi/che-do-choi/",
      "/vi/huong-dan/to-chuc-phong-choi/",
      "/vi/chinh-sach-bien-tap/",
    ],
    ctaLabel: "Tạo game theo hướng dẫn",
  }),
  vi({
    translationKey: "host-guide",
    path: "/vi/huong-dan/to-chuc-phong-choi/",
    kind: "guide",
    title: "Hướng dẫn tổ chức phòng Đố Kinh Thánh trực tiếp",
    description:
      "Checklist mở phòng, mời người chơi, dùng màn hình trình chiếu, điều khiển từng vòng, xử lý kết nối và xóa phòng sau game.",
    h1: "Cách tổ chức một phòng Đố Kinh Thánh trực tiếp",
    summary:
      "Sau khi tạo phòng, giữ riêng link khôi phục của người dẫn, chỉ chia sẻ link hoặc mã tham gia cho người chơi, rồi điều khiển countdown, reveal và bảng xếp hạng từ phiên host.",
    audience: "Dành cho người điều phối chương trình và người hỗ trợ màn hình trình chiếu.",
    datePublished: REVIEW_DATE,
    sections: [
      {
        title: "Trước khi bắt đầu",
        bullets: [
          "Kiểm tra mạng trên thiết bị người dẫn và màn hình trình chiếu.",
          "Mở link screen riêng; không chiếu link host có token bí mật.",
          "Chỉ gửi mã phòng, QR hoặc link join cho người chơi.",
          "Nhắc người chơi dùng tên hiển thị phù hợp vì tên sẽ xuất hiện trong phòng.",
        ],
      },
      {
        title: "Trong mỗi vòng",
        steps: [
          "Bắt đầu game và chờ countdown mở câu hỏi.",
          "Theo dõi số người đã trả lời mà không nhìn thấy đáp án riêng trước reveal.",
          "Tạm dừng khi cần; thời gian pause được loại khỏi response time.",
          "Khóa câu, hiện đáp án, rồi hiện bảng xếp hạng trước khi sang vòng mới.",
        ],
      },
      {
        title: "Kết nối lại và link khôi phục",
        paragraphs: [
          "Phiên host, screen và player giữ token trong sessionStorage của tab để kết nối lại. Link khôi phục host là bí mật toàn quyền; không đưa link đó vào chat công khai hoặc ảnh chụp màn hình.",
        ],
      },
      {
        title: "Kết thúc an toàn",
        paragraphs: [
          "Hoàn tất game để hiển thị kết quả chung cuộc. Kết quả được giữ năm phút rồi phòng bị xóa cứng; người dẫn có thể xác nhận kết thúc và xóa ngay. Sau xóa, mã phòng không thể khôi phục.",
        ],
      },
    ],
    related: ["/vi/cach-hoat-dong/", "/vi/che-do-choi/", "/vi/quyen-rieng-tu-va-vong-doi-du-lieu/"],
    ctaLabel: "Mở ứng dụng phòng chơi",
  }),
  vi({
    translationKey: "faq",
    path: "/vi/cau-hoi-thuong-gap/",
    kind: "faq",
    title: "Câu hỏi thường gặp về Đố Kinh Thánh Live",
    description:
      "Giải đáp về tài khoản, lưu game, loại câu hỏi, chế độ chơi, kết nối, dữ liệu tạm thời, quyền riêng tư và xóa phòng.",
    h1: "Câu hỏi thường gặp",
    summary:
      "Các câu trả lời dưới đây mô tả đúng phiên bản hiện tại của Đố Kinh Thánh Live; phòng chơi là tạm thời và không trở thành trang nội dung công khai.",
    audience:
      "Dành cho người tạo game, người dẫn và người chơi cần kiểm tra nhanh một giới hạn cụ thể.",
    sections: [],
    faq: [
      {
        question: "Có cần tài khoản để tạo hoặc chơi không?",
        answer: "Không. Ứng dụng hiện không có hệ thống tài khoản.",
      },
      {
        question: "Game có được lưu trong thư viện trên máy chủ không?",
        answer:
          "Không. Bản nháp chỉ ở sessionStorage của tab; file .dkt.json do người dùng tải về và tự quản lý là cách lưu lâu hơn.",
        href: "/vi/huong-dan/tao-game-do-kinh-thanh/",
        hrefLabel: "Xem hướng dẫn tạo game",
      },
      {
        question: "Những dạng câu hỏi nào đang có?",
        answer:
          "Trắc nghiệm, Đúng/Sai, điền đáp án và ô chữ hàng ngang với một từ khóa dọc đặc biệt.",
        href: "/vi/dang-cau-hoi/",
        hrefLabel: "Xem chi tiết bốn dạng câu hỏi",
      },
      {
        question: "Người trả lời đúng nhưng chậm có được điểm không?",
        answer:
          "Có. Theo lượt cho cùng điểm với mọi đáp án đúng. Ai trả lời nhanh nhất vẫn cho mọi đáp án đúng có điểm, nhưng câu trả lời nhanh hơn nhận nhiều hơn.",
        href: "/vi/che-do-choi/",
        hrefLabel: "So sánh hai chế độ",
      },
      {
        question: "Game có chơi offline được không?",
        answer: "Không. Vỏ PWA có thể cài đặt nhưng phòng realtime luôn cần kết nối mạng.",
      },
      {
        question: "Phòng tồn tại bao lâu?",
        answer:
          "Phòng đang hoạt động hết hạn sau hai giờ không có hoạt động host và có tuổi thọ tuyệt đối sáu giờ. Sau khi hoàn tất, kết quả được giữ năm phút trước khi xóa.",
      },
      {
        question: "Dữ liệu phòng có thể khôi phục sau khi xóa không?",
        answer:
          "Không. Ứng dụng gọi deleteAll trên storage của Durable Object; không có soft delete hoặc kho lưu trữ khôi phục.",
        href: "/vi/quyen-rieng-tu-va-vong-doi-du-lieu/",
        hrefLabel: "Đọc vòng đời dữ liệu",
      },
      {
        question: "Ứng dụng có tự kiểm chứng câu hỏi Kinh Thánh không?",
        answer:
          "Không. Người soạn phải kiểm tra nội dung, tham chiếu và bản dịch. Chính sách biên tập mô tả cách chuẩn bị nội dung trước khi công bố.",
        href: "/vi/chinh-sach-bien-tap/",
        hrefLabel: "Đọc chính sách biên tập",
      },
    ],
    related: ["/vi/tinh-nang/", "/vi/huong-dan/", "/vi/quyen-rieng-tu-va-vong-doi-du-lieu/"],
    ctaLabel: "Mở Đố Kinh Thánh Live",
  }),
  vi({
    translationKey: "about",
    path: "/vi/gioi-thieu/",
    kind: "about",
    title: "Giới thiệu Đố Kinh Thánh Live",
    description:
      "Đố Kinh Thánh Live là ứng dụng web song ngữ để tự soạn game, tạo phòng tạm thời và chơi realtime mà không cần tài khoản.",
    h1: "Về Đố Kinh Thánh Live",
    summary:
      "Đố Kinh Thánh Live là một ứng dụng web tập trung vào một vòng chơi ngắn gọn: tự soạn nội dung, mở phòng, cùng trả lời, xem kết quả và xóa dữ liệu tạm thời.",
    audience:
      "Trang này dành cho người muốn hiểu mục tiêu, phạm vi và những điều sản phẩm chủ ý không lưu giữ.",
    sections: [
      {
        title: "Mục tiêu sản phẩm",
        paragraphs: [
          "Ứng dụng giúp một nhóm cùng tham gia game Kinh Thánh trên thiết bị riêng trong khi người dẫn kiểm soát tiến trình và một màn hình chung hiển thị trạng thái. Trọng tâm là vận hành gọn, dễ tham gia và tiết kiệm tài nguyên Cloudflare Free.",
        ],
      },
      {
        title: "Phạm vi hiện tại",
        bullets: [
          "Không có tài khoản, hồ sơ người dùng hoặc dashboard lịch sử.",
          "Không có kho câu hỏi Kinh Thánh được xuất bản tự động.",
          "Không có thư viện game lâu dài trên máy chủ.",
          "Không có quảng cáo hoặc SDK analytics trong mã nguồn hiện tại.",
        ],
      },
      {
        title: "Minh bạch thông tin",
        paragraphs: [
          "Các trang public chỉ mô tả hành vi đã xác minh từ mã nguồn. Không công bố số người dùng, đánh giá, chứng nhận, tổ chức xuất bản hoặc lời chứng thực khi chưa có dữ liệu thật.",
        ],
      },
    ],
    related: [
      "/vi/tinh-nang/",
      "/vi/chinh-sach-bien-tap/",
      "/vi/quyen-rieng-tu-va-vong-doi-du-lieu/",
    ],
    ctaLabel: "Trải nghiệm ứng dụng",
  }),
  vi({
    translationKey: "editorial-policy",
    path: "/vi/chinh-sach-bien-tap/",
    kind: "editorial",
    title: "Chính sách biên tập nội dung Kinh Thánh",
    description:
      "Nguyên tắc kiểm tra câu hỏi, tham chiếu Kinh Thánh, bản dịch, bản quyền, nội dung có AI hỗ trợ, ngày cập nhật và quy trình sửa lỗi.",
    h1: "Chính sách biên tập và kiểm chứng nội dung",
    summary:
      "Nội dung Kinh Thánh chỉ nên được đưa vào game hoặc website sau khi con người kiểm tra câu hỏi, đáp án, tham chiếu, ngữ cảnh và quyền sử dụng bản dịch; AI không phải là người duyệt cuối.",
    audience: "Dành cho người soạn game và người phụ trách nội dung public của dự án.",
    sections: [
      {
        title: "Kiểm tra nội dung Kinh Thánh",
        bullets: [
          "Ghi tham chiếu sách, chương và câu khi câu hỏi phụ thuộc vào một phân đoạn cụ thể.",
          "Xác định bản dịch nếu trích nguyên văn và kiểm tra điều khoản bản quyền của bản dịch đó.",
          "Ưu tiên tham chiếu thay vì sao chép đoạn dài có bản quyền.",
          "Không suy diễn một cách hiểu thần học thành dữ kiện duy nhất khi câu hỏi có thể gây tranh luận.",
        ],
      },
      {
        title: "Tác giả, người duyệt và trạng thái",
        paragraphs: [
          "Chỉ ghi tên tác giả hoặc người duyệt khi có danh tính thật và sự đồng ý công bố. Nội dung chưa được duyệt phải ở trạng thái draft/noindex và không vào sitemap. Không tạo nhân vật, chức danh hoặc chuyên môn giả.",
        ],
      },
      {
        title: "AI hỗ trợ và bản dịch ngôn ngữ",
        paragraphs: [
          "AI có thể hỗ trợ dàn ý hoặc diễn đạt, nhưng người chịu trách nhiệm phải đối chiếu lại từng claim. Bản tiếng Anh cần được bản địa hóa tự nhiên và kiểm tra độc lập, không xuất bản bản dịch máy chưa duyệt.",
        ],
      },
      {
        title: "Ngày và sửa lỗi",
        paragraphs: [
          "datePublished là ngày xuất bản thật; dateModified chỉ đổi khi nội dung thay đổi đáng kể, không đổi theo mỗi build. Khi phát hiện lỗi, tạm gỡ nội dung có rủi ro, sửa nguồn, cập nhật ngày và ghi lại phạm vi chỉnh sửa trong lịch sử repository.",
          "Repository hiện chưa cấu hình kênh liên hệ công khai; không hiển thị địa chỉ giả. Chủ sở hữu cần thêm phương thức liên hệ thật trước khi quảng bá quy trình tiếp nhận sửa lỗi bên ngoài.",
        ],
      },
      {
        title: "Những cách xuất bản bị cấm",
        bullets: [
          "Không tạo hàng loạt trang mỏng theo từ khóa, sách, chương, phòng hoặc người chơi.",
          "Không nhồi từ khóa, che chữ, tạo FAQ ẩn hoặc schema không khớp nội dung.",
          "Không dùng đánh giá, số liệu, ngày, tác giả hoặc trích dẫn không có bằng chứng.",
        ],
      },
    ],
    related: ["/vi/dang-cau-hoi/", "/vi/gioi-thieu/", "/vi/quyen-rieng-tu-va-vong-doi-du-lieu/"],
    ctaLabel: "Mở trình tạo để soạn nội dung đã duyệt",
  }),
  vi({
    translationKey: "privacy",
    path: "/vi/quyen-rieng-tu-va-vong-doi-du-lieu/",
    kind: "privacy",
    title: "Quyền riêng tư và vòng đời dữ liệu phòng chơi",
    description:
      "Thông tin tạm thời, Durable Object SQLite, sessionStorage, thời điểm xóa cứng, cache, analytics và những store không được dùng trong Đố Kinh Thánh Live.",
    h1: "Dữ liệu phòng là tạm thời và được xóa cứng",
    summary:
      "Đố Kinh Thánh Live không có tài khoản hoặc lịch sử game: dữ liệu phòng được lưu tạm trong SQLite-backed Durable Object, rồi deleteAll khi host xóa, phòng hết hạn hoặc hết năm phút xem kết quả.",
    audience:
      "Dành cho người tổ chức và người chơi muốn biết chính xác dữ liệu nào được tạo, nằm ở đâu và khi nào biến mất.",
    sections: [
      {
        title: "Dữ liệu được tạo trong một phòng",
        bullets: [
          "Định nghĩa game gồm tiêu đề, câu hỏi, lựa chọn và đáp án do người tạo gửi lên.",
          "Tên hiển thị, biểu tượng, token đã băm, trạng thái kết nối, đáp án đã chấm và điểm của người chơi.",
          "Tiến trình vòng, deadline, bảng xếp hạng và vé WebSocket dùng một lần.",
          "Ứng dụng hiện không hỗ trợ tải ảnh lên máy chủ và không lưu email hoặc số điện thoại.",
        ],
      },
      {
        title: "Nơi dữ liệu tạm thời được lưu",
        paragraphs: [
          "Máy chủ dùng một SQLite-backed Durable Object cho mỗi mã phòng. Repository hiện không có binding Cloudflare D1 hoặc R2, vì vậy không có bản ghi D1 hay object ảnh R2 cần xóa. Raw text của câu trả lời ngắn chỉ tồn tại đủ để chuẩn hóa và chấm, không được ghi vào storage.",
          "Trình duyệt dùng sessionStorage cho bản nháp, token phiên và tùy chọn feedback. Không dùng localStorage hoặc IndexedDB cho dữ liệu phòng. File .dkt.json do người dùng tải xuống nằm ngoài quyền xóa của ứng dụng.",
        ],
      },
      {
        title: "Khi nào xóa xảy ra",
        bullets: [
          "Người dẫn có thể xác nhận kết thúc và xóa ngay.",
          "Phòng active bị xóa sau hai giờ không có hoạt động host.",
          "Mọi phòng có tuổi thọ tuyệt đối sáu giờ.",
          "Sau khi hoàn tất bình thường, kết quả được giữ năm phút và cảnh báo ở phút cuối trước khi xóa.",
        ],
      },
      {
        title: "Xóa cứng, cache và trình duyệt",
        paragraphs: [
          "Cleanup chuyển phòng sang DELETING, phát sự kiện, đóng WebSocket rồi gọi deleteAll trên storage. Không có soft delete hoặc archive khôi phục. Việc xóa Durable Object là thao tác nền tảng có thể cần thời gian để nhất quán hoàn toàn; ứng dụng không hứa xóa tức thời ở mọi lớp hạ tầng Cloudflare.",
          "API và phản hồi theo phòng dùng Cache-Control: no-store; service worker không cache /api/*. Vì dữ liệu riêng không được đưa vào CDN cache, không có object nội dung phòng cần purge. Static app shell và tài liệu public có thể được CDN cache nhưng không chứa mã phòng, tên người chơi hoặc đáp án.",
          "Khi client nhận sự kiện xóa, token phiên của vai trò hiện tại được xóa khỏi sessionStorage; sessionStorage còn lại tự mất khi đóng tab. Bản nháp builder được xóa sau create-room thành công.",
        ],
      },
      {
        title: "Analytics và metadata nền tảng",
        paragraphs: [
          "Mã nguồn hiện không cài SDK analytics hoặc quảng cáo. Nếu sau này đo Core Web Vitals hay CTA, cấu hình không được gửi mã phòng, token, tên, câu hỏi, đáp án, URL ảnh hoặc nội dung tự do. Cloudflare vẫn có thể xử lý metadata vận hành ở cấp nền tảng theo chính sách của họ.",
        ],
      },
    ],
    related: ["/vi/cach-hoat-dong/", "/vi/gioi-thieu/", "/vi/chinh-sach-bien-tap/"],
    ctaLabel: "Mở ứng dụng với dữ liệu tạm thời",
  }),

  en({
    translationKey: "home",
    path: "/en/",
    kind: "home",
    title: "Bible Quiz Live – Create a Room and Play in Real Time",
    description:
      "Create a Bible quiz, invite players with a room code, and compete in turn-based or fastest-answer mode with multiple-choice, true/false, typed-answer, and crossword questions.",
    h1: "Create a Bible quiz and play together in real time",
    summary:
      "Bible Quiz Live is an account-free web app: a host builds a quiz, opens a temporary room, shares a code or link, and controls a live game for the group.",
    audience:
      "It is designed for hosts, Sunday school teachers, and church groups who want to prepare their own material and let everyone answer on their own device.",
    sections: [
      {
        title: "A straightforward game flow",
        steps: [
          "The host builds a game with one of the four supported question types.",
          "The app opens a room and provides a six-character code and join link.",
          "Players enter a display name, choose an icon, and answer on their device.",
          "The host reveals answers and leaderboards, then completes the game; temporary room data is hard-deleted according to its lifecycle.",
        ],
      },
      {
        title: "Two competition styles",
        paragraphs: [
          "Turn-based mode gives the same round score to everyone who answers correctly in time. Fastest-answer mode still rewards every correct answer, while faster responses receive more points.",
          "Scoring happens on the server. The browser cannot choose its own score or trusted response timestamp.",
        ],
      },
      {
        title: "Data exists only for the live room",
        paragraphs: [
          "There are no accounts, server-side quiz libraries, or permanent leaderboards. Room content, display names, and scores live in a temporary Durable Object and are hard-deleted after host deletion, expiry, or the short results period.",
        ],
      },
    ],
    faq: [
      {
        question: "Do players need an account?",
        answer: "No. Players use the room code or link, enter a display name, and join.",
      },
      {
        question: "Can I keep a quiz to edit later?",
        answer:
          "The current tab keeps an ephemeral sessionStorage draft. A creator can also download and later import a .dkt.json file; the server does not maintain a long-term quiz library.",
      },
    ],
    related: [
      "/en/features/",
      "/en/how-it-works/",
      "/en/game-modes/",
      "/en/question-types/",
      "/en/guides/",
      "/en/faq/",
    ],
    ctaLabel: "Open the quiz builder",
  }),
  en({
    translationKey: "features",
    path: "/en/features/",
    kind: "webpage",
    title: "Bible Quiz Live Features",
    description:
      "Explore the browser-based builder, real-time rooms, four question types, two game modes, presentation screen, and temporary data lifecycle.",
    h1: "Features available in Bible Quiz Live",
    summary:
      "Bible Quiz Live combines an in-browser quiz builder, a real-time room, and separate experiences for the host, players, and a read-only presentation screen.",
    audience: "Use this page to confirm what the current product can do before planning an event.",
    sections: [
      {
        title: "Build and review a game",
        bullets: [
          "Create multiple-choice, true/false, typed-answer, and crossword items.",
          "Preview content in phone or desktop layouts before opening a room.",
          "Restore the tab-session draft and download or import a portable .dkt.json configuration.",
          "No account is required, and exporting a configuration does not upload the file to the server.",
        ],
      },
      {
        title: "Control a live room",
        bullets: [
          "Share a room code, join link, or QR code.",
          "Use separate, role-bound host, player, and screen sessions.",
          "Pause, resume, or lock a question early from the host controls.",
          "Reconnect within the tab session without putting long-lived tokens in WebSocket query strings.",
        ],
      },
      {
        title: "Results and device support",
        paragraphs: [
          "Leaderboards update through the game and end with a final result. The interface supports narrow screens, keyboards, visible focus, live announcements, and reduced motion.",
          "The PWA shell can be installed, but live gameplay always needs a network connection and room data is not cached for offline play.",
        ],
      },
    ],
    related: [
      "/en/how-it-works/",
      "/en/game-modes/",
      "/en/question-types/",
      "/en/privacy-and-data-lifecycle/",
    ],
    ctaLabel: "Use these features in the builder",
  }),
  en({
    translationKey: "how-it-works",
    path: "/en/how-it-works/",
    kind: "webpage",
    title: "How Bible Quiz Live Works",
    description:
      "Learn how a quiz moves from a browser draft to a live room, server-side scoring, final leaderboard, and hard deletion.",
    h1: "From a draft to a live Bible quiz room",
    summary:
      "The host builds a quiz locally, submits a valid game definition to create a room, and controls each round over real-time connections while the room Durable Object remains the server source of truth.",
    audience:
      "For hosts who want to understand the operational and technical flow before running a game.",
    sections: [
      {
        title: "1. Prepare the material",
        paragraphs: [
          "The builder keeps its draft in the current tab's sessionStorage. The creator chooses a mode and default duration, adds questions, and can preview them without creating a room.",
        ],
      },
      {
        title: "2. Create and share the room",
        paragraphs: [
          "The server creates a random room code, separate host and screen tokens, and a public join link. Privileged tokens arrive in the URL fragment, move into sessionStorage, and are removed from the address bar.",
        ],
      },
      {
        title: "3. Play round by round",
        paragraphs: [
          "Each active player may answer once per applicable round. The server owns the deadline, validates the answer, calculates the score, and withholds private answer data until the host reveals the round.",
        ],
      },
      {
        title: "4. Finish and delete",
        paragraphs: [
          "The final leaderboard remains available for five minutes. A host can delete immediately, and inactive rooms also expire. Cleanup closes connections and deletes all Durable Object storage.",
        ],
      },
    ],
    related: [
      "/en/guides/create-a-bible-quiz/",
      "/en/guides/host-a-live-quiz-room/",
      "/en/privacy-and-data-lifecycle/",
    ],
    ctaLabel: "Start building a quiz",
  }),
  en({
    translationKey: "game-modes",
    path: "/en/game-modes/",
    kind: "webpage",
    title: "Turn-Based and Fastest-Answer Game Modes",
    description:
      "Compare Bible Quiz Live's turn-based and fastest-answer modes, including scoring behavior, ties, pause handling, and suitable use cases.",
    h1: "Choose the right game mode for your group",
    summary:
      "Bible Quiz Live has two multiplayer modes: turn-based gives equal points to correct in-time answers, while fastest-answer rewards every correct answer but gives more points for speed.",
    audience:
      "For hosts deciding between an accuracy-focused pace and a faster, more competitive format.",
    sections: [
      {
        title: "Turn-based",
        paragraphs: [
          "A correct answer earns 1,000 points on a normal or horizontal crossword round. The special vertical answer earns 2,000 points. Response speed does not change the score.",
          "Choose this mode when careful reading and equal credit for correct answers matter most.",
        ],
      },
      {
        title: "Fastest-answer",
        paragraphs: [
          "Every correct player earns points. Normal rounds range from 500 to 1,000 points, and the vertical crossword answer ranges from 1,000 to 2,000. Scores decrease with response time and are rounded to ten points.",
          "Paused time is excluded from response time. When scores tie, correct count and total response time participate in the speed-mode tie-break.",
        ],
      },
      {
        title: "Rules shared by both modes",
        bullets: [
          "A player submits once per applicable round.",
          "The server rejects answers received after the deadline.",
          "A late joiner starts with the next eligible round.",
          "Equal results use competition ranks such as 1, 1, 3.",
        ],
      },
    ],
    related: ["/en/how-it-works/", "/en/question-types/", "/en/guides/host-a-live-quiz-room/"],
    ctaLabel: "Choose a mode in the builder",
  }),
  en({
    translationKey: "question-types",
    path: "/en/question-types/",
    kind: "question-type",
    title: "Four Bible Quiz Question Types",
    description:
      "Learn how multiple choice, true/false, typed answers, and horizontal crossword rows with one special vertical answer work.",
    h1: "Four supported question types",
    summary:
      "The builder supports single-answer multiple choice, true/false, exact normalized typed answers, and a crossword made from horizontal rows plus one special vertical answer.",
    audience:
      "For quiz creators who want varied interactions without publishing their private quiz content on the public site.",
    sections: [
      {
        title: "Multiple choice and true/false",
        paragraphs: [
          "Multiple choice provides options and one correct option. True/false presents a statement with a boolean answer. Server validation respects the answer type rather than treating arbitrary text as a boolean.",
        ],
      },
      {
        title: "Typed answer",
        paragraphs: [
          "The creator supplies a canonical answer and explicit accepted aliases. The server normalizes case, Vietnamese diacritics, spaces, and punctuation before exact comparison; it does not use fuzzy or AI-based matching.",
        ],
      },
      {
        title: "Horizontal and vertical crossword",
        paragraphs: [
          "A crossword contains three to ten horizontal rows. One selected character from each horizontal answer forms a special vertical answer, which opens after the horizontal rounds are revealed.",
        ],
      },
      {
        title: "Editorial responsibility",
        paragraphs: [
          "The app does not ship an automatic Bible question bank. Creators must verify questions, answers, Scripture references, and translation permissions before use.",
        ],
      },
    ],
    related: [
      "/en/question-types/horizontal-and-special-vertical-crossword/",
      "/en/editorial-policy/",
      "/en/guides/create-a-bible-quiz/",
    ],
    ctaLabel: "Build a question",
  }),
  en({
    translationKey: "crossword",
    path: "/en/question-types/horizontal-and-special-vertical-crossword/",
    kind: "question-type",
    title: "Horizontal Crossword Rows and a Special Vertical Answer",
    description:
      "How Bible Quiz Live crosswords use 3–10 horizontal rows, aligned selected characters, and a double-value special vertical round.",
    h1: "How the horizontal and special vertical crossword works",
    summary:
      "A Bible Quiz Live crossword creates a sequence of horizontal rounds, then combines one chosen character from each answer into a special vertical answer worth twice the normal round value.",
    audience:
      "For creators who want a connected clue sequence rather than separate standalone questions.",
    sections: [
      {
        title: "Crossword structure",
        bullets: [
          "Each crossword contains 3–10 horizontal rows.",
          "Each row has a clue, answer, optional aliases, and a selected character position.",
          "Cells use graphemes so a Vietnamese accented character occupies one visual cell.",
          "Selected characters automatically align on one vertical column.",
        ],
      },
      {
        title: "Play sequence",
        steps: [
          "Players answer the open horizontal clue.",
          "The host locks and reveals the round, then shows the leaderboard.",
          "The next row opens while previous rows remain revealed on the board.",
          "After the final row, players answer the special vertical clue.",
        ],
      },
      {
        title: "Scoring and limits",
        paragraphs: [
          "Horizontal rows use normal round scoring. The special vertical answer has a 2× multiplier in both game modes. Typed answers are normalized and compared exactly against creator-provided answers and aliases.",
          "Preview the selected character positions on both phone and large-screen layouts before opening a room.",
        ],
      },
    ],
    faq: [
      {
        question: "Can players attempt the vertical answer before all rows are complete?",
        answer:
          "The current flow opens the special vertical round after the horizontal rounds are complete; it is not an early-buzzer mechanism.",
      },
      {
        question: "Does the app automatically generate a Bible crossword?",
        answer:
          "No. The creator supplies every clue, answer, selected character, and the vertical answer, then previews the layout.",
      },
    ],
    related: ["/en/question-types/", "/en/game-modes/", "/en/guides/create-a-bible-quiz/"],
    ctaLabel: "Create a crossword question",
  }),
  en({
    translationKey: "guides",
    path: "/en/guides/",
    kind: "guide-index",
    title: "Bible Quiz Live Guides",
    description:
      "Verified guides for creating a Bible quiz and hosting a live room from preparation through final hard deletion.",
    h1: "Guides for building and hosting a live quiz",
    summary:
      "The current guide set covers the two main jobs: creating a valid quiz in the builder and running a real-time room for a group.",
    audience: "For first-time users or hosts who want a compact event checklist.",
    sections: [
      {
        title: "Create a Bible quiz",
        paragraphs: [
          "Choose a mode, add and verify questions, preview the game, and understand the tab draft and user-managed configuration file before creating a room.",
        ],
      },
      {
        title: "Host a live quiz room",
        paragraphs: [
          "Prepare the presentation screen, share the correct link, control deadlines and reveals, handle reconnection, complete the leaderboard, and delete the room safely.",
        ],
      },
    ],
    related: ["/en/guides/create-a-bible-quiz/", "/en/guides/host-a-live-quiz-room/"],
    ctaLabel: "Open the quiz builder",
  }),
  en({
    translationKey: "create-guide",
    path: "/en/guides/create-a-bible-quiz/",
    kind: "guide",
    title: "How to Create a Bible Quiz",
    description:
      "Step-by-step instructions for choosing a mode, building four question types, previewing, exporting a configuration, and opening a live room.",
    h1: "How to create a Bible quiz",
    summary:
      "Open the builder, name the game, select a mode, add verified questions and answers, preview multiple layouts, and create a room only after validation succeeds.",
    audience: "For the person responsible for preparing questions and answers before an event.",
    datePublished: REVIEW_DATE,
    sections: [
      {
        title: "1. Choose the competition pace",
        paragraphs: [
          "Use turn-based mode for equal credit on correct answers, or fastest-answer when speed should affect points. Select a default duration that gives people time to read the material.",
        ],
      },
      {
        title: "2. Build each question",
        steps: [
          "Choose one of the four supported question types.",
          "Write a clear prompt and provide the correct answer or option.",
          "For typed answers, add only genuinely acceptable aliases.",
          "For a crossword, verify every row, selected character, and the vertical answer.",
        ],
      },
      {
        title: "3. Review content and layout",
        paragraphs: [
          "Use the preview for order, timing, and visual checks. Verify Scripture references, translation, spelling, and context yourself; the app does not certify theological accuracy.",
        ],
      },
      {
        title: "4. Keep a draft when necessary",
        paragraphs: [
          "The tab draft lives in sessionStorage. To move between devices or continue later, download a .dkt.json file and manage it yourself. Import validation runs before the app asks to replace the open draft.",
        ],
      },
      {
        title: "5. Create the room",
        paragraphs: [
          "After validation, the game definition is submitted to create a temporary Durable Object. A successful create-room operation clears the builder draft from the tab.",
        ],
      },
    ],
    related: [
      "/en/question-types/",
      "/en/game-modes/",
      "/en/guides/host-a-live-quiz-room/",
      "/en/editorial-policy/",
    ],
    ctaLabel: "Create a quiz now",
  }),
  en({
    translationKey: "host-guide",
    path: "/en/guides/host-a-live-quiz-room/",
    kind: "guide",
    title: "How to Host a Live Bible Quiz Room",
    description:
      "A practical checklist for opening a room, inviting players, presenting the game, controlling rounds, reconnecting, and deleting room data.",
    h1: "How to host a live Bible quiz room",
    summary:
      "Keep the host recovery link private, share only the join code or link with players, and use the host session to control countdowns, reveals, leaderboards, and final deletion.",
    audience: "For the event host and anyone operating the shared presentation screen.",
    datePublished: REVIEW_DATE,
    sections: [
      {
        title: "Before the game",
        bullets: [
          "Check connectivity on the host and presentation devices.",
          "Open the separate screen link; never project a host URL containing its secret token.",
          "Give players only the room code, QR code, or join link.",
          "Ask players to choose appropriate display names because those names appear inside the room.",
        ],
      },
      {
        title: "During each round",
        steps: [
          "Start the game and let the countdown open the question.",
          "Watch the answer count without seeing private answers before reveal.",
          "Pause when needed; paused time is excluded from response time.",
          "Lock the question, reveal the answer, and show the leaderboard before continuing.",
        ],
      },
      {
        title: "Reconnection and recovery links",
        paragraphs: [
          "Host, screen, and player sessions keep role tokens in the current tab's sessionStorage. The host recovery URL grants full host authority; do not paste it into a public chat or include it in screenshots.",
        ],
      },
      {
        title: "Finish safely",
        paragraphs: [
          "Complete the game to show the final leaderboard. Results remain for five minutes and are then hard-deleted; the host can also confirm immediate deletion. A deleted room code cannot be restored.",
        ],
      },
    ],
    related: ["/en/how-it-works/", "/en/game-modes/", "/en/privacy-and-data-lifecycle/"],
    ctaLabel: "Open the live game app",
  }),
  en({
    translationKey: "faq",
    path: "/en/faq/",
    kind: "faq",
    title: "Bible Quiz Live FAQ",
    description:
      "Answers about accounts, saved quizzes, question types, modes, connectivity, temporary data, privacy, and hard deletion.",
    h1: "Frequently asked questions",
    summary:
      "These answers describe the current Bible Quiz Live implementation; live room URLs are temporary operational routes, not public content pages.",
    audience:
      "For creators, hosts, and players who need a direct answer about a current product limit.",
    sections: [],
    faq: [
      {
        question: "Do I need an account to create or play?",
        answer: "No. The app currently has no account system.",
      },
      {
        question: "Is my quiz saved in a server library?",
        answer:
          "No. The tab draft uses sessionStorage, and a user-managed .dkt.json download is the longer-lived option.",
        href: "/en/guides/create-a-bible-quiz/",
        hrefLabel: "Read the creation guide",
      },
      {
        question: "Which question types are supported?",
        answer:
          "Multiple choice, true/false, typed answer, and horizontal crossword rows with one special vertical answer.",
        href: "/en/question-types/",
        hrefLabel: "Explore all four question types",
      },
      {
        question: "Does a slower correct answer still receive points?",
        answer:
          "Yes. Turn-based gives equal points to correct answers. Fastest-answer rewards every correct answer, with more points for faster responses.",
        href: "/en/game-modes/",
        hrefLabel: "Compare the game modes",
      },
      {
        question: "Can the game run offline?",
        answer: "No. The PWA shell is installable, but live rooms require a network connection.",
      },
      {
        question: "How long does a room exist?",
        answer:
          "An active room expires after two hours without host activity and has a six-hour absolute lifetime. Final results remain for five minutes.",
      },
      {
        question: "Can deleted room data be recovered?",
        answer:
          "No. Cleanup calls deleteAll on Durable Object storage, with no soft-delete record or recovery archive.",
        href: "/en/privacy-and-data-lifecycle/",
        hrefLabel: "Read the data lifecycle",
      },
      {
        question: "Does the app verify Bible questions automatically?",
        answer:
          "No. The creator must review content, references, and translations. The editorial policy explains the publication standard.",
        href: "/en/editorial-policy/",
        hrefLabel: "Read the editorial policy",
      },
    ],
    related: ["/en/features/", "/en/guides/", "/en/privacy-and-data-lifecycle/"],
    ctaLabel: "Open Bible Quiz Live",
  }),
  en({
    translationKey: "about",
    path: "/en/about/",
    kind: "about",
    title: "About Bible Quiz Live",
    description:
      "Bible Quiz Live is a bilingual web app for building quizzes, opening temporary rooms, and playing in real time without accounts.",
    h1: "About Bible Quiz Live",
    summary:
      "Bible Quiz Live focuses on a short, deliberate lifecycle: create your own content, open a room, answer together, review the result, and delete temporary data.",
    audience: "For anyone evaluating the product's purpose, scope, and intentional data limits.",
    sections: [
      {
        title: "Product goal",
        paragraphs: [
          "The app lets a group answer on separate devices while a host controls progress and a shared screen shows the room. It is designed for low-friction participation and economical use of Cloudflare's free-tier architecture.",
        ],
      },
      {
        title: "Current scope",
        bullets: [
          "No accounts, user profiles, or history dashboard.",
          "No automatically published Bible question bank.",
          "No long-term server-side quiz library.",
          "No advertising or analytics SDK in the current source.",
        ],
      },
      {
        title: "Information integrity",
        paragraphs: [
          "Public pages describe behavior verified in source code. They do not claim user counts, ratings, awards, publisher organizations, or testimonials without real evidence.",
        ],
      },
    ],
    related: ["/en/features/", "/en/editorial-policy/", "/en/privacy-and-data-lifecycle/"],
    ctaLabel: "Try the application",
  }),
  en({
    translationKey: "editorial-policy",
    path: "/en/editorial-policy/",
    kind: "editorial",
    title: "Bible Content Editorial Policy",
    description:
      "Standards for questions, Scripture references, translations, copyright, AI assistance, authorship, dates, review status, and corrections.",
    h1: "Editorial and content verification policy",
    summary:
      "Bible content should enter a game or public page only after a person verifies the question, answer, reference, context, and translation rights; AI is never the final reviewer.",
    audience: "For quiz creators and maintainers of the project's public content.",
    sections: [
      {
        title: "Verify Bible content",
        bullets: [
          "Record book, chapter, and verse when a question depends on a specific passage.",
          "Name the translation when quoting and verify that translation's copyright terms.",
          "Prefer references over long reproductions of copyrighted text.",
          "Do not present a disputed interpretation as the only factual answer.",
        ],
      },
      {
        title: "Authors, reviewers, and status",
        paragraphs: [
          "Name an author or reviewer only when a real person exists and has approved publication. Unreviewed material stays draft/noindex and outside the sitemap. Never invent identities, titles, or credentials.",
        ],
      },
      {
        title: "AI assistance and localization",
        paragraphs: [
          "AI may help with outlining or wording, but a responsible person must verify each claim. English is localized naturally and reviewed independently rather than published as an unchecked machine translation.",
        ],
      },
      {
        title: "Dates and corrections",
        paragraphs: [
          "datePublished records real publication; dateModified changes only after a material edit, not on each build. If an error is found, remove risky material, correct the source, update the date, and preserve the change in repository history.",
          "The repository does not yet configure a public contact channel, so this page does not invent one. The owner should add a real method before advertising an external correction intake process.",
        ],
      },
      {
        title: "Prohibited publishing practices",
        bullets: [
          "No scaled thin pages for keywords, books, chapters, rooms, or players.",
          "No keyword stuffing, hidden text, hidden FAQ content, or schema that differs from visible content.",
          "No unsupported ratings, statistics, dates, authors, or quotations.",
        ],
      },
    ],
    related: ["/en/question-types/", "/en/about/", "/en/privacy-and-data-lifecycle/"],
    ctaLabel: "Open the builder with reviewed content",
  }),
  en({
    translationKey: "privacy",
    path: "/en/privacy-and-data-lifecycle/",
    kind: "privacy",
    title: "Privacy and Live Room Data Lifecycle",
    description:
      "Temporary room information, Durable Object SQLite, sessionStorage, hard deletion timing, caching, analytics, and stores Bible Quiz Live does not use.",
    h1: "Live room data is temporary and hard-deleted",
    summary:
      "Bible Quiz Live has no accounts or game history: room data lives temporarily in a SQLite-backed Durable Object and deleteAll runs after host deletion, expiry, or the five-minute final-results period.",
    audience:
      "For hosts and players who want a precise account of what data exists, where it is stored, and when it disappears.",
    sections: [
      {
        title: "Information created in a room",
        bullets: [
          "The game definition: title, questions, options, and creator-provided answers.",
          "Display names, icons, hashed tokens, connection state, evaluated submissions, and scores.",
          "Round progress, deadlines, leaderboard entries, and one-time WebSocket tickets.",
          "The current app does not support server image uploads and does not collect email addresses or phone numbers.",
        ],
      },
      {
        title: "Where temporary data is stored",
        paragraphs: [
          "The server uses one SQLite-backed Durable Object per room code. The repository has no Cloudflare D1 or R2 binding, so there are no D1 records or R2 image objects to delete. Raw typed-answer text exists only long enough to normalize and evaluate it and is not written to storage.",
          "The browser uses sessionStorage for the builder draft, role tokens, and feedback preference. It does not use localStorage or IndexedDB for room data. A downloaded .dkt.json file is user-managed and cannot be deleted by the app.",
        ],
      },
      {
        title: "When deletion happens",
        bullets: [
          "The host may confirm immediate finish-and-delete.",
          "An active room expires after two hours without host activity.",
          "Every room has a six-hour absolute lifetime.",
          "After normal completion, results remain for five minutes, with a warning during the final minute.",
        ],
      },
      {
        title: "Hard deletion, caches, and the browser",
        paragraphs: [
          "Cleanup moves the room to DELETING, broadcasts the event, closes WebSockets, and calls deleteAll on storage. There is no soft delete or recovery archive. Durable Object deletion is a platform operation that may take time to become fully consistent, so the app does not promise instantaneous removal across every Cloudflare infrastructure layer.",
          "Room APIs use Cache-Control: no-store, and the service worker does not cache /api/*. Because private data is never put in the CDN cache, no room-content object requires purging. Cached public documentation and app-shell files contain no room codes, player names, or answers.",
          "When a client receives the deletion event, it clears the current role token from sessionStorage; remaining sessionStorage disappears when the tab closes. The builder draft is removed after successful room creation.",
        ],
      },
      {
        title: "Analytics and platform metadata",
        paragraphs: [
          "The current source includes no analytics or advertising SDK. Future measurement must not send room codes, tokens, names, questions, answers, image URLs, or free-form game content. Cloudflare may still process platform-level operational metadata under its own policies.",
        ],
      },
    ],
    related: ["/en/how-it-works/", "/en/about/", "/en/editorial-policy/"],
    ctaLabel: "Open the app with temporary data",
  }),
];

export const PAGE_BY_PATH: Map<string, PublicPage> = new Map(
  PUBLIC_PAGES.map((page) => [page.path, page]),
);

export function alternateFor(page: PublicPage): PublicPage {
  const alternate = PUBLIC_PAGES.find(
    (candidate) =>
      candidate.translationKey === page.translationKey && candidate.locale !== page.locale,
  );
  if (!alternate) throw new Error(`Missing alternate for ${page.path}`);
  return alternate;
}
