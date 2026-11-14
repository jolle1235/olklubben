# Events

A tasting has its own page `/c/<clubId>/events/<eventId>` that reads like an invitation: title, theme,
time, place with "Åbn i kort" (or "Tilføj adresse"), hosts, "Planen", and "Øl smagt til dette event"
with "+ Tilføj øl". The creator, the hosts and admins can edit and delete it. New events come from
"Opret event" (`/c/<clubId>/events/new`).

## Sub-features

- `event-page` shows time, place, hosts, plan and the event's beers.
- `event-create` creates an event: title (suggested "Ølsmagning #N"), date, start time, optional end
  day and time, place, hosts, theme, plan.
- `event-edit` edits it ("Rediger").
- `event-delete` deletes it ("Slet event"); its beers stay in the catalogue without an event.

## How to get to it (user POV)

- Overblik → the hero card or a row under "Kommende arrangementer".
- Kalender → an event.
- The "+" in the top bar (mobile) or "Opret event" on Overblik/Kalender for a new one.

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "jesper" })`. `EVENTS.next13` (in 3 days, Hos Jesper, created by a poll);
  `EVENTS.past12` (3 weeks ago, Hos Mads, four beers).

- **Open.** ``app.goto(`/c/${CLUBS.drengene.id}/events/${EVENTS.next13.id}`)``.
  `getByRole("heading", { level: 1, name: "Ølsmagning #13" })`, `getByText("Valgt ved afstemning 🗳")`,
  `getByText("Hos Jesper")`, and `getByRole("region", { name: "Øl smagt til dette event" })`.
- **Create.** ``app.goto(`/c/${CLUBS.drengene.id}/events/new`)``; heading "Opret event". Fill
  `getByLabel("Titel")`, `getByLabel("Dato", { exact: true })` (`YYYY-MM-DD`), `getByLabel("Starttid")`, pick a place
  `getByRole("radio", { name: "Hos Mads", exact: true })`, then
  `getByRole("button", { name: "Opret event" })`. Lands on the new event page.
- **Read back.** `app.sql("SELECT title, starts_at FROM events WHERE club_id = $1 ORDER BY created_at DESC LIMIT 1", [CLUBS.drengene.id])`.
- **Proof.** `app.shot("event")`.

## Gotchas

- The event form's end fields are labelled "Slutdag" and "Sluttid" (match with `/^Slutdag/`), and
  "Dato" would also match a label containing "dato": use exact labels.
- Times are Europe/Copenhagen; `starts_at` in the database is UTC.
- An event without start time shows no time; with an end more than 6 hours into the next day the end
  day is named (D-176).
- "Slet event" opens a confirm dialog; the delete only happens after confirming in it.
