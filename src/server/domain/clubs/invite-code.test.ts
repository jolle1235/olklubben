import { afterEach, describe, expect, it, vi } from "vitest";

import {
  formatInviteCode,
  generateInviteCode,
  INVITE_ALPHABET,
  INVITE_CODE_LENGTH,
  normalizeInviteCode,
} from "./invite-code";

describe("INVITE_ALPHABET", () => {
  it("has no look-alike characters (0/O, 1/I/L) and no duplicates", () => {
    for (const character of ["0", "O", "1", "I", "L"]) {
      expect(INVITE_ALPHABET).not.toContain(character);
    }
    expect(new Set(INVITE_ALPHABET).size).toBe(INVITE_ALPHABET.length);
    expect(INVITE_ALPHABET).toMatch(/^[A-Z2-9]+$/);
    expect(INVITE_ALPHABET).toHaveLength(31);
  });

  it("matches the CHECK constraint on invites.code", () => {
    const databasePattern = /^[2-9A-HJKMNP-Z]{8}$/;
    expect(databasePattern.test(INVITE_ALPHABET.slice(0, 8))).toBe(true);
    for (const character of INVITE_ALPHABET) {
      expect(databasePattern.test(character.repeat(8))).toBe(true);
    }
  });
});

describe("generateInviteCode", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns 8 characters from the alphabet", () => {
    for (let i = 0; i < 200; i++) {
      const code = generateInviteCode();
      expect(code).toHaveLength(INVITE_CODE_LENGTH);
      for (const character of code) expect(INVITE_ALPHABET).toContain(character);
      expect(normalizeInviteCode(code)).toBe(code);
    }
  });

  it("does not repeat itself", () => {
    const codes = new Set(Array.from({ length: 1000 }, () => generateInviteCode()));
    expect(codes.size).toBe(1000);
  });

  it("skips bytes ≥ 248 instead of folding them into the alphabet (no modulo bias)", () => {
    // First batch: only rejected bytes; second batch: 0..15 → "23456789ABCDEFGH…".
    let call = 0;
    vi.spyOn(globalThis.crypto, "getRandomValues").mockImplementation(
      <T extends ArrayBufferView | null>(array: T): T => {
        const bytes = array as unknown as Uint8Array;
        for (let i = 0; i < bytes.length; i++) bytes[i] = call === 0 ? 248 + (i % 8) : i;
        call++;
        return array;
      },
    );

    expect(generateInviteCode()).toBe("23456789");
    expect(call).toBe(2);
  });

  it("uses every character about equally often", () => {
    const counts = new Map<string, number>();
    for (let i = 0; i < 4000; i++) {
      for (const character of generateInviteCode()) {
        counts.set(character, (counts.get(character) ?? 0) + 1);
      }
    }
    // 32,000 characters / 31 ≈ 1032 each (σ ≈ 32); the bounds are > 9σ wide.
    expect(counts.size).toBe(INVITE_ALPHABET.length);
    for (const count of counts.values()) {
      expect(count).toBeGreaterThan(700);
      expect(count).toBeLessThan(1400);
    }
  });
});

describe("normalizeInviteCode", () => {
  it.each([
    ["K7XMQ2PA", "K7XMQ2PA"],
    ["k7xmq2pa", "K7XMQ2PA"],
    ["K7XM-Q2PA", "K7XMQ2PA"],
    ["k7xm-q2pa", "K7XMQ2PA"],
    ["  K7XM Q2PA  ", "K7XMQ2PA"],
    ["K7 XM-Q2 PA", "K7XMQ2PA"],
    ["K7XM–Q2PA", "K7XMQ2PA"], // en dash from a phone keyboard
    ["K7XM\tQ2PA\n", "K7XMQ2PA"],
  ])("accepts %j → %s", (input, expected) => {
    expect(normalizeInviteCode(input)).toBe(expected);
  });

  it("accepts a pasted invitation link", () => {
    expect(normalizeInviteCode("https://olklubben.vercel.app/join/K7XMQ2PA")).toBe("K7XMQ2PA");
    expect(normalizeInviteCode("http://localhost:3000/join/k7xm-q2pa?ref=chat")).toBe("K7XMQ2PA");
  });

  it.each([
    ["", "empty"],
    ["K7XMQ2P", "too short"],
    ["K7XMQ2PAA", "too long"],
    ["K7XMQ2P0", "contains 0"],
    ["K7XMQ2PO", "contains O"],
    ["K7XMQ2P1", "contains 1"],
    ["K7XMQ2PI", "contains I"],
    ["K7XMQ2PL", "contains L"],
    ["K7XM_Q2PA", "underscore"],
    ["K7XMQ2PÆ", "Danish letter"],
    ["https://x/join/", "link without code"],
  ])("rejects %j (%s)", (input) => {
    expect(normalizeInviteCode(input)).toBeNull();
  });

  it("rejects non-strings", () => {
    expect(normalizeInviteCode(undefined)).toBeNull();
    expect(normalizeInviteCode(null)).toBeNull();
    expect(normalizeInviteCode(12345678)).toBeNull();
  });
});

describe("formatInviteCode", () => {
  it("splits the code into two groups of four", () => {
    expect(formatInviteCode("K7XMQ2PA")).toBe("K7XM-Q2PA");
    expect(formatInviteCode("k7xm-q2pa")).toBe("K7XM-Q2PA");
  });

  it("returns invalid input unchanged", () => {
    expect(formatInviteCode("nope")).toBe("nope");
  });
});
