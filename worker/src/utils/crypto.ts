const PBKDF2_MARKER = 'pbkdf2-sha256';
// Cloudflare Workers' WebCrypto rejects PBKDF2 iteration counts above 100000,
// so this is the practical platform ceiling for password hashing here.
const PBKDF2_ITERATIONS = 100000;
const SALT_BYTES = 16;
const KEY_BITS = 256;

export function randomToken(bytes = 32): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

function toHex(buffer: ArrayBuffer): string {
  return Array.from(new Uint8Array(buffer), (b) => b.toString(16).padStart(2, '0')).join('');
}

function encode(data: string): ArrayBuffer {
  const encoded = new TextEncoder().encode(data);
  return encoded.buffer.slice(encoded.byteOffset, encoded.byteOffset + encoded.byteLength) as ArrayBuffer;
}

async function pbkdf2(password: string, salt: string, iterations: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', hash: 'SHA-256', salt: encode(salt), iterations },
    key,
    KEY_BITS
  );
  return toHex(bits);
}

/**
 * Slow password hashing using PBKDF2-SHA256 with a per-user random salt.
 *
 * Stored format (hash portion): `pbkdf2-sha256$<iterations>$<64 hex>`.
 * The stored value in `users.password_hash` is `<salt-hex>:<hash>` where the
 * salt is 32 hex chars (16 bytes).
 */
export async function hashPassword(password: string, salt?: string): Promise<{ hash: string; salt: string }> {
  const s = salt ?? randomToken(SALT_BYTES);
  const digest = await pbkdf2(password, s, PBKDF2_ITERATIONS);
  return { hash: `${PBKDF2_MARKER}$${PBKDF2_ITERATIONS}$${digest}`, salt: s };
}

/** True when the stored hash uses the pre-launch salted SHA-256 scheme. */
export function isLegacyHash(hash: string): boolean {
  return !hash.startsWith(`${PBKDF2_MARKER}$`);
}

/**
 * Verifies a password against either the current PBKDF2-SHA256 scheme or the
 * pre-launch salted SHA-256 scheme (used only to validate existing accounts
 * until their next successful login upgrades them).
 */
export async function verifyPassword(password: string, hash: string, salt: string): Promise<boolean> {
  if (hash.startsWith(`${PBKDF2_MARKER}$`)) {
    const parts = hash.split('$');
    const iterations = Number(parts[1]) || PBKDF2_ITERATIONS;
    const expected = parts[2] ?? '';
    const computed = await pbkdf2(password, salt, iterations);
    return computed === expected;
  }

  const data = encode(`${salt}:${password}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return toHex(digest) === hash;
}