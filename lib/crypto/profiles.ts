import type { SmtpProfile } from "@/types/smtp";

/**
 * Client-side encrypted profile vault.
 *
 * Profiles (which contain SMTP passwords) are encrypted in the browser with
 * AES-GCM under a key derived from a user-chosen passphrase via PBKDF2-SHA256.
 * Only the ciphertext, salt and IV are ever written to localStorage — the
 * passphrase and the plaintext profiles never leave the page and are never
 * transmitted. Decrypting requires re-entering the passphrase.
 */

export interface EncryptedVault {
  version: 1;
  kdf: "PBKDF2-SHA256";
  iterations: number;
  salt: string; // base64
  iv: string; // base64
  ciphertext: string; // base64
}

const ITERATIONS = 210_000;
const encoder = new TextEncoder();
const decoder = new TextDecoder();

function bytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

function base64ToBytes(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return bytes;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await crypto.subtle.importKey(
    "raw",
    encoder.encode(passphrase),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt as BufferSource,
      iterations: ITERATIONS,
      hash: "SHA-256",
    },
    baseKey,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"],
  );
}

export async function encryptProfiles(
  profiles: SmtpProfile[],
  passphrase: string,
): Promise<EncryptedVault> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ciphertext = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv: iv as BufferSource },
    key,
    encoder.encode(JSON.stringify(profiles)),
  );
  return {
    version: 1,
    kdf: "PBKDF2-SHA256",
    iterations: ITERATIONS,
    salt: bytesToBase64(salt),
    iv: bytesToBase64(iv),
    ciphertext: bytesToBase64(new Uint8Array(ciphertext)),
  };
}

export async function decryptProfiles(
  vault: EncryptedVault,
  passphrase: string,
): Promise<SmtpProfile[]> {
  const key = await deriveKey(passphrase, base64ToBytes(vault.salt));
  try {
    const plaintext = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: base64ToBytes(vault.iv) as BufferSource },
      key,
      base64ToBytes(vault.ciphertext) as BufferSource,
    );
    const parsed = JSON.parse(decoder.decode(plaintext));
    if (!Array.isArray(parsed)) throw new Error("Vault did not contain a profile list.");
    return parsed as SmtpProfile[];
  } catch {
    throw new Error("Wrong passphrase, or the vault is corrupted.");
  }
}
