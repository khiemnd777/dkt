import type { SessionRole } from "@shared/room";

export function sessionKey(role: SessionRole, roomCode: string): string {
  return `dkt:${role}:${roomCode}`;
}

export function saveSession(role: SessionRole, roomCode: string, token: string): void {
  sessionStorage.setItem(sessionKey(role, roomCode), token);
}

export function readSession(role: SessionRole, roomCode: string): string | null {
  return sessionStorage.getItem(sessionKey(role, roomCode));
}

export function clearSession(role: SessionRole, roomCode: string): void {
  sessionStorage.removeItem(sessionKey(role, roomCode));
}

export function bootstrapFragmentToken(role: SessionRole, roomCode: string): string | null {
  const fragment = new URLSearchParams(window.location.hash.slice(1));
  const token = fragment.get("token");
  if (token) {
    saveSession(role, roomCode, token);
    window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    return token;
  }
  return readSession(role, roomCode);
}
