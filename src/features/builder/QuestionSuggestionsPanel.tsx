import type {
  BuilderMediaHandle,
  GameItem,
  GameItemType,
  GenerationProvenance,
} from "@shared/game";
import type { QuestionCandidateEnvelope } from "@shared/question-intelligence";
import type { ScriptureIndex, ScriptureVersion } from "@shared/scripture";
import { Bot, Check, ChevronDown, LoaderCircle, Sparkles } from "lucide-react";
import { useCallback, useRef, useState } from "react";
import { api } from "../../lib/api";
import { Turnstile } from "../security/Turnstile";

function answerFingerprint(item: GameItem): string {
  switch (item.type) {
    case "SINGLE_CHOICE":
      return item.options.find((option) => option.id === item.correctOptionId)?.text ?? "";
    case "MULTIPLE_CHOICE":
      return item.options
        .filter((option) => item.correctOptionIds.includes(option.id))
        .map((option) => option.text)
        .sort((left, right) => left.localeCompare(right, "vi"))
        .join(" | ");
    case "TRUE_FALSE":
      return `${item.statement} | ${item.correctValue ? "đúng" : "sai"}`;
    case "SHORT_ANSWER":
      return item.canonicalAnswer;
    case "CROSSWORD":
      return item.verticalAnswer;
  }
}

const typeLabels: Record<GameItemType | "AUTO_BALANCE", string> = {
  AUTO_BALANCE: "Tự cân bằng",
  SINGLE_CHOICE: "Chọn một đáp án",
  MULTIPLE_CHOICE: "Chọn nhiều đáp án",
  TRUE_FALSE: "Đúng / Sai",
  SHORT_ANSWER: "Trả lời ngắn",
  CROSSWORD: "Ô chữ",
};

