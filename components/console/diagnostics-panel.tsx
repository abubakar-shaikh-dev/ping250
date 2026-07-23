"use client";

import { AnimatedBadge, type AnimatedBadgeStatus } from "@/components/motion/animated-badge";
import { StatefulButton, type ButtonState } from "@/components/motion/button/stateful";
import { Input } from "@/components/motion/input";
import { ShieldCheckIcon } from "@/components/icons/shield-check";
import type { DiagnosticsReport, DnsFinding, DnsStatus } from "@/types/smtp";
import { Panel } from "./panel";

const STATUS_TO_BADGE: Record<DnsStatus, AnimatedBadgeStatus> = {
  pass: "success",
  warn: "warning",
  fail: "danger",
  info: "info",
};

interface DiagnosticsPanelProps {
  domain: string;
  report: DiagnosticsReport | null;
  state: ButtonState;
  onDomainChange: (domain: string) => void;
  onRun: () => void;
}

export function DiagnosticsPanel({
  domain,
  report,
  state,
  onDomainChange,
  onRun,
}: DiagnosticsPanelProps) {
  return (
    <Panel title="Deliverability diagnostics" icon={<ShieldCheckIcon size={15} />}>
      <div className="space-y-4">
        <p className="text-xs leading-relaxed text-muted-foreground">
          Checks the sending domain's SPF, DKIM and DMARC DNS records - the three authentication
          records that decide whether mail lands in the inbox or the spam folder.
        </p>

        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Domain"
              placeholder="acme.dev"
              value={domain}
              onChange={onDomainChange}
              spellCheck={false}
            />
          </div>
          <StatefulButton
            variant="outline"
            state={state}
            onClick={onRun}
            loadingText="Checking"
            successText="Done"
            errorText="Retry"
            className="mb-0.5"
          >
            Run
          </StatefulButton>
        </div>

        {report ? (
          <div className="space-y-3">
            <ul className="space-y-1 rounded-md border border-border bg-background/40 px-3 py-2 text-sm">
              {report.summary.map((line, index) => (
                <li key={index} className="text-muted-foreground">
                  {line}
                </li>
              ))}
            </ul>
            <Finding title="SPF" finding={report.spf} />
            <Finding title="DKIM" finding={report.dkim} />
            <Finding title="DMARC" finding={report.dmarc} />
          </div>
        ) : null}
      </div>
    </Panel>
  );
}

function Finding({ title, finding }: { title: string; finding: DnsFinding }) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-3">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-semibold">{title}</span>
        <AnimatedBadge status={STATUS_TO_BADGE[finding.status]}>{finding.label}</AnimatedBadge>
      </div>
      <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{finding.detail}</p>
      {finding.records?.length ? (
        <pre className="scrollbar-slim mt-2 overflow-x-auto rounded bg-background px-2 py-1.5 font-mono text-[11px] text-muted-foreground">
          {finding.records.join("\n")}
        </pre>
      ) : null}
    </div>
  );
}
