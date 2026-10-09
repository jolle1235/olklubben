import { describe, expect, it, vi } from "vitest";

import { isUniqueConstraintError, retryOnUniqueViolation } from "./unique-retry";

const collision = Object.assign(new Error("Unique constraint failed"), { code: "P2002" });

describe("isUniqueConstraintError", () => {
  it("recognises Prisma's P2002", () => {
    expect(isUniqueConstraintError(collision)).toBe(true);
  });

  it("ignores other errors and non-errors", () => {
    expect(isUniqueConstraintError(Object.assign(new Error("x"), { code: "P2025" }))).toBe(false);
    expect(isUniqueConstraintError(new Error("x"))).toBe(false);
    expect(isUniqueConstraintError("P2002")).toBe(false);
    expect(isUniqueConstraintError(null)).toBe(false);
  });
});

describe("retryOnUniqueViolation", () => {
  it("returns the first successful result", async () => {
    const task = vi.fn(async () => "ok");
    await expect(retryOnUniqueViolation(task)).resolves.toBe("ok");
    expect(task).toHaveBeenCalledTimes(1);
  });

  it("runs the task again after a collision", async () => {
    const task = vi
      .fn<(attempt: number) => Promise<string>>()
      .mockRejectedValueOnce(collision)
      .mockRejectedValueOnce(collision)
      .mockResolvedValueOnce("third time lucky");
    await expect(retryOnUniqueViolation(task)).resolves.toBe("third time lucky");
    expect(task.mock.calls.map(([attempt]) => attempt)).toEqual([1, 2, 3]);
  });

  it("gives up after the given number of attempts and rethrows the collision", async () => {
    const task = vi.fn(async () => {
      throw collision;
    });
    await expect(retryOnUniqueViolation(task, 3)).rejects.toBe(collision);
    expect(task).toHaveBeenCalledTimes(3);
  });

  it("rethrows other errors immediately", async () => {
    const boom = new Error("database down");
    const task = vi.fn(async () => {
      throw boom;
    });
    await expect(retryOnUniqueViolation(task)).rejects.toBe(boom);
    expect(task).toHaveBeenCalledTimes(1);
  });
});
