import Image from "next/image";
import { getAllPosts } from "@/lib/posts";
import { GAME_MODES } from "@/data/modes";
import { withBasePath } from "@/lib/basePath";
import HudSection from "@/components/HudSection";
import ModeCard from "@/components/ModeCard";
import NewsItem from "@/components/NewsItem";
import CtaButton from "@/components/CtaButton";

export default function Home() {
  const recentPosts = getAllPosts().slice(0, 3);

  return (
    <>
      <section className="home-hero" aria-labelledby="hero-title">
        <Image
          src={withBasePath("/images/backgrounds/sector-zero-key-art.webp")}
          alt=""
          fill
          priority
          sizes="100vw"
          className="hero-art"
        />
        <div className="hero-shade" />
        <div className="page-grid hero-content">
          <p className="eyebrow">A persistent frontier, built one place at a time</p>
          <h1 id="hero-title">
            Answer <br />
            the signal.
          </h1>
          <p className="hero-premise">
            Chart a course. Walk the frontier. Build a foothold and face the Hollow.
          </p>
          <CtaButton href="https://colorpulse6.github.io/sector-zero/" external>
            Play in browser
          </CtaButton>
          <a href="#gameplay" className="text-link hero-explore">
            Explore the game <span aria-hidden="true">↓</span>
          </a>
        </div>
        <p className="art-caption">Sector Zero · Illustrative key art</p>
      </section>

      <HudSection
        id="gameplay"
        label="The experience"
        title="Explore. Build. Defend."
        className="modes-section"
      >
        <div className="section-intro">
          <p>
            Travel connects the places you explore. Space combat, turret defense and
            first-person missions put you inside the encounters along the way.
          </p>
          <span className="capture-note">Captured in game</span>
        </div>
        <div className="modes-grid">
          {GAME_MODES.map((mode) => (
            <ModeCard key={mode.id} mode={mode} />
          ))}
        </div>
      </HudSection>

      <section
        className="exploration-section"
        aria-labelledby="exploration-title"
      >
        <div className="page-grid exploration-grid">
          <div className="exploration-copy">
            <p className="eyebrow">Beyond the cockpit</p>
            <h2 id="exploration-title" className="section-title">
              There’s a world
              <br />
              between the battles.
            </h2>
            <p>
              Choose a destination in the Galaxy Atlas, commit to the journey, and
              step into the settlements at the edge of known space.
            </p>
            <p>
              Ashfall is our first reference world: a place to explore, improve and
              return to. Colony development, useful trade and lasting consequences
              are being connected in small, playable steps.
            </p>
            <CtaButton href="/coming-soon/" secondary>
              Explore the colonies
            </CtaButton>
          </div>
          <figure className="exploration-preview">
            <Image
              src={withBasePath("/images/modes/cockpit.png")}
              alt="Gameplay capture of the UEC Vanguard bridge, with mission board, star map, and armory"
              width={470}
              height={805}
              sizes="(max-width: 700px) 80vw, 350px"
            />
            <figcaption>
              UEC Vanguard bridge <span>In-game capture</span>
            </figcaption>
          </figure>
        </div>
      </section>

      <HudSection label="From the Vanguard" title="Latest transmissions.">
        <div className="news-list">
          {recentPosts.map((post) => (
            <NewsItem key={post.slug} post={post} />
          ))}
        </div>
        <CtaButton href="/news/" secondary>
          View all updates
        </CtaButton>
      </HudSection>
      <section className="departure-section">
        <div className="page-grid departure-content">
          <div>
            <p className="eyebrow">The signal is still calling</p>
            <h2>Your next mission awaits.</h2>
          </div>
          <CtaButton href="https://colorpulse6.github.io/sector-zero/" external>
            Play in browser
          </CtaButton>
        </div>
      </section>
    </>
  );
}
