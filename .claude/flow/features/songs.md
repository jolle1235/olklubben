# Sangbog

`/c/<clubId>/songs` lists the club's songs alphabetically in Danish order (Æ, Ø, Å last, "Aa" under Å)
with letter headings and an A–Å jump. The search field searches title, artist, melody and lyrics as
you type, keeps the query in the URL (`?q=`) and shows the matching line. A song's page has "Tekst"
and "Akkorder" (when it has chords), font size steps, and "Forrige og næste sang". Admins create, edit,
delete and import songs from PDFs.

## Sub-features

- `songs-list` alphabetical list with letter headings.
- `songs-search` instant search, query in the URL, fallback without æ/ø/å.
- `song-read` reading view: Tekst/Akkorder, "Mindre skrift"/"Større skrift", previous/next.
- `song-admin` create, edit, delete (admins only).
- `song-import` "Importér fra PDF" (admins; not mapped in detail yet).

## How to get to it (user POV)

- "Sangbog" in the main navigation.
- From an event that is "I gang nu": the "Sangbog" shortcut on Overblik.

## Driving it with the verify driver

Preconditions:

- `openApp(id, { as: "mads" })` (admin of Torsdagsklubben; using Mads keeps Kaptajnen's last active
  club). All five seed songs are synthetic and in Torsdagsklubben; Drengene & Bajere has none.

- **List.** ``app.goto(`/c/${CLUBS.torsdag.id}/songs`)``. h1 "Sangbog";
  `getByRole("link", { name: /Aalborg-valsen/ })` under "Å".
- **Search.** `getByLabel("Søg i sangbogen").fill("kaptajnen")`. The URL gets `?q=kaptajnen` and
  `getByRole("link", { name: /Skål for kaptajnen/ })` is listed.
- **Read.** Open it: h1 "Skål for kaptajnen", `getByRole("button", { name: "Akkorder" })`,
  `getByRole("navigation", { name: "Forrige og næste sang" })`.
- **Proof.** `app.shot("song")`.

## Gotchas

- Never real song titles or lyrics anywhere: not in checks, screenshots for PRs, or notes (SPEC §19.1
  rule 10). The instance only has the synthetic seed songs; never run `songbook:import` against it.
- The search updates the URL after a short debounce: wait for the URL or the result, not a sleep.
- The font size is remembered per device (localStorage); a fresh `openApp` starts at the default.
- Song pages repeat section headings ("Omkvæd") several times: don't assert a unique h2.
