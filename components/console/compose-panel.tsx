"use client";

import { Input } from "@/components/motion/input";
import { StatefulButton, type ButtonState } from "@/components/motion/button/stateful";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/motion/tabs";
import { FileTextIcon } from "@/components/icons/file-text";
import { SendIcon } from "@/components/icons/send";
import { ShieldCheckIcon } from "@/components/icons/shield-check";
import { XIcon } from "@/components/icons/x";
import type { Attachment } from "@/lib/smtp/schema";
import { useRef } from "react";
import { CopyButton } from "./copy-button";
import { Panel } from "./panel";
import { Turnstile } from "./turnstile";

export interface ComposeDraft {
  to: string;
  subject: string;
  text: string;
  html: string;
  bodyFormat: "plain" | "html";
  attachment: Attachment | null;
}

const TEXTAREA_CLASS =
  "w-full resize-y rounded-md border border-border bg-background px-3 py-2 font-mono text-sm leading-relaxed text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

interface ComposePanelProps {
  draft: ComposeDraft;
  errors: Record<string, string>;
  verifyState: ButtonState;
  sendState: ButtonState;
  curlCommand: string;
  onPatch: (patch: Partial<ComposeDraft>) => void;
  onVerify: () => void;
  onSend: () => void;
  onAttachmentFile: (file: File | null) => void;
  onTurnstileToken: (token: string | null) => void;
}

export function ComposePanel({
  draft,
  errors,
  verifyState,
  sendState,
  curlCommand,
  onPatch,
  onVerify,
  onSend,
  onAttachmentFile,
  onTurnstileToken,
}: ComposePanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  return (
    <Panel title="Compose test message" icon={<FileTextIcon size={15} />}>
      <div className="space-y-4">
        <Input
          label="To (single recipient)"
          placeholder="you@inbox.example"
          value={draft.to}
          onChange={(value) => onPatch({ to: value })}
          error={errors["message.to"]}
          autoComplete="off"
          spellCheck={false}
        />
        <Input
          label="Subject"
          placeholder="Ping250 test - SMTP is working"
          value={draft.subject}
          onChange={(value) => onPatch({ subject: value })}
          error={errors["message.subject"]}
        />

        <div className="space-y-2">
          <Tabs
            value={draft.bodyFormat}
            onValueChange={(value) => onPatch({ bodyFormat: value as "plain" | "html" })}
            variant="segment"
          >
            <TabsList>
              <TabsTrigger value="plain">Plain text</TabsTrigger>
              <TabsTrigger value="html">HTML</TabsTrigger>
            </TabsList>

            <TabsContent value="plain">
              <textarea
                value={draft.text}
                onChange={(event) => onPatch({ text: event.target.value })}
                placeholder={"Hello from Ping250.\n\nIf you are reading this in an inbox, your SMTP config works."}
                rows={6}
                className={TEXTAREA_CLASS}
                aria-label="Plain text body"
              />
            </TabsContent>

            <TabsContent value="html">
              <div className="space-y-2">
                <textarea
                  value={draft.html}
                  onChange={(event) => onPatch({ html: event.target.value })}
                  placeholder={'<h1>Hello from Ping250</h1>\n<p>Your SMTP config works.</p>'}
                  rows={6}
                  className={TEXTAREA_CLASS}
                  aria-label="HTML body"
                />
                {draft.html.trim() ? (
                  <div className="space-y-1">
                    <span className="text-[11px] uppercase tracking-wide text-muted-foreground">
                      Preview (sandboxed)
                    </span>
                    <iframe
                      title="HTML email preview"
                      sandbox=""
                      srcDoc={draft.html}
                      className="h-36 w-full rounded-md border border-border bg-white"
                    />
                  </div>
                ) : null}
              </div>
            </TabsContent>
          </Tabs>
          {errors["message.text"] ? (
            <p className="text-xs text-destructive">{errors["message.text"]}</p>
          ) : null}
        </div>

        <div className="space-y-2">
          <span className="text-xs font-medium text-muted-foreground">Attachment (optional, ≤1 MB)</span>
          {draft.attachment ? (
            <div className="flex items-center justify-between gap-2 rounded-md border border-border bg-background/50 px-3 py-2">
              <span className="flex min-w-0 items-center gap-2 text-sm">
                <FileTextIcon size={15} />
                <span className="truncate">{draft.attachment.filename}</span>
                <span className="font-mono text-[11px] text-muted-foreground">
                  {draft.attachment.contentType}
                </span>
              </span>
              <button
                type="button"
                onClick={() => {
                  onAttachmentFile(null);
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                aria-label="Remove attachment"
                className="cursor-pointer rounded p-1 text-muted-foreground hover:text-destructive"
              >
                <XIcon size={15} />
              </button>
            </div>
          ) : (
            <input
              ref={fileInputRef}
              type="file"
              onChange={(event) => onAttachmentFile(event.target.files?.[0] ?? null)}
              className="block w-full text-sm text-muted-foreground file:mr-3 file:rounded-md file:border-0 file:bg-secondary file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-secondary-foreground hover:file:bg-accent"
            />
          )}
        </div>

        <Turnstile onVerify={onTurnstileToken} />

        <div className="flex flex-col gap-2 border-t border-border pt-4 sm:flex-row">
          <StatefulButton
            variant="outline"
            state={verifyState}
            onClick={onVerify}
            loadingText="Verifying"
            successText="Verified"
            errorText="Failed"
            icon={<ShieldCheckIcon size={16} />}
            className="sm:flex-1"
          >
            Verify connection
          </StatefulButton>
          <StatefulButton
            variant="primary"
            state={sendState}
            onClick={onSend}
            loadingText="Sending"
            successText="250 OK"
            errorText="Failed"
            icon={<SendIcon size={16} />}
            className="sm:flex-1"
          >
            Send test email
          </StatefulButton>
        </div>

        <details className="group rounded-md border border-border bg-background/40">
          <summary className="flex cursor-pointer list-none items-center justify-between px-3 py-2 text-xs font-medium text-muted-foreground hover:text-foreground">
            <span>Script it - cURL example</span>
            <CopyButton text={curlCommand} label="Copy" />
          </summary>
          <pre className="scrollbar-slim overflow-x-auto border-t border-border px-3 py-3 font-mono text-[11px] leading-relaxed text-foreground/90">
            {curlCommand}
          </pre>
        </details>
      </div>
    </Panel>
  );
}