export function QuestionSuggestionsPanel({
  existingItems,
  mediaHandles,
  autoBalanceEnabled,
  mediaAnalysisEnabled,
  onApprove,
}: {
  existingItems: GameItem[];
  mediaHandles: Record<string, BuilderMediaHandle>;
  autoBalanceEnabled: boolean;
  mediaAnalysisEnabled: boolean;
  onApprove: (item: GameItem) => void;
}) {
  const clientGenerationId = useRef(crypto.randomUUID());
  const [open, setOpen] = useState(false);
  const [versions, setVersions] = useState<ScriptureVersion[]>([]);
  const [versionId, setVersionId] = useState<number>();
  const [index, setIndex] = useState<ScriptureIndex>();
  const [bookId, setBookId] = useState("");
  const [chapter, setChapter] = useState<number>();
  const [verseStart, setVerseStart] = useState("");
  const [verseEnd, setVerseEnd] = useState("");
  const [type, setType] = useState<GameItemType | "AUTO_BALANCE">(
    autoBalanceEnabled ? "AUTO_BALANCE" : "SINGLE_CHOICE",
  );
  const [count, setCount] = useState(5);
  const [difficulty, setDifficulty] = useState<"EASY" | "MEDIUM" | "HARD" | "MIXED">("MIXED");
  const [audience, setAudience] = useState<"CHILDREN" | "YOUTH" | "ADULT" | "MIXED">("YOUTH");
  const [turnstileToken, setTurnstileToken] = useState<string>();
  const [mediaAssetId, setMediaAssetId] = useState("");
  const [candidates, setCandidates] = useState<QuestionCandidateEnvelope[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const openPanel = async () => {
    setOpen((value) => !value);
    if (versions.length) return;
    setBusy(true);
    try {
      const result = await api.scriptureVersions();
      setVersions(result.versions);
      if (result.versions[0]) await chooseVersion(result.versions[0].id);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải danh sách bản dịch.");
    } finally {
      setBusy(false);
    }
  };

  const chooseVersion = async (id: number) => {
    setVersionId(id);
    setIndex(undefined);
    setBookId("");
    setChapter(undefined);
    try {
      const next = await api.scriptureIndex(id);
      setIndex(next);
      const firstBook = next.books[0];
      setBookId(firstBook?.id ?? "");
      setChapter(firstBook?.chapters[0]?.number);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tải mục lục Kinh Thánh.");
    }
  };

  const onTurnstile = useCallback((token?: string) => setTurnstileToken(token), []);
  const selectedBook = index?.books.find((book) => book.id === bookId);
  const passageId =
    bookId && chapter
      ? `${bookId}.${chapter}${verseStart ? `.${verseStart}${verseEnd && verseEnd !== verseStart ? `-${verseEnd}` : ""}` : ""}`
      : "";

  const generate = async () => {
    if (!versionId || !passageId) return;
    setBusy(true);
    setError(undefined);
    try {
      const result = await api.questionSuggestions({
        scriptureScope: { provider: "youversion", bibleVersionId: versionId, passageId },
        count,
        types: type === "AUTO_BALANCE" ? type : [type],
        difficulty,
        audience,
        locale: "vi",
        existingItems: existingItems.map((item) => ({
          type: item.type,
          ...(item.bibleReference ? { passageId: item.scriptureEvidence?.passageId } : {}),
          normalizedAnswer: answerFingerprint(item).slice(0, 120),
          runtimeRoundCost: item.type === "CROSSWORD" ? item.horizontalRows.length : 1,
        })),
        ...(mediaAssetId
          ? {
              mediaAssetId,
              mediaCapability: mediaHandles[mediaAssetId]?.readCapability,
            }
          : {}),
        turnstileToken,
        clientGenerationId: clientGenerationId.current,
      });
      setCandidates(result.candidates);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tạo câu hỏi đề xuất.");
    } finally {
      setBusy(false);
    }
  };

  const approve = (candidate: QuestionCandidateEnvelope) => {
    const now = new Date().toISOString();
    const provenance: GenerationProvenance = {
      source: "AI_ASSISTED",
      provider: "openai",
      model: candidate.generation.model,
      promptVersion: candidate.generation.promptVersion,
      strategyVersion: candidate.generation.strategyVersion,
      generatedAt: candidate.generation.generatedAt,
      validatedAt: now,
      humanApprovedAt: now,
      confidence: candidate.confidence,
      ...(candidate.validationReceipt ? { validationReceipt: candidate.validationReceipt } : {}),
    };
    onApprove({ ...candidate.proposedItem, generationProvenance: provenance } as GameItem);
    setCandidates((current) =>
      current.filter((entry) => entry.candidateId !== candidate.candidateId),
    );
  };

  return (
    <section className="ai-suggestions-panel">
      <button className="ai-panel-toggle" type="button" onClick={() => void openPanel()}>
        <Sparkles />
        <span>
          <strong>Trợ lý tạo câu hỏi từ YouVersion</strong>
          <small>AI chỉ dùng phân đoạn được chọn; bạn phải xem lại và chấp thuận từng câu.</small>
        </span>
        <ChevronDown className={open ? "open" : ""} />
      </button>
      {open ? (
        <div className="ai-panel-body">
          <div className="form-grid three">
            <label>
              Bản dịch
              <select
                value={versionId ?? ""}
                onChange={(event) => void chooseVersion(Number(event.target.value))}
              >
                <option value="">Chọn bản dịch</option>
                {versions.map((version) => (
                  <option key={version.id} value={version.id}>
                    {version.abbreviation} · {version.localizedTitle}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Sách
              <select
                value={bookId}
                onChange={(event) => {
                  const next = index?.books.find((book) => book.id === event.target.value);
                  setBookId(event.target.value);
                  setChapter(next?.chapters[0]?.number);
                }}
              >
                {index?.books.map((book) => (
                  <option key={book.id} value={book.id}>
                    {book.name}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Chương
              <select
                value={chapter ?? ""}
                onChange={(event) => setChapter(Number(event.target.value))}
              >
                {selectedBook?.chapters.map((entry) => (
                  <option key={entry.id} value={entry.number}>
                    {entry.number}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Từ câu <span>(để trống dùng cả chương)</span>
              <input
                type="number"
                min="1"
                value={verseStart}
                onChange={(event) => setVerseStart(event.target.value)}
              />
            </label>
            <label>
              Đến câu
              <input
                type="number"
                min="1"
                value={verseEnd}
                disabled={!verseStart}
                onChange={(event) => setVerseEnd(event.target.value)}
              />
            </label>
            <label>
              Kiểu câu hỏi
              <select
                value={type}
                onChange={(event) => setType(event.target.value as GameItemType | "AUTO_BALANCE")}
              >
                {Object.entries(typeLabels)
                  .filter(([value]) => autoBalanceEnabled || value !== "AUTO_BALANCE")
                  .map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
              </select>
            </label>
            <label>
              Số câu
              <input
                type="number"
                min="1"
                max="10"
                value={count}
                onChange={(event) => setCount(Number(event.target.value))}
              />
            </label>
            <label>
              Độ khó
              <select
                value={difficulty}
                onChange={(event) => setDifficulty(event.target.value as typeof difficulty)}
              >
                <option value="MIXED">Phối hợp</option>
                <option value="EASY">Dễ</option>
                <option value="MEDIUM">Vừa</option>
                <option value="HARD">Khó</option>
              </select>
            </label>
            <label>
              Người chơi
              <select
                value={audience}
                onChange={(event) => setAudience(event.target.value as typeof audience)}
              >
                <option value="CHILDREN">Thiếu nhi</option>
                <option value="YOUTH">Thanh thiếu niên</option>
                <option value="ADULT">Người lớn</option>
                <option value="MIXED">Hỗn hợp</option>
              </select>
            </label>
            {mediaAnalysisEnabled ? (
              <label>
                Media hỗ trợ <span>(không bắt buộc)</span>
                <select
                  value={mediaAssetId}
                  onChange={(event) => setMediaAssetId(event.target.value)}
                >
                  <option value="">Không dùng media</option>
                  {Object.values(mediaHandles).map((handle) => (
                    <option key={handle.media.assetId} value={handle.media.assetId}>
                      {handle.media.kind === "IMAGE" ? "Ảnh" : "Âm thanh"} ·{" "}
                      {handle.media.accessibilityText}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
          </div>
          {versionId ? (
            <small className="scripture-scope-preview">Phân đoạn: {passageId || "—"}</small>
          ) : null}
          <Turnstile
            onToken={onTurnstile}
            action="question-generation"
            label="Xác minh tạo câu hỏi"
          />
          <button
            className="button primary"
            type="button"
            disabled={busy || !versionId || !passageId}
            onClick={() => void generate()}
          >
            {busy ? <LoaderCircle className="spin" /> : <Bot />}{" "}
            {busy ? "Đang tạo và kiểm tra…" : "Tạo đề xuất"}
          </button>
          {error ? (
            <p className="field-error" role="alert">
              {error}
            </p>
          ) : null}
          {candidates.length ? (
            <div className="candidate-list">
              {candidates.map((candidate) => (
                <article className="candidate-card" key={candidate.candidateId}>
                  <div>
                    <strong>{typeLabels[candidate.type]}</strong>
                    <span
                      className={`candidate-state ${candidate.validation.overall.toLowerCase()}`}
                    >
                      {candidate.validation.overall}
                    </span>
                  </div>
                  <h3>
                    {"prompt" in candidate.proposedItem
                      ? candidate.proposedItem.prompt
                      : "statement" in candidate.proposedItem
                        ? candidate.proposedItem.statement
                        : candidate.proposedItem.verticalClue}
                  </h3>
                  <p>{candidate.proposedItem.explanation}</p>
                  <small>
                    {candidate.evidence.localizedReference} ·{" "}
                    {candidate.evidence.versionAbbreviation}
                  </small>
                  <details>
                    <summary>Kiểm tra và căn cứ</summary>
                    <ul>
                      {candidate.validation.checks.map((check) => (
                        <li key={check.code}>
                          {check.outcome}: {check.message}
                        </li>
                      ))}
                    </ul>
                  </details>
                  <button className="button gold" type="button" onClick={() => approve(candidate)}>
                    <Check /> Chấp thuận và thêm để chỉnh sửa
                  </button>
                </article>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
