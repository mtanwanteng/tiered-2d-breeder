# Bibliophile — Implementation Progress Log

> Working log of phase completion + project-specific pitfalls.
> Read this before resuming work after a long break or context reset.
> Source plan: `C:\Users\MTanw\.claude\plans\ok-give-me-the-steady-cake.md`
> Spec: `docs/design/bibliophile-spec.md`
> Decisions: `docs/design/bibliophile-decisions.md`

Branch: `bibliophile-2026-04-27` → `origin/bibliophile-2026-04-27`

---

## Phase status

| Phase | Status | Commit | Notes |
|---|---|---|---|
| 0 — Foundations | ✅ done | `4914bd6` | Theme architecture, palette swap, +3 cap dropped, locked to 11 chapters, schema cols added |
| 1 — Visual rebrand | ✅ done | `4914bd6` | Same commit as Phase 0. SVG patterns, Cardo+Inter, bookplate frames, idea tray, strip refit, chapter title bar |
| 2 — Hold-to-commit + bind ceremony | ✅ done | `638bd08`, `79206e0` | Motion primitives, hold-arc, bind state machine. `79206e0` extracted `attachDragToSpawn` for inventory + cube tiles |
| 3 — Audio | 🟡 parked | `a59d81d` | Web Audio bus + 10 procedural cues built and wired. **Disabled** (`audio.disabled = true` default). Re-enable: `audio.setDisabled(false)`. Synths sounded irritating in playtest; replace with sourced samples or refine before lighting. |
| 4 — Library + Vault + Retirement | ✅ done | `2908d47` | DB helpers, 3 API routes, Bookplate component, /library + /vault pages, retirement ceremony with hold-to-commit + ink-point dispersal |
| 5 — Onboarding + run end | ✅ done (minimum) | `c46b573` | Title-screen front-cover overlay; run-end wax seal + cathedral bell + haptic. Full 5-frame guided onboarding deferred to Phase 8. |
| 6 — AI-thinking copy | ✅ done | `46cbd76` | Crossfade primitive, phase machine (start/longer/long/veryLong/failed/resolved), Bari pose CSS, hover-flicker fix on tray. Default thresholds: 0/8/16/24s. |
| 7 — Accessibility | ⛔ pending | — | Reduced motion fallbacks, tap-to-commit alternative, high-contrast variant, font-size floor, settings page. Schema migration 0005 needed (user settings cols). |
| 8 — Polish | ⛔ pending | — | Long-press tile narrative card, page-turn on all transitions, failed-combine shake, painted Bari art (Imagen?), naming sweep (PostHog `app` super-property), select-five disposition, full 5-frame onboarding. |

---

## Project-specific pitfalls (already paid for)

### Edit tool + CRLF line endings
`src/main.ts` (and the rest of the repo) has Windows CRLF endings. Multi-line
`Edit` `old_string`s **often fail** because the harness's swap-form heuristics
don't always normalize `\r\n` vs `\n`. **Use smaller, contiguous edits** —
single-line or 2-3 line spans match reliably; 8+ line spans regularly miss.

### Next.js dev cache
`npm run build` occasionally produces a phantom
`<Html> should not be imported outside of pages/_document` error on `/404`
prerender. **Fix: `rm -rf .next` before build.** Not a code issue.

### TypeScript strict flags
`noUnusedLocals`, `noUnusedParameters`, `erasableSyntaxOnly`, `noUncheckedSideEffectImports`.
Unused vars must be `_`-prefixed. Don't import dead helpers ahead of time.

### Drizzle migration drift
`era_idea_tile` and `bari_generated_map` were added to `src/db/schema.ts`
without committing migrations. Migration `0004_dear_ultragirl.sql` is rewritten
to be **ALTER-only** with `IF NOT EXISTS` guards so it works on DBs that
already have the tables (likely the case for any dev DB that used
`drizzle-kit push`). When generating new migrations, prefer ALTER-only +
`IF NOT EXISTS` for existing tables.

### Audio kill-switch
`src/audio/index.ts` exposes a singleton `audio` with a `disabled` flag
defaulting to `true`. Every cue method early-returns when disabled. To
re-enable everything in one line: `audio.setDisabled(false)`. Cue call
sites in `main.ts` (cello on bind, clasp on commit, ink-bloom on combine,
desk-tap on drop, paper rustle on era summary, brush canvas during wipe,
singing bowl on objectives complete, cathedral bell at run end) stay wired.

### Direction-aware drag pattern
`attachDragToSpawn(targetEl, getData, opts)` in `main.ts` is the shared
drag-from-source-tile-to-workspace primitive. Used by inventory bookplates
and bound chapter cubes. Mouse: drag immediately. Touch: only commits to a
drag when motion is **vertically dominant past 10px**; horizontal motion
releases to the browser's native scroll. **Don't hand-roll a separate
drag handler for new tile-source surfaces** — extend or reuse this.

