"use client";

import { AnimatedToastStack, useAnimatedToastStack } from "@/components/motion/animated-toast-stack";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { apiPost, ApiError } from "@/lib/api-client";
import { decryptProfiles, encryptProfiles, type EncryptedVault } from "@/lib/crypto/profiles";
import {
  addHistory,
  clearHistory,
  downloadText,
  historyToCsv,
  loadHistory,
} from "@/lib/history-store";
import { loadVault, saveVault } from "@/lib/profile-store";
import { getPreset, type SmtpPresetId } from "@/lib/smtp/presets";
import type { SmtpConfig } from "@/lib/smtp/schema";
import type {
  DiagnosticsReport,
  HistoryEntry,
  SendResult,
  SmtpActionResult,
  SmtpProfile,
  VerifyResult,
} from "@/types/smtp";
import { useEffect, useMemo, useRef, useState } from "react";
import { Turnstile, type TurnstileHandle } from "./turnstile";
import { ConnectionPanel } from "./connection-panel";
import { ComposePanel, type ComposeDraft } from "./compose-panel";
import { DiagnosticsPanel } from "./diagnostics-panel";
import { HistoryPanel } from "./history-panel";
import { ProfilesPanel } from "./profiles-panel";
import { ResultLog, type LogLevel, type LogLine } from "./result-log";
import type { ButtonState } from "@/components/motion/button/stateful";

const uid = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;

const domainOf = (email: string) => email.split("@")[1]?.trim() ?? "";

const DEFAULT_DRAFT: ComposeDraft = {
  to: "",
  subject: "Ping250 test - your SMTP config works",
  text: "Hello from Ping250.\n\nIf this landed in an inbox, your SMTP credentials, host and port are all correct.",
  html: "",
  bodyFormat: "plain",
  attachment: null,
};

interface SmtpConsoleProps {
  initialConfig: SmtpConfig;
}

