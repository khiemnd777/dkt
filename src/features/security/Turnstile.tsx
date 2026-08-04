import { useEffect, useRef } from "react";

declare global {
  interface Window {
    turnstile?: {
      render(container: HTMLElement, options: Record<string, unknown>): string;
      remove(widgetId: string): void;
    };
  }
}

const SCRIPT_ID = "cloudflare-turnstile-script";

export function Turnstile({ onToken }: { onToken: (token?: string) => void }) {
  const sitekey = import.meta.env.VITE_TURNSTILE_SITE_KEY;
  const container = useRef<HTMLFieldSetElement>(null);
  useEffect(() => {
    if (!sitekey || !container.current) return;
    let widgetId: string | undefined;
    let cancelled = false;
    const render = () => {
      if (cancelled || !container.current || !window.turnstile) return;
      widgetId = window.turnstile.render(container.current, {
        sitekey,
        action: "create-room",
        callback: (token: string) => onToken(token),
        "expired-callback": () => onToken(undefined),
        "error-callback": () => onToken(undefined),
      });
    };
    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (window.turnstile) render();
      else existing.addEventListener("load", render, { once: true });
    } else {
      const script = document.createElement("script");
      script.id = SCRIPT_ID;
      script.src = "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";
      script.async = true;
      script.defer = true;
      script.addEventListener("load", render, { once: true });
      document.head.appendChild(script);
    }
    return () => {
      cancelled = true;
      if (widgetId && window.turnstile) window.turnstile.remove(widgetId);
    };
  }, [sitekey, onToken]);
  if (!sitekey) return null;
  return <fieldset className="turnstile" ref={container} aria-label="Xác minh tạo phòng" />;
}
