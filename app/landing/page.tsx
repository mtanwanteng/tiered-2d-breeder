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
  external?: boolean;
}

const PROTOTYPES: Prototype[] = [
  {
    name: "Playground",
    href: "https://playground.alwayshungrygames.com",
    image: "/landing/playground.png",
    caption: "All things are possible",
    external: true,
  },
  {
    name: "Bari",
    href: "https://bari.alwayshungrygames.com/",
    image: "/landing/architect.png",
    caption: "Guide your Civilization to the Age of Plenty",
    external: true,
  },
  {
    name: "Curator",
    href: "#",
    caption: "Play, Create, Curate",
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
  const { name, href, image, caption, external } = prototype;
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
      </div>
      <div className={styles.cardBody}>
        <h2 className={styles.cardTitle}>{name}</h2>
        <p className={styles.cardCaption}>{caption}</p>
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
