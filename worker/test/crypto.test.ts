import { describe, expect, it } from 'vitest';
import { hashPassword, verifyPassword, randomToken } from '../src/utils/crypto';

describe('password hashing', () => {
  it('produces a salted, non-reversible hash and verifies it', async () => {
    const { hash, salt } = await hashPassword('correct horse battery staple');
    expect(hash).toMatch(/^[0-9a-f]{64}$/);
    expect(salt).toMatch(/^[0-9a-f]{32}$/);
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
    const { hash } = await hashPassword('pw', 'aaaabbbbccccddddeeeeffff00001111');
    expect(hash).toHaveLength(64);
  });

  it('randomToken returns hex with requested length', () => {
    expect(randomToken(16)).toMatch(/^[0-9a-f]{32}$/);
    expect(randomToken(32)).toMatch(/^[0-9a-f]{64}$/);
  });
});