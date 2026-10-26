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

  it("knows the round-4 poll toasts (§9.7, §13.5)", () => {
    expect(flashToastMessage("vote-saved")).toBe("Skål! Din stemme er gemt ✓");
    expect(flashToastMessage("poll-locked")).toBe("Afstemningen er lukket 🔒");
    for (const key of [
      "poll-created",
      "poll-updated",
      "vote-saved-closed",
      "vote-saved-tie",
      "poll-closed",
      "poll-awaiting",
      "poll-decided",
      "poll-cancelled",
    ]) {
      expect(flashToastMessage(key), key).toBeTruthy();
    }
    expect(withToast("/c/x/polls/y#stem", "vote-saved")).toBe("/c/x/polls/y?toast=vote-saved#stem");
  });

  it("knows the feedback toasts (§9.9)", () => {
    expect(flashToastMessage("feedback-created")).toBe("Tak! Din rapport er gemt 🍻");
    expect(flashToastMessage("feedback-updated")).toBe("Gemt ✓");
    expect(flashToastMessage("feedback-deleted")).toBe("Rapporten er slettet.");
    expect(flashToastMessage("feedback-moderated")).toBe("Status er gemt ✓");
    expect(withToast("/feedback?type=bug", "feedback-deleted")).toBe(
      "/feedback?type=bug&toast=feedback-deleted",
    );
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

  it("knows the toasts for 'Skift email' and 'Tilføj password' (D-151, D-152)", () => {
    expect(flashToastMessage("email-changed")).toBe(
      "Din email er skiftet. Dine andre enheder er logget ud.",
    );
    expect(flashToastMessage("password-set")).toBe(
      "Dit password er gemt. Nu kan du også logge ind med email og password. Dine andre enheder er logget ud.",
    );
    expect(withToast("/c/abc/profile", "email-changed")).toBe("/c/abc/profile?toast=email-changed");
  });

  it("explains that 'Skift email' removed the Google login (D-165)", () => {
    expect(flashToastMessage("email-changed-google")).toContain(
      "Google-login er koblet fra, fordi det hørte til den gamle email.",
    );
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
