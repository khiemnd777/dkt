import { useEffect, useState } from "react";

export function useCountdown(deadline?: number, serverOffsetMs = 0): number {
  const calculate = () => (deadline ? Math.max(0, deadline - (Date.now() + serverOffsetMs)) : 0);
  const [remaining, setRemaining] = useState(calculate);
  useEffect(() => {
    setRemaining(calculate());
    if (!deadline) return;
    const timer = window.setInterval(() => setRemaining(calculate()), 200);
    return () => window.clearInterval(timer);
  }, [deadline, serverOffsetMs]);
  return remaining;
}

export function formatCountdown(milliseconds: number): string {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return minutes > 0
    ? `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
    : String(seconds);
}
