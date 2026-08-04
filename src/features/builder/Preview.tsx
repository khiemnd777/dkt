import type { GameItem, GameMode } from "@shared/game";
import { answerCells, normalizeAnswer } from "@shared/text";
import {
  ArrowRight,
  CheckCircle2,
  Monitor,
  RotateCcw,
  Send,
  Smartphone,
  XCircle,
} from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { crosswordRowOffsets } from "../crossword/alignment";

interface PreviewProps {
  item: GameItem;
  fullScreen?: boolean;
  mode?: GameMode;
  defaultDurationSec?: number;
}

export function Preview({
  item,
  fullScreen = false,
  mode = "TURN_BASED",
  defaultDurationSec = 20,
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
        />
      ) : (
        <StaticPreview item={item} screen={screen} />
      )}
    </div>
  );
}

function StaticPreview({ item, screen }: { item: GameItem; screen: "phone" | "present" }) {
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
        <h3>{prompt}</h3>
        {item.type === "SINGLE_CHOICE" ? (
          <div className="preview-options">
            {item.options.map((option, index) => (
              <div key={option.id}>
                <span>{String.fromCharCode(65 + index)}</span>
                {option.text}
              </div>
            ))}
          </div>
        ) : null}
        {item.type === "TRUE_FALSE" ? (
          <div className="preview-options two">
            <div>✓ Đúng</div>
            <div>× Sai</div>
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
}: {
  item: GameItem;
  mode: GameMode;
  defaultDurationSec: number;
  screen: "phone" | "present";
}) {
  const [roundIndex, setRoundIndex] = useState(0);
  const [choice, setChoice] = useState("");
  const [text, setText] = useState("");
  const [result, setResult] = useState<boolean>();
  const crossword = item.type === "CROSSWORD" ? item : undefined;
  const totalPracticeRounds = crossword ? crossword.horizontalRows.length + 1 : 1;
  const isVerticalRound = Boolean(crossword && roundIndex === crossword.horizontalRows.length);
  const currentRow = crossword?.horizontalRows[roundIndex];
  const prompt =
    item.type === "CROSSWORD"
      ? (currentRow?.clue ?? item.verticalClue)
      : item.type === "TRUE_FALSE"
        ? item.statement
        : item.prompt;
  const durationSec =
    item.type === "CROSSWORD"
      ? isVerticalRound
        ? item.verticalDurationSec
        : item.horizontalDurationSec
      : (item.durationSec ?? defaultDurationSec);
  const roundLabel = crossword
    ? isVerticalRound
      ? "TỪ KHÓA DỌC · ĐIỂM ×2"
      : `HÀNG NGANG ${roundIndex + 1} / ${crossword.horizontalRows.length}`
    : "TỰ CHƠI KIỂM NGHIỆM";
  const correctAnswer =
    item.type === "SINGLE_CHOICE"
      ? (item.options.find((option) => option.id === item.correctOptionId)?.text ?? "")
      : item.type === "TRUE_FALSE"
        ? item.correctValue
          ? "Đúng"
          : "Sai"
        : item.type === "SHORT_ANSWER"
          ? item.canonicalAnswer
          : (currentRow?.answer ?? item.verticalAnswer);
  const revealedRows = crossword
    ? Math.min(
        crossword.horizontalRows.length,
        roundIndex + (result !== undefined && !isVerticalRound ? 1 : 0),
      )
    : 0;
  const crosswordOffsets = crossword ? crosswordRowOffsets(crossword.horizontalRows) : [];
  const hasAnswer =
    item.type === "SINGLE_CHOICE" || item.type === "TRUE_FALSE" ? choice : text.trim();

  useEffect(() => {
    setRoundIndex(0);
    setChoice("");
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
    if (item.type === "TRUE_FALSE") {
      setResult((choice === "true") === item.correctValue);
      return;
    }
    const accepted =
      item.type === "SHORT_ANSWER"
        ? [item.canonicalAnswer, ...item.acceptedAliases]
        : currentRow
          ? [currentRow.answer, ...currentRow.acceptedAliases]
          : [item.verticalAnswer];
    setResult(accepted.some((answer) => normalizeAnswer(answer) === normalizeAnswer(text)));
  };

  const continuePractice = () => {
    setChoice("");
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
      : roundIndex + 1 === crossword.horizontalRows.length
        ? "Đến từ khóa dọc"
        : "Hàng tiếp theo"
    : "Thử lại câu này";
  const typeClass = crossword ? "crossword-game-preview" : "";

  return (
    <div className={`game-preview practice-preview ${screen} ${typeClass}`.trim()}>
      <PreviewTop durationSec={durationSec} />
      <div className="preview-question-content">
        <small>{roundLabel}</small>
        {crossword ? (
          <CrosswordPreview
            item={crossword}
            offsets={crosswordOffsets}
            revealedRows={revealedRows}
            activeRow={isVerticalRound ? undefined : roundIndex}
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
                {result ? (
                  <small>
                    {mode === "TURN_BASED"
                      ? `Mô phỏng: ${(isVerticalRound ? 2_000 : 1_000).toLocaleString("vi-VN")} điểm`
                      : `Đáp án hợp lệ${isVerticalRound ? " · vòng này nhân đôi" : ""}; điểm live phụ thuộc tốc độ.`}
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
