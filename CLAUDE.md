# Ølklubben

Produktet, arkitekturen og alle beslutninger er beskrevet i [SPEC.md](SPEC.md). Det er projektets kilde til sandhed.

Før du arbejder i projektet:

1. Læs de relevante afsnit af `SPEC.md`, især §19 (AI-agentens arbejdsområde: status, beslutningslog, fejl og rettelser).
2. Følg arbejdsreglerne i §19.1.
3. Efter hver opgave: opdatér §19.2 (status). Log fejl og rettelser i §19.4 og afvigelser fra spec'en i §19.3.

Sprog: UI-tekst og dokumentation på dansk. Kode, routes og identifiers på engelsk.

## Opgaveflow

Til en opgave fra start til færdig PR (fejl, feature, refaktorering) bruges `deliver`-skillen: `deliver "<opgave>"`, `deliver resume <slug>`. Flow-skillsene deles med andre projekter og kommer fra det private repo `jolle1235/agent-skills` (installeret i `.claude/skills/`, låst i `skills-lock.json`; ret dem dér og kør `npx skills update -p -y`). Det, der er særligt for dette projekt (kommandoer, gates, konventioner, sikkerhed og SPEC-opdateringen efter hver opgave), står i `.claude/flow/profile.md`. Kørslernes tilstand ligger i `.flow/<slug>/` (gitignored).
