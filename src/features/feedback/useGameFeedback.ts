import type { RoomSnapshot, SessionRole } from "@shared/room";
import { useCallback, useEffect, useRef, useState } from "react";

const FEEDBACK_KEY = "dkt:feedback-enabled";
let audioContext: AudioContext | undefined;

type Cue = "enabled" | "countdown" | "opened" | "paused" | "correct" | "incorrect" | "finished";

function readEnabled(): boolean {
  try {
    return sessionStorage.getItem(FEEDBACK_KEY) === "true";
  } catch {
    return false;
  }
}

async function playCue(cue: Cue): Promise<void> {
  const AudioContextConstructor =
    window.AudioContext ??
    (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioContextConstructor) return;
  audioContext ??= new AudioContextConstructor();
  if (audioContext.state === "suspended") await audioContext.resume().catch(() => undefined);
  const frequencies: Record<Cue, number> = {
    enabled: 660,
    countdown: 440,
    opened: 740,
    paused: 310,
    correct: 880,
    incorrect: 220,
    finished: 990,
  };
  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  const now = audioContext.currentTime;
  oscillator.type = cue === "incorrect" ? "sawtooth" : "sine";
  oscillator.frequency.setValueAtTime(frequencies[cue], now);
  if (cue === "correct" || cue === "finished")
    oscillator.frequency.exponentialRampToValueAtTime(frequencies[cue] * 1.25, now + 0.16);
  gain.gain.setValueAtTime(0.0001, now);
  gain.gain.exponentialRampToValueAtTime(0.12, now + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start(now);
  oscillator.stop(now + 0.24);
}

function vibrate(cue: Cue): void {
  if (!("vibrate" in navigator)) return;
  const pattern = cue === "correct" ? [45, 35, 70] : cue === "incorrect" ? [120] : [35];
  navigator.vibrate(pattern);
}

export function useGameFeedback(snapshot: RoomSnapshot | undefined, role: SessionRole) {
  const [enabled, setEnabled] = useState(readEnabled);
  const previousPhase = useRef(snapshot?.phase);
  const previousRound = useRef(snapshot?.currentRoundIndex);
  const previousResult = useRef<boolean | undefined>(undefined);

  useEffect(() => {
    const phase = snapshot?.phase;
    const result = snapshot?.self?.currentResult?.isCorrect;
    if (enabled && snapshot) {
      let cue: Cue | undefined;
      if (result !== undefined && result !== previousResult.current)
        cue = result ? "correct" : "incorrect";
      else if (
        phase !== previousPhase.current ||
        snapshot.currentRoundIndex !== previousRound.current
      ) {
        if (phase === "COUNTDOWN") cue = "countdown";
        else if (phase === "QUESTION_OPEN") cue = "opened";
        else if (phase === "QUESTION_PAUSED") cue = "paused";
        else if (phase === "FINISHED") cue = "finished";
      }
      if (cue) {
        void playCue(cue);
        if (role === "PLAYER") vibrate(cue);
      }
    }
    previousPhase.current = phase;
    previousRound.current = snapshot?.currentRoundIndex;
    previousResult.current = result;
  }, [enabled, role, snapshot]);

  const toggle = useCallback(() => {
    setEnabled((current) => {
      const next = !current;
      try {
        sessionStorage.setItem(FEEDBACK_KEY, String(next));
      } catch {
        // Feedback still works for the current view when storage is unavailable.
      }
      if (next) {
        void playCue("enabled");
        if (role === "PLAYER") vibrate("enabled");
      }
      return next;
    });
  }, [role]);

  return { enabled, toggle };
}
