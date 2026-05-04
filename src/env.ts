// Single source of truth for "is this a local build?"
//
// NEXT_PUBLIC_VERCEL_ENV is set by Vercel on every deployment (production,
// preview, and Vercel-managed development branches) and also by `vercel dev`
// locally. It is unset when running plain `next dev` outside Vercel. We use
// its absence as the marker for "local build" — the only environment where
// the debug console, pipeline HUD, model selector, Test Victory, and
// Reset Player affordances are surfaced.
//
// Distinct from NODE_ENV (build-system signal, used by posthog-provider for
// debug mode). VERCEL_ENV is the deployment-stage signal — what we want for
// gating end-user-visible debug UI.
export const isLocalBuild = !process.env.NEXT_PUBLIC_VERCEL_ENV;