export function SmtpConsole({ initialConfig }: SmtpConsoleProps) {
  const { toasts, showToast, dismissToast } = useAnimatedToastStack({ limit: 4 });

  // Connection + compose state
  const [presetId, setPresetId] = useState<SmtpPresetId>("custom");
  const [config, setConfig] = useState<SmtpConfig>(initialConfig);
  const [draft, setDraft] = useState<ComposeDraft>(DEFAULT_DRAFT);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  // Action + result state
  const [verifyState, setVerifyState] = useState<ButtonState>("idle");
  const [sendState, setSendState] = useState<ButtonState>("idle");
  const [diagState, setDiagState] = useState<ButtonState>("idle");
  const [log, setLog] = useState<LogLine[]>([]);
  const [result, setResult] = useState<SmtpActionResult | null>(null);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileRef = useRef<TurnstileHandle | null>(null);

  // Diagnostics + history
  const [diagDomain, setDiagDomain] = useState(() => domainOf(initialConfig.fromEmail));
  const [report, setReport] = useState<DiagnosticsReport | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Encrypted profiles
  const [vault, setVault] = useState<EncryptedVault | null>(null);
  const [unlocked, setUnlocked] = useState(false);
  const [profiles, setProfiles] = useState<SmtpProfile[]>([]);
  const [activeProfileId, setActiveProfileId] = useState<string | null>(null);
  const passphraseRef = useRef("");

  // Load persisted (non-secret) state once on mount.
  useEffect(() => {
    setHistory(loadHistory());
    setVault(loadVault());
  }, []);

  function addLog(level: LogLevel, text: string) {
    setLog((current) => [...current.slice(-199), { id: uid(), ts: Date.now(), level, text }]);
  }

  function flash(setter: (state: ButtonState) => void, outcome: "success" | "error") {
    setter(outcome);
    window.setTimeout(() => setter("idle"), 2400);
  }

  function patchConfig(patch: Partial<SmtpConfig>) {
    setConfig((current) => ({ ...current, ...patch }));
    if (patch.fromEmail !== undefined) {
      const domain = domainOf(patch.fromEmail);
      if (domain) setDiagDomain(domain);
    }
  }

  function patchDraft(patch: Partial<ComposeDraft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  function handlePresetChange(id: SmtpPresetId) {
    setPresetId(id);
    if (id !== "custom") {
      const preset = getPreset(id);
      patchConfig({ host: preset.host, port: preset.port, secure: preset.secure });
      addLog("info", `Preset loaded: ${preset.label} (${preset.host}:${preset.port})`);
    }
  }

  function handleAttachmentFile(file: File | null) {
    if (!file) {
      patchDraft({ attachment: null });
      return;
    }
    if (file.size > 1_000_000) {
      showToast({ status: "error", title: "Attachment too large", description: "Keep it under 1 MB." });
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const raw = String(reader.result ?? "");
      const base64 = raw.includes(",") ? (raw.split(",")[1] ?? "") : raw;
      patchDraft({
        attachment: {
          filename: file.name,
          contentType: file.type || "application/octet-stream",
          content: base64,
        },
      });
    };
    reader.readAsDataURL(file);
  }

  function recordHistory(entry: Omit<HistoryEntry, "id" | "timestamp">) {
    setHistory(addHistory({ ...entry, id: uid(), timestamp: Date.now() }));
  }

  function describeFailure(error: ApiError) {
    if (error.fields) setFieldErrors(error.fields);
    addLog("err", error.message);
    showToast({ status: "error", title: "Request blocked", description: error.message });
  }

  async function handleVerify() {
    setFieldErrors({});
    setVerifyState("loading");
    addLog("cmd", `verify ${config.host || "<host>"}:${config.port} (secure=${config.secure})`);
    try {
      const res = await apiPost<VerifyResult>("/api/smtp/verify", { config, turnstileToken });
      turnstileRef.current?.reset();
      setResult(res);
      if (res.ok) {
        flash(setVerifyState, "success");
        addLog("ok", `${res.latencyMs} ms - ${res.message}`);
        showToast({ status: "success", title: "Connection verified", description: `${res.latencyMs} ms round trip.` });
      } else {
        flash(setVerifyState, "error");
        addLog("err", `${res.error?.title ?? "Verification failed"} (${res.latencyMs} ms)`);
        showToast({ status: "error", title: res.error?.title ?? "Verification failed", description: res.error?.hint });
      }
      recordHistory({
        action: "verify",
        presetLabel: getPreset(presetId).label,
        host: `${config.host}:${config.port}`,
        status: res.ok ? "success" : "error",
        latencyMs: res.latencyMs,
        errorTitle: res.error?.title,
      });
    } catch (error) {
      turnstileRef.current?.reset();
      flash(setVerifyState, "error");
      if (error instanceof ApiError) describeFailure(error);
      else addLog("err", "Unexpected error during verify.");
    }
  }

  async function handleSend() {
    setFieldErrors({});
    if (!draft.to.trim() || !draft.subject.trim() || (!draft.text.trim() && !draft.html.trim())) {
      const errors: Record<string, string> = {};
      if (!draft.to.trim()) errors["message.to"] = "Recipient is required";
      if (!draft.subject.trim()) errors["message.subject"] = "Subject is required";
      if (!draft.text.trim() && !draft.html.trim()) errors["message.text"] = "Add a plain or HTML body";
      setFieldErrors(errors);
      showToast({ status: "error", title: "Incomplete message", description: "Fill the highlighted fields." });
      return;
    }

    setSendState("loading");
    addLog("cmd", `send → ${draft.to} via ${config.host || "<host>"}:${config.port}`);
    const message = {
      to: draft.to.trim(),
      subject: draft.subject.trim(),
      text: draft.text.trim() || undefined,
      html: draft.html.trim() || undefined,
      attachment: draft.attachment ?? undefined,
    };
    try {
      const res = await apiPost<SendResult>("/api/smtp/send", { config, message, turnstileToken });
      turnstileRef.current?.reset();
      setResult(res);
      if (res.ok) {
        flash(setSendState, "success");
        addLog("ok", `250 OK - accepted${res.accepted?.length ? `: ${res.accepted.join(", ")}` : ""} (${res.latencyMs} ms)`);
        if (res.response) addLog("info", `server: ${res.response}`);
        showToast({ status: "success", title: "250 OK - test email sent", description: `Delivered to ${draft.to} in ${res.latencyMs} ms.` });
      } else {
        flash(setSendState, "error");
        addLog("err", `${res.error?.title ?? "Send failed"} (${res.latencyMs} ms)`);
        if (res.error?.response) addLog("info", `server: ${res.error.response}`);
        showToast({ status: "error", title: res.error?.title ?? "Send failed", description: res.error?.hint });
      }
      recordHistory({
        action: "send",
        presetLabel: getPreset(presetId).label,
        host: `${config.host}:${config.port}`,
        to: draft.to,
        status: res.ok ? "success" : "error",
        latencyMs: res.latencyMs,
        errorTitle: res.error?.title,
      });
    } catch (error) {
      turnstileRef.current?.reset();
      flash(setSendState, "error");
      if (error instanceof ApiError) describeFailure(error);
      else addLog("err", "Unexpected error during send.");
    }
  }

  async function handleRunDiagnostics() {
    if (!diagDomain.trim()) {
      showToast({ status: "error", title: "No domain", description: "Enter the sending domain first." });
      return;
    }
    setDiagState("loading");
    addLog("cmd", `diagnostics ${diagDomain} (SPF / DKIM / DMARC)`);
    try {
      const res = await apiPost<{ ok: true; report: DiagnosticsReport }>("/api/diagnostics", {
        domain: diagDomain.trim(),
        turnstileToken,
      });
      turnstileRef.current?.reset();
      setReport(res.report);
      flash(setDiagState, "success");
      addLog("ok", `diagnostics complete for ${res.report.domain}`);
    } catch (error) {
      turnstileRef.current?.reset();
      flash(setDiagState, "error");
      if (error instanceof ApiError) describeFailure(error);
      else addLog("err", "Diagnostics lookup failed.");
    }
  }

  // ── Encrypted profile lifecycle ────────────────────────────────────────────
  async function handleCreateVault(passphrase: string) {
    const next = await encryptProfiles([], passphrase);
    saveVault(next);
    setVault(next);
    setProfiles([]);
    setUnlocked(true);
    passphraseRef.current = passphrase;
    showToast({ status: "success", title: "Vault created", description: "Profiles are now encrypted in this browser." });
  }

  async function handleUnlock(passphrase: string) {
    const current = loadVault();
    if (!current) throw new Error("No vault found in this browser.");
    const list = await decryptProfiles(current, passphrase);
    setProfiles(list);
    setUnlocked(true);
    passphraseRef.current = passphrase;
    showToast({ status: "success", title: "Unlocked", description: `${list.length} profile(s) decrypted in memory.` });
  }

  function handleLock() {
    setUnlocked(false);
    setProfiles([]);
    setActiveProfileId(null);
    passphraseRef.current = "";
    showToast({ status: "info", title: "Locked", description: "Profiles cleared from memory." });
  }

  async function handleSaveProfile(name: string) {
    const profile: SmtpProfile = {
      id: uid(),
      name,
      config,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    const list = [...profiles, profile];
    const next = await encryptProfiles(list, passphraseRef.current);
    saveVault(next);
    setVault(next);
    setProfiles(list);
    setActiveProfileId(profile.id);
    showToast({ status: "success", title: "Profile saved", description: `“${name}” encrypted and stored.` });
  }

  function handleLoadProfile(id: string) {
    const profile = profiles.find((item) => item.id === id);
    if (!profile) return;
    setConfig(profile.config);
    setPresetId("custom");
    setActiveProfileId(id);
    addLog("info", `Loaded profile “${profile.name}” (${profile.config.host}:${profile.config.port})`);
    showToast({ status: "info", title: "Profile loaded", description: profile.name });
  }

  async function handleDeleteProfile(id: string) {
    const list = profiles.filter((item) => item.id !== id);
    const next = await encryptProfiles(list, passphraseRef.current);
    saveVault(next);
    setVault(next);
    setProfiles(list);
    if (activeProfileId === id) setActiveProfileId(null);
    showToast({ status: "info", title: "Profile deleted" });
  }

  // ── History export ─────────────────────────────────────────────────────────
  function handleExportCsv() {
    downloadText("ping250-history.csv", historyToCsv(history), "text/csv;charset=utf-8");
  }
  function handleExportJson() {
    downloadText("ping250-history.json", JSON.stringify(history, null, 2), "application/json");
  }
  function handleClearHistory() {
    clearHistory();
    setHistory([]);
  }

  const curlCommand = useMemo(() => {
    const origin = process.env.NEXT_PUBLIC_APP_URL ?? "https://ping250.abubakarshaikh.dev";
    const configPayload = {
      host: config.host || "smtp.example.com",
      port: config.port,
      secure: config.secure,
      username: config.username || "<username>",
      password: "<password>",
      fromName: config.fromName,
      fromEmail: config.fromEmail || "<from@example.com>",
    };
    const sendPayload = {
      config: configPayload,
      message: {
        to: draft.to || "<to@example.com>",
        subject: draft.subject || "Ping250 test",
        text: draft.text || "Hello from Ping250",
      },
    };
    return [
      "# Verify a connection",
      `curl -X POST ${origin}/api/smtp/verify \\`,
      `  -H "content-type: application/json" \\`,
      `  -d '${JSON.stringify({ config: configPayload })}'`,
      "",
      "# Send a test email",
      `curl -X POST ${origin}/api/smtp/send \\`,
      `  -H "content-type: application/json" \\`,
      `  -d '${JSON.stringify(sendPayload)}'`,
      "",
      "# In production (Turnstile enabled) add a valid token to the body:",
      '#   "turnstileToken": "<token>"',
    ].join("\n");
  }, [config, draft]);

  return (
    <div className="grid gap-4 xl:grid-cols-12">
      <div className="space-y-4 xl:col-span-3">
        <ConnectionPanel
          config={config}
          presetId={presetId}
          errors={fieldErrors}
          onPresetChange={handlePresetChange}
          onPatch={patchConfig}
        />
        <ProfilesPanel
          hasVault={vault !== null}
          unlocked={unlocked}
          profiles={profiles}
          activeProfileId={activeProfileId}
          onCreateVault={handleCreateVault}
          onUnlock={handleUnlock}
          onLock={handleLock}
          onSave={handleSaveProfile}
          onLoad={handleLoadProfile}
          onDelete={handleDeleteProfile}
        />
      </div>

      <div className="xl:col-span-5">
        <ComposePanel
          draft={draft}
          errors={fieldErrors}
          verifyState={verifyState}
          sendState={sendState}
          curlCommand={curlCommand}
          onPatch={patchDraft}
          onVerify={handleVerify}
          onSend={handleSend}
          onAttachmentFile={handleAttachmentFile}
          onTurnstileToken={setTurnstileToken}
          turnstileHandleRef={turnstileRef}
        />
      </div>

      <div className="space-y-4 xl:col-span-4">
        <ResultLog log={log} result={result} />
        <Tabs defaultValue="diagnostics" variant="underline">
          <TabsList>
            <TabsTrigger value="diagnostics">Diagnostics</TabsTrigger>
            <TabsTrigger value="history">History</TabsTrigger>
          </TabsList>
          <TabsContent value="diagnostics">
            <DiagnosticsPanel
              domain={diagDomain}
              report={report}
              state={diagState}
              onDomainChange={setDiagDomain}
              onRun={handleRunDiagnostics}
            />
          </TabsContent>
          <TabsContent value="history">
            <HistoryPanel
              history={history}
              onClear={handleClearHistory}
              onExportCsv={handleExportCsv}
              onExportJson={handleExportJson}
            />
          </TabsContent>
        </Tabs>
      </div>

      <AnimatedToastStack toasts={toasts} onDismiss={dismissToast} position="bottom-right" fixed />
    </div>
  );
}
