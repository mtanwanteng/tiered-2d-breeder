"use client";

// Client-side interactivity for /landing — three named PostHog events for
// funnel analysis:
//
//   landing_viewed         fires once on mount when PostHog is ready
//   prototype_clicked      fires on each prototype card click
//   landing_about_clicked  fires on the footer About link click
//
// Autocapture continues to fire on top of these (the project uses PostHog's
// 2026-01-30 defaults). Named events are additive — they make funnels
// readable without removing the autocaptured raw clicks. PostHog's outbound-
// link handling flushes the queue before navigation, so events captured on
// external link click are reliably delivered.
//
// CROSS-DOMAIN IDENTITY (?ph_distinct_id=…)
// Each prototype subdomain (playground/bari/ideacollector) is its own
// PostHog project. To join a /landing visitor's events with the events
// they generate inside the prototype, we append the visitor's PostHog
// distinct_id to the outbound URL once PostHog initialises. The receiving
// app reads the param on mount and calls posthog.identify(id) to alias
// its own anonymous distinct_id onto the same person record.
//
// Receiver-side snippet (each prototype app needs this on its entry page):
//
//   const id = new URL(location.href).searchParams.get("ph_distinct_id");
//   if (id) posthog.identify(id);
//
// The href is rewritten via state once PostHog is ready, so middle-click
// and cmd-click paths also carry the param — onClick isn't required for
// propagation. Clicks before PostHog is ready fall through with a bare
// URL (acceptable degradation).

import { useEffect, useRef, useState } from "react";
import type { KeyboardEvent as ReactKeyboardEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import posthog from "posthog-js";
import styles from "../landing.module.css";

/** Append PostHog's distinct_id to a URL as `ph_distinct_id`. Existing
 *  query params are preserved. Returns the original URL if posthog hasn't
 *  initialised yet (no id available) or if the URL is malformed. */
function withDistinctId(href: string): string {
  if (typeof window === "undefined") return href;
  try {
    const id = posthog.get_distinct_id();
    if (!id) return href;
    const url = new URL(href);
    url.searchParams.set("ph_distinct_id", id);
    return url.toString();
  } catch {
    return href;
  }
}

export interface Prototype {
  name: string;
  href: string;
  /** Optional screenshot path under /public. When unset, the card renders a
   *  styled placeholder so the page works before final art lands. */
  image?: string;
  caption: string;
  /** Longer explanatory blurb rendered below the caption — what the
   *  prototype is and what we're trying to learn from it. */
  instructions?: string;
  external?: boolean;
  /** Optional platform / compatibility hint shown as a pill on the image. */
  badge?: string;
}

/** Fires `landing_viewed` once on mount. Renders nothing. The ref guard
 *  prevents a duplicate event if React re-mounts the component (e.g. during
 *  Strict Mode double-invocation in dev). */
export function LandingTracker() {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    posthog.capture("landing_viewed");
  }, []);
  return null;
}

/** Prototype card with a click handler that fires `prototype_clicked`.
 *  Markup matches the prior server-rendered PrototypeCard exactly so visual
 *  output is unchanged. */
export function TrackedPrototypeCard({ prototype }: { prototype: Prototype }) {
  const { name, href, image, caption, instructions, external, badge } = prototype;
  const isPlaceholder = href === "#";

  // Rewrite the href to include the visitor's PostHog distinct_id once the
  // SDK has initialised. Initial render uses the bare href so SSR output
  // matches the client's first paint (no hydration mismatch); useEffect
  // upgrades it after mount.
  const [navHref, setNavHref] = useState(href);
  useEffect(() => {
    if (isPlaceholder) return;
    setNavHref(withDistinctId(href));
  }, [href, isPlaceholder]);

  // Just-in-time refresh on activation. The state-managed navHref above
  // catches the common case (PostHog initialised before the user clicks),
  // but for a logged-in player who clicks within the brief window between
  // page load and AuthProvider's posthog.identify(userId) call, the
  // distinct_id may be PostHog's auto-UUID instead of their stable userId.
  // Refreshing the anchor's href synchronously on pointerdown / Enter
  // captures the freshest distinct_id at the moment of navigation —
  // covers left, middle, cmd-click, right-click-open-in-new-tab, and
  // keyboard activation alike.
  const linkRef = useRef<HTMLAnchorElement>(null);
  const refreshHref = () => {
    if (isPlaceholder || !linkRef.current) return;
    linkRef.current.href = withDistinctId(href);
  };
  const handleKeyDown = (e: ReactKeyboardEvent<HTMLAnchorElement>) => {
    if (e.key === "Enter" || e.key === " ") refreshHref();
  };

  const handleClick = () => {
    if (isPlaceholder) return;
    posthog.capture("prototype_clicked", {
      prototype: name,
      url: href,
      has_badge: Boolean(badge),
      has_image: Boolean(image),
    });
  };

  const inner = (
    <>
      <div className={styles.cardImageWrap}>
        {image ? (
          <Image
            src={image}
            alt={name}
            fill
            sizes="(max-width: 720px) 100vw, 33vw"
            className={styles.cardImage}
          />
        ) : (
          <div className={styles.cardPlaceholder} aria-hidden="true">
            <span className={styles.cardPlaceholderText}>{name}</span>
          </div>
        )}
        {badge && (
          <span className={styles.cardBadge} aria-label={`${badge} optimized`}>
            {badge}
          </span>
        )}
      </div>
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>{name}</h2>
        <p className={styles.cardCaption}>{caption}</p>
        {instructions && (
          <p className={styles.cardInstructions}>{instructions}</p>
        )}
      </div>
    </>
  );

  if (isPlaceholder) {
    return (
      <div className={`${styles.card} ${styles.cardDisabled}`} aria-disabled="true">
        {inner}
      </div>
    );
  }

  return (
    <a
      ref={linkRef}
      className={styles.card}
      href={navHref}
      onPointerDown={refreshHref}
      onKeyDown={handleKeyDown}
      onClick={handleClick}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {inner}
    </a>
  );
}

/** Footer About link with a click handler that fires `landing_about_clicked`. */
export function TrackedAboutLink() {
  const handleClick = () => {
    posthog.capture("landing_about_clicked");
  };
  return (
    <Link href="/about" className={styles.footerLink} onClick={handleClick}>
      About
    </Link>
  );
}
