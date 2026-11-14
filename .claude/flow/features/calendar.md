# Kalender

`/c/<clubId>/calendar` has two views: "Måned" (the default on desktop), a month grid with events and
dashed possible dates from open polls, browsable with "Forrige måned", "Næste måned" and "I dag"; and
"Liste" (the default on mobile), upcoming events per month followed by "Tidligere ølsmagninger" (12
per month, with beer count and best beer). Each entry links to its event or poll.

## Sub-features

- `calendar-month` the month grid, previous and next months, "I dag".
- `calendar-list` upcoming events per month plus possible poll dates.
- `calendar-history` "Tidligere ølsmagninger" grouped by month, "Vis alle N tidligere".
- `calendar-day` on mobile, tapping a date shows that day's events and "Opret event denne dag".
- `calendar-create` "Opret event" and "Planlæg ølsmagning" links.

## How to get to it (user POV)

- "Kalender" in the main navigation.
- Switch views with the "Visning" navigation: "Liste" / "Måned".

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "jesper" })`. Drengene & Bajere: Ølsmagning #13 in 3 days, Juleøl warmup in 4
  weeks, poll Ølsmagning #14 with three possible dates, three past tastings.

- **Month (desktop).** ``app.goto(`/c/${CLUBS.drengene.id}/calendar`)``. h1 "Kalender";
  `getByRole("table", { name: /^Kalender for / })`; event links are named
  `"Ølsmagning #13 , tirsdag 17. november kl. 18:30"`, poll dates
  `"Mulig dato: Ølsmagning #14, lørdag 28. november kl. 18:30, afstemning, stem inden …"`.
- **List.** `getByRole("navigation", { name: "Visning" }).getByRole("link", { name: "Liste" }).click()`.
  Each month is a region named after it ("december 2026"); links like
  `getByRole("link", { name: /^Juleøl warmup ,/ })`.
- **History.** `getByRole("region", { name: "Tidligere ølsmagninger", exact: true })` contains
  `getByRole("link", { name: /^Ølsmagning #12 ,/ })` (its name ends "4 øl · Bedst: Grimbergen Dubbel ★ 4,7").
- **Mobile.** `viewport: "mobile"`: the list is the default; there is no table.
- **Proof.** `app.shot("calendar")`.

## Gotchas

- Link names contain a space before the comma ("Ølsmagning #13 , tirsdag …"). Match with a regex
  anchored on the title, e.g. `/^Ølsmagning #13 ,/`.
- The month regions in history are named "Tidligere ølsmagninger oktober 2026"; use `exact: true` for
  the outer region.
- Dates are relative to the seed day, so which month an event falls in varies: don't assert month
  names.
- A poll's possible dates disappear once the poll is decided.
- The view and month are in the URL (`?view`, `?month`, `?day`, `?past`); invalid values are ignored.
