import { ArrowRight, BookOpenCheck, Gamepad2, Sparkles, Users } from "lucide-react";
import { type FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Brand } from "../components/shared/Brand";
import { ContactChannels } from "../components/shared/ContactChannels";
import { PrivacyNotice } from "../components/shared/PrivacyNotice";

export function HomePage() {
  const [roomCode, setRoomCode] = useState("");
  const navigate = useNavigate();
  const join = (event: FormEvent) => {
    event.preventDefault();
    if (/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/u.test(roomCode)) navigate(`/join/${roomCode}`);
  };
  return (
    <main className="home-page">
      <header className="site-header">
        <Brand />
        <a
          className="text-link"
          href="https://dokinhthanh.io.vn/vi/quyen-rieng-tu-va-vong-doi-du-lieu/"
        >
          Quyền riêng tư
        </a>
      </header>
      <section className="hero">
        <div className="hero-copy">
          <div className="eyebrow">
            <Sparkles size={16} /> Cùng học Lời Chúa, cùng vui
          </div>
          <h1>
            Một game Kinh Thánh.
            <br />
            <span>Cả nhóm cùng chơi.</span>
          </h1>
          <p className="hero-lede">
            Tạo câu hỏi ngay trong trình duyệt, chia sẻ mã phòng và xem mọi người tranh tài theo
            thời gian thực.
          </p>
          <div className="hero-actions">
            <Link className="button primary large" to="/create">
              <Gamepad2 /> Tạo game mới <ArrowRight />
            </Link>
          </div>
          <form className="join-card" onSubmit={join}>
            <label htmlFor="room-code">Đã có mã phòng?</label>
            <div className="join-row">
              <input
                id="room-code"
                className="room-code-input"
                value={roomCode}
                onChange={(event) =>
                  setRoomCode(
                    event.target.value
                      .toUpperCase()
                      .replace(/[^A-Z2-9]/gu, "")
                      .slice(0, 6),
                  )
                }
                placeholder="ABC234"
                autoComplete="off"
                inputMode="text"
                aria-describedby="room-code-help"
              />
              <button className="button gold" type="submit" disabled={roomCode.length !== 6}>
                Tham gia
              </button>
            </div>
            <span id="room-code-help">Nhập mã gồm 6 ký tự trên màn hình của người dẫn.</span>
          </form>
        </div>
        <div className="hero-visual" aria-hidden="true">
          <div className="show-card card-one">
            <span>📖</span>
            <strong>Ai đã đánh bại Gô-li-át?</strong>
            <small>Câu 4 / 10</small>
          </div>
          <div className="show-card card-two">
            <span>🏆</span>
            <strong>1. An — 4.850</strong>
            <small>Bảng xếp hạng trực tiếp</small>
          </div>
          <div className="show-card card-three">
            <Users />
            <strong>24 người đã vào</strong>
            <small>Mã phòng · DKT234</small>
          </div>
        </div>
      </section>
      <section className="feature-strip" aria-label="Điểm nổi bật">
        <div>
          <BookOpenCheck />
          <span>
            <strong>4 loại câu hỏi</strong>Trắc nghiệm, đúng sai, trả lời ngắn, ô chữ
          </span>
        </div>
        <div>
          <Users />
          <span>
            <strong>Ai đúng cũng có điểm</strong>Chơi theo lượt hoặc đua tốc độ
          </span>
        </div>
        <div>
          <Sparkles />
          <span>
            <strong>Không cần tài khoản</strong>Mở lên, tạo phòng và cùng chơi
          </span>
        </div>
      </section>
      <PrivacyNotice />
      <footer className="site-footer">
        <ContactChannels />
        <p>Đố Kinh Thánh Live · Thiết kế cho những buổi nhóm đầy niềm vui</p>
      </footer>
    </main>
  );
}
