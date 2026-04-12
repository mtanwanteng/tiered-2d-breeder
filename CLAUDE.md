# CLAUDE.md

Developer notes for Claude Code working in this repo.

---

## Database — Drizzle

**Prefer native Drizzle over raw `sql` template literals.**

Use `sql\`...\`` only when there is no native Drizzle equivalent, or when the native approach involves significant compromises (heavy performance cost, unreadable query composition, etc.). Document why raw SQL was necessary with a comment when you do use it.

Example of the exception: write-once COALESCE on a column update — no native Drizzle equivalent in 0.45.x, so `sql\`COALESCE(${user.anonId}, ${anonId})\`` is acceptable.

---

## Analytics

Tracking spec lives at `docs/analytics-tracking.md`. It is divided into four concerns:

- **Scoreboard display** — data that drives the in-game scoreboard UI (lives in localStorage save system, not PostHog)
- **Game design** — aggregate PostHog analysis for balance, pacing, and engagement
- **Market** — standard business metrics (retention, DAU/MAU, auth conversion)
- **Cost** — AI API usage and cost-per-combination tracking

**When adding a new game mechanic:** if the mechanic creates player behavior worth measuring, add an entry to the `## TODO — Mechanics to instrument` section in `docs/analytics-tracking.md`. Include the proposed event name, where it fires, and what insight it enables (scoreboard display, game design, market, or cost).

---

## Error Logging — Sanitize in Production

**Never expose raw error messages to the player console in production.**

When logging errors that include `err.message` or `String(err)` from network calls or external APIs, gate the detail behind `import.meta.env.PROD`:

```ts
log.error("api", `[TAG] Something failed${!import.meta.env.PROD ? `: ${err.message}` : ""}`);
```

In production the log reads `"[TAG] Something failed"` — no internal URLs, model names, GCP project IDs, or stack traces. Full detail is still available in dev.

**Each error site must have a unique short tag** (e.g. `[CMB]`, `[ERA-CHK]`, `[ERA-CHO]`, `[ERA-TRN]`) so player bug reports can be grepped directly back to the originating line of code.
