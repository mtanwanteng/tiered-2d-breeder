import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import styles from "../prototypes.module.css";

export const metadata: Metadata = {
  title: "Prototypes – Always Hungry Games",
  description:
    "Our experiments in finding where AI-generated content can power open-ended, tactile play. What we built, why, and what we learned.",
};

interface PrototypeEntry {
  name: string;
  href: string;
  caption: string;
  /** Path under /public to a self-hosted video. Leave unset until a recording is ready. */
  video?: string;
  why: string;
  hypothesis: string;
  learnings: string | null;
}

const ENTRIES: PrototypeEntry[] = [
  {
    name: "Bari the Architect",
    href: "https://bari.alwayshungrygames.com/",
    caption: "Guide your Civilization to the Age of Plenty",
    why: "We wanted to test whether Infinite Craft-style combination — drag two concepts together, AI names the result — could sustain a full progression loop. Is 'combine things' enough of a verb to make a game?",
    hypothesis:
      "Discovery would be intrinsically motivating. The two sides of correctly guessing and being surprised by AI-generated results would be the core reward. Civilization-progression gates would give structure without killing freeform exploration.",
    learnings:
      "The combination verb is genuinely compelling and understandable after a first completion — players want to know what happens when they put two things together. But without friction, the output space is arbitrary to highly goal-oriented players.",
  },
  {
    name: "Curator",
    href: "https://ideacollector.alwayshungrygames.com",
    caption: "Play, Create, Curate",
    why: "Bari the Achitect's open-ended AI space felt arbitrary without framing. We wanted to test whether a strong thematic lens — a book collector's library — and deliberate curation mechanics could make each combination feel intentional rather than random. Additionally we wanted to support mobile players and improve FTUE to reduce feedback noise",
    hypothesis:
      "Slowing down the pace and focusing on a collector's sensibility would make each discovery feel earned and mnanual curation would increase the connection and authorship between the player and the ideas they hand selected.",
    learnings:
      "A UI/UX overhaul to reinforce the theme and add mobile support didn't move the needle on player enjoyment or understanding of the core loop — players were already finding the fun. The original mechanics hold up. Players also did not respond to the curation mechanic strongly, further testing required. Personally, we also found that the specific theming constraint took away from the feel of the infinite possibility space of the game",
  },
  {
    name: "Playground",
    href: "https://playground.alwayshungrygames.com",
    caption: "All things are possible!",
    why: "What if the tile's position mattered? To reach the playful feeling of LEGO, we suspected the combination mechanic needed a second axis — not just 'what do these make?' but 'where does this go?'.",
    hypothesis:
      "Physical placement would create the space to imagine personal narratives and make the board feel like something you built, not just a list of discoveries.",
    learnings:
      "Spatial arrangement genuinely changes the feeling of authorship, and intentional players strongly connect to the feeling of creation. What remains is to recreate a creative loop that sustains retention like LEGO and Minecraft, as well as direction for goal oriented players",
  },
];

export default function PrototypesPage() {
  return (
    <div className={styles.page}>
      <Link href="/landing" className={styles.backLink}>
        ← back to home
      </Link>

      <main className={styles.content}>
        <header className={styles.hero}>
          <Image
            src="/alwayshungrylogo.png"
            alt="Always Hungry Games"
            width={1536}
            height={1024}
            priority
            sizes="(max-width: 720px) 90vw, 560px"
            className={styles.logo}
          />
        </header>

        <p className={styles.intro}>
          How do we recreate the feeling of building with LEGOs - creative,
          tactile, imaginative - and add something only possible with AI? Here 
          are our experiments in finding where AI-generated content can power that kind of play.
        </p>

        <section className={styles.entries} aria-label="Prototype research">
          {ENTRIES.map((entry) => (
            <article key={entry.name} className={styles.entry}>
              <div className={styles.videoWrap}>
                {entry.video ? (
                  <video
                    className={styles.video}
                    src={entry.video}
                    autoPlay
                    loop
                    muted
                    playsInline
                  />
                ) : (
                  <div className={styles.videoPlaceholder} aria-hidden="true">
                    video coming soon
                  </div>
                )}
              </div>

              <div className={styles.entryBody}>
                <div className={styles.entryHeader}>
                  <div>
                    <h2 className={styles.entryTitle}>{entry.name}</h2>
                    <p className={styles.entryCaption}>{entry.caption}</p>
                  </div>
                  <a
                    href={entry.href}
                    className={styles.visitLink}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    Play →
                  </a>
                </div>

                <dl className={styles.details}>
                  <div className={styles.detailBlock}>
                    <dt className={styles.detailLabel}>Why it exists</dt>
                    <dd className={styles.detailText}>{entry.why}</dd>
                  </div>
                  <div className={styles.detailBlock}>
                    <dt className={styles.detailLabel}>Hypothesis</dt>
                    <dd className={styles.detailText}>{entry.hypothesis}</dd>
                  </div>
                  <div className={styles.detailBlock}>
                    <dt className={styles.detailLabel}>Learnings</dt>
                    <dd>
                      {entry.learnings ? (
                        <p className={styles.detailText}>{entry.learnings}</p>
                      ) : (
                        <p className={styles.detailTextMuted}>In progress.</p>
                      )}
                    </dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </section>

        <footer className={styles.footer}>
          <Link href="/about" className={styles.footerLink}>
            About
          </Link>
        </footer>
      </main>
    </div>
  );
}
