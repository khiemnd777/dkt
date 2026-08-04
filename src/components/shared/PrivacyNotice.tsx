import { Clock3, ShieldCheck } from "lucide-react";

export function PrivacyNotice({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`privacy-notice ${compact ? "compact" : ""}`}>
      {compact ? <Clock3 size={18} /> : <ShieldCheck size={22} />}
      <p>
        {compact
          ? "Không lưu lâu dài — phòng sẽ tự động bị xóa."
          : "Phòng chơi này chỉ tồn tại tạm thời. Toàn bộ câu hỏi, tên người chơi, câu trả lời và điểm số sẽ tự động bị xóa sau khi game kết thúc."}
      </p>
    </div>
  );
}
