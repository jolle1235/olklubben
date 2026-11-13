# Verifier notes: <project name>

The project's memory for proving changes, across sessions. Read by `find-verifier`, `scope-task`,
`before-after`, `verify` and `update-verify` (profile → Verifier notes). Only append from runs that
happened; never delete lines, strike them through with a pointer instead.

## Recipes

Concrete proof recipes for this app, by technique number from the shared catalog
(`.claude/skills/find-verifier/references/verifier-catalog.md`). Where both cover a technique, the
recipe here wins. Real commands and paths.

### <n>. <technique name>

- **Recipe:** …
- **Worked:** <date, task slug>

## Log

One line per task that chose a verifier (`find-verifier`) or ran `before-after`:

```
<date> | <task slug> | <task kind> | <technique> | caught something: yes/no | note
```

## Lessons

What failed, was misunderstood or surprised a run, so the next session doesn't repeat it:

```
<date> | <task slug or skill> | <what went wrong or was misunderstood> → <what to do instead>
```
