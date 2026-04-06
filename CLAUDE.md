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
