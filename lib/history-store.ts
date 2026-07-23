import type { HistoryEntry } from "@/types/smtp";

const HISTORY_KEY = "ping250:history:v1";
const MAX_ENTRIES = 200;

export function loadHistory(): HistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as HistoryEntry[]) : [];
  } catch {
    return [];
  }
}

export function saveHistory(entries: HistoryEntry[]): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(HISTORY_KEY, JSON.stringify(entries.slice(0, MAX_ENTRIES)));
}

export function addHistory(entry: HistoryEntry): HistoryEntry[] {
  const next = [entry, ...loadHistory()].slice(0, MAX_ENTRIES);
  saveHistory(next);
  return next;
}

export function clearHistory(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(HISTORY_KEY);
}

const CSV_COLUMNS: Array<[keyof HistoryEntry, string]> = [
  ["timestamp", "timestamp_iso"],
  ["action", "action"],
  ["presetLabel", "provider"],
  ["host", "host"],
  ["to", "recipient"],
  ["status", "status"],
  ["latencyMs", "latency_ms"],
  ["errorTitle", "error"],
];

function csvEscape(value: unknown): string {
  const s = value === null || value === undefined ? "" : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function historyToCsv(entries: HistoryEntry[]): string {
  const header = CSV_COLUMNS.map(([, label]) => label).join(",");
  const rows = entries.map((entry) =>
    CSV_COLUMNS.map(([key]) => {
      if (key === "timestamp") return csvEscape(new Date(entry.timestamp).toISOString());
      return csvEscape(entry[key]);
    }).join(","),
  );
  return [header, ...rows].join("\n");
}

export function downloadText(filename: string, text: string, mime: string): void {
  if (typeof window === "undefined") return;
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  URL.revokeObjectURL(url);
}
