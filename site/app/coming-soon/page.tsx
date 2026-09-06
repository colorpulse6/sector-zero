import Image from "next/image";
import HudSection from "@/components/HudSection";
import CtaButton from "@/components/CtaButton";
import { withBasePath } from "@/lib/basePath";

const playableFeatures = [
  {
    name: "Make a foothold",
    description:
      "Found colonies, construct buildings, and manage the food, metal, power, and water that keep a settlement running.",
  },
  {
    name: "Walk the frontier",
    description:
      "Descend into settlements and explore their streets and interiors in first person.",
  },
  {
    name: "Meet the locals",
    description:
      "Talk to residents, follow their routines, and visit the quartermaster to buy supplies. Faction standing shapes your welcome.",
  },
];

export default function ComingSoonPage() {
  return (
    <>
      <section className="page-hero colony-hero" aria-labelledby="colony-title">
        <Image
          src={withBasePath("/images/backgrounds/colony-bg.png")}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-art"
        />
        <div className="hero-shade" />
        <div className="page-grid">
          <p className="eyebrow">Life on the frontier</p>
          <h1 id="colony-title">
            A place worth
            <br />
            coming back to.
          </h1>
          <p className="page-lead">
            The Kepler colonists built lives at the edge of known space. Now
            it’s your turn to make a foothold.
          </p>
          <CtaButton href="https://colorpulse6.github.io/sector-zero/" external>
            Play in browser
          </CtaButton>
        </div>
        <p className="art-caption">Colony concept art · Illustrative</p>
      </section>
      <HudSection label="Playable today" title="More than a landing zone.">
        <div className="feature-columns">
          {playableFeatures.map((feature, index) => (
            <div key={feature.name}>
              <span className="feature-number">0{index + 1}</span>
              <h3>{feature.name}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
        <CtaButton href="/news/rpg-exploration/" secondary>
          Read the exploration briefing
        </CtaButton>
      </HudSection>
      <HudSection
        label="On the horizon · Planned features"
        title="The frontier keeps growing."
        className="bordered-section"
      >
        <div className="future-grid">
          <figure>
            <Image
              src={withBasePath("/images/colony/outpost.png")}
              alt="Concept illustration of an outpost on an alien planet"
              width={1536}
              height={1024}
              sizes="(max-width: 700px) 90vw, 560px"
            />
            <figcaption>
              Outpost concept art · Not a gameplay capture
            </figcaption>
          </figure>
          <div className="reading-copy">
            <p className="future-note">
              In development — these ambitions are not all playable yet.
            </p>
            <h3>A living network of colonies.</h3>
            <p>
              Future colony development is planned to deepen frontier threats,
              raids, defense, and the supply networks connecting settlements.
            </p>
            <p>
              Broader logistics and colony crises remain a work in progress.
              Follow the updates for changes as they become playable.
            </p>
            <CtaButton href="/news/" secondary>
              Follow development
            </CtaButton>
          </div>
        </div>
      </HudSection>
    </>
  );
}
