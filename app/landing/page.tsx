import type { Metadata } from "next";
import Image from "next/image";
import styles from "../landing.module.css";
import {
  LandingTracker,
  TrackedAboutLink,
  TrackedPrototypeCard,
  type Prototype,
} from "./landing-client";

export const metadata: Metadata = {
  title: "Always Hungry Games",
  description: "Prototypes from Always Hungry Games.",
};

const PROTOTYPES: Prototype[] = [
  {
    name: "Playground",
    href: "https://playground.alwayshungrygames.com",
    image: "/landing/playground.png",
    caption: "All things are possible",
    instructions:
      "Lay out map area to create a map that takes spatial arrangements into account. You can combine tiles as well!",
    external: true,
    badge: "Tablet / PC",
  },
  {
    name: "Bari the Architect",
    href: "https://bari.alwayshungrygames.com/",
    image: "/landing/architect.png",
    caption: "Guide your Civilization to the Age of Plenty",
    instructions:
      "Our earliest prototype, capturing the fun and exploration of Infinite Craft-style idea combination to progress!",
    external: true,
  },
  {
    name: "Curator",
    href: "https://ideacollector.alwayshungrygames.com",
    image: "/landing/ideacollector.png",
    caption: "Play, Create, Curate",
    instructions:
      "A themed recreation of Bari emphasizing thoughtfulness, collection, and curation of your idea tiles. Suitable for mobile play!",
    external: true,
  },
];

export default function LandingPage() {
  return (
    <div className={styles.page}>
      <LandingTracker />
      <main className={styles.content}>
        <header className={styles.hero}>
          <Image
            src="/alwayshungrylogo.png"
            alt="Always Hungry Games"
            width={1536}
            height={1024}
            priority
            sizes="(max-width: 1200px) 60vw, 720px"
            className={styles.logo}
          />
        </header>

        <p className={styles.intro}>
          Ozmos to the Cosmos is our project to capture the Essence of building with LEGOs. We&apos;re in the process of making various prototypes to prove
          out our ideas, feel free to try them out!
        </p>

        <section className={styles.prototypes} aria-label="Prototypes">
          {PROTOTYPES.map((p) => (
            <TrackedPrototypeCard key={p.name} prototype={p} />
          ))}
        </section>

        <footer className={styles.footer}>
          <TrackedAboutLink />
        </footer>
      </main>
    </div>
  );
}
