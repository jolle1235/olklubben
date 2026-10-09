import { expect, test } from "./fixtures";
import { deleteMembership, insertEvent, insertPlace, placeIdByName, sql } from "./support/db";
import {
  clubName,
  createClub,
  expectHydrated,
  newUser,
  signUpWithClub,
  type TestUser,
} from "./support/app";
import { choosePlace, dayFromToday, hostCheckbox, joinClub, placeRadio } from "./support/round2";

/**
 * Round 3, events with places and hosts (SPEC §9.2, D-098, D-099, D-101,
 * E29–E31): the PlaceSelector (radio cards, "＋ Nyt sted" inline, "findes
 * allerede"), the HostsPicker (follows the place until touched, "Brug stedets
 * ejere", hosts who left), the event page (place link, "Åbn i kort" only with
 * an address, "Tilføj adresse", "Værter: …"), archived places and a forged
 * place of another club. Every club, place and event here is the test's own.
 */

const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

async function hostIdsOf(eventId: string): Promise<string[]> {
  const rows = await sql<{ email: string }>(
    `SELECT u.email FROM event_hosts h JOIN users u ON u.id = h.user_id
     WHERE h.event_id = $1 ORDER BY u.email`,
    [eventId],
  );
  return rows.map((row) => row.email);
}

const emails = (...users: TestUser[]) => users.map((user) => user.email.toLowerCase()).sort();

function hostsGroup(page: import("@playwright/test").Page) {
  return page.getByRole("group", { name: "Værter" });
}

