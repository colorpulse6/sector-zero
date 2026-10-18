import Image from "next/image";
import HudSection from "@/components/HudSection";
import CtaButton from "@/components/CtaButton";
import { withBasePath } from "@/lib/basePath";

const colonyFeatures = [
  {
    name: "Improve Ashfall",
    description:
      "Build power and a Mine, then add housing, a Farm and a Water Purifier. Settlers arrive as world cycles pass when housing is free and the colony is happy.",
  },
  {
    name: "Walk the frontier",
    description:
      "Descend into Ashfall, walk the outpost, and visit the region to survey local sites and undertake expeditions.",
  },
  {
    name: "Meet the locals",
    description:
      "Meet the Overseer and Quartermaster. The Overseer reports colony conditions; a dependable earning, trading and resupply loop is still in development.",
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
            Start with Ashfall. Give one settlement a purpose, improve it,
            and return to see what your work has changed.
          </p>
          <CtaButton href="https://colorpulse6.github.io/sector-zero/" external>
            Play in browser
          </CtaButton>
        </div>
        <p className="art-caption">Colony concept art · Illustrative</p>
      </section>
      <HudSection label="Ashfall · In active development" title="More than a landing zone.">
        <div className="feature-columns">
          {colonyFeatures.map((feature, index) => (
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
              We finish one useful settlement loop before opening the next world:
              arrive, meet people, improve the colony, undertake local work,
              use the rewards, leave and return.
            </p>
            <p>
              Broader logistics, colony crises and a living civilization remain
              long-term ambitions. Features are introduced as their foundations
              become playable; the full frontier is not finished.
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
