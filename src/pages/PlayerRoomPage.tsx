import type { PlayerAnswer } from "@shared/game";
import type { RoomSnapshot } from "@shared/room";
import { CheckCircle2, DoorOpen, KeyRound, PauseCircle, Send, Trophy, XCircle } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Brand } from "../components/shared/Brand";
import { ConnectionBanner } from "../components/shared/ConnectionBanner";
import { Countdown } from "../components/shared/Countdown";
import { FeedbackToggle } from "../components/shared/FeedbackToggle";
import { Leaderboard } from "../components/shared/Leaderboard";
import { PrivacyNotice } from "../components/shared/PrivacyNotice";
import { CrosswordBoard } from "../features/crossword/CrosswordBoard";
import { useGameFeedback } from "../features/feedback/useGameFeedback";
import { RuntimeQuestionMedia } from "../features/media/QuestionMedia";
import { useRoomRealtime } from "../features/realtime/useRoomRealtime";
import { formatCountdown, useCountdown } from "../hooks/useCountdown";
import { api } from "../lib/api";
import { clearSession, readSession } from "../lib/session";

export function PlayerRoomPage() {
  const code = (useParams().roomCode ?? "").toUpperCase();
  const navigate = useNavigate();
  const [token] = useState(() => readSession("PLAYER", code));
  const realtime = useRoomRealtime({
    roomCode: code,
    role: "PLAYER",
    token,
    onDeleted: () => clearSession("PLAYER", code),
  });
  const feedback = useGameFeedback(realtime.snapshot, "PLAYER");
  useEffect(() => {
    if (realtime.connection === "FAILED") clearSession("PLAYER", code);
  }, [realtime.connection, code]);
  const leave = async () => {
    if (token) await api.leave(code, token).catch(() => undefined);
    clearSession("PLAYER", code);
    navigate("/", { replace: true });
  };
  if (!token)
    return (
      <main className="center-page">
        <Brand />
        <h1>Bạn chưa tham gia phòng này</h1>
        <p>Nhập tên và chọn hình đại diện để bắt đầu.</p>
        <Link className="button primary" to={`/join/${code}`}>
          Tham gia phòng {code}
        </Link>
      </main>
    );
  return (
    <main className="room-page player-page">
      <ConnectionBanner state={realtime.connection} />
      <header className="room-header">
        <Brand compact />
        <div className="room-header-meta">
          <span>PHÒNG</span>
          <strong>{code}</strong>
        </div>
        <FeedbackToggle enabled={feedback.enabled} onToggle={feedback.toggle} />
        <button type="button" className="icon-button" onClick={leave} aria-label="Rời phòng">
          <DoorOpen />
        </button>
      </header>
      {realtime.notice ? (
        <div className="toast error" role="alert">
          {realtime.notice}
          <button type="button" onClick={realtime.clearNotice} aria-label="Đóng thông báo">
            ×
          </button>
        </div>
      ) : null}
      {!realtime.snapshot ? (
        <div className="loading-card">Đang vào phòng…</div>
      ) : (
        <PlayerStage
          snapshot={realtime.snapshot}
          offset={realtime.serverOffsetMs}
          connected={realtime.connection === "CONNECTED"}
          send={realtime.send}
        />
      )}
    </main>
  );
}

