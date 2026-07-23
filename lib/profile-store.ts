import type { EncryptedVault } from "@/lib/crypto/profiles";

const VAULT_KEY = "ping250:vault:v1";

export function loadVault(): EncryptedVault | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(VAULT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EncryptedVault;
    return parsed?.ciphertext ? parsed : null;
  } catch {
    return null;
  }
}

export function saveVault(vault: EncryptedVault): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VAULT_KEY, JSON.stringify(vault));
}

export function clearVault(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(VAULT_KEY);
}

export function hasVault(): boolean {
  return loadVault() !== null;
}
