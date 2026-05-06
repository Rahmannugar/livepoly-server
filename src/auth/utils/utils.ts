import { hash, verify } from 'argon2';
import { createHash, randomBytes, randomInt } from 'crypto';

export function generateOtpCode() {
  return String(randomInt(100000, 1000000));
}

export function hashToken(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function generateOpaqueToken(byteLength = 64) {
  return randomBytes(byteLength).toString('base64url');
}

export function hashPassword(password: string) {
  return hash(password);
}

export function verifyPassword(passwordHash: string, password: string) {
  return verify(passwordHash, password);
}
