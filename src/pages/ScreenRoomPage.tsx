import type { RoomSnapshot } from "@shared/room";
import { Crown, PauseCircle, Radio, Trophy, Users } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ConnectionBanner } from "../components/shared/ConnectionBanner";
import { Countdown } from "../components/shared/Countdown";
import { FeedbackToggle } from "../components/shared/FeedbackToggle";
import { Leaderboard } from "../components/shared/Leaderboard";
import { CrosswordBoard } from "../features/crossword/CrosswordBoard";
import { useGameFeedback } from "../features/feedback/useGameFeedback";
import { RuntimeQuestionMedia } from "../features/media/QuestionMedia";
import { useRoomRealtime } from "../features/realtime/useRoomRealtime";
import { formatCountdown, useCountdown } from "../hooks/useCountdown";
import { bootstrapFragmentToken, clearSession } from "../lib/session";

export function ScreenRoomPage() {
  const code = (useParams().roomCode ?? "").toUpperCase();
  const [token] = useState(() => bootstrapFragmentToken("SCREEN", code));
  const realtime = useRoomRealtime({
    roomCode: code,
    role: "SCREEN",
    token,
    onDeleted: () => clearSession("SCREEN", code),
  });
  const feedback = useGameFeedback(realtime.snapshot, "SCREEN");
  if (!token)
    return (
      <main className="screen-page centered">
        <h1>Thiếu phiên màn hình</h1>
        <p>Hãy mở màn hình trình chiếu từ bảng điều khiển người dẫn.</p>
        <Link className="button gold" to="/">
          Về trang chủ
        </Link>
      </main>
    );
  return (
    <main className="screen-page">
      <ConnectionBanner state={realtime.connection} />
      <header className="screen-header">
        <div className="screen-brand">
          📖 ĐỐ KINH THÁNH <strong>LIVE</strong>
        </div>
        <FeedbackToggle enabled={feedback.enabled} onToggle={feedback.toggle} dark />
        <div>
          <span>PHÒNG</span>
          <strong>{code}</strong>
        </div>
      </header>
      {realtime.snapshot ? (
        <ScreenStage snapshot={realtime.snapshot} offset={realtime.serverOffsetMs} />
      ) : (
        <div className="screen-loading">Đang kết nối màn hình…</div>
      )}
    </main>
  );
}

