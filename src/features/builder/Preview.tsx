import type { GameItem, GameMode } from "@shared/game";
import { answerCells, normalizeAnswer } from "@shared/text";
import {
  ArrowRight,
  Check,
  CheckCircle2,
  Monitor,
  RotateCcw,
  Send,
  Smartphone,
  X,
  XCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { crosswordRowOffsets } from "../crossword/alignment";
import { QuestionMedia } from "../media/QuestionMedia";

interface PreviewProps {
  item: GameItem;
  fullScreen?: boolean;
  mode?: GameMode;
  defaultDurationSec?: number;
  mediaSources?: Record<string, string>;
}

export function Preview({
  item,
  fullScreen = false,
  mode = "TURN_BASED",
  defaultDurationSec = 20,
  mediaSources = {},
}: PreviewProps) {
  const [screen, setScreen] = useState<"phone" | "present">("phone");

  return (
    <div className={`preview-pane ${fullScreen ? "fullscreen" : ""}`}>
      <div className="preview-switch">
        <button
          type="button"
          className={screen === "phone" ? "selected" : ""}
          onClick={() => setScreen("phone")}
        >
          <Smartphone /> Điện thoại
        </button>
        <button
          type="button"
          className={screen === "present" ? "selected" : ""}
          onClick={() => setScreen("present")}
        >
          <Monitor /> {fullScreen ? "Máy tính / trình chiếu" : "Trình chiếu"}
        </button>
      </div>
      {fullScreen ? (
        <PracticePreview
          item={item}
          mode={mode}
          defaultDurationSec={defaultDurationSec}
          screen={screen}
          mediaSources={mediaSources}
        />
      ) : (
        <StaticPreview item={item} screen={screen} mediaSources={mediaSources} />
      )}
    </div>
  );
}

function StaticPreview({
  item,
  screen,
  mediaSources,
}: {
  item: GameItem;
  screen: "phone" | "present";
  mediaSources: Record<string, string>;
}) {
  const prompt =
    item.type === "TRUE_FALSE"
      ? item.statement
      : item.type === "CROSSWORD"
        ? item.verticalClue
        : item.prompt;
  const crosswordOffsets =
    item.type === "CROSSWORD" ? crosswordRowOffsets(item.horizontalRows) : [];

  return (
    <div
      className={`game-preview ${screen} ${item.type === "CROSSWORD" ? "crossword-game-preview" : ""}`.trim()}
    >
      <PreviewTop
        durationSec={
          item.type === "CROSSWORD" ? item.horizontalDurationSec : (item.durationSec ?? 20)
        }
      />
      <div className="preview-question-content">
        <small>XEM TRƯỚC CÂU HỎI</small>
        <QuestionMedia
          media={item.presentation?.media}
          source={
            item.presentation?.media ? mediaSources[item.presentation.media.assetId] : undefined
          }
          compact
        />
        <h3>{prompt}</h3>
        {item.type === "SINGLE_CHOICE" || item.type === "MULTIPLE_CHOICE" ? (
          <div className="preview-options">
            {item.options.map((option, index) => (
              <div key={option.id}>
                <span>
                  {item.type === "MULTIPLE_CHOICE" ? "☐" : String.fromCharCode(65 + index)}
                </span>
                {option.text}
              </div>
            ))}
          </div>
        ) : null}
        {item.type === "TRUE_FALSE" ? (
          <div className="preview-options two">
            <div>
              <Check /> Đúng
            </div>
            <div>
              <X /> Sai
            </div>
          </div>
        ) : null}
        {item.type === "SHORT_ANSWER" ? (
          <div className="preview-answer">Nhập câu trả lời…</div>
        ) : null}
        {item.type === "CROSSWORD" ? (
          <CrosswordPreview item={item} offsets={crosswordOffsets} revealedRows={0} />
        ) : null}
      </div>
    </div>
  );
}

function PracticePreview({
  item,
  mode,
  defaultDurationSec,
  screen,
  mediaSources,
}: {
  item: GameItem;
  mode: GameMode;
  defaultDurationSec: number;
  screen: "phone" | "present";
  mediaSources: Record<string, string>;
}) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [choice, setChoice] = useState("");
  const [choices, setChoices] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [result, setResult] = useState<boolean>();
  const crossword = item.type === "CROSSWORD" ? item : undefined;
  const totalPracticeRounds = crossword ? crossword.horizontalRows.length : 1;
  const currentRow = crossword?.horizontalRows[roundIndex];
  const presentation = currentRow?.presentation?.media
    ? currentRow.presentation
    : item.presentation;
  const prompt =
    item.type === "CROSSWORD"
      ? (currentRow?.clue ?? item.title)
      : item.type === "TRUE_FALSE"
        ? item.statement
        : item.prompt;
  const durationSec =
    item.type === "CROSSWORD"
      ? item.horizontalDurationSec
      : (item.durationSec ?? defaultDurationSec);
  const roundLabel = crossword
    ? `HÀNG NGANG ${roundIndex + 1} / ${crossword.horizontalRows.length}`
    : "TỰ CHƠI KIỂM NGHIỆM";
  const correctAnswer =
    item.type === "SINGLE_CHOICE"
      ? (item.options.find((option) => option.id === item.correctOptionId)?.text ?? "")
      : item.type === "MULTIPLE_CHOICE"
        ? item.options
            .filter((option) => item.correctOptionIds.includes(option.id))
            .map((option) => option.text)
            .join("; ")
        : item.type === "TRUE_FALSE"
          ? item.correctValue
            ? "Đúng"
            : "Sai"
          : item.type === "SHORT_ANSWER"
            ? item.canonicalAnswer
            : (currentRow?.answer ?? "");
  const revealedRows = crossword
    ? Math.min(crossword.horizontalRows.length, roundIndex + (result !== undefined ? 1 : 0))
    : 0;
  const crosswordOffsets = crossword ? crosswordRowOffsets(crossword.horizontalRows) : [];
  const hasAnswer =
    item.type === "MULTIPLE_CHOICE"
      ? choices.length
      : item.type === "SINGLE_CHOICE" || item.type === "TRUE_FALSE"
        ? choice
        : text.trim();

  useEffect(() => {
    setRoundIndex(0);
    setChoice("");
    setChoices([]);
    setText("");
    setResult(undefined);
  }, [item.id]);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!hasAnswer || result !== undefined) return;
    if (item.type === "SINGLE_CHOICE") {
      setResult(choice === item.correctOptionId);
      return;
    }
    if (item.type === "MULTIPLE_CHOICE") {
      const submitted = [...new Set(choices)].sort();
      const correct = [...new Set(item.correctOptionIds)].sort();
      setResult(
        submitted.length === correct.length &&
          submitted.every((optionId, index) => optionId === correct[index]),
      );
      return;
    }
    if (item.type === "TRUE_FALSE") {
      setResult((choice === "true") === item.correctValue);
      return;
    }
    const accepted =
      item.type === "SHORT_ANSWER"
        ? [item.canonicalAnswer, ...item.acceptedAliases]
        : currentRow
          ? [currentRow.answer, ...currentRow.acceptedAliases]
          : [];
    setResult(accepted.some((answer) => normalizeAnswer(answer) === normalizeAnswer(text)));
  };

  const continuePractice = () => {
    setChoice("");
    setChoices([]);
    setText("");
    setResult(undefined);
    if (crossword && roundIndex < totalPracticeRounds - 1) {
      setRoundIndex((current) => current + 1);
      return;
    }
    setRoundIndex(0);
  };

  const nextLabel = crossword
    ? roundIndex === totalPracticeRounds - 1
      ? "Chơi lại ô chữ"
      : "Hàng tiếp theo"
    : "Thử lại câu này";
  const typeClass = crossword ? "crossword-game-preview" : "";

  return (
    <div className={`game-preview practice-preview ${screen} ${typeClass}`.trim()}>
      <PreviewTop durationSec={durationSec} />
      <div className="preview-question-content">
        <small>{roundLabel}</small>
        <QuestionMedia
          media={presentation?.media}
          source={presentation?.media ? mediaSources[presentation.media.assetId] : undefined}
          compact
        />
        {crossword ? (
          <CrosswordPreview
            item={crossword}
            offsets={crosswordOffsets}
            revealedRows={revealedRows}
            activeRow={roundIndex}
          />
        ) : null}
        <h3>{prompt}</h3>
        <form className="practice-answer-form" onSubmit={submit}>
          {item.type === "SINGLE_CHOICE" ? (
            <div className="practice-options">
              {item.options.map((option, index) => (
                <button
                  type="button"
                  key={option.id}
                  disabled={result !== undefined}
                  className={choice === option.id ? "selected" : ""}
                  onClick={() => setChoice(option.id)}
                >
                  <span>{String.fromCharCode(65 + index)}</span>
                  {option.text}
                </button>
              ))}
            </div>
          ) : null}
          {item.type === "MULTIPLE_CHOICE" ? (
            <div className="practice-options">
              {item.options.map((option, index) => {
                const selected = choices.includes(option.id);
                return (
                  <button
                    type="button"
                    key={option.id}
                    disabled={result !== undefined}
                    className={selected ? "selected" : ""}
                    aria-pressed={selected}
                    onClick={() =>
                      setChoices((current) =>
                        current.includes(option.id)
                          ? current.filter((id) => id !== option.id)
                          : [...current, option.id],
                      )
                    }
                  >
                    <span>{selected ? "✓" : String.fromCharCode(65 + index)}</span>
                    {option.text}
                  </button>
                );
              })}
            </div>
          ) : null}
          {item.type === "TRUE_FALSE" ? (
            <div className="practice-options two">
              <button
                type="button"
                disabled={result !== undefined}
                className={choice === "true" ? "selected" : ""}
                onClick={() => setChoice("true")}
              >
                <span>✓</span> Đúng
              </button>
              <button
                type="button"
                disabled={result !== undefined}
                className={choice === "false" ? "selected" : ""}
                onClick={() => setChoice("false")}
              >
                <span>×</span> Sai
              </button>
            </div>
          ) : null}
          {item.type === "SHORT_ANSWER" || item.type === "CROSSWORD" ? (
            <label className="practice-text-answer">
              <span>Câu trả lời thử của Host</span>
              <input
                value={text}
                disabled={result !== undefined}
                maxLength={240}
                autoComplete="off"
                onChange={(event) => setText(event.target.value)}
              />
            </label>
          ) : null}
          {result === undefined ? (
            <button className="practice-submit" type="submit" disabled={!hasAnswer}>
              <Send /> Kiểm tra đáp án
            </button>
          ) : (
            <div className={`practice-result ${result ? "correct" : "incorrect"}`} role="status">
              {result ? <CheckCircle2 /> : <XCircle />}
              <div>
                <strong>{result ? "Chính xác!" : "Chưa đúng"}</strong>
                <span>
                  Đáp án: <b>{correctAnswer}</b>
                </span>
                {crossword && roundIndex === crossword.horizontalRows.length - 1 ? (
                  <span>
                    Đáp án hàng dọc: <b>{crossword.verticalAnswer}</b>
                  </span>
                ) : null}
                {result ? (
                  <small>
                    {mode === "TURN_BASED"
                      ? `Mô phỏng: ${(1_000).toLocaleString("vi-VN")} điểm`
                      : "Đáp án hợp lệ; điểm live phụ thuộc tốc độ."}
                  </small>
                ) : null}
              </div>
              <button type="button" onClick={continuePractice}>
                {roundIndex === totalPracticeRounds - 1 ? <RotateCcw /> : <ArrowRight />}
                {nextLabel}
              </button>
            </div>
          )}
        </form>
      </div>
    </div>
  );
}

