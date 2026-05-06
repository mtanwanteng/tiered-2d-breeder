import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../about.module.css";

export const metadata: Metadata = {
  title: "About – Always Hungry Games",
  description:
    "We are iterating through our ideas, looking for where AI innovation actually creates value in games.",
};

export default function AboutPage() {
  return (
    <div className={styles.page}>
      <Link href="/" className={styles.backLink}>← back to home</Link>

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

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>AlwaysHungry.Games</h2>
          <p className={styles.lead}>
            Iterating through ideas, looking for where AI
            innovation actually creates value in games.
          </p>
        </section>
      </main>
    </div>
  );
}