function ScreenStage({ snapshot, offset }: { snapshot: RoomSnapshot; offset: number }) {
  const joinUrl = `${window.location.origin}/join/${snapshot.roomCode}`;
  const deleteRemaining = useCountdown(snapshot.finishedDeleteAt, offset);
  if (snapshot.phase === "LOBBY")
    return (
      <section className="screen-lobby">
        <div className="screen-lobby-copy">
          <span className="live-label">
            <Radio /> Đang chờ người chơi
          </span>
          <h1>{snapshot.gameTitle}</h1>
          <div className="screen-room-code">
            <span>Vào trang và nhập mã</span>
            <strong>{snapshot.roomCode}</strong>
            <small>{joinUrl}</small>
          </div>
          <div className="screen-player-count">
            <Users /> <strong>{snapshot.playerCount}</strong> người đã tham gia
          </div>
          <div className="screen-mode">
            {snapshot.mode === "TURN_BASED"
              ? "📖 Theo lượt câu hỏi · Ai đúng cũng nhận 1.000 điểm"
              : "⚡ Đua tốc độ · Nhanh hơn nhận nhiều điểm hơn"}
          </div>
        </div>
        <div className="screen-qr">
          <QRCodeSVG value={joinUrl} size={300} level="M" marginSize={3} />
          <span>Quét mã để tham gia</span>
        </div>
      </section>
    );
  if (snapshot.phase === "COUNTDOWN")
    return (
      <section className="screen-stage centered">
        <span className="screen-kicker">
          CÂU {snapshot.currentRoundIndex + 1} / {snapshot.totalRounds}
        </span>
        <h1>Chuẩn bị!</h1>
        <Countdown deadline={snapshot.countdownEndsAt} offset={offset} large />
      </section>
    );
  if (snapshot.phase === "QUESTION_PAUSED")
    return (
      <section className="screen-stage centered paused-stage" role="status" aria-live="polite">
        <PauseCircle />
        <span className="screen-kicker">CÂU {snapshot.currentRoundIndex + 1}</span>
        <h1>Tạm dừng</h1>
        <p>Đồng hồ và nhận đáp án sẽ tiếp tục khi người dẫn sẵn sàng.</p>
      </section>
    );
  if (snapshot.phase === "LEADERBOARD")
    return (
      <section className="screen-stage leaderboard-stage">
        <div className="screen-title">
          <Trophy />
          <h1>Bảng xếp hạng</h1>
        </div>
        <Leaderboard entries={snapshot.leaderboard ?? []} limit={10} />
      </section>
    );
  if (snapshot.phase === "FINISHED")
    return (
      <section className="screen-stage final-stage">
        <div className="confetti" aria-hidden="true">
          ✦　★　✧　◆　✦　★　✧
        </div>
        <div className="screen-title">
          <Crown />
          <h1>Kết quả chung cuộc</h1>
        </div>
        <Leaderboard entries={snapshot.leaderboard ?? []} limit={10} />
        <p>
          Phòng sẽ tự động bị xóa sau <strong>{formatCountdown(deleteRemaining)}</strong>
        </p>
      </section>
    );
  if (snapshot.phase === "DELETING")
    return (
      <section className="screen-stage centered">
        <h1>Phòng chơi đã kết thúc</h1>
        <p>Mọi dữ liệu tạm thời đã được xóa. Cảm ơn mọi người!</p>
      </section>
    );
  if (snapshot.phase === "MEDIA_PREPARE")
    return (
      <section className="screen-stage centered media-prepare-stage">
        <span className="screen-kicker">CÂU {snapshot.currentRoundIndex + 1}</span>
        <RuntimeQuestionMedia media={snapshot.currentRound?.publicPayload.media} autoPlay />
        <h1>{snapshot.currentRound?.publicPayload.prompt}</h1>
        {snapshot.answerOpenedAt ? (
          <>
            <p>Thời gian trả lời sẽ bắt đầu sau phần media.</p>
            <Countdown deadline={snapshot.answerOpenedAt} offset={offset} large />
          </>
        ) : (
          <p>Đang chờ người dẫn xác nhận media sẵn sàng…</p>
        )}
      </section>
    );
  return (
    <section className="screen-stage question-stage">
      <div className="screen-round-meta">
        <span>
          CÂU {snapshot.currentRoundIndex + 1} / {snapshot.totalRounds}
        </span>
        {snapshot.phase === "QUESTION_OPEN" ? (
          <Countdown deadline={snapshot.deadlineAt} offset={offset} large />
        ) : (
          <span className="locked-label">
            {snapshot.phase === "QUESTION_LOCKED" ? "ĐÃ KHÓA" : "ĐÁP ÁN"}
          </span>
        )}
      </div>
      <CrosswordBoard snapshot={snapshot} large />
      <RuntimeQuestionMedia media={snapshot.currentRound?.publicPayload.media} />
      <h1>{snapshot.currentRound?.publicPayload.prompt}</h1>
      {snapshot.currentRound?.publicPayload.options && !snapshot.reveal ? (
        <div className="screen-options">
          {snapshot.currentRound.publicPayload.options.map((option, index) => (
            <div key={option.id}>
              <span>{String.fromCharCode(65 + index)}</span>
              {option.text}
            </div>
          ))}
        </div>
      ) : null}
      <div className="screen-answer-count">
        <strong>{snapshot.answeredCount}</strong> / {snapshot.eligibleCount} đã trả lời
      </div>
      {snapshot.reveal ? (
        <div className="screen-reveal">
          <span>ĐÁP ÁN ĐÚNG</span>
          <strong>{snapshot.reveal.answer}</strong>
          {snapshot.reveal.bibleReference ? <em>{snapshot.reveal.bibleReference}</em> : null}
          <p>{snapshot.reveal.explanation}</p>
          {snapshot.crosswordVerticalReveal ? (
            <div className="screen-vertical-answer">
              <span>ĐÁP ÁN HÀNG DỌC</span>
              <strong>{snapshot.crosswordVerticalReveal.answer}</strong>
              <small>{snapshot.crosswordVerticalReveal.clue}</small>
              {snapshot.crosswordVerticalReveal.bibleReference ? (
                <em>{snapshot.crosswordVerticalReveal.bibleReference}</em>
              ) : null}
              <p>{snapshot.crosswordVerticalReveal.explanation}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