function PreviewTop({ durationSec }: { durationSec: number }) {
  return (
    <div className="preview-top">
      <span>ĐKT LIVE</span>
      <span>{durationSec}</span>
    </div>
  );
}

function CrosswordPreview({
  item,
  offsets,
  revealedRows,
  activeRow,
}: {
  item: Extract<GameItem, { type: "CROSSWORD" }>;
  offsets: number[];
  revealedRows: number;
  activeRow?: number;
}) {
  return (
    <figure className="crossword-preview" aria-label={`Ô chữ ${item.title}`}>
      {item.horizontalRows.map((row, index) => {
        const cells = answerCells(row.answer);
        const revealed = index < revealedRows;
        return (
          <div
            className={`${activeRow === index ? "active" : ""} ${revealed ? "revealed" : ""}`.trim()}
            key={row.id}
          >
            <span>{index + 1}</span>
            <div>
              {Array.from({ length: offsets[index] }, (_, spacerIndex) => (
                <i
                  aria-hidden="true"
                  className="alignment-spacer"
                  key={`${row.id}-spacer-${spacerIndex}`}
                />
              ))}
              {cells.map((cell, cellIndex) => (
                <i
                  className={row.specialCellIndex === cellIndex ? "special" : ""}
                  key={`${cell}-${cellIndex}`}
                >
                  {revealed ? cell : "?"}
                </i>
              ))}
            </div>
          </div>
        );
      })}
    </figure>
  );
}
