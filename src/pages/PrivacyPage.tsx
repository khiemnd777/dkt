import { Clock3, DatabaseZap, ShieldCheck, Wifi } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/shared/Brand";

export function PrivacyPage() {
  return (
    <main className="simple-page">
      <header className="site-header">
        <Brand />
        <Link className="button secondary" to="/">
          Về trang chủ
        </Link>
      </header>
      <article className="prose-card">
        <div className="eyebrow">
          <ShieldCheck size={16} /> Quyền riêng tư theo vòng đời phòng
        </div>
        <h1>Chơi xong là xóa sạch</h1>
        <p className="lead">
          Ứng dụng không có tài khoản, lịch sử game, thư viện câu hỏi lâu dài hay bảng xếp hạng vĩnh
          viễn.
        </p>
        <div className="privacy-grid">
          <section>
            <Clock3 />
            <h2>Tồn tại tạm thời</h2>
            <p>
              Câu hỏi, tên người chơi, câu trả lời và điểm số chỉ được giữ trong Durable Object của
              phòng đang hoạt động.
            </p>
          </section>
          <section>
            <DatabaseZap />
            <h2>Không có cơ sở dữ liệu vĩnh viễn</h2>
            <p>
              Phòng kết thúc được giữ 5 phút để xem kết quả, sau đó toàn bộ bộ nhớ phòng bị xóa.
            </p>
          </section>
          <section>
            <Wifi />
            <h2>Cần kết nối mạng</h2>
            <p>
              Vỏ ứng dụng có thể được cài đặt, nhưng gameplay thời gian thực luôn cần mạng. Dữ liệu
              phòng không được cache offline.
            </p>
          </section>
        </div>
        <h2>Ứng dụng không thu thập</h2>
        <ul>
          <li>Email hoặc số điện thoại</li>
          <li>Tài khoản hay mật khẩu</li>
          <li>Ảnh đại diện tải lên</li>
          <li>Phân tích hành vi hoặc quảng cáo</li>
        </ul>
        <h2>File cấu hình do bạn quản lý</h2>
        <p>
          Khi bạn chọn “Tải cấu hình”, trình duyệt lưu một file <code>.dkt.json</code> trên thiết bị
          để bạn tiếp tục chỉnh sửa vào ngày khác hoặc trên thiết bị khác. File chỉ chứa nội dung và
          cài đặt game; không chứa mã phòng, token bí mật, người chơi hay điểm số. File không được
          tải lên máy chủ khi tạo ra, và ứng dụng không thể tự xóa file đã tải xuống khỏi thiết bị
          của bạn.
        </p>
        <p>
          Cloudflare vẫn có thể xử lý metadata vận hành ở cấp nền tảng theo chính sách của họ. Ứng
          dụng này không chủ động xây dựng lịch sử người chơi hay nội dung phòng.
        </p>
      </article>
    </main>
  );
}
