import { BookOpen, Star } from "lucide-react";
import { Link } from "react-router-dom";

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <Link to="/" className="brand" aria-label="Đố Kinh Thánh Live — Trang chủ">
      <span className="brand-mark" aria-hidden="true">
        <BookOpen size={compact ? 22 : 27} />
        <Star className="brand-star" size={11} />
      </span>
      <span>{compact ? "ĐKT Live" : "Đố Kinh Thánh Live"}</span>
    </Link>
  );
}
