import { Compass } from "lucide-react";
import { Link } from "react-router-dom";
import { Brand } from "../components/shared/Brand";

export function NotFoundPage() {
  return (
    <main className="center-page">
      <Brand />
      <div className="empty-illustration">
        <Compass />
      </div>
      <h1>Không tìm thấy trang này</h1>
      <p>Có thể đường dẫn đã cũ hoặc phòng chơi đã được xóa.</p>
      <Link className="button primary" to="/">
        Về trang chủ
      </Link>
    </main>
  );
}
