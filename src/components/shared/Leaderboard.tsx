import type { LeaderboardEntry } from "@shared/room";
import { Crown, Medal, Trophy } from "lucide-react";

export function Leaderboard({
  entries,
  selfId,
  limit,
}: {
  entries: LeaderboardEntry[];
  selfId?: string;
  limit?: number;
}) {
  const visible = limit ? entries.slice(0, limit) : entries;
  const self = selfId ? entries.find((entry) => entry.playerId === selfId) : undefined;
  const showSelf = self && !visible.some((entry) => entry.playerId === self.playerId);
  return (
    <ol className="leaderboard" aria-label="Bảng xếp hạng">
      {visible.map((entry) => (
        <li
          className={`leader-row ${entry.playerId === selfId ? "self" : ""}`}
          key={entry.playerId}
        >
          <span className="rank">
            {entry.rank === 1 ? (
              <Crown size={20} />
            ) : entry.rank <= 3 ? (
              <Medal size={20} />
            ) : (
              `#${entry.rank}`
            )}
          </span>
          <span className="avatar" aria-hidden="true">
            {entry.avatarId}
          </span>
          <span className="leader-name">{entry.displayName}</span>
          <strong>{entry.totalScore.toLocaleString("vi-VN")}</strong>
        </li>
      ))}
      {showSelf && self ? (
        <>
          <li className="leader-separator" aria-hidden="true">
            •••
          </li>
          <li className="leader-row self">
            <span className="rank">#{self.rank}</span>
            <span className="avatar" aria-hidden="true">
              {self.avatarId}
            </span>
            <span className="leader-name">{self.displayName}</span>
            <strong>{self.totalScore.toLocaleString("vi-VN")}</strong>
          </li>
        </>
      ) : null}
      {!entries.length ? (
        <li className="empty-state">
          <Trophy /> Chưa có điểm số
        </li>
      ) : null}
    </ol>
  );
}
