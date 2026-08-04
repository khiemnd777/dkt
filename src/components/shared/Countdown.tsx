import { Timer } from "lucide-react";
import { formatCountdown, useCountdown } from "../../hooks/useCountdown";

export function Countdown({
  deadline,
  offset = 0,
  large = false,
}: {
  deadline?: number;
  offset?: number;
  large?: boolean;
}) {
  const remaining = useCountdown(deadline, offset);
  return (
    <div
      className={`countdown ${large ? "large" : ""}`}
      aria-live={remaining <= 5_000 ? "assertive" : "off"}
    >
      <Timer aria-hidden="true" />
      <span>{formatCountdown(remaining)}</span>
    </div>
  );
}
