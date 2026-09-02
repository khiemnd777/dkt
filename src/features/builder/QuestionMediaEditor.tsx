import type { BuilderMediaHandle, QuestionMediaRef } from "@shared/game";
import { Image, Music, Trash2, Upload } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "../../lib/api";
import { QuestionMedia } from "../media/QuestionMedia";

export function QuestionMediaEditor({
  media,
  handle,
  onChange,
  onHandle,
}: {
  media?: QuestionMediaRef;
  handle?: BuilderMediaHandle;
  onChange: (media?: QuestionMediaRef) => void;
  onHandle: (handle: BuilderMediaHandle) => void;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File>();
  const [accessibilityText, setAccessibilityText] = useState(media?.accessibilityText ?? "");
  const [attribution, setAttribution] = useState(media?.rights.attribution ?? "");
  const [attested, setAttested] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const upload = async () => {
    if (!file || !accessibilityText.trim() || !attested) return;
    setBusy(true);
    setError(undefined);
    const form = new FormData();
    form.set("file", file);
    form.set("kind", file.type === "audio/mpeg" ? "AUDIO" : "IMAGE");
    form.set("accessibilityText", accessibilityText.trim());
    form.set("rightsSource", "USER_UPLOAD");
    form.set("attestedByHost", "true");
    if (attribution.trim()) form.set("attribution", attribution.trim());
    try {
      const next = await api.uploadQuestionMedia(form);
      onHandle(next);
      onChange(next.media);
      setFile(undefined);
      setAttested(false);
      if (input.current) input.current.value = "";
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải tệp lên.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    if (!media) return;
    setBusy(true);
    // Assets can be shared by duplicated questions. Detaching is local; the private
    // object remains inaccessible and is removed by the short R2 lifecycle policy.
    onChange(undefined);
    setBusy(false);
  };

  const source =
    media && handle
      ? `/api/question-media/${media.assetId}?token=${encodeURIComponent(handle.readCapability)}`
      : undefined;

  return (
    <section className="question-media-editor">
      <div className="section-title">
        <h3>Hình ảnh hoặc âm thanh câu hỏi</h3>
        <span>Một tệp · không bắt buộc</span>
      </div>
      {media ? (
        <>
          <QuestionMedia media={media} source={source} compact />
          {!handle ? (
            <p className="field-error">
              Quyền truy cập tạm thời không còn trong tab này. Hãy tải lại tệp trước khi tạo phòng.
            </p>
          ) : null}
          <button className="button danger ghost" type="button" disabled={busy} onClick={remove}>
            <Trash2 /> Gỡ tệp
          </button>
        </>
      ) : (
        <div className="media-upload-form">
          <button className="button tertiary" type="button" onClick={() => input.current?.click()}>
            <Image /> <Music /> Chọn ảnh hoặc MP3
          </button>
          <input
            ref={input}
            hidden
            type="file"
            accept="image/jpeg,image/png,image/webp,audio/mpeg"
            onChange={(event) => setFile(event.target.files?.[0])}
          />
          {file ? <strong>{file.name}</strong> : null}
          <label>
            Mô tả thay thế / nội dung âm thanh
            <textarea
              value={accessibilityText}
              maxLength={500}
              onChange={(event) => setAccessibilityText(event.target.value)}
              placeholder="Mô tả đầy đủ để mọi người đều hiểu câu hỏi."
            />
          </label>
          <label>
            Ghi nguồn <span>(nếu cần)</span>
            <input
              value={attribution}
              maxLength={500}
              onChange={(event) => setAttribution(event.target.value)}
            />
          </label>
          <label className="media-rights-check">
            <input
              type="checkbox"
              checked={attested}
              onChange={(event) => setAttested(event.target.checked)}
            />
            Tôi có quyền sử dụng tệp này và đồng ý gửi tệp tới OpenAI để kiểm tra an toàn; âm thanh
            sẽ được phiên âm để kiểm tra.
          </label>
          <button
            className="button primary"
            type="button"
            disabled={!file || !accessibilityText.trim() || !attested || busy}
            onClick={() => void upload()}
          >
            <Upload /> {busy ? "Đang kiểm tra…" : "Tải lên và kiểm tra"}
          </button>
        </div>
      )}
      {error ? <p className="field-error">{error}</p> : null}
    </section>
  );
}
