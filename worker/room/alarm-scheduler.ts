import type { RoomMeta, RoomProgress } from "../../shared/room";

export function nextAlarmAt(meta: RoomMeta, progress: RoomProgress): number | undefined {
  const deadlines = [meta.hardExpiresAt, meta.inactivityExpiresAt, meta.finishedDeleteAt];
  if (progress.phase === "COUNTDOWN") deadlines.push(progress.countdownEndsAt);
  if (progress.phase === "MEDIA_PREPARE") {
    deadlines.push(progress.mediaReadyDeadlineAt, progress.answerOpenedAt);
  }
  if (progress.phase === "QUESTION_OPEN") deadlines.push(progress.deadlineAt);
  if (meta.finishedDeleteAt) deadlines.push(meta.finishedDeleteAt - 60_000);
  const now = Date.now();
  const future = deadlines.filter(
    (value): value is number => typeof value === "number" && value > now,
  );
  return future.length ? Math.min(...future) : undefined;
}

export async function scheduleNextAlarm(
  storage: DurableObjectStorage,
  meta: RoomMeta,
  progress: RoomProgress,
): Promise<void> {
  const next = nextAlarmAt(meta, progress);
  if (next) await storage.setAlarm(next);
  else await storage.deleteAlarm();
}
