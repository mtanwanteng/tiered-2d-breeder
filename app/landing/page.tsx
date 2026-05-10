import type { Metadata } from "next";
import Image from "next/image";
import styles from "../landing.module.css";

export const metadata: Metadata = {
  title: "Always Hungry Games",
  description: "Prototypes from Always Hungry Games.",
};

interface Prototype {
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
            <PrototypeCard key={p.name} prototype={p} />
          ))}
        </section>
      </main>
    </div>
  );
}

function PrototypeCard({ prototype }: { prototype: Prototype }) {
  const { name, href, image, caption, instructions, external, badge } = prototype;
  const isPlaceholder = href === "#";

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
      className={styles.card}
      href={href}
      {...(external
        ? { target: "_blank", rel: "noopener noreferrer" }
        : {})}
    >
      {inner}
    </a>
  );
}
