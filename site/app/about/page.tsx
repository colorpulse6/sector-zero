import { GAME_MODES } from "@/data/modes";
import HudSection from "@/components/HudSection";
import ModeCard from "@/components/ModeCard";

export default function AboutPage() {
  return (
    <>
      {/* The Story */}
      <HudSection label="THE STORY">
        <div className="max-w-3xl">
          <h2 className="font-mono text-xl tracking-[0.2em] text-cyan-accent mb-6">
            THE KEPLER EXODUS
          </h2>
          <div className="space-y-4 text-sm text-text-primary leading-relaxed">
            <p>
              In 2535, forty-seven colony ships launched toward the edge of known
              space. The Kepler Exodus  - humanity&apos;s boldest leap. Two million
              souls chasing a new home. They never arrived. The region was sealed
              off and renamed: Sector Zero. For 312 years, no one went in.
            </p>
            <p>
              Then a signal started broadcasting from inside.
            </p>
            <p>
              Commander Voss, Lieutenant Reyes, and Doc Kael are the crew of the
              UEC Vanguard  - sent to silence it. What they find is far worse than
              aliens: the Hollow are evolved humans, descendants of the Kepler
              colonists, merged into a collective consciousness over centuries of
              isolation.
            </p>
            <p className="text-text-muted italic">
              Two endings await. Destroy the Hollow Mind and restart the cycle.
              Or merge with it  - breaking the cycle, but losing your humanity.
            </p>
          </div>
        </div>
      </HudSection>

      {/* Gameplay Modes */}
      <HudSection label="GAMEPLAY MODES" className="border-t border-border-hud">
        <h2 className="font-mono text-xl tracking-[0.2em] text-cyan-accent mb-6">
          6 WAYS TO FIGHT
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-4xl">
          {GAME_MODES.map((mode) => (
            <ModeCard key={mode.id} mode={mode} />
          ))}
        </div>
      </HudSection>

      {/* Tech Stack */}
      <HudSection label="BUILT WITH" className="border-t border-border-hud">
        <div className="max-w-3xl">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[
              { name: "HTML5 Canvas", detail: "2D rendering at 60fps" },
              { name: "Next.js 15", detail: "Static export for GitHub Pages" },
              { name: "TypeScript", detail: "30+ interfaces, strict mode" },
              { name: "React 19", detail: "UI layer and state management" },
            ].map((tech) => (
              <div key={tech.name} className="border border-border-hud p-3">
                <p className="font-mono text-xs text-cyan-accent">{tech.name}</p>
                <p className="text-[0.65rem] text-text-muted mt-1">{tech.detail}</p>
              </div>
            ))}
          </div>
        </div>
      </HudSection>
    </>
  );
}
