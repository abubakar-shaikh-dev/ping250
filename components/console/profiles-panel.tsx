"use client";

import { AnimatedBadge } from "@/components/motion/animated-badge";
import { Button } from "@/components/motion/button/base";
import { Input } from "@/components/motion/input";
import { Loader } from "@/components/motion/loader";
import { LockIcon } from "@/components/icons/lock";
import { PlusIcon } from "@/components/icons/plus";
import { XIcon } from "@/components/icons/x";
import type { SmtpProfile } from "@/types/smtp";
import { useState, type FormEvent } from "react";
import { Panel } from "./panel";

interface ProfilesPanelProps {
  hasVault: boolean;
  unlocked: boolean;
  profiles: SmtpProfile[];
  activeProfileId: string | null;
  onCreateVault: (passphrase: string) => Promise<void>;
  onUnlock: (passphrase: string) => Promise<void>;
  onLock: () => void;
  onSave: (name: string) => Promise<void>;
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}

export function ProfilesPanel({
  hasVault,
  unlocked,
  profiles,
  activeProfileId,
  onCreateVault,
  onUnlock,
  onLock,
  onSave,
  onLoad,
  onDelete,
}: ProfilesPanelProps) {
  return (
    <Panel
      title="Encrypted profiles"
      icon={<LockIcon size={15} />}
      actions={
        unlocked ? (
          <Button variant="ghost" size="sm" onClick={onLock}>
            Lock
          </Button>
        ) : undefined
      }
    >
      {!hasVault ? (
        <SetupForm onCreate={onCreateVault} />
      ) : !unlocked ? (
        <UnlockForm onUnlock={onUnlock} />
      ) : (
        <UnlockedView
          profiles={profiles}
          activeProfileId={activeProfileId}
          onSave={onSave}
          onLoad={onLoad}
          onDelete={onDelete}
        />
      )}
    </Panel>
  );
}

function SetupForm({ onCreate }: { onCreate: (passphrase: string) => Promise<void> }) {
  const [passphrase, setPassphrase] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    if (passphrase.length < 6) return setError("Use at least 6 characters.");
    if (passphrase !== confirm) return setError("Passphrases do not match.");
    setBusy(true);
    setError(null);
    try {
      await onCreate(passphrase);
    } catch {
      setError("Could not create the vault in this browser.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Save named SMTP configs encrypted in this browser with AES-256-GCM. The passphrase never
        leaves the page - lose it and the profiles are unrecoverable.
      </p>
      <Input
        label="New passphrase"
        type="password"
        value={passphrase}
        onChange={setPassphrase}
        autoComplete="new-password"
      />
      <Input
        label="Confirm passphrase"
        type="password"
        value={confirm}
        onChange={setConfirm}
        autoComplete="new-password"
        error={error ?? undefined}
      />
      <Button type="submit" variant="primary" size="sm" disabled={busy}>
        {busy ? "Encrypting…" : "Create encrypted vault"}
      </Button>
    </form>
  );
}

function UnlockForm({ onUnlock }: { onUnlock: (passphrase: string) => Promise<void> }) {
  const [passphrase, setPassphrase] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      await onUnlock(passphrase);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not unlock the vault.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <p className="text-xs leading-relaxed text-muted-foreground">
        Your profiles are locked. Enter the passphrase to decrypt them in memory.
      </p>
      <Input
        label="Passphrase"
        type="password"
        value={passphrase}
        onChange={setPassphrase}
        autoComplete="current-password"
        error={error ?? undefined}
      />
      <Button type="submit" variant="primary" size="sm" disabled={busy}>
        {busy ? "Decrypting…" : "Unlock"}
      </Button>
    </form>
  );
}

function UnlockedView({
  profiles,
  activeProfileId,
  onSave,
  onLoad,
  onDelete,
}: {
  profiles: SmtpProfile[];
  activeProfileId: string | null;
  onSave: (name: string) => Promise<void>;
  onLoad: (id: string) => void;
  onDelete: (id: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave(event: FormEvent) {
    event.preventDefault();
    if (!name.trim()) return setError("Give the profile a name.");
    setBusy(true);
    setError(null);
    try {
      await onSave(name.trim());
      setName("");
    } catch {
      setError("Could not save the profile.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="space-y-4">
      {profiles.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No profiles yet. Fill in the connection form, then save it below.
        </p>
      ) : (
        <ul className="space-y-1.5">
          {profiles.map((profile) => {
            const active = profile.id === activeProfileId;
            return (
              <li
                key={profile.id}
                className="group flex items-center gap-2 rounded-md border border-border bg-background/50 px-2.5 py-2"
              >
                <button
                  type="button"
                  onClick={() => onLoad(profile.id)}
                  className="min-w-0 flex-1 cursor-pointer text-left"
                >
                  <span className="flex items-center gap-2">
                    <span className="truncate text-sm font-medium">{profile.name}</span>
                    {active ? <AnimatedBadge status="success">loaded</AnimatedBadge> : null}
                  </span>
                  <span className="block truncate font-mono text-[11px] text-muted-foreground">
                    {profile.config.host || "no host"}:{profile.config.port}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onDelete(profile.id)}
                  aria-label={`Delete ${profile.name}`}
                  className="cursor-pointer rounded p-1 text-muted-foreground opacity-0 transition-opacity hover:text-destructive group-hover:opacity-100 focus-visible:opacity-100"
                >
                  <XIcon size={15} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <form onSubmit={handleSave} className="space-y-2 border-t border-border pt-3">
        <div className="flex items-end gap-2">
          <div className="flex-1">
            <Input
              label="Save current config as"
              placeholder="Gmail - personal"
              value={name}
              onChange={setName}
              error={error ?? undefined}
            />
          </div>
          <Button type="submit" variant="secondary" size="sm" disabled={busy} className="mb-0.5">
            {busy ? <Loader variant="dots" size={16} /> : <PlusIcon size={15} />}
            <span className="ml-1">Save</span>
          </Button>
        </div>
      </form>
    </div>
  );
}
