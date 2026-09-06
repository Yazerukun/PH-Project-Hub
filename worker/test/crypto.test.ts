import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, randomToken, isLegacyHash } from '../src/utils/crypto';

import { toHex } from './crypto-harness';

const HEX64 = /^[0-9a-f]{64}$/;
const HEX32 = /^[0-9a-f]{32}$/;

describe('password hashing', () => {
  it('produces a salted PBKDF2-SHA256 hash and verifies it', async () => {
    const { hash, salt } = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^pbkdf2-sha256\$210000\$/);
    expect(hash.slice('pbkdf2-sha256$210000$'.length)).toMatch(HEX64);
    expect(salt).toMatch(HEX32);
    expect(isLegacyHash(hash)).toBe(false);
    expect(await verifyPassword('correct horse battery staple', hash, salt)).toBe(true);
    expect(await verifyPassword('wrong passphrase', hash, salt)).toBe(false);
  });

  it('derives different hashes for the same password with different salts', async () => {
    const a = await hashPassword('same-pass');
    const b = await hashPassword('same-pass');
    expect(a.hash).not.toBe(b.hash);
    expect(await verifyPassword('same-pass', a.hash, a.salt)).toBe(true);
    expect(await verifyPassword('same-pass', b.hash, b.salt)).toBe(true);
  });

  it('recomputes the correct digest for a fixed salt', async () => {
    const { hash, salt } = await hashPassword('pw', 'aaaabbbbccccddddeeeeffff00001111');
    expect(salt).toBe('aaaabbbbccccddddeeeeffff00001111');
    expect(hash).toMatch(/^pbkdf2-sha256\$210000\$[0-9a-f]{64}$/);
    expect(await verifyPassword('pw', hash, salt)).toBe(true);
  });

  it('still verifies pre-launch salted SHA-256 hashes (backward compatible)', async () => {
    const salt = 'aaaabbbbccccddddeeeeffff00001111';
    const legacyHash = toHex(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${salt}:old-school-pass`)));
    expect(isLegacyHash(legacyHash)).toBe(true);
    expect(await verifyPassword('old-school-pass', legacyHash, salt)).toBe(true);
    expect(await verifyPassword('wrong-pass', legacyHash, salt)).toBe(false);
  });

  it('randomToken returns hex with requested length', () => {
    expect(randomToken(16)).toMatch(HEX32);
    expect(randomToken(32)).toMatch(HEX64);
  });
});