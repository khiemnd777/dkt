import type { Player, RoomSecrets, SessionRole } from "../../shared/room";
import { hashToken } from "../security/crypto";

export interface AuthenticatedSession {
  role: SessionRole;
  playerId?: string;
}

export async function authenticateSession(
  token: string,
  requestedRole: SessionRole,
  secrets: RoomSecrets,
  players: Record<string, Player>,
): Promise<AuthenticatedSession | undefined> {
  const hash = await hashToken(token);
  if (requestedRole === "HOST" && hash === secrets.hostTokenHash) return { role: "HOST" };
  if (requestedRole === "SCREEN" && hash === secrets.screenTokenHash) return { role: "SCREEN" };
  if (requestedRole === "PLAYER") {
    const player = Object.values(players).find(
      (candidate) => !candidate.removed && candidate.playerTokenHash === hash,
    );
    if (player) return { role: "PLAYER", playerId: player.playerId };
  }
  return undefined;
}
