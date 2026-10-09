import { describe, expect, it } from "vitest";

import {
  FLASH_TOASTS,
  flashToastMessage,
  searchWithoutToast,
  TOAST_PARAM,
  withToast,
} from "./flash-toast";

describe("withToast", () => {
  it("adds the flag as the first query parameter", () => {
    expect(withToast("/c/x", "event-deleted")).toBe(`/c/x?${TOAST_PARAM}=event-deleted`);
  });

  it("keeps an existing query and the hash", () => {
    expect(withToast("/c/x/calendar?month=2026-10#uge", "event-created")).toBe(
      "/c/x/calendar?month=2026-10&toast=event-created#uge",
    );
  });
});

describe("flashToastMessage", () => {
  it("knows the event and beer toasts (SPEC §13.5 tone)", () => {
    expect(flashToastMessage("event-created")).toBe("Skål! Eventet er oprettet 🍻");
    expect(flashToastMessage("event-updated")).toBe("Gemt ✓");
    expect(flashToastMessage("beer-updated")).toBe("Gemt ✓");
    expect(flashToastMessage("beer-deleted")).toBe("Øllen er slettet.");
    for (const message of Object.values(FLASH_TOASTS)) expect(message.length).toBeGreaterThan(0);
  });

  it("knows the round-3 toasts for places, profile and club", () => {
    for (const key of [
      "place-created",
      "place-updated",
      "place-archived",
      "place-restored",
      "place-deleted",
      "profile-updated",
      "password-changed",
      "club-updated",
      "club-left",
      "club-deleted",
    ]) {
      expect(flashToastMessage(key), key).not.toBeNull();
    }
    expect(flashToastMessage("profile-updated")).toBe("Gemt ✓");
    expect(flashToastMessage("club-deleted")).toBe("Klubben er slettet.");
  });

  it("ignores missing and unknown keys, also inherited ones", () => {
    expect(flashToastMessage(null)).toBeNull();
    expect(flashToastMessage(undefined)).toBeNull();
    expect(flashToastMessage("")).toBeNull();
    expect(flashToastMessage("<script>")).toBeNull();
    expect(flashToastMessage("toString")).toBeNull();
    expect(flashToastMessage("__proto__")).toBeNull();
  });
});

describe("searchWithoutToast", () => {
  it("removes only the flag", () => {
    expect(searchWithoutToast("?toast=event-created")).toBe("");
    expect(searchWithoutToast("?q=duvel&toast=beer-deleted&sort=name")).toBe("?q=duvel&sort=name");
    expect(searchWithoutToast("")).toBe("");
  });
});
