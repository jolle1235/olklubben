# Steder

`/c/<clubId>/places` lists the club's places (name, address, owners, how many tastings), with
archived ones folded under "Arkiverede steder (N)". A place's page shows "Om stedet" (address with
"Åbn i kort", description), "Ejere" with "Det er mit sted", "Ølsmagninger her" and "Opret event her".
An unused place can be deleted, a used one archived and restored; a place in an open poll can do
neither.

## Sub-features

- `places-list` active places and the folded archive.
- `place-page` address, owners, tastings held there.
- `place-own` "Det er mit sted" makes you an owner; admins can remove other owners.
- `place-create-edit` "Nyt sted" and "Rediger" (unique name among active places).
- `place-archive-delete` archive, restore or delete, depending on use.

## How to get to it (user POV)

- Klubbens side → "Steder" ("5 steder Hvor I mødes, og hvem der ejer dem").
- Profil → Steder.
- An event page → its place.

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "jesper" })`. Drengene & Bajere: five active places, "Det gamle klubhus"
  archived. `PLACES.hosMads` (owner Mads, address, in the open poll), `PLACES.lokaleBar` (no
  owners, never used).

- **List.** ``app.goto(`/c/${CLUBS.drengene.id}/places`)``. h1 "Steder";
  `getByRole("link", { name: /^Den lokale bar/ })`; `getByText("Arkiverede steder (1)")`.
- **Place.** `getByRole("link", { name: /^Hos Mads Søndergade/ }).click()`: h1 "Hos Mads",
  `getByRole("region", { name: "Ejere" })` contains "Mads", `getByRole("link", { name: "Opret event her" })`.
- **Own it.** As Anders on `PLACES.lokaleBar`: `getByRole("button", { name: "Det er mit sted" })`.
  "Anders" appears under "Ejere"; read back
  `app.sql("SELECT 1 FROM place_owners o JOIN users u ON u.id = o.user_id WHERE o.place_id = $1 AND u.email = $2", [PLACES.lokaleBar.id, USERS.anders.email])`
  (recorded 2026-11-14).
- **Proof.** `app.shot("place")`.

## Gotchas

- Link names are the whole card ("Hos Mads Søndergade 12, 8381 Tilst Ejer: Mads · 1 ølsmagning"), so
  "Hos Mads" also prefixes "Hos Mads & Anders". Anchor more of the name.
- "Hos Mads", "Hos Jesper" and "Hos Anders" are in the open poll: the page says it can't be archived
  until the poll is over. Use `PLACES.lokaleBar` for archive and delete.
- The archive group is collapsed; open it before looking for "Det gamle klubhus".
- Owners become hosts of new events at the place; existing events don't change.
