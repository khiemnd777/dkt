import type { ScriptureContext, ScriptureVersion } from "@shared/scripture";
import { BookOpen } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";
import { api } from "../../lib/api";

function sourceLink(context: ScriptureContext): string | undefined {
  const value = context.chunks[0]?.deepLink ?? context.version.deepLink;
  if (!value) return undefined;
  try {
    const url = new URL(value);
    return url.protocol === "https:" &&
      ["www.bible.com", "bible.com", "www.youversion.com", "youversion.com"].includes(url.hostname)
      ? url.href
      : undefined;
  } catch {
    return undefined;
  }
}

export function ScriptureReferenceField({
  value,
  onChange,
  enabled,
  label = "Câu Kinh Thánh tham khảo",
  optional = true,
}: {
  value: string;
  onChange: (value: string) => void;
  enabled: boolean;
  label?: string;
  optional?: boolean;
}) {
  const inputId = useId();
  const versionsCache = useRef<ScriptureVersion[]>([]);
  const [versions, setVersions] = useState<ScriptureVersion[]>([]);
  const [versionId, setVersionId] = useState<number>();
  const [retry, setRetry] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>();
  const [result, setResult] = useState<{ input: string; context: ScriptureContext }>();
  const reference = value.trim();

  useEffect(() => {
    setResult(undefined);
    setError(undefined);
    setLoading(false);
    if (!enabled || !/\d$/u.test(reference)) return;
    const controller = new AbortController();
    let active = true;
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        let available = versionsCache.current;
        if (!available.length) {
          available = (await api.scriptureVersions("vi", controller.signal)).versions;
          if (!active) return;
          versionsCache.current = available;
          setVersions(available);
        }
        const selectedId = versionId ?? available[0]?.id;
        if (!selectedId)
          throw new Error("Chưa có bản dịch tiếng Việt được cấp quyền cho ứng dụng.");
        const context = await api.scriptureLookup(selectedId, reference, controller.signal);
        if (active) setResult({ input: reference, context });
      } catch (cause) {
        if (active) setError(cause instanceof Error ? cause.message : "Không thể tra cứu lúc này.");
      } finally {
        if (active) setLoading(false);
      }
    }, 600);
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
  }, [enabled, reference, versionId, retry]);

  const context =
    enabled &&
    result?.input === reference &&
    (!versionId || result.context.version.id === versionId)
      ? result.context
      : undefined;
  const link = context ? sourceLink(context) : undefined;

  return (
    <div className="scripture-reference-field">
      <label htmlFor={inputId}>
        {label} {optional ? <span>(không bắt buộc)</span> : null}
        <input
          id={inputId}
          value={value}
          maxLength={120}
          onChange={(event) => onChange(event.target.value)}
          placeholder="1 Sa-mu-ên 17:50"
        />
      </label>
      {enabled ? (
        <section className="scripture-lookup" aria-label={`Tra cứu YouVersion — ${label}`}>
          <div className="scripture-lookup-heading">
            <BookOpen aria-hidden="true" />
            <strong>Tra cứu YouVersion</strong>
          </div>
          {versions.length ? (
            <label>
              Bản dịch tra cứu
              <select
                value={versionId ?? versions[0].id}
                onChange={(event) => setVersionId(Number(event.target.value))}
              >
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.abbreviation} · {version.localizedTitle}
                  </option>
                ))}
              </select>
            </label>
          ) : null}
          <div aria-live="polite" aria-busy={loading}>
            {loading ? <p>Đang tra cứu phân đoạn…</p> : null}
            {!context && !loading && !error ? (
              <p>
                Nhập địa chỉ để tự tra cứu, ví dụ: Giăng 3:16–18. Hỗ trợ một chương hoặc các câu
                liên tiếp trong cùng chương.
              </p>
            ) : null}
            {error ? (
              <div className="scripture-lookup-error">
                <p className="field-error">
                  {error} Bạn vẫn có thể nhập câu hỏi và tạo phòng bình thường.
                </p>
                <button
                  className="button tertiary"
                  type="button"
                  onClick={() => setRetry((current) => current + 1)}
                >
                  Thử tra cứu lại
                </button>
              </div>
            ) : null}
            {context ? (
              <>
                {context.chunks.map((chunk) => (
                  <div key={chunk.reference.passageId}>
                    <strong>{chunk.localizedReference}</strong>
                    <blockquote>{chunk.content}</blockquote>
                    {chunk.attribution && chunk.attribution !== context.version.attribution ? (
                      <small>{chunk.attribution}</small>
                    ) : null}
                  </div>
                ))}
                <p className="scripture-attribution">{context.version.attribution}</p>
                {link ? (
                  <a href={link} target="_blank" rel="noopener noreferrer">
                    Mở trên YouVersion
                  </a>
                ) : null}
              </>
            ) : null}
          </div>
        </section>
      ) : null}
    </div>
  );
}
