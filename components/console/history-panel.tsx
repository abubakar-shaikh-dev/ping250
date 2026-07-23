"use client";

import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Button } from "@/components/motion/button/base";
import { DownloadIcon } from "@/components/icons/download";
import { HistoryIcon } from "@/components/icons/history";
import { XIcon } from "@/components/icons/x";
import type { HistoryEntry } from "@/types/smtp";
import { useMemo, useState } from "react";
import { Panel } from "./panel";

type Filter = "all" | "success" | "error";

interface HistoryPanelProps {
  history: HistoryEntry[];
  onClear: () => void;
  onExportCsv: () => void;
  onExportJson: () => void;
}

export function HistoryPanel({ history, onClear, onExportCsv, onExportJson }: HistoryPanelProps) {
  const [filter, setFilter] = useState<Filter>("all");

  const filtered = useMemo(
    () => (filter === "all" ? history : history.filter((entry) => entry.status === filter)),
    [history, filter],
  );

  return (
    <Panel
      title="Test history"
      icon={<HistoryIcon size={15} />}
      actions={
        history.length > 0 ? (
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="sm" onClick={onExportCsv} aria-label="Export CSV">
              <DownloadIcon size={14} />
              <span className="ml-1">CSV</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onExportJson} aria-label="Export JSON">
              <DownloadIcon size={14} />
              <span className="ml-1">JSON</span>
            </Button>
            <Button variant="ghost" size="sm" onClick={onClear} aria-label="Clear history">
              <XIcon size={14} />
            </Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-3">
        <div className="flex gap-1" role="tablist" aria-label="Filter history">
          {(["all", "success", "error"] as const).map((value) => (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`cursor-pointer rounded-full px-3 py-1 text-xs font-medium capitalize transition-colors ${
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-secondary-foreground hover:bg-accent"
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {filtered.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {history.length === 0
              ? "No tests yet. Runs appear here with their provider, status and response time - stored only in this browser, never the message body or credentials."
              : "Nothing matches this filter."}
          </p>
        ) : (
          <ul className="scrollbar-slim max-h-72 space-y-1.5 overflow-y-auto pr-1">
            {filtered.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center gap-3 rounded-md border border-border bg-background/40 px-3 py-2"
              >
                <AnimatedBadge status={entry.status === "success" ? "success" : "danger"}>
                  {entry.status === "success" ? "250" : "err"}
                </AnimatedBadge>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="rounded bg-secondary px-1.5 py-0.5 font-mono text-[10px] uppercase text-secondary-foreground">
                      {entry.action}
                    </span>
                    <span className="truncate text-sm font-medium">{entry.presetLabel}</span>
                  </div>
                  <div className="truncate font-mono text-[11px] text-muted-foreground">
                    {entry.host}
                    {entry.to ? ` → ${entry.to}` : ""}
                    {entry.errorTitle ? ` · ${entry.errorTitle}` : ""}
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <div className="font-mono text-xs text-muted-foreground">{entry.latencyMs} ms</div>
                  <div className="font-mono text-[10px] text-muted-foreground/70">
                    {new Date(entry.timestamp).toLocaleString(undefined, {
                      month: "short",
                      day: "numeric",
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Panel>
  );
}
