"use client";

import { AnimatedBadge } from "@/components/motion/animated-badge";
import { TerminalIcon } from "@/components/icons/terminal";
import type { SmtpActionResult } from "@/types/smtp";
import { useEffect, useRef } from "react";
import { CopyButton } from "./copy-button";
import { Panel } from "./panel";

export type LogLevel = "cmd" | "info" | "ok" | "err";

export interface LogLine {
  id: string;
  ts: number;
  level: LogLevel;
  text: string;
}

const LEVEL_CLASS: Record<LogLevel, string> = {
  cmd: "text-primary",
  info: "text-muted-foreground",
  ok: "text-emerald-600 dark:text-emerald-400",
  err: "text-destructive",
};

const LEVEL_PREFIX: Record<LogLevel, string> = {
  cmd: "›",
  info: "·",
  ok: "✓",
  err: "✕",
};

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour12: false });
}

interface ResultLogProps {
  log: LogLine[];
  result: SmtpActionResult | null;
}

export function ResultLog({ log, result }: ResultLogProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [log]);

  return (
    <Panel
      title="Response"
      icon={<TerminalIcon size={15} />}
      actions={result ? <CopyButton text={JSON.stringify(result, null, 2)} label="JSON" /> : undefined}
      bodyClassName="flex flex-col gap-3 p-0"
    >
      {result ? <ResultCard result={result} /> : null}

      <div
        ref={scrollRef}
        className="scrollbar-slim h-56 overflow-y-auto border-t border-border bg-background/40 px-3 py-2 font-mono text-[12px] leading-relaxed"
        role="log"
        aria-live="polite"
        aria-label="SMTP response log"
      >
        {log.length === 0 ? (
          <p className="text-muted-foreground/70">
            Waiting for a request. Verify the connection or send a test message and the SMTP
            conversation will stream here.
          </p>
        ) : (
          log.map((line) => (
            <div key={line.id} className="flex gap-2 whitespace-pre-wrap break-words">
              <span className="shrink-0 text-muted-foreground/50">{formatTime(line.ts)}</span>
              <span className={`shrink-0 ${LEVEL_CLASS[line.level]}`}>{LEVEL_PREFIX[line.level]}</span>
              <span className={LEVEL_CLASS[line.level]}>{line.text}</span>
            </div>
          ))
        )}
      </div>
    </Panel>
  );
}

function ResultCard({ result }: { result: SmtpActionResult }) {
  const ok = result.ok;
  return (
    <div className="px-4 pt-3">
      <div className="flex flex-wrap items-center gap-2">
        <AnimatedBadge status={ok ? "success" : "danger"} pulse={!ok}>
          {ok ? (result.action === "send" ? "250 OK - delivered" : "Connection verified") : "Failed"}
        </AnimatedBadge>
        <span className="font-mono text-xs text-muted-foreground">{result.latencyMs} ms</span>
        {result.action === "send" && result.messageId ? (
          <span className="truncate font-mono text-[11px] text-muted-foreground" title={result.messageId}>
            id: {result.messageId}
          </span>
        ) : null}
      </div>

      {ok ? (
        result.action === "send" ? (
          <p className="mt-2 text-sm text-muted-foreground">
            Accepted for delivery
            {result.accepted?.length ? ` to ${result.accepted.join(", ")}` : ""}
            {result.response ? <span className="font-mono"> - {result.response}</span> : null}
          </p>
        ) : (
          <p className="mt-2 text-sm text-muted-foreground">{result.message}</p>
        )
      ) : result.error ? (
        <div className="mt-2 space-y-1.5">
          <p className="text-sm font-medium text-foreground">{result.error.title}</p>
          <p className="text-sm leading-relaxed text-muted-foreground">{result.error.detail}</p>
          {result.error.hint ? (
            <p className="rounded-md border border-border bg-accent/40 px-3 py-2 text-sm leading-relaxed text-accent-foreground">
              {result.error.hint}
            </p>
          ) : null}
          {result.error.code || result.error.responseCode || result.error.response ? (
            <p className="font-mono text-[11px] text-muted-foreground/80">
              {[result.error.code, result.error.responseCode, result.error.response]
                .filter(Boolean)
                .join(" · ")}
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
