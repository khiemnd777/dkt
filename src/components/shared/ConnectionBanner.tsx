import type { ConnectionState } from "../../features/realtime/RealtimeClient";

export function ConnectionBanner({ state }: { state: ConnectionState }) {
  if (state === "CONNECTED") return null;
  const label =
    state === "RECONNECTING"
      ? "Đang kết nối lại…"
      : state === "FAILED"
        ? "Không thể kết nối. Phòng có thể đã hết hạn hoặc tạm thời quá tải."
        : "Đang kết nối…";
  return (
    <div
      className={`connection-banner ${state === "FAILED" ? "error" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="status-dot" /> {label}
    </div>
  );
}
