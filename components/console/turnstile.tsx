"use client";

import { useCallback, useEffect, useRef } from "react";

const SCRIPT_SRC = "https://challenges.cloudflare.com/turnstile/v0/api.js";
const ENABLED = process.env.NEXT_PUBLIC_TURNSTILE_ENABLED === "true";
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "";

declare global {
  interface Window {
    turnstile?: {
      render: (element: HTMLElement, options: Record<string, unknown>) => string;
      reset: (widget?: string) => void;
      remove: (widget?: string) => void;
    };
  }
}

let scriptPromise: Promise<void> | null = null;

function loadTurnstileScript(): Promise<void> {
  if (scriptPromise) return scriptPromise;
  scriptPromise = new Promise((resolve, reject) => {
    if (window.turnstile) return resolve();
    const script = document.createElement("script");
    script.src = `${SCRIPT_SRC}?render=explicit`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("turnstile-script-failed"));
    document.head.appendChild(script);
  });
  return scriptPromise;
}

export interface TurnstileHandle {
  reset: () => void;
}

interface TurnstileProps {
  onVerify: (token: string | null) => void;
  onExpire?: () => void;
  handleRef?: React.RefObject<TurnstileHandle | null>;
}

/**
 * Cloudflare Turnstile bot-check. Callbacks are held in refs so the widget is
 * rendered exactly once; parent re-renders never tear it down. When the check
 * is disabled (local dev) it renders nothing and reports a null token.
 */
export function Turnstile({ onVerify, onExpire, handleRef }: TurnstileProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetId = useRef<string | null>(null);
  const onVerifyRef = useRef(onVerify);
  const onExpireRef = useRef(onExpire);
  onVerifyRef.current = onVerify;
  onExpireRef.current = onExpire;

  const reset = useCallback(() => {
    if (widgetId.current && window.turnstile) {
      window.turnstile.reset(widgetId.current);
    }
    onVerifyRef.current(null);
  }, []);

  useEffect(() => {
    if (handleRef) {
      handleRef.current = { reset };
    }
    return () => {
      if (handleRef) {
        handleRef.current = null;
      }
    };
  }, [handleRef, reset]);

  useEffect(() => {
    if (!ENABLED) {
      onVerifyRef.current(null);
      return;
    }
    let cancelled = false;
    loadTurnstileScript()
      .then(() => {
        if (cancelled || !containerRef.current || !window.turnstile) return;
        widgetId.current = window.turnstile.render(containerRef.current, {
          sitekey: SITE_KEY,
          theme: "auto",
          callback: (token: string) => onVerifyRef.current(token),
          "expired-callback": () => {
            onVerifyRef.current(null);
            onExpireRef.current?.();
          },
          "error-callback": () => onVerifyRef.current(null),
        });
      })
      .catch(() => onVerifyRef.current(null));

    return () => {
      cancelled = true;
      if (widgetId.current && window.turnstile) {
        window.turnstile.remove(widgetId.current);
        widgetId.current = null;
      }
    };
  }, []);

  if (!ENABLED) return null;

  return (
    <div
      ref={containerRef}
      className="min-h-[65px] w-full"
      aria-label="Human verification"
    />
  );
}

export function isTurnstileEnabled(): boolean {
  return ENABLED;
}
