import { createHash, createHmac, randomBytes } from 'crypto';

// ─── Password Utils ───────────────────────────────────────────────────────────
// Використовуємо вбудований crypto замість bcrypt (без зовнішніх залежностей)

const ITERATIONS = 100_000;
const KEY_LEN = 64;
const DIGEST = 'sha512';

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const hash = createHash(DIGEST);
  // Simple PBKDF2-like stretching via multiple iterations
  let derived = password + salt;
  for (let i = 0; i < ITERATIONS; i++) {
    derived = createHash(DIGEST).update(derived).digest('hex');
  }
  return `${salt}:${derived.substring(0, KEY_LEN)}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [salt] = stored.split(':');
  if (!salt) return false;
  let derived = password + salt;
  for (let i = 0; i < ITERATIONS; i++) {
    derived = createHash(DIGEST).update(derived).digest('hex');
  }
  const candidate = `${salt}:${derived.substring(0, KEY_LEN)}`;
  // Constant-time comparison
  if (candidate.length !== stored.length) return false;
  let diff = 0;
  for (let i = 0; i < candidate.length; i++) {
    diff |= candidate.charCodeAt(i) ^ stored.charCodeAt(i);
  }
  return diff === 0;
}

// ─── JWT-like Token Utils ─────────────────────────────────────────────────────
// Простий HS256-подібний токен без зовнішніх залежностей

const SECRET = process.env['JWT_SECRET'] ?? 'dev-secret-change-in-production-min-32-chars';
const EXPIRY_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

interface TokenPayload {
  userId: string;
  email: string;
  iat: number;
  exp: number;
}

function base64url(str: string): string {
  return Buffer.from(str).toString('base64url');
}

function fromBase64url(str: string): string {
  return Buffer.from(str, 'base64url').toString('utf8');
}

export function signToken(userId: string, email: string): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload: TokenPayload = {
    userId,
    email,
    iat: Date.now(),
    exp: Date.now() + EXPIRY_MS,
  };
  const payloadEncoded = base64url(JSON.stringify(payload));
  const signature = createHmac('sha256', SECRET)
    .update(`${header}.${payloadEncoded}`)
    .digest('base64url');
  return `${header}.${payloadEncoded}.${signature}`;
}

export function verifyToken(token: string): TokenPayload {
  const parts = token.split('.');
  if (parts.length !== 3) throw new Error('Invalid token format');
  const [header, payloadPart, signature] = parts as [string, string, string];

  const expectedSig = createHmac('sha256', SECRET)
    .update(`${header}.${payloadPart}`)
    .digest('base64url');

  if (signature !== expectedSig) throw new Error('Invalid token signature');

  const payload: TokenPayload = JSON.parse(fromBase64url(payloadPart));
  if (payload.exp < Date.now()) throw new Error('Token expired');

  return payload;
}

// ─── Validation Utils ─────────────────────────────────────────────────────────

export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidPassword(password: string): boolean {
  return password.length >= 8;
}

export function sanitizeString(str: string, maxLen = 500): string {
  return str.trim().substring(0, maxLen);
}

export function isNonEmptyString(val: unknown): val is string {
  return typeof val === 'string' && val.trim().length > 0;
}
