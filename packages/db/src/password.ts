/**
 * Password hashing with node:crypto scrypt — no external dependencies.
 * Lives in @fedites/db so migrations and seeds can hash demo passwords;
 * the API re-exports it (apps/api/src/password.ts).
 * Format: scrypt$N$r$p$salt$hash (all hex).
 */
import { randomBytes, scrypt as scryptCb, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCb) as (
  password: string | Buffer,
  salt: string | Buffer,
  keylen: number,
  options: { N: number; r: number; p: number },
) => Promise<Buffer>;

const PARAMS = { N: 16384, r: 8, p: 1 } as const;
const KEYLEN = 64;

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scrypt(password, salt, KEYLEN, PARAMS);
  return `scrypt$${PARAMS.N}$${PARAMS.r}$${PARAMS.p}$${salt.toString("hex")}$${key.toString("hex")}`;
}

export async function verifyPassword(password: string, stored: string): Promise<boolean> {
  const parts = stored.split("$");
  if (parts.length !== 6 || parts[0] !== "scrypt") return false;
  const N = Number(parts[1]);
  const r = Number(parts[2]);
  const p = Number(parts[3]);
  const salt = Buffer.from(parts[4] ?? "", "hex");
  const expected = Buffer.from(parts[5] ?? "", "hex");
  if (expected.length !== KEYLEN) return false;
  const actual = await scrypt(password, salt, KEYLEN, { N, r, p });
  return timingSafeEqual(actual, expected);
}

export function passwordProblems(password: string): string[] {
  const problems: string[] = [];
  if (password.length < 10) problems.push("use at least 10 characters");
  if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
    problems.push("mix letters and numbers");
  }
  return problems;
}
