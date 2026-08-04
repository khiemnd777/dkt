import { Volume2, VolumeX } from "lucide-react";

export function FeedbackToggle({
  enabled,
  onToggle,
  dark = false,
}: {
  enabled: boolean;
  onToggle: () => void;
  dark?: boolean;
}) {
  return (
    <button
      type="button"
      className={`feedback-toggle ${dark ? "dark" : ""}`}
      aria-label={enabled ? "Tắt âm thanh và rung" : "Bật âm thanh và rung"}
      aria-pressed={enabled}
      onClick={onToggle}
      title={enabled ? "Tắt âm thanh và rung" : "Bật âm thanh và rung"}
    >
      {enabled ? <Volume2 /> : <VolumeX />}
      <span>{enabled ? "Âm thanh bật" : "Âm thanh tắt"}</span>
    </button>
  );
}
