import type { PublicQuestionMedia, QuestionMediaRef } from "@shared/game";

export function QuestionMedia({
  media,
  source,
  compact = false,
  autoPlay = false,
  onReady,
  onFailure,
}: {
  media?: QuestionMediaRef | PublicQuestionMedia;
  source?: string;
  compact?: boolean;
  autoPlay?: boolean;
  onReady?: () => void;
  onFailure?: () => void;
}) {
  if (!media) return null;
  return (
    <figure className={`question-media ${compact ? "compact" : ""}`.trim()}>
      {source && media.kind === "IMAGE" ? (
        <img
          src={source}
          alt={media.accessibilityText}
          width={media.width}
          height={media.height}
          loading="eager"
          decoding="async"
          onLoad={onReady}
          onError={onFailure}
        />
      ) : source && media.kind === "AUDIO" ? (
        // biome-ignore lint/a11y/useMediaCaption: The required transcript/description is rendered immediately below in the figcaption.
        <audio
          controls
          preload="metadata"
          src={source}
          aria-label={media.accessibilityText}
          autoPlay={autoPlay}
          onPlay={onReady}
          onError={onFailure}
        />
      ) : (
        <div className="question-media-fallback" role="img" aria-label={media.accessibilityText}>
          {media.kind === "IMAGE" ? "🖼️" : "🔊"}
        </div>
      )}
      <figcaption>{media.accessibilityText}</figcaption>
    </figure>
  );
}

export function RuntimeQuestionMedia({
  media,
  autoPlay = false,
  onReady,
  onFailure,
}: {
  media?: PublicQuestionMedia;
  autoPlay?: boolean;
  onReady?: () => void;
  onFailure?: () => void;
}) {
  return (
    <QuestionMedia
      media={media}
      source={media?.deliveryUrl}
      autoPlay={autoPlay}
      onReady={onReady}
      onFailure={onFailure}
    />
  );
}
