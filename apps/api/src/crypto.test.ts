import { describe, it, expect } from "vitest";
import { hashPassword, verifyPassword, passwordProblems } from "./password.js";
import { generateTotpSecret, verifyTotp, totpCode, base32Decode, base32Encode } from "./totp.js";

describe("passwords (session 1.1)", () => {
  it("hashes and verifies with scrypt", async () => {
    const hash = await hashPassword("correct horse 42");
    expect(hash.startsWith("scrypt$")).toBe(true);
    expect(await verifyPassword("correct horse 42", hash)).toBe(true);
    expect(await verifyPassword("wrong horse 43", hash)).toBe(false);
  });

  it("rejects malformed stored hashes safely", async () => {
    expect(await verifyPassword("x", "not-a-hash")).toBe(false);
    expect(await verifyPassword("x", "scrypt$1$2$3$zz$zz")).toBe(false);
  });

  it("enforces a password policy", () => {
    expect(passwordProblems("short1").length).toBeGreaterThan(0);
    expect(passwordProblems("onlyletterspassword")).toBeTruthy();
    expect(passwordProblems("goodpass123")).toEqual([]);
  });
});

describe("TOTP 2FA (mvp §13)", () => {
  it("round-trips base32", () => {
    const buf = Buffer.from([0, 1, 2, 250, 251, 255]);
    expect(base32Decode(base32Encode(buf)).equals(buf)).toBe(true);
  });

  it("verifies the current code and tolerates one step of drift", () => {
    const secret = generateTotpSecret();
    const now = 1_700_000_000_000;
    const step = Math.floor(now / 1000 / 30);
    expect(verifyTotp(secret, totpCode(secret, step), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, step - 1), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, step + 1), now)).toBe(true);
    expect(verifyTotp(secret, totpCode(secret, step + 5), now)).toBe(false);
    expect(verifyTotp(secret, "abc123", now)).toBe(false);
  });
});
