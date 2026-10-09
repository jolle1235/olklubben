import { describe, expect, it } from "vitest";

import { isAllowedUserImage } from "./user-image";

describe("isAllowedUserImage (round 1: Google pictures only)", () => {
  it("allows no image", () => {
    expect(isAllowedUserImage(null)).toBe(true);
  });

  it("allows Google's picture URLs", () => {
    expect(isAllowedUserImage("https://lh3.googleusercontent.com/a/ACg8ocK=s96-c")).toBe(true);
    expect(isAllowedUserImage("https://googleusercontent.com/x.png")).toBe(true);
  });

  it("refuses other hosts, including look-alikes", () => {
    expect(isAllowedUserImage("https://tracker.example.invalid/x.png")).toBe(false);
    expect(isAllowedUserImage("https://evilgoogleusercontent.com/x.png")).toBe(false);
    expect(isAllowedUserImage("https://googleusercontent.com.evil.example/x.png")).toBe(false);
    expect(isAllowedUserImage("https://lh3.googleusercontent.com@evil.example/x.png")).toBe(false);
  });

  it("refuses http and other schemes", () => {
    expect(isAllowedUserImage("http://lh3.googleusercontent.com/a/x")).toBe(false);
    expect(isAllowedUserImage("javascript:alert(1)")).toBe(false);
    expect(isAllowedUserImage("data:image/png;base64,AAAA")).toBe(false);
  });

  it("refuses non-strings, undefined and junk", () => {
    expect(isAllowedUserImage(12345)).toBe(false);
    expect(isAllowedUserImage(undefined)).toBe(false);
    expect(isAllowedUserImage({ url: "https://lh3.googleusercontent.com/a" })).toBe(false);
    expect(isAllowedUserImage("")).toBe(false);
    expect(isAllowedUserImage("lh3.googleusercontent.com/a/x")).toBe(false);
  });
});
