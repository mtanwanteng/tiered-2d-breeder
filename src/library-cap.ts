// Shared library-cap constants. The Next.js library page (app/library/page.tsx)
// and the Vite-bundled game client (src/main.ts) both import these so the
// retirement-overlay gate and the visible-slot count never drift apart.
//
// LIBRARY_CAP — the real ceiling on non-retired bound tiles (spec §3.5).
// LIBRARY_DEMO_ACTIVE_SLOTS — temporary demo gate. While set below
// LIBRARY_CAP, the library page renders the remaining slots as locked AND
// the retirement-overlay triggers at this lower count instead of the real
// cap. Flip back to LIBRARY_CAP to restore the full shelf.
export const LIBRARY_CAP = 24;
export const LIBRARY_DEMO_ACTIVE_SLOTS = 3;
