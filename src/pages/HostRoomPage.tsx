import {
  Clipboard,
  ExternalLink,
  KeyRound,
  LockKeyhole,
  PauseCircle,
  Play,
  PlayCircle,
  Presentation,
  Radio,
  Trash2,
  Users,
  Volume2,
  Wifi,
} from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { useRef, useState } from "react";
import { useParams } from "react-router-dom";
import { Brand } from "../components/shared/Brand";
import { ConnectionBanner } from "../components/shared/ConnectionBanner";
import { Countdown } from "../components/shared/Countdown";
import { FeedbackToggle } from "../components/shared/FeedbackToggle";
import { Leaderboard } from "../components/shared/Leaderboard";
import { PrivacyNotice } from "../components/shared/PrivacyNotice";
import { ConfirmDialog } from "../components/ui/ConfirmDialog";
import { CrosswordBoard } from "../features/crossword/CrosswordBoard";
import { useGameFeedback } from "../features/feedback/useGameFeedback";
import { RuntimeQuestionMedia } from "../features/media/QuestionMedia";
import { useRoomRealtime } from "../features/realtime/useRoomRealtime";
import { bootstrapFragmentToken, clearSession, readSession } from "../lib/session";

export function HostRoomPage() {
  const code = (useParams().roomCode ?? "").toUpperCase();
  const [token] = useState(() => bootstrapFragmentToken("HOST", code));
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [recoveryCopied, setRecoveryCopied] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const soundContext = useRef<AudioContext | null>(null);
  const realtime = useRoomRealtime({
    roomCode: code,
    role: "HOST",
    token,
    onDeleted: () => clearSession("HOST", code),
  });
  const room = realtime.snapshot;
  const controlsDisabled = realtime.connection !== "CONNECTED";
  const feedback = useGameFeedback(room, "HOST");
  const joinUrl = `${window.location.origin}/join/${code}`;
  const screenToken = readSession("SCREEN", code);
  const openScreen = () => {
    if (screenToken)
      window.open(
        `/screen/${code}#token=${encodeURIComponent(screenToken)}`,
        "_blank",
        "noopener,noreferrer",
      );
  };
  const copy = async () => {
    await navigator.clipboard.writeText(joinUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  };
  const copyRecovery = async () => {
    if (!token) return;
    const recoveryUrl = `${window.location.origin}/host/${code}#token=${encodeURIComponent(token)}`;
    await navigator.clipboard.writeText(recoveryUrl);
    setRecoveryCopied(true);
    window.setTimeout(() => setRecoveryCopied(false), 2_000);
  };
  const enableSound = async () => {
    try {
      soundContext.current ??= new AudioContext();
      await soundContext.current.resume();
      setSoundEnabled(true);
    } catch {
      setSoundEnabled(false);
    }
  };
  const control = () => {
    if (!room) return null;
    if (room.phase === "LOBBY")
      return (
        <button
          className="button gold huge"
          type="button"
          disabled={!room.playerCount || controlsDisabled}
          onClick={() => realtime.send({ type: "host.start_game" })}
        >
          <Play /> Bắt đầu game
        </button>
      );
    if (room.phase === "QUESTION_OPEN")
      return (
        <>
          <button
            className="button secondary"
            type="button"
            disabled={controlsDisabled}
            onClick={() => realtime.send({ type: "host.pause_round" })}
          >
            <PauseCircle /> Tạm dừng
          </button>
          <button
            className="button gold"
            type="button"
            disabled={controlsDisabled}
            onClick={() => realtime.send({ type: "host.lock_round" })}
          >
            <LockKeyhole /> Khóa câu hỏi sớm
          </button>
        </>
      );
    if (room.phase === "QUESTION_PAUSED")
      return (
        <button
          className="button gold"
          type="button"
          disabled={controlsDisabled}
          onClick={() => realtime.send({ type: "host.resume_round" })}
        >
          <PlayCircle /> Tiếp tục câu hỏi
        </button>
      );
    if (room.phase === "QUESTION_LOCKED")
      return (
        <button
          className="button gold"
          type="button"
          disabled={controlsDisabled}
          onClick={() => realtime.send({ type: "host.reveal_answer" })}
        >
          Hiện đáp án
        </button>
      );
    if (room.phase === "ANSWER_REVEAL")
      return (
        <button
          className="button gold"
          type="button"
          disabled={controlsDisabled}
          onClick={() => realtime.send({ type: "host.show_leaderboard" })}
        >
          Hiện bảng xếp hạng
        </button>
      );
    if (room.phase === "LEADERBOARD")
      return (
        <button
          className="button gold"
          type="button"
          disabled={controlsDisabled}
          onClick={() => realtime.send({ type: "host.continue" })}
        >
          {room.currentRoundIndex + 1 >= room.totalRounds ? "Hoàn tất game" : "Câu tiếp theo"}
        </button>
      );
    return null;
  };
  if (!token) return <MissingSession sessionLabel="người dẫn" />;
  return (
    <main className="room-page host-page">
      <ConnectionBanner state={realtime.connection} />
      <header className="room-header">
        <Brand compact />
        <div className="room-header-meta">
          <span>PHÒNG</span>
          <strong>{code}</strong>
        </div>
        <FeedbackToggle enabled={feedback.enabled} onToggle={feedback.toggle} />
        <div className="connection-chip">
          <Wifi /> {realtime.connection === "CONNECTED" ? "Đã kết nối" : "Đang kết nối"}
        </div>
      </header>
      {realtime.notice ? (
        <div className="toast error" role="alert">
          {realtime.notice}
          <button type="button" onClick={realtime.clearNotice} aria-label="Đóng thông báo">
            ×
          </button>
        </div>
      ) : null}
      {!room ? (
        <div className="loading-card">Đang mở bảng điều khiển…</div>
      ) : (
        <div className="host-layout">
          <section className="host-main">
            {room.phase === "LOBBY" ? (
              <div className="host-lobby">
                <div className="lobby-title">
                  <span className="eyebrow">
                    <Radio /> Sẵn sàng phát trực tiếp
                  </span>
                  <h1>{room.gameTitle}</h1>
                  <p>
                    {room.mode === "TURN_BASED" ? "Theo lượt câu hỏi" : "Đua tốc độ"} ·{" "}
                    {room.totalRounds} vòng chơi
                  </p>
                </div>
                <div className="share-panel">
                  <div className="qr-card">
                    <QRCodeSVG value={joinUrl} size={190} level="M" marginSize={2} />
                    <span>Quét để tham gia</span>
                  </div>
                  <div className="share-details">
                    <span>Mã phòng</span>
                    <strong>{code}</strong>
                    <button className="button secondary" type="button" onClick={copy}>
                      <Clipboard /> {copied ? "Đã sao chép" : "Sao chép đường dẫn"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={openScreen}
                      disabled={!screenToken}
                    >
                      <Presentation /> Mở màn hình trình chiếu <ExternalLink />
                    </button>
                    <button className="button secondary" type="button" onClick={copyRecovery}>
                      <KeyRound />
                      {recoveryCopied ? "Đã sao chép link bí mật" : "Sao chép link khôi phục host"}
                    </button>
                    <button
                      className="button secondary"
                      type="button"
                      onClick={() => void enableSound()}
                      aria-pressed={soundEnabled}
                    >
                      <Volume2 /> {soundEnabled ? "Âm thanh đã bật" : "Bật âm thanh"}
                    </button>
                    <small className="secret-hint" role="status">
                      Link này có toàn quyền điều khiển phòng. Chỉ lưu hoặc gửi riêng cho người dẫn.
                    </small>
                  </div>
                </div>
                <PrivacyNotice />
              </div>
            ) : (
              <HostGameStage
                room={room}
                offset={realtime.serverOffsetMs}
                onMediaReady={(mode) => {
                  const roundId = room.currentRound?.roundId;
                  if (roundId)
                    realtime.send({ type: "host.media_ready", payload: { roundId, mode } });
                }}
              />
            )}
            <div className="host-controls">
              {control()}
              <button
                className="button danger ghost"
                type="button"
                disabled={controlsDisabled}
                onClick={() => setDeleteOpen(true)}
              >
                <Trash2 /> Kết thúc và xóa phòng ngay
              </button>
            </div>
          </section>
          <aside className="players-panel">
            <div className="panel-heading">
              <span>
                <Users /> Người chơi
              </span>
              <strong>{room.playerCount}</strong>
            </div>
            <div className="player-list">
              {room.players
                ?.filter((player) => !player.removed)
                .map((player) => (
                  <div className="player-row" key={player.playerId}>
                    <span className="avatar">{player.avatarId}</span>
                    <span>
                      <strong>{player.displayName}</strong>
                      <small>
                        {player.connected ? "Đang kết nối" : "Mất kết nối"}
                        {player.answered ? " · Đã trả lời" : ""}
                      </small>
                    </span>
                    <button
                      type="button"
                      aria-label={`Mời ${player.displayName} ra khỏi phòng`}
                      disabled={controlsDisabled}
                      onClick={() =>
                        realtime.send({
                          type: "host.remove_player",
                          payload: { playerId: player.playerId },
                        })
                      }
                    >
                      ×
                    </button>
                  </div>
                ))}
            </div>
            {!room.playerCount ? (
              <p className="empty-hint">Chia sẻ mã phòng để mời mọi người vào.</p>
            ) : null}
          </aside>
        </div>
      )}
      <ConfirmDialog
        open={deleteOpen}
        title="Xóa phòng ngay?"
        description="Toàn bộ câu hỏi, người chơi, câu trả lời và điểm số sẽ bị xóa ngay lập tức. Thao tác này không thể hoàn tác."
        confirmLabel="Xóa toàn bộ phòng"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={() => {
          if (realtime.send({ type: "host.delete_room" })) setDeleteOpen(false);
        }}
      />
    </main>
  );
}

function HostGameStage({
  room,
  offset,
  onMediaReady,
}: {
  room: NonNullable<ReturnType<typeof useRoomRealtime>["snapshot"]>;
  offset: number;
  onMediaReady: (mode: "READY" | "FALLBACK") => void;
}) {
  if (room.phase === "COUNTDOWN")
    return (
      <div className="stage centered">
        <span className="eyebrow">Chuẩn bị câu {room.currentRoundIndex + 1}</span>
        <Countdown deadline={room.countdownEndsAt} offset={offset} large />
      </div>
    );
  if (room.phase === "QUESTION_PAUSED")
    return (
      <div className="stage centered paused-stage">
        <PauseCircle />
        <span className="eyebrow">Câu {room.currentRoundIndex + 1}</span>
        <h1>Đã tạm dừng</h1>
        <p>Đồng hồ và nhận đáp án đang dừng. Nhấn “Tiếp tục câu hỏi” khi sẵn sàng.</p>
      </div>
    );
  if (room.phase === "LEADERBOARD" || room.phase === "FINISHED")
    return (
      <div className="stage">
        <h1>{room.phase === "FINISHED" ? "Kết quả chung cuộc" : "Bảng xếp hạng"}</h1>
        <Leaderboard entries={room.leaderboard ?? []} />
      </div>
    );
  if (room.phase === "DELETING")
    return (
      <div className="stage centered">
        <h1>Phòng đã được xóa</h1>
        <p>Mọi dữ liệu tạm thời của phòng đã được xóa.</p>
      </div>
    );
  if (room.phase === "MEDIA_PREPARE")
    return (
      <div className="stage centered media-prepare-stage">
        <span className="eyebrow">Đang trình bày media câu {room.currentRoundIndex + 1}</span>
        <RuntimeQuestionMedia
          media={room.currentRound?.publicPayload.media}
          autoPlay
          onReady={() => onMediaReady("READY")}
          onFailure={() => onMediaReady("FALLBACK")}
        />
        <h1>{room.currentRound?.publicPayload.prompt}</h1>
        {room.answerOpenedAt ? (
          <>
            <p>Đồng hồ trả lời sẽ bắt đầu sau phần media.</p>
            <Countdown deadline={room.answerOpenedAt} offset={offset} />
          </>
        ) : (
          <>
            <p>
              Đang chờ media sẵn sàng. Nếu trình duyệt chặn âm thanh, hãy nhấn phát hoặc dùng nội
              dung thay thế.
            </p>
            <button
              className="button secondary"
              type="button"
              onClick={() => onMediaReady("FALLBACK")}
            >
              Dùng nội dung thay thế
            </button>
          </>
        )}
      </div>
    );
  return (
    <div className="stage">
      <div className="round-meta">
        <span>
          Câu {room.currentRoundIndex + 1} / {room.totalRounds}
        </span>
        {room.phase === "QUESTION_OPEN" ? (
          <Countdown deadline={room.deadlineAt} offset={offset} />
        ) : (
          <span className="phase-chip">
            {room.phase === "QUESTION_LOCKED" ? "Đã khóa" : "Đáp án"}
          </span>
        )}
      </div>
      <RuntimeQuestionMedia media={room.currentRound?.publicPayload.media} />
      <h1>{room.currentRound?.publicPayload.prompt}</h1>
      <CrosswordBoard snapshot={room} />
      {room.currentRound?.publicPayload.options ? (
        <div className="host-options">
          {room.currentRound.publicPayload.options.map((option) => (
            <div key={option.id}>{option.text}</div>
          ))}
        </div>
      ) : null}
      <div className="answer-progress">
        <strong>
          {room.answeredCount} / {room.eligibleCount}
        </strong>
        <span>người đã trả lời</span>
        <div>
          <i
            style={{
              width: `${room.eligibleCount ? (room.answeredCount / room.eligibleCount) * 100 : 0}%`,
            }}
          />
        </div>
      </div>
      {room.reveal ? (
        <div className="reveal-card">
          <span>Đáp án đúng</span>
          <strong>{room.reveal.answer}</strong>
          {room.reveal.bibleReference ? <em>{room.reveal.bibleReference}</em> : null}
          <p>{room.reveal.explanation}</p>
        </div>
      ) : null}
      {room.crosswordVerticalReveal ? (
        <div className="reveal-card crossword-final-answer">
          <span>Đáp án hàng dọc</span>
          <strong>{room.crosswordVerticalReveal.answer}</strong>
          <small>{room.crosswordVerticalReveal.clue}</small>
          {room.crosswordVerticalReveal.bibleReference ? (
            <em>{room.crosswordVerticalReveal.bibleReference}</em>
          ) : null}
          <p>{room.crosswordVerticalReveal.explanation}</p>
        </div>
      ) : null}
    </div>
  );
}

function MissingSession({ sessionLabel }: { sessionLabel: string }) {
  return (
    <main className="center-page">
      <Brand />
      <h1>Thiếu phiên {sessionLabel}</h1>
      <p>Hãy mở đúng đường dẫn bí mật được tạo cùng phòng chơi.</p>
      <a className="button primary" href="/">
        Về trang chủ
      </a>
    </main>
  );
}
