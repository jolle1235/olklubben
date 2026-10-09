import { expect, test } from "./fixtures";
import { insertBeer, insertEvent, sql } from "./support/db";
import {
  clubName,
  expectHydrated,
  expectOverview,
  newUser,
  readInvitePath,
  signUp,
  signUpWithClub,
} from "./support/app";

/**
 * Events (SPEC §9.2, §10.4, D-022, D-061, D-064, E13, E20, E22): create with
 * the suggested title, overnight end and a DST date, the invitation page,
 * edit, delete (beers stay), and the creator-or-admin rule on the server.
 */

const NOT_ALLOWED_TO_EDIT = "Kun den, der oprettede eventet, og klubbens admins kan rette det.";

async function eventRow(id: string) {
  const [row] = await sql<{ title: string; theme: string | null }>(
    "SELECT title, theme FROM events WHERE id = $1",
    [id],
  );
  return row ?? null;
}

test.describe("Events", () => {
  test("opret (forslag, overnat, sommertid) → eventsiden → rediger → slet, og øllene bliver", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "eventejer");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Events"));

    await page.goto(`/c/${clubId}/events/new`);
    await expect(page.getByRole("heading", { level: 1, name: "Opret event" })).toBeVisible();
    // D-064: the first event of a new club.
    await expect(page.getByLabel("Titel")).toHaveValue("Ølsmagning #1");
    await expect(page.getByLabel("Starttid")).toHaveValue("18:30");

    // Client validation: messages inline, focus on the first invalid field (D-056).
    await page.getByLabel("Titel").fill("");
    await page.getByRole("button", { name: "Opret event" }).click();
    await expect(page.getByText("Giv eventet en titel.")).toBeVisible();
    await expect(page.getByText("Vælg en dato.")).toBeVisible();
    await expect(page.getByText("Skriv, hvor I mødes.")).toBeVisible();
    await expect(page.getByLabel("Titel")).toBeFocused();
    await expect(page).toHaveURL(/\/events\/new$/);

    // 25 October 2026: the clocks go back at 03:00 (E20). 18:30–01:00 ends the next day.
    await page.getByLabel("Titel").fill("Ølsmagning #1");
    await page.getByLabel("Dato").fill("2026-10-25");
    await page.getByLabel(/^Sluttid/).fill("01:00");
    await expect(page.getByText("Slutter dagen efter kl. 01:00.")).toBeVisible();
    await page.getByLabel("Sted").fill("Søndergade 12, Tilst");
    await page.getByLabel(/^Tema/).fill("Belgiske øl");
    await page.getByLabel(/^Beskrivelse/).fill("Først en hvidtøl.\n\nSå blindsmagning.");
    await page.getByRole("button", { name: "Opret event" }).click();

    await expect(page).toHaveURL(/\/events\/[0-9a-f-]{36}$/);
    const eventId = new URL(page.url()).pathname.split("/").pop() as string;
    await expect(page.getByText("Skål! Eventet er oprettet 🍻")).toBeVisible();
    await expect(page.getByRole("heading", { level: 1, name: "Ølsmagning #1" })).toBeVisible();
    await expect(page.getByText(/søndag 25\. oktober/i)).toBeVisible();
    // 18:30 stays 18:30 after the clock change: 17:30 UTC in winter time.
    await expect(page.locator('time[datetime="2026-10-25T17:30:00.000Z"]')).toHaveText("18:30");
    await expect(page.locator('time[datetime="2026-10-26T00:00:00.000Z"]')).toHaveText("01:00");
    await expect(page.getByText("Tema: Belgiske øl")).toBeVisible();
    await expect(page.getByRole("heading", { level: 2, name: "Planen" })).toBeVisible();
    await expect(page.getByRole("link", { name: /Åbn i kort/ })).toHaveAttribute(
      "href",
      /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=S%C3%B8ndergade/,
    );
    await expect(page.getByRole("link", { name: "Tilføj øl" }).last()).toHaveAttribute(
      "href",
      `/c/${clubId}/beers/new?eventId=${eventId}`,
    );

    // Edit: the stored times come back as typed; save → toast.
    await page.getByRole("link", { name: "Rediger", exact: true }).click();
    await expect(page.getByRole("heading", { level: 1, name: "Rediger event" })).toBeVisible();
    await expect(page.getByLabel("Dato")).toHaveValue("2026-10-25");
    await expect(page.getByLabel("Starttid")).toHaveValue("18:30");
    await expect(page.getByLabel(/^Sluttid/)).toHaveValue("01:00");
    await expect(page.getByLabel(/^Beskrivelse/)).toHaveValue(
      "Først en hvidtøl.\n\nSå blindsmagning.",
    );
    await page.getByLabel(/^Tema/).fill("Tyske øl");
    await page.getByRole("button", { name: "Gem ændringer" }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`));
    await expect(page.getByText("Gemt ✓")).toBeVisible();
    await expect(page.getByText("Tema: Tyske øl")).toBeVisible();

    // A beer tasted at the event (the beer form is tested in beers.spec.ts).
    const beerId = await insertBeer({
      clubId,
      createdByEmail: owner.email,
      name: "Testøl Dubbel",
      abv: 6.5,
      eventId,
    });
    await page.reload();
    await expect(page.getByRole("link", { name: /Testøl Dubbel/ })).toHaveAttribute(
      "href",
      `/c/${clubId}/beers/${beerId}`,
    );

    // Delete with the confirmation from §9.2 → Overblik. The beer stays (E13).
    await expectHydrated(page.getByRole("button", { name: "Slet event" }));
    await page.getByRole("button", { name: "Slet event" }).click();
    const dialog = page.getByRole("alertdialog");
    await expect(dialog.getByText("Er du sikker?")).toBeVisible();
    await expect(dialog.getByText('"Ølsmagning #1" bliver slettet permanent.')).toBeVisible();
    await expect(
      dialog.getByText("Øl, der er knyttet til eventet, bliver i kataloget, men mister koblingen."),
    ).toBeVisible();
    await dialog.getByRole("button", { name: "Slet event" }).click();
    // Overblik confirms it, and the toast flag leaves the address bar again.
    await expect(
      page.getByText("Eventet er slettet. Øllene er stadig i kataloget 🍺"),
    ).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}$`));
    await expect.poll(() => eventRow(eventId)).toBeNull();
    const [beer] = await sql<{ event_id: string | null }>(
      "SELECT event_id FROM beers WHERE id = $1",
      [beerId],
    );
    expect(beer?.event_id).toBeNull();

    // The deleted event is a real 404 now.
    const gone = await page.goto(`/c/${clubId}/events/${eventId}`);
    expect(gone?.status()).toBe(404);
  });

  test("et medlem kan ikke rette andres events: ingen knapper, 404 på rediger, og serveren afviser", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "eventadmin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Rettigheder"));
    const adminEventId = await insertEvent({
      clubId,
      createdByEmail: admin.email,
      title: "Adminens smagning",
      startsAt: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000),
    });
    await page.goto(`/c/${clubId}/club`);
    const invitePath = await readInvitePath(page);

    const memberPage = await openPage();
    const member = newUser(testInfo, "eventmedlem");
    await signUp(memberPage, member, { next: invitePath });
    await memberPage.getByRole("button", { name: "Join klub" }).click();
    await expectOverview(memberPage, clubId);

    // The member sees the event, but no Rediger/Slet (D-061).
    await memberPage.goto(`/c/${clubId}/events/${adminEventId}`);
    await expect(
      memberPage.getByRole("heading", { level: 1, name: "Adminens smagning" }),
    ).toBeVisible();
    await expect(memberPage.getByRole("button", { name: "Slet event" })).toHaveCount(0);
    await expect(memberPage.getByRole("link", { name: "Rediger", exact: true })).toHaveCount(0);

    // The edit page is a real 404 for them (no loading.tsx above it, TG-008).
    const edit = await memberPage.goto(`/c/${clubId}/events/${adminEventId}/edit`);
    expect(edit?.status()).toBe(404);

    // Forged request: the member's own edit form, pointed at the admin's event.
    const ownEventId = await insertEvent({
      clubId,
      createdByEmail: member.email,
      title: "Medlemmets smagning",
      startsAt: new Date(Date.now() + 9 * 24 * 60 * 60 * 1000),
    });
    await memberPage.goto(`/c/${clubId}/events/${ownEventId}/edit`);
    await expect(memberPage.getByLabel("Titel")).toHaveValue("Medlemmets smagning");
    await memberPage.getByLabel("Titel").fill("Overtaget");
    // Set right before the submit: a re-render would put the real id back.
    await memberPage.evaluate((id) => {
      const input = document.querySelector<HTMLInputElement>('input[name="eventId"]');
      if (input) input.value = id;
    }, adminEventId);
    await memberPage.getByRole("button", { name: "Gem ændringer" }).click();
    await expect(memberPage.getByText(NOT_ALLOWED_TO_EDIT)).toBeVisible();
    expect((await eventRow(adminEventId))?.title).toBe("Adminens smagning");
    expect((await eventRow(ownEventId))?.title).toBe("Medlemmets smagning");

    // An admin may edit the member's event (D-061).
    const adminEdit = await page.goto(`/c/${clubId}/events/${ownEventId}/edit`);
    expect(adminEdit?.status()).toBe(200);
    await expect(page.getByRole("heading", { level: 1, name: "Rediger event" })).toBeVisible();
  });
});