test.describe("Events med steder og værter", () => {
  test("en klub uden steder: '＋ Nyt sted' er valgt, 'Det er mit sted' gør mig til ejer og vært, og 'Åbn i kort' bruger adressen", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "nytsted");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "NytSted"));

    await page.goto(`/c/${clubId}/events/new`);
    await expectHydrated(placeRadio(page, "＋ Nyt sted"));
    await expect(placeRadio(page, "＋ Nyt sted")).toBeChecked();
    await expect(page.getByLabel("Navn på stedet")).toBeVisible();
    // No owners yet: I am the host.
    await expect(hostCheckbox(page, `${owner.name} (dig)`)).toBeChecked();
    await expect(hostsGroup(page)).toContainText("Stedet har ingen ejere, så du er vært.");

    await page.getByLabel("Dato").fill(dayFromToday(6));
    await page.getByLabel("Navn på stedet").fill("Hos Ejeren");
    await page.getByLabel(/^Adresse/).fill("Søndergade 12, 8381 Tilst");
    await page.getByLabel("Det er mit sted").check();
    await expect(hostsGroup(page)).toContainText("Udfyldt med stedets ejere.");
    await page.getByRole("button", { name: "Opret event" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/events/${UUID}$`));
    const eventId = new URL(page.url()).pathname.split("/").pop() ?? "";

    const placeId = await placeIdByName(clubId, "Hos Ejeren");
    expect(placeId).not.toBeNull();
    const owners = await sql<{ email: string }>(
      "SELECT u.email FROM place_owners o JOIN users u ON u.id = o.user_id WHERE o.place_id = $1",
      [placeId],
    );
    expect(owners.map((row) => row.email)).toEqual(emails(owner));
    expect(await hostIdsOf(eventId)).toEqual(emails(owner));

    // The event page: the place links to its page, the address and the map (D-101).
    await expect(page.getByRole("link", { name: "Hos Ejeren", exact: true })).toHaveAttribute(
      "href",
      `/c/${clubId}/places/${placeId}`,
    );
    await expect(page.getByText("Søndergade 12, 8381 Tilst", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Åbn i kort/ })).toHaveAttribute(
      "href",
      "https://www.google.com/maps/search/?api=1&query=S%C3%B8ndergade%2012%2C%208381%20Tilst",
    );
    await expect(page.getByRole("link", { name: "Tilføj adresse" })).toHaveCount(0);
    await expect(page.getByText(`Vært: ${owner.name}`)).toBeVisible();
  });

  test("værterne følger stedet, egne valg overlever et stedskift, et kendt navn genbruges, og en vært kan rette eventet", async ({
    page,
    openPage,
  }, testInfo) => {
    const admin = newUser(testInfo, "vaertadmin");
    const clubId = await signUpWithClub(page, admin, clubName(testInfo, "Vaerter"));
    const memberPage = await openPage();
    const member = newUser(testInfo, "vaertmedlem");
    await joinClub(page, memberPage, member, clubId);
    const hosMedlemmet = await insertPlace({
      clubId,
      name: "Hos Medlemmet",
      createdByEmail: member.email,
      ownerEmails: [member.email],
    });
    await insertPlace({ clubId, name: "Baren", createdByEmail: admin.email });

    await page.goto(`/c/${clubId}/events/new`);
    await expectHydrated(placeRadio(page, "Baren"));
    // Two places: none is chosen for you, so no hosts are suggested yet.
    await expect(placeRadio(page, "Hos Medlemmet")).not.toBeChecked();
    await expect(placeRadio(page, "Baren")).not.toBeChecked();
    await expect(hostsGroup(page)).toContainText("Vælg et sted, så foreslår vi værter.");
    await expect(placeRadio(page, "Hos Medlemmet")).toHaveAccessibleDescription(
      `Ejer: ${member.name}`,
    );

    // Untouched, the hosts follow the place: its owners, else me.
    await placeRadio(page, "Hos Medlemmet").check();
    await expect(hostCheckbox(page, member.name)).toBeChecked();
    await expect(hostCheckbox(page, `${admin.name} (dig)`)).not.toBeChecked();
    await expect(hostsGroup(page)).toContainText("Udfyldt med stedets ejere.");
    await placeRadio(page, "Baren").check();
    await expect(hostCheckbox(page, `${admin.name} (dig)`)).toBeChecked();
    await expect(hostCheckbox(page, member.name)).not.toBeChecked();

    // Touched, they stay through a place change, until "Brug stedets ejere".
    await hostCheckbox(page, member.name).check();
    await expect(hostsGroup(page)).toContainText("Du har selv valgt værter.");
    await placeRadio(page, "Hos Medlemmet").check();
    await expect(hostCheckbox(page, `${admin.name} (dig)`)).toBeChecked();
    await expect(hostCheckbox(page, member.name)).toBeChecked();
    await page.getByRole("button", { name: "Brug stedets ejere" }).click();
    await expect(hostCheckbox(page, `${admin.name} (dig)`)).not.toBeChecked();
    await expect(hostCheckbox(page, member.name)).toBeChecked();

    // A new place with a name the club has (E29): "findes allerede" → [Vælg det].
    await placeRadio(page, "＋ Nyt sted").check();
    await page.getByLabel("Navn på stedet").fill("  hos  MEDLEMMET ");
    await expect(page.getByText("«Hos Medlemmet» findes allerede.")).toBeVisible();
    await page.getByRole("button", { name: "Vælg det" }).click();
    await expect(placeRadio(page, "Hos Medlemmet")).toBeChecked();
    await expect(placeRadio(page, "Hos Medlemmet")).toBeFocused();
    await expect(page.getByLabel("Navn på stedet")).toBeHidden();

    await page.getByLabel("Titel").fill("Værtssmagning");
    await page.getByLabel("Dato").fill(dayFromToday(8));
    await page.getByRole("button", { name: "Opret event" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/events/${UUID}$`));
    const eventId = new URL(page.url()).pathname.split("/").pop() ?? "";
    expect(await hostIdsOf(eventId)).toEqual(emails(member));
    expect((await sql("SELECT 1 FROM places WHERE club_id = $1", [clubId])).length).toBe(2);
    await expect(page.getByText(`Vært: ${member.name}`)).toBeVisible();
    // No address: no map link, but a way to add one (D-101).
    await expect(page.getByRole("link", { name: /Åbn i kort/ })).toHaveCount(0);
    await expect(page.getByRole("link", { name: "Tilføj adresse" })).toHaveAttribute(
      "href",
      `/c/${clubId}/places/${hosMedlemmet}/edit`,
    );

    // The host did not create the event, but may edit it (D-098).
    await memberPage.goto(`/c/${clubId}/events/${eventId}`);
    await memberPage.getByRole("link", { name: "Rediger", exact: true }).click();
    await expect(
      memberPage.getByRole("heading", { level: 1, name: "Rediger event" }),
    ).toBeVisible();
    await expect(placeRadio(memberPage, "Hos Medlemmet")).toBeChecked();
    await expect(hostCheckbox(memberPage, `${member.name} (dig)`)).toBeChecked();
    await memberPage.getByLabel(/^Tema/).fill("Værtens tema");
    await memberPage.getByRole("button", { name: "Gem ændringer" }).click();
    await expect(memberPage).toHaveURL(new RegExp(`/events/${eventId}$`));
    await expect(memberPage.getByText("Tema: Værtens tema")).toBeVisible();

    // The host leaves the club (E31): on edit they are a ticked "(tidligere
    // medlem)" chip and stay a host when saved; they cannot be picked anew.
    await deleteMembership(member.email, clubId);
    await page.goto(`/c/${clubId}/events/${eventId}/edit`);
    const formerChip = hostCheckbox(page, `${member.name} (tidligere medlem)`);
    await expect(formerChip).toBeChecked();
    await expectHydrated(formerChip);
    await page.getByRole("button", { name: "Gem ændringer" }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`));
    expect(await hostIdsOf(eventId)).toEqual(emails(member));
    await page.goto(`/c/${clubId}/events/new`);
    await expect(placeRadio(page, "Baren")).toBeVisible();
    await expect(hostCheckbox(page, member.name)).toHaveCount(0);
  });

  test("arkiverede steder: tilbydes ikke til et nyt event, men bliver på eventet og ved redigering (E30)", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "arkiv");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Arkiv"));
    const gammelt = await insertPlace({
      clubId,
      name: "Det gamle sted",
      address: "Havnegade 3, Aarhus",
      createdByEmail: owner.email,
    });
    const eventId = await insertEvent({
      clubId,
      createdByEmail: owner.email,
      title: "Afskedssmagning",
      startsAt: new Date(Date.now() + 4 * 24 * 60 * 60 * 1000),
      placeName: "Det gamle sted",
    });
    await insertPlace({ clubId, name: "Det nye sted", createdByEmail: owner.email });
    await sql("UPDATE places SET archived_at = now() WHERE id = $1", [gammelt]);

    // The event still shows its place (E4), marked as archived.
    await page.goto(`/c/${clubId}/events/${eventId}`);
    await expect(page.getByRole("link", { name: "Det gamle sted", exact: true })).toBeVisible();
    await expect(page.getByText("Arkiveret", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: /Åbn i kort/ })).toHaveAttribute(
      "href",
      /query=Havnegade%203%2C%20Aarhus$/,
    );

    // A new event: only the active place, and as the only one it is chosen.
    await page.goto(`/c/${clubId}/events/new`);
    await expect(placeRadio(page, "Det nye sted")).toBeChecked();
    await expect(page.getByRole("radio", { name: /Det gamle sted/ })).toHaveCount(0);

    // Editing: the archived place stays chosen and is kept when saved.
    await page.goto(`/c/${clubId}/events/${eventId}/edit`);
    await expect(placeRadio(page, "Det gamle sted (arkiveret)")).toBeChecked();
    await expectHydrated(placeRadio(page, "Det nye sted"));
    await page.getByLabel(/^Tema/).fill("Sidste gang");
    await page.getByRole("button", { name: "Gem ændringer" }).click();
    await expect(page).toHaveURL(new RegExp(`/events/${eventId}$`));
    await expect(page.getByText("Tema: Sidste gang")).toBeVisible();
    const [row] = await sql<{ place_id: string }>("SELECT place_id FROM events WHERE id = $1", [
      eventId,
    ]);
    expect(row?.place_id).toBe(gammelt);
  });

  test("en forfalsket placeId fra en anden klub giver en feltfejl; valget står, og næste forsøg virker (F-053)", async ({
    page,
  }, testInfo) => {
    const owner = newUser(testInfo, "falsk");
    const clubId = await signUpWithClub(page, owner, clubName(testInfo, "Falsk"));
    await insertPlace({ clubId, name: "Hos Mig", createdByEmail: owner.email });
    const hosDig = await insertPlace({ clubId, name: "Hos Dig", createdByEmail: owner.email });
    const otherClubId = await createClub(page, clubName(testInfo, "Andenklub"));
    const foreign = await insertPlace({
      clubId: otherClubId,
      name: "Naboens sted",
      createdByEmail: owner.email,
    });
    expect(foreign).toHaveLength(hosDig.length);

    await page.goto(`/c/${clubId}/events/new`);
    await page.getByLabel("Titel").fill("Falsk smagning");
    await page.getByLabel("Dato").fill(dayFromToday(9));
    await choosePlace(page, "Hos Dig");
    await expect(hostCheckbox(page, `${owner.name} (dig)`)).toBeChecked();

    // Rewrite the submitted place id once, as a forged request would (F-038).
    let forged = 0;
    await page.route("**/events/new", async (route) => {
      const request = route.request();
      const body = request.postData();
      if (request.method() !== "POST" || !body?.includes(hosDig)) return route.continue();
      forged += 1;
      await route.continue({ postData: body.replaceAll(hosDig, foreign) });
    });
    await page.getByRole("button", { name: "Opret event" }).click();
    await expect(page.getByText("Stedet findes ikke længere. Vælg et andet.")).toBeVisible();
    expect(forged).toBe(1);
    await page.unrouteAll();

    // React reset the form after the answer; the choice is still shown (F-053).
    await expect(placeRadio(page, "Hos Dig")).toBeChecked();
    await expect(placeRadio(page, "Hos Dig")).toBeFocused();
    await expect(hostCheckbox(page, `${owner.name} (dig)`)).toBeChecked();
    await expect(page.getByLabel("Titel")).toHaveValue("Falsk smagning");
    expect(
      (await sql("SELECT 1 FROM events WHERE club_id = ANY($1::text[])", [[clubId, otherClubId]]))
        .length,
    ).toBe(0);

    await page.getByRole("button", { name: "Opret event" }).click();
    await expect(page).toHaveURL(new RegExp(`/c/${clubId}/events/${UUID}$`));
    await expect(page.getByRole("link", { name: "Hos Dig", exact: true })).toBeVisible();
  });
});