function PlayerStage({
  snapshot,
  offset,
  connected,
  send,
}: {
  snapshot: RoomSnapshot;
  offset: number;
  connected: boolean;
  send: ReturnType<typeof useRoomRealtime>["send"];
}) {
  const [choice, setChoice] = useState<string>();
  const [choices, setChoices] = useState<string[]>([]);
  const [text, setText] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [verticalOpen, setVerticalOpen] = useState(false);
  const [verticalText, setVerticalText] = useState("");
  const [verticalSubmitting, setVerticalSubmitting] = useState(false);
  const deletionRemaining = useCountdown(snapshot.finishedDeleteAt, offset);
  const roundId = snapshot.currentRound?.roundId;
  useEffect(() => {
    setChoice(undefined);
    setChoices([]);
    setText("");
    setSubmitting(false);
    setVerticalOpen(false);
    setVerticalText("");
    setVerticalSubmitting(false);
  }, [roundId]);
  useEffect(() => {
    if (snapshot.self?.submitted) setSubmitting(false);
  }, [snapshot.self?.submitted]);
  useEffect(() => {
    if (snapshot.self?.crosswordVerticalGuess?.submitted) {
      setVerticalSubmitting(false);
      setVerticalOpen(false);
      setVerticalText("");
    }
  }, [snapshot.self?.crosswordVerticalGuess?.submitted]);

  if (snapshot.phase === "LOBBY")
    return (
      <div className="player-stage lobby">
        <span className="avatar giant">{snapshot.self?.avatarId}</span>
        <h1>Chào {snapshot.self?.displayName}!</h1>
        <p>Đang chờ người dẫn bắt đầu…</p>
        <div className="mode-badge">
          {snapshot.mode === "TURN_BASED" ? "📖 Theo lượt câu hỏi" : "⚡ Đua tốc độ"}
        </div>
        <div className="lobby-count">{snapshot.playerCount} người đã sẵn sàng</div>
        <PrivacyNotice compact />
      </div>
    );
  if (snapshot.phase === "COUNTDOWN")
    return (
      <div className="player-stage centered">
        <span className="eyebrow">Câu {snapshot.currentRoundIndex + 1} sắp bắt đầu</span>
        <Countdown deadline={snapshot.countdownEndsAt} offset={offset} large />
        <p>Hãy sẵn sàng!</p>
      </div>
    );
  if (snapshot.phase === "LEADERBOARD")
    return (
      <div className="player-stage">
        <div className="stage-heading">
          <Trophy />
          <h1>Bảng xếp hạng</h1>
        </div>
        <Leaderboard entries={snapshot.leaderboard ?? []} selfId={snapshot.self?.playerId} />
      </div>
    );
  if (snapshot.phase === "FINISHED") {
    const self = snapshot.leaderboard?.find((entry) => entry.playerId === snapshot.self?.playerId);
    const accuracy =
      snapshot.self && snapshot.totalRounds
        ? Math.round((snapshot.self.correctCount / snapshot.totalRounds) * 100)
        : 0;
    return (
      <div className="player-stage final">
        <div className="celebration" aria-hidden="true">
          ✦ 🎉 ✦
        </div>
        <h1>Hoàn thành!</h1>
        <div className="personal-result">
          <span>
            Hạng <strong>#{self?.rank ?? "–"}</strong>
          </span>
          <span>
            Điểm <strong>{self?.totalScore.toLocaleString("vi-VN") ?? 0}</strong>
          </span>
          <span>
            Chính xác <strong>{accuracy}%</strong>
          </span>
        </div>
        <Leaderboard entries={snapshot.leaderboard ?? []} selfId={snapshot.self?.playerId} />
        <p className="deletion-countdown">
          Phòng sẽ tự động bị xóa sau {formatCountdown(deletionRemaining)}
        </p>
      </div>
    );
  }
  if (snapshot.phase === "DELETING")
    return (
      <div className="player-stage centered">
        <h1>Phòng đã được xóa</h1>
        <p>Cảm ơn bạn đã cùng chơi!</p>
        <Link className="button primary" to="/">
          Về trang chủ
        </Link>
      </div>
    );
  if (snapshot.self && snapshot.self.eligibleFromRoundIndex > snapshot.currentRoundIndex)
    return (
      <div className="player-stage centered">
        <span className="avatar giant">{snapshot.self.avatarId}</span>
        <h1>Bạn sẽ bắt đầu từ câu tiếp theo.</h1>
        <p>Hãy theo dõi đáp án của vòng hiện tại nhé.</p>
      </div>
    );
  if (snapshot.phase === "QUESTION_PAUSED")
    return (
      <div className="player-stage centered paused-stage" role="status" aria-live="polite">
        <PauseCircle />
        <span className="eyebrow">Câu {snapshot.currentRoundIndex + 1}</span>
        <h1>Người dẫn đã tạm dừng</h1>
        <p>Đồng hồ và nhận đáp án đang dừng. Câu trả lời bạn đang chọn vẫn được giữ.</p>
      </div>
    );
  const round = snapshot.currentRound;
  if (!round) return <div className="loading-card">Đang tải câu hỏi…</div>;
  if (snapshot.phase === "MEDIA_PREPARE")
    return (
      <div className="player-stage centered media-prepare-stage">
        <span className="eyebrow">Chuẩn bị media câu hỏi</span>
        <RuntimeQuestionMedia media={round.publicPayload.media} autoPlay />
        {snapshot.answerOpenedAt ? (
          <>
            <p>Thời gian trả lời bắt đầu sau khi media trình bày xong.</p>
            <Countdown deadline={snapshot.answerOpenedAt} offset={offset} />
          </>
        ) : (
          <p>Đang chờ người dẫn xác nhận media sẵn sàng…</p>
        )}
      </div>
    );
  const answerForSubmit = (): PlayerAnswer | undefined => {
    if (round.kind === "SINGLE_CHOICE")
      return choice ? { type: "OPTION", optionId: choice } : undefined;
    if (round.kind === "MULTIPLE_CHOICE")
      return choices.length >= 2 ? { type: "OPTIONS", optionIds: choices } : undefined;
    if (round.kind === "TRUE_FALSE")
      return choice ? { type: "BOOLEAN", value: choice === "true" } : undefined;
    return text.trim() ? { type: "TEXT", value: text.trim() } : undefined;
  };
  const submit = (event?: FormEvent) => {
    event?.preventDefault();
    const answer = answerForSubmit();
    if (!answer || !connected || snapshot.self?.submitted) return;
    setSubmitting(true);
    if (
      !send({
        type: "player.submit_answer",
        payload: { roundId: round.roundId, submissionId: crypto.randomUUID(), answer },
      })
    )
      setSubmitting(false);
  };
  const verticalGuess =
    snapshot.self?.crosswordVerticalGuess?.itemId === round.itemId
      ? snapshot.self.crosswordVerticalGuess
      : undefined;
  const canGuessVertical =
    round.kind === "CROSSWORD_HORIZONTAL" && Boolean(round.publicPayload.crossword?.verticalClue);
  const submitVertical = (event: FormEvent) => {
    event.preventDefault();
    const value = verticalText.trim();
    if (!value || !connected || verticalSubmitting || verticalGuess?.submitted) return;
    setVerticalSubmitting(true);
    if (
      !send({
        type: "player.submit_crossword_vertical",
        payload: { roundId: round.roundId, submissionId: crypto.randomUUID(), value },
      })
    )
      setVerticalSubmitting(false);
  };
  const reveal = snapshot.phase === "ANSWER_REVEAL";
  return (
    <div className="player-stage question">
      <div className="round-meta">
        <span>
          Câu {snapshot.currentRoundIndex + 1} / {snapshot.totalRounds}
        </span>
        {snapshot.phase === "QUESTION_OPEN" ? (
          <Countdown deadline={snapshot.deadlineAt} offset={offset} />
        ) : (
          <span className="phase-chip">
            {snapshot.phase === "QUESTION_LOCKED" ? "Đã khóa" : "Đáp án"}
          </span>
        )}
      </div>
      <div className="progress-track">
        <i
          style={{ width: `${((snapshot.currentRoundIndex + 1) / snapshot.totalRounds) * 100}%` }}
        />
      </div>
      <CrosswordBoard snapshot={snapshot} />
      <RuntimeQuestionMedia media={round.publicPayload.media} />
      <h1>{round.publicPayload.prompt}</h1>
      {snapshot.phase === "QUESTION_OPEN" ? (
        <form onSubmit={submit} className="answer-form">
          {round.publicPayload.options ? (
            <div className="answer-options">
              {round.publicPayload.options.map((option, index) => {
                const value =
                  round.kind === "TRUE_FALSE"
                    ? option.id === "true"
                      ? "true"
                      : "false"
                    : option.id;
                const multipleSelected =
                  round.kind === "MULTIPLE_CHOICE" && choices.includes(option.id);
                return (
                  <button
                    type="button"
                    className={choice === value || multipleSelected ? "selected" : ""}
                    disabled={snapshot.self?.submitted || submitting}
                    key={option.id}
                    aria-pressed={round.kind === "MULTIPLE_CHOICE" ? multipleSelected : undefined}
                    onClick={() => {
                      if (round.kind === "MULTIPLE_CHOICE") {
                        setChoices((current) =>
                          current.includes(option.id)
                            ? current.filter((id) => id !== option.id)
                            : [...current, option.id],
                        );
                      } else {
                        setChoice(value);
                      }
                    }}
                  >
                    <span>{multipleSelected ? "✓" : String.fromCharCode(65 + index)}</span>
                    {option.text}
                  </button>
                );
              })}
            </div>
          ) : (
            <label className="text-answer">
              <span>Câu trả lời của bạn</span>
              <input
                value={text}
                onChange={(event) => setText(event.target.value)}
                disabled={snapshot.self?.submitted || submitting}
                maxLength={240}
                autoComplete="off"
              />
            </label>
          )}
          <button
            className="button gold large full"
            disabled={!answerForSubmit() || !connected || snapshot.self?.submitted || submitting}
            type="submit"
          >
            <Send />{" "}
            {submitting
              ? "Đang gửi…"
              : snapshot.self?.submitted
                ? "Đã ghi nhận"
                : "Gửi câu trả lời"}
          </button>
          {snapshot.self?.submitted ? (
            <div className="accepted-message" role="status" aria-live="polite">
              <CheckCircle2 /> Đã ghi nhận câu trả lời
            </div>
          ) : null}
        </form>
      ) : null}
      {snapshot.phase === "QUESTION_OPEN" && canGuessVertical ? (
        <div className="vertical-guess">
          {verticalGuess?.submitted ? (
            <div className="vertical-guess-used" role="status" aria-live="polite">
              <CheckCircle2 />
              <div>
                <strong>Đã dùng lượt giải hàng dọc</strong>
                <span>Đáp án sẽ chưa được mở để những người khác tiếp tục đoán.</span>
              </div>
            </div>
          ) : verticalOpen ? (
            <form onSubmit={submitVertical} className="vertical-guess-form">
              <div className="vertical-guess-heading">
                <span>Gợi ý hàng dọc</span>
                <strong>{round.publicPayload.crossword?.verticalClue}</strong>
              </div>
              <label className="text-answer">
                <span>Đáp án hàng dọc</span>
                <input
                  value={verticalText}
                  onChange={(event) => setVerticalText(event.target.value)}
                  disabled={verticalSubmitting}
                  maxLength={240}
                  autoComplete="off"
                />
              </label>
              <small>
                Chỉ được gửi một lần · Đúng nhận tối đa{" "}
                <strong>
                  {(snapshot.crosswordVerticalPoints ?? 0).toLocaleString("vi-VN")} điểm
                </strong>
              </small>
              <div className="vertical-guess-actions">
                <button
                  className="button secondary"
                  type="button"
                  disabled={verticalSubmitting}
                  onClick={() => setVerticalOpen(false)}
                >
                  Hủy
                </button>
                <button
                  className="button gold"
                  type="submit"
                  disabled={!verticalText.trim() || !connected || verticalSubmitting}
                >
                  <Send /> {verticalSubmitting ? "Đang gửi…" : "Chốt đáp án hàng dọc"}
                </button>
              </div>
            </form>
          ) : (
            <button
              className="button secondary large full vertical-guess-trigger"
              type="button"
              onClick={() => setVerticalOpen(true)}
            >
              <KeyRound /> Giải hàng dọc ·{" "}
              {(snapshot.crosswordVerticalPoints ?? 0).toLocaleString("vi-VN")} điểm
            </button>
          )}
        </div>
      ) : null}
      {snapshot.phase === "QUESTION_LOCKED" ? (
        <div className="waiting-card">
          {snapshot.self?.submitted ? (
            <div className="accepted-message" role="status" aria-live="polite">
              <CheckCircle2 /> Đã ghi nhận câu trả lời
            </div>
          ) : null}
          <p>Đã khóa câu trả lời. Đang chờ người dẫn hiện đáp án…</p>
        </div>
      ) : null}
      {reveal ? (
        <>
          <div
            className={`personal-reveal ${snapshot.self?.currentResult?.isCorrect ? "correct" : "incorrect"}`}
          >
            {snapshot.self?.currentResult?.isCorrect ? <CheckCircle2 /> : <XCircle />}
            <div>
              <span>{snapshot.self?.currentResult?.isCorrect ? "Chính xác!" : "Chưa đúng"}</span>
              <strong>+{snapshot.self?.currentResult?.awardedPoints ?? 0} điểm</strong>
            </div>
            <div className="correct-answer">
              <small>Đáp án</small>
              <strong>{snapshot.reveal?.answer}</strong>
              {snapshot.reveal?.bibleReference ? <em>{snapshot.reveal.bibleReference}</em> : null}
              <p>{snapshot.reveal?.explanation}</p>
            </div>
          </div>
          {verticalGuess?.result ? (
            <div
              className={`vertical-guess-result ${verticalGuess.result.isCorrect ? "correct" : "incorrect"}`}
              role="status"
            >
              {verticalGuess.result.isCorrect ? <CheckCircle2 /> : <XCircle />}
              <div>
                <span>Hàng dọc: {verticalGuess.result.isCorrect ? "Chính xác!" : "Chưa đúng"}</span>
                <strong>+{verticalGuess.result.awardedPoints} điểm thưởng</strong>
                <small>Ô hàng dọc vẫn được giữ kín cho những người chơi khác.</small>
              </div>
            </div>
          ) : null}
          {snapshot.crosswordVerticalReveal ? (
            <div className="crossword-final-answer">
              <span>Đáp án hàng dọc</span>
              <strong>{snapshot.crosswordVerticalReveal.answer}</strong>
              <small>{snapshot.crosswordVerticalReveal.clue}</small>
              {snapshot.crosswordVerticalReveal.bibleReference ? (
                <em>{snapshot.crosswordVerticalReveal.bibleReference}</em>
              ) : null}
              <p>{snapshot.crosswordVerticalReveal.explanation}</p>
            </div>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
