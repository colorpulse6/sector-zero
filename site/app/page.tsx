import Image from "next/image";
import { getAllPosts } from "@/lib/posts";
import { GAME_MODES } from "@/data/modes";
import HudSection from "@/components/HudSection";
import ModeCard from "@/components/ModeCard";
import NewsItem from "@/components/NewsItem";
import CtaButton from "@/components/CtaButton";

export default function Home() {
  const recentPosts = getAllPosts().slice(0, 3);

  return (
    <>
      {/* Hero Section */}
      <section className="relative text-center py-24 px-6 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/backgrounds/hero-bg.png"
            alt=""
            fill
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-deep/30 via-transparent to-deep" />
        </div>
        <div className="relative z-10">
          <p className="hud-label mb-4">
            UEC VANGUARD // MISSION BRIEFING
          </p>
          <h1 className="font-mono text-4xl md:text-5xl font-bold tracking-[0.3em] text-cyan-accent mb-3">
            SECTOR ZERO
          </h1>
          <p className="font-mono text-sm text-text-muted mb-8 tracking-wider">
            8 Sectors. 6 Modes. One Hivemind.
          </p>
          <CtaButton
            href="https://colorpulse6.github.io/knicks-knacks/sector-zero/"
            external
          >
            PLAY NOW
          </CtaButton>
        </div>
      </section>

      {/* Mode Cards */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src="/images/backgrounds/section-bg.png"
            alt=""
            fill
            className="object-cover opacity-40"
          />
        </div>
        <div className="relative z-10">
          <HudSection label="GAMEPLAY MODES">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl">
              {GAME_MODES.map((mode) => (
                <ModeCard key={mode.id} mode={mode} />
              ))}
            </div>
          </HudSection>
        </div>
      </section>

      {/* Latest Transmissions */}
      <HudSection label="LATEST TRANSMISSIONS" className="border-t border-border-hud">
        <div className="space-y-6 max-w-3xl mb-8">
          {recentPosts.map((post) => (
            <NewsItem key={post.slug} post={post} />
          ))}
        </div>
        <CtaButton href="/news">VIEW ALL UPDATES</CtaButton>
      </HudSection>
    </>
  );
}
