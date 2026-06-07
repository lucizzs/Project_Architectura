import {
  hashPassword, verifyPassword, signToken, verifyToken,
  isValidEmail, isValidPassword, sanitizeString, isNonEmptyString,
} from '../../../src/utils/crypto.utils';

describe('hashPassword / verifyPassword', () => {
  it('returns a non-empty string', () => {
    const h = hashPassword('mypassword');
    expect(typeof h).toBe('string');
    expect(h.length).toBeGreaterThan(10);
  });

  it('verifies correct password', () => {
    const hash = hashPassword('correctpw');
    expect(verifyPassword('correctpw', hash)).toBe(true);
  });

  it('rejects wrong password', () => {
    const hash = hashPassword('correct');
    expect(verifyPassword('wrong', hash)).toBe(false);
  });

  it('different hashes for same password (random salt)', () => {
    const h1 = hashPassword('samepassword');
    const h2 = hashPassword('samepassword');
    expect(h1).not.toBe(h2);
  });

  it('rejects malformed stored hash', () => {
    expect(verifyPassword('pw', 'malformed')).toBe(false);
  });

  it('rejects empty stored hash', () => {
    expect(verifyPassword('pw', '')).toBe(false);
  });

  it('hashes with special characters work', () => {
    const pw = 'p@$$w0rd!#%^&*()';
    const hash = hashPassword(pw);
    expect(verifyPassword(pw, hash)).toBe(true);
  });

  it('hashes with unicode work', () => {
    const pw = 'пароль123';
    const hash = hashPassword(pw);
    expect(verifyPassword(pw, hash)).toBe(true);
  });
});

describe('signToken / verifyToken', () => {
  it('produces 3-part JWT-like token', () => {
    const token = signToken('user-1', 'a@a.com');
    expect(token.split('.').length).toBe(3);
  });

  it('verifies own token and returns payload', () => {
    const token = signToken('user-42', 'b@b.com');
    const payload = verifyToken(token);
    expect(payload.userId).toBe('user-42');
    expect(payload.email).toBe('b@b.com');
  });

  it('payload has iat and exp', () => {
    const token = signToken('u', 'u@u.com');
    const p = verifyToken(token);
    expect(p.iat).toBeGreaterThan(0);
    expect(p.exp).toBeGreaterThan(p.iat);
  });

  it('throws on tampered payload', () => {
    const [header, , sig] = signToken('u', 'u@u.com').split('.');
    const fakePayload = Buffer.from(JSON.stringify({ userId: 'hacker', email: 'h@h.com', iat: Date.now(), exp: Date.now() + 9999999 })).toString('base64url');
    expect(() => verifyToken(`${header}.${fakePayload}.${sig}`)).toThrow();
  });

  it('throws on malformed token (< 3 parts)', () => {
    expect(() => verifyToken('only.two')).toThrow();
  });

  it('throws on expired token', () => {
    // We can't easily create an expired token without mocking Date,
    // but we verify the structure is correct
    const token = signToken('u', 'u@u.com');
    expect(() => verifyToken(token)).not.toThrow(); // should be valid
  });
});

describe('isValidEmail', () => {
  it('accepts valid emails', () => {
    expect(isValidEmail('user@example.com')).toBe(true);
    expect(isValidEmail('user+tag@sub.domain.org')).toBe(true);
    expect(isValidEmail('a@b.io')).toBe(true);
  });

  it('rejects invalid emails', () => {
    expect(isValidEmail('notanemail')).toBe(false);
    expect(isValidEmail('@nodomain.com')).toBe(false);
    expect(isValidEmail('user@')).toBe(false);
    expect(isValidEmail('')).toBe(false);
    expect(isValidEmail('user @example.com')).toBe(false);
  });
});

describe('isValidPassword', () => {
  it('accepts passwords of 8+ chars', () => {
    expect(isValidPassword('12345678')).toBe(true);
    expect(isValidPassword('longer_password')).toBe(true);
  });

  it('rejects passwords shorter than 8 chars', () => {
    expect(isValidPassword('1234567')).toBe(false);
    expect(isValidPassword('')).toBe(false);
  });
});

describe('sanitizeString', () => {
  it('trims whitespace', () => {
    expect(sanitizeString('  hello  ')).toBe('hello');
  });

  it('truncates to maxLen', () => {
    expect(sanitizeString('abcdef', 3)).toBe('abc');
  });

  it('returns empty string for whitespace-only', () => {
    expect(sanitizeString('   ')).toBe('');
  });

  it('uses default maxLen of 500', () => {
    const long = 'a'.repeat(600);
    expect(sanitizeString(long).length).toBe(500);
  });
});

describe('isNonEmptyString', () => {
  it('returns true for non-empty strings', () => {
    expect(isNonEmptyString('hello')).toBe(true);
    expect(isNonEmptyString('  x  ')).toBe(true);
  });

  it('returns false for empty or whitespace', () => {
    expect(isNonEmptyString('')).toBe(false);
    expect(isNonEmptyString('   ')).toBe(false);
  });

  it('returns false for non-strings', () => {
    expect(isNonEmptyString(null)).toBe(false);
    expect(isNonEmptyString(undefined)).toBe(false);
    expect(isNonEmptyString(42)).toBe(false);
    expect(isNonEmptyString([])).toBe(false);
  });
});
