import Image from "next/image";
import { GAME_MODES } from "@/data/modes";
import { withBasePath } from "@/lib/basePath";
import HudSection from "@/components/HudSection";
import ModeCard from "@/components/ModeCard";
import CtaButton from "@/components/CtaButton";

export default function AboutPage() {
  return (
    <>
      <section className="page-hero" aria-labelledby="about-title">
        <Image
          src={withBasePath("/images/backgrounds/sector-zero-key-art.webp")}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-art"
        />
        <div className="hero-shade" />
        <div className="page-grid">
          <p className="eyebrow">The story so far</p>
          <h1 id="about-title">
            Forty-seven ships.
            <br />
            One unanswered signal.
          </h1>
          <p className="page-lead">
            You are the last pilot of Sector Zero. The UEC Vanguard is your way
            in. The truth is waiting on the other side.
          </p>
        </div>
      </section>
      <HudSection label="2535 · The Kepler Exodus" title="They never arrived.">
        <div className="story-layout">
          <div className="reading-copy">
            <p>
              In 2535, forty-seven colony ships launched toward the edge of
              known space. The Kepler Exodus: humanity&apos;s boldest leap. Two
              million souls chasing a new home.
            </p>
            <p>
              The region was sealed off and renamed Sector Zero. For 312 years,
              no one went in. Then a signal started broadcasting from inside.
            </p>
            <p>
              Commander Voss, Lieutenant Reyes, and Doc Kael are the crew of the
              UEC Vanguard, sent to silence it. Join them on a campaign through
              eight hostile sectors, where the fate of the lost colonists is
              only the beginning.
            </p>
            <details className="story-spoilers">
              <summary>Reveal story spoilers</summary>
              <div>
                <p>
                  The Hollow are evolved humans: descendants of the Kepler
                  colonists, merged into a collective consciousness over
                  centuries of isolation.
                </p>
                <p>
                  Two endings await. Destroy the Hollow Mind and restart the
                  cycle. Or merge with it, breaking the cycle, but losing your
                  humanity.
                </p>
              </div>
            </details>
          </div>
          <aside className="mission-facts" aria-label="Campaign at a glance">
            <p className="eyebrow">Mission profile</p>
            <dl>
              <div>
                <dt>Sectors</dt>
                <dd>08</dd>
              </div>
              <div>
                <dt>Campaign missions</dt>
                <dd>40</dd>
              </div>
              <div>
                <dt>Ways to fight</dt>
                <dd>06</dd>
              </div>
            </dl>
            <CtaButton
              href="https://colorpulse6.github.io/sector-zero/"
              external
            >
              Begin your mission
            </CtaButton>
          </aside>
        </div>
      </HudSection>
      <HudSection
        label="The gameplay"
        title="Adapt to every encounter."
        className="bordered-section"
      >
        <div className="modes-grid">
          {GAME_MODES.map((mode) => (
            <ModeCard key={mode.id} mode={mode} />
          ))}
        </div>
      </HudSection>
      <HudSection
        label="An independent game"
        title="Made for the browser."
        className="bordered-section"
      >
        <div className="reading-copy">
          <p>
            Sector Zero is built by{" "}
            <a
              href="https://nichalasbarnes.com/"
              target="_blank"
              rel="noopener noreferrer"
            >
              Nic Barnes
            </a>
            , using HTML5 Canvas, TypeScript, React, and Next.js.
          </p>
          <p>
            Follow the game’s development, explore the source, or jump straight
            into the pilot’s seat.
          </p>
          <CtaButton
            href="https://github.com/colorpulse6/sector-zero"
            external
            secondary
          >
            Explore the source
          </CtaButton>
        </div>
      </HudSection>
    </>
  );
}