### `position: fixed` overlays + transform
The `#bari` element is `position: fixed` lower-left. Pose classes
(`bari--leaning` etc.) apply `transform` on the `#bari` parent. Children
(`#bari-char`, `#bari-tool`) have their own keyframe animations
(`bari-idle` bobbing, `tool-swing` rotation) that use transforms too —
**parent-only pose transforms layer cleanly** with child keyframe transforms.
Don't put `transform` on the children for pose changes — the keyframe
animation will override the static value on the next frame.

### Tile hover anti-pattern
`.palette-item:hover { transform: translateY(-2px) }` causes a vibration
loop on the trailing tile: lift moves bounding box off cursor → hover
ends → drops back → cursor over again → repeat. **Use box-shadow or
outline for visual lift** instead of moving the bounding box.

### `getBoundingClientRect` for drop visuals
`spawnInkBleedRing(item)` measures the tile's actual rendered bounds via
`getBoundingClientRect` and sizes the halo to match exactly. **Don't
hardcode tile dimensions** — they change with theme overrides.

### LF / CRLF git warnings
Git emits warnings like "LF will be replaced by CRLF" on commit. Harmless;
the working tree is CRLF and committed objects normalize to LF.

---

## Open decisions (still unresolved)

From `docs/design/bibliophile-decisions.md`:

- **D5 — Product naming**: using "Idea Collector" for metadata/page titles,
  but PostHog `app: 'architect'` super-property unchanged. Phase 8 sweeps
  this when marketing finalizes the name.
- **D9 — Select-five mode disposition**: Phase 8 reskin only; mechanics
  untouched. Out-of-scope to retire it during the rebrand.
- **D14 — Audio layer**: Web Audio API for P1/P2, HTMLAudio for P3 ambient
  (already built, see Phase 3 status).

---

## What's next (Phase 7)

**Goal:** Reduced-motion mode, tap-to-commit alternative, high-contrast variant, font-size floor.

**Files to create / edit (per plan):**
- Edit every `src/motion/*.ts` primitive — the basic `prefers-reduced-motion`
  fallbacks are already there. **Verify they actually trigger** in a
  browser DevTools "emulate reduced motion" check. The hold-to-commit's
  hold-arc still uses 2.5s linear (it's a clock; the spec says don't shorten).
- Edit `src/main.ts` hold-to-commit — branch to tap-to-commit when a new
  user setting is true. Tap once on slot → tap again within 4s commits.
- New: `themes/bibliophile/tokens-high-contrast.css` —
  `[data-theme="bibliophile"][data-contrast="high"]` swaps vellum/ink-black,
  +50% border weights, removes marble pattern.
- New: settings page or modal — toggles reduced motion, tap-to-commit,
  high contrast, room tone.
- Migration 0005 — adds `seen_first_retirement_speech`,
  `prefers_reduced_motion`, `prefers_tap_to_commit`, `room_tone_enabled`
  to `user`. ALTER-only with defaults.
- Edit `src/style.css` — enforce `body { font-size: 14px }` and label
  floor at 11px.

---

## What's next (Phase 8)

**Polish + ship-readiness pass.** From plan:

- Long-press tile narrative card (slides in from below, reuses `Bookplate.tsx`)
- `failed-combine-shake` motion primitive + wire on combine reject
- Page-turn primitive triggers on era→era and era→library transitions
  (currently only used inside the bind→summary transition)
- Painted Bari art via Imagen (`/lib/server/vertex.ts → callGeminiImage`):
  - prompt: "watercolor manuscript illustration, small apprentice mason,
    cross-legged, hammer on knee, sepia + vellum palette, 4 poses: idle,
    nod, wonder, patient"
  - generate, save to `public/themes/bibliophile/bari/{idle,nod,wonder,patient}.png`,
    swap CSS placeholder
- Title-screen art: same Imagen approach for the front-cover library scene
- Naming sweep:
  - PostHog `app: 'architect'` rename (single server-side update across
    `app/api/*/route.ts`)
  - OG metadata in `app/layout.tsx`
  - README rewrite
- Select-five mode reskin (bibliophile tokens; mechanics untouched)
- Full 5-frame guided onboarding (Bari + Fire+Wood + "Try." + scratch-in
  narrative) — depends on Bari painted art being in place
- Run-end ceremony precise timing (1.6s title scratch-in, 800ms stats fade,
  1.5s library link reveal)
- Remove the legacy how-to-play modal if onboarding subsumes it
- `MAX_DISCOVERED_SLOTS` is already gone — verify no resurrected reference

---

## How to verify a phase end-to-end

No automated tests in the repo. Verification is manual:

1. `npm run dev` → game URL
2. Hard-reload (`Ctrl+Shift+R`) after pulling — bibliophile CSS bundles
   tend to cache aggressively
3. Clear localStorage to test first-run flows (`localStorage.clear()` in
   DevTools console)
4. For long-running combines (Phase 6), throttle network in DevTools to
   "Slow 3G" so the AI-thinking thresholds (8/16/24s) actually fire
5. Library / Vault verification: bind enough tiles to fill 24 slots
   (debug console can fast-forward eras), then trigger retirement on a 25th

---

*Last updated after Phase 6 commit `46cbd76`. Update this file at the
end of each phase commit.*
