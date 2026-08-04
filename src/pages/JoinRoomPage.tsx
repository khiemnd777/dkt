import { AVATARS } from "@shared/limits";
import type { PublicRoomMetadata } from "@shared/room";
import { ArrowRight, Users } from "lucide-react";
import { type FormEvent, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Brand } from "../components/shared/Brand";
import { PrivacyNotice } from "../components/shared/PrivacyNotice";
import { api } from "../lib/api";
import { readSession, saveSession } from "../lib/session";

export function JoinRoomPage() {
  const code = (useParams().roomCode ?? "").toUpperCase();
  const navigate = useNavigate();
  const [room, setRoom] = useState<PublicRoomMetadata>();
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<string>(AVATARS[0]);
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);

  useEffect(() => {
    api
      .publicRoom(code)
      .then(setRoom)
      .catch((cause: Error) => setError(cause.message))
      .finally(() => setLoading(false));
  }, [code]);

  const join = async (event: FormEvent) => {
    event.preventDefault();
    setJoining(true);
    setError(undefined);
    try {
      const result = await api.join(code, {
        displayName: name,
        avatarId: avatar,
        reconnectToken: readSession("PLAYER", code) ?? undefined,
      });
      saveSession("PLAYER", code, result.playerToken);
      navigate(`/play/${code}`, { replace: true });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Không thể tham gia phòng.");
    } finally {
      setJoining(false);
    }
  };

  return (
    <main className="join-page">
      <header className="site-header">
        <Brand compact />
        <Link className="text-link" to="/">
          Đổi mã phòng
        </Link>
      </header>
      <section className="join-panel">
        <div className="room-code-pill">
          Mã phòng <strong>{code}</strong>
        </div>
        {loading ? <div className="loading-card">Đang tìm phòng…</div> : null}
        {error && !room ? (
          <div className="error-card" role="alert">
            <h1>Không thể vào phòng</h1>
            <p>{error}</p>
            <Link to="/" className="button secondary">
              Nhập mã khác
            </Link>
          </div>
        ) : null}
        {room ? (
          <>
            <div className="join-heading">
              <span className="round-icon">📖</span>
              <h1>{room.gameTitle}</h1>
              <p>
                {room.mode === "TURN_BASED"
                  ? "Theo lượt câu hỏi · Ai đúng cũng nhận 1.000 điểm"
                  : "Đua tốc độ · Ai đúng cũng có điểm, trả lời nhanh được nhiều hơn"}
              </p>
              <span className="player-count">
                <Users size={17} /> {room.playerCount} người trong phòng
              </span>
            </div>
            <form className="join-form" onSubmit={join}>
              <label htmlFor="display-name">Tên hiển thị</label>
              <input
                id="display-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                minLength={2}
                maxLength={24}
                placeholder="Ví dụ: Minh Anh"
                required
              />
              <fieldset>
                <legend>Chọn hình đại diện</legend>
                <div className="avatar-grid">
                  {AVATARS.map((candidate) => (
                    <button
                      key={candidate}
                      type="button"
                      className={avatar === candidate ? "selected" : ""}
                      aria-label={`Chọn ${candidate}`}
                      aria-pressed={avatar === candidate}
                      onClick={() => setAvatar(candidate)}
                    >
                      {candidate}
                    </button>
                  ))}
                </div>
              </fieldset>
              {error ? (
                <p className="field-error" role="alert">
                  {error}
                </p>
              ) : null}
              <button
                type="submit"
                className="button primary large full"
                disabled={joining || !room.canJoin}
              >
                {joining ? (
                  "Đang vào phòng…"
                ) : (
                  <>
                    Vào phòng <ArrowRight />
                  </>
                )}
              </button>
            </form>
            <PrivacyNotice compact />
          </>
        ) : null}
      </section>
    </main>
  );
}
