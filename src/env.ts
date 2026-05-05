// Single source of truth for "is this a local build?"
//
// Two signals, OR'd together:
//
//   1. NEXT_PUBLIC_VERCEL_ENV unset — Vercel sets this on every deployment
//      (production / preview / development) and also `vercel dev`. Plain
//      `next dev` doesn't set it, so its absence is a strong "this is a
//      local build" signal.
//
//   2. window.location.hostname is localhost / 127.0.0.1 / a .local mDNS
//      name — runtime fallback for the case where a build that was made
//      with VERCEL_ENV in scope (e.g. preview builds pulled down for
//      iteration) is being served locally. Also covers Vercel CLI's
//      `vercel dev`, which sets VERCEL_ENV but is still localhost.
//
// Either one true → local build → debug console / pipeline HUD / debug
// menu item / Test Victory / Reset Player affordances surface.
//
// Distinct from NODE_ENV (build-system signal, used by posthog-provider).
function detectLocalBuild(): boolean {
  if (typeof window !== "undefined") {
    const host = window.location.hostname;
    if (host === "localhost" || host === "127.0.0.1" || host.endsWith(".local")) {
      return true;
    }
  }
  return !process.env.NEXT_PUBLIC_VERCEL_ENV;
}
export const isLocalBuild = detectLocalBuild();
