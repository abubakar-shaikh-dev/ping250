"use client";

import { Input } from "@/components/motion/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/motion/select";
import { Switch } from "@/components/motion/switch";
import { EyeIcon } from "@/components/icons/eye";
import { EyeOffIcon } from "@/components/icons/eye-off";
import { PlugZapIcon } from "@/components/icons/plug-zap";
import { getPreset, SMTP_PRESETS, type SmtpPresetId } from "@/lib/smtp/presets";
import type { SmtpConfig } from "@/lib/smtp/schema";
import { useState } from "react";
import { Panel } from "./panel";

interface ConnectionPanelProps {
  config: SmtpConfig;
  presetId: SmtpPresetId;
  errors: Record<string, string>;
  onPresetChange: (id: SmtpPresetId) => void;
  onPatch: (patch: Partial<SmtpConfig>) => void;
}

export function ConnectionPanel({
  config,
  presetId,
  errors,
  onPresetChange,
  onPatch,
}: ConnectionPanelProps) {
  const [showPassword, setShowPassword] = useState(false);
  const preset = getPreset(presetId);

  return (
    <Panel title="Connection" icon={<PlugZapIcon size={15} />}>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <span className="text-xs font-medium text-muted-foreground">Provider preset</span>
          <Select value={presetId} onValueChange={(value) => onPresetChange(value as SmtpPresetId)}>
            <SelectTrigger>
              <SelectValue placeholder="Choose a provider" />
            </SelectTrigger>
            <SelectContent>
              {SMTP_PRESETS.map((p) => (
                <SelectItem key={p.id} value={p.id}>
                  {p.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {preset.note ? (
            <p className="text-xs leading-relaxed text-muted-foreground/80">{preset.note}</p>
          ) : null}
        </div>

        <Input
          label="Host"
          placeholder="smtp.gmail.com"
          value={config.host}
          onChange={(value) => onPatch({ host: value })}
          error={errors["config.host"]}
          autoComplete="off"
          spellCheck={false}
        />

        <Input
          label="Port"
          type="number"
          inputMode="numeric"
          value={String(config.port)}
          onChange={(value) => onPatch({ port: Number.parseInt(value, 10) || 0 })}
          error={errors["config.port"]}
        />

        <div className="pb-1.5">
          <Switch
            checked={config.secure}
            onCheckedChange={(value) => onPatch({ secure: value })}
            label={config.secure ? "TLS on (465)" : "STARTTLS (587)"}
          />
        </div>

        <Input
          label="Username"
          placeholder={preset.usernameHint ?? "SMTP username"}
          value={config.username}
          onChange={(value) => onPatch({ username: value })}
          autoComplete="off"
          spellCheck={false}
        />

        <Input
          label="Password"
          type={showPassword ? "text" : "password"}
          placeholder={preset.passwordHint ?? "SMTP password"}
          value={config.password}
          onChange={(value) => onPatch({ password: value })}
          autoComplete="new-password"
          rightIcon={
            <button
              type="button"
              onClick={() => setShowPassword((current) => !current)}
              aria-label={showPassword ? "Hide password" : "Show password"}
              className="cursor-pointer text-muted-foreground transition-colors hover:text-foreground"
            >
              {showPassword ? <EyeOffIcon size={16} /> : <EyeIcon size={16} />}
            </button>
          }
        />

        <Input
          label="From name"
          placeholder="Acme Alerts"
          value={config.fromName}
          onChange={(value) => onPatch({ fromName: value })}
        />
        <Input
          label="From email"
          placeholder="alerts@acme.dev"
          value={config.fromEmail}
          onChange={(value) => onPatch({ fromEmail: value })}
          error={errors["config.fromEmail"]}
          autoComplete="off"
          spellCheck={false}
        />
      </div>
    </Panel>
  );
}
