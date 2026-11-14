# Ølkatalog and ratings

`/c/<clubId>/beers` lists every beer of the club with the club's average, the count, and the user's own
rating ("Din: ★ 4,5"), with search, six sort orders and an event filter, all in the URL. A beer's page
has "Klubbens rating", "Din rating" (five stars with half points, saved at once with "Gemt ✓"),
"Smagt til" and everyone's ratings. The person who added a beer and admins can edit and delete it.

## Sub-features

- `catalog-list` the list with count ("9 øl"), search ("Søg øl"), "Sorter" and "Event" filters.
- `rating-set` set or change your rating by keyboard or tap; saved immediately.
- `rating-remove` "Fjern min rating".
- `beer-add` "Tilføj øl" (name, "Alkoholprocent" as "5,2" or "5.2", optional event), with the
  duplicate warning "Den her har I vist smagt før 👀".
- `beer-edit-delete` "Rediger" and "Slet øl".

## How to get to it (user POV)

- "Øl" in the main navigation.
- An event page → a beer under "Øl smagt til dette event".
- "+ Tilføj øl" in the catalogue or on an event page.

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "jesper" })`. Drengene & Bajere has 9 beers. `BEERS.westmalle`: 3 ratings,
  Kaptajnen's is 5. `BEERS.mikkeller`: no ratings.

- **Catalogue.** ``app.goto(`/c/${CLUBS.drengene.id}/beers`)``. `getByRole("heading", { level: 1, name: "Ølkatalog" })`,
  `getByText("9 øl", { exact: true })`.
- **Open a beer.** `getByRole("link", { name: /Westmalle Tripel/ }).click()`; h1 "Westmalle Tripel";
  `getByRole("radio", { name: "5 ud af 5", exact: true })` is checked.
- **Rate.** On `BEERS.mikkeller`: `getByRole("radiogroup", { name: "Din rating" })`, focus
  `getByRole("radio", { name: "1 ud af 5", exact: true })`, press `End` then `ArrowLeft` twice →
  "4 ud af 5". Wait for `getByText("Gemt ✓", { exact: true })`.
- **Read back.** `app.sql("SELECT r.value FROM beer_ratings r JOIN users u ON u.id = r.user_id WHERE r.beer_id = $1 AND u.email = $2", [BEERS.mikkeller.id, USERS.jesper.email])`
  → `value` 8 (half points: 2 = 1 star … 10 = 5 stars).
- **Survives reload.** `page.reload()`: "4 ud af 5" still checked; the catalogue link's accessible
  name contains "din rating 4 ud af 5".
- **Proof.** `app.shot("rating")`. Recorded run: `.flow/setup-verify/check.mts` (2026-11-14).

## Gotchas

- The stars save after a short pause (debounced, one request per pause). Wait for "Gemt ✓" before
  reading the database or navigating, never a fixed sleep.
- A click on the stars right after a full page load can land before hydration and do nothing. Wait
  for "Gemt ✓" or use the keyboard after focusing a radio.
- Radio names: "4 ud af 5" needs `exact: true` (otherwise "4,5 ud af 5" matches too).
- "Fjern min rating" shows "Rating fjernet" and removes the row; the button disappears.
- Torsdagsklubben has no beers (its catalogue shows the empty state).
