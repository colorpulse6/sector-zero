import type { DialogTrigger, PlanetId } from "./types";

// ─── Crew shorthand ─────────────────────────────────────────────────

const V = { speaker: "VOSS", portraitKey: "PORTRAIT_VOSS", color: "#44ccff" };
const R = { speaker: "REYES", portraitKey: "PORTRAIT_REYES", color: "#ff8844" };
const K = { speaker: "DOC KAEL", portraitKey: "PORTRAIT_KAEL", color: "#44ff88" };

function line(
  crew: { speaker: string; portraitKey: string; color: string },
  text: string,
  duration: number = 240
) {
  return { speaker: crew.speaker, portraitKey: crew.portraitKey, text, duration, color: crew.color };
}

// ─── Planet Dialog ──────────────────────────────────────────────────

export function getPlanetDialogTriggers(planetId: PlanetId): DialogTrigger[] {
  switch (planetId) {
    // ── Verdania ────────────────────────────────────────────────────
    case "verdania":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(K, "Bio-scanners are off the charts. This jungle... it's alive in ways I've never seen."),
            line(V, "Stay focused. Grab those bio-samples and watch for hostiles."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 3 },
          lines: [
            line(K, "Commander... the plant DNA. It's not alien. It's human. The colonists were absorbed into the canopy."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 6 },
          lines: [
            line(R, "The vines are moving on their own. They're reaching for us."),
            line(K, "The jungle didn't consume the settlement. The settlement BECAME the jungle."),
          ],
          once: true,
        },
      ];

    // ── Glaciem ─────────────────────────────────────────────────────
    case "glaciem":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(V, "Cryogenic signatures below the surface. Hundreds of them."),
            line(K, "They tried to hibernate until rescue came. The ice preserved their bodies perfectly."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 4 },
          lines: [
            line(K, "The cryo-pods are still powered. But the vital signs... something else is alive inside them now."),
            line(R, "Don't say that. Don't say things like that."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 7 },
          lines: [
            line(V, "Whatever woke up in those pods, it's controlling the ice. Stay alive."),
          ],
          once: true,
        },
      ];

    // ── Pyraxis ─────────────────────────────────────────────────────
    case "pyraxis":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(K, "Mining tunnels reaching 40 kilometers deep. The colonists were looking for something."),
            line(V, "Keep that survey craft safe. We need whatever data it can pull from those tunnels."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 3 },
          lines: [
            line(K, "They found it. At the bottom of the deepest shaft — organic tissue fused with the rock. The Hollow's first tendril."),
            line(R, "So Pyraxis was where it started? First contact?"),
            line(K, "First CONVERSION. The miners were the first to be taken."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 6 },
          lines: [
            line(R, "The survey craft is taking heavy fire! Intercepting!"),
          ],
          once: true,
        },
      ];

    // ── Ossuary ─────────────────────────────────────────────────────
    case "ossuary":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(V, "These aren't alien ruins. The architecture is human. Modified, but human."),
            line(K, "A temple complex. The colonists built this."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 3 },
          lines: [
            line(K, "The inscriptions... they worshipped the Hollow. Willingly. They believed it would save them."),
            line(R, "Save them from what?"),
            line(K, "From death. From forgetting. From being alone."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 6 },
          lines: [
            line(V, "Hold the excavation site. Whatever data is in those walls, we need it."),
          ],
          once: true,
        },
      ];

    // ── Abyssia ─────────────────────────────────────────────────────
    case "abyssia":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(K, "An underwater city. Fully pressurized. The most technologically advanced colony we've found."),
            line(V, "They resisted the longest. Salvage whatever you can from the wreckage."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 3 },
          lines: [
            line(K, "The Hollow learned to communicate through water pressure variations. Essentially... it sang to them."),
            line(R, "Sang?"),
            line(K, "A frequency that bypassed every defense. They opened the gates themselves in the end."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 6 },
          lines: [
            line(R, "This plating... it's the strongest alloy I've ever seen. We can use this."),
          ],
          once: true,
        },
      ];

    // ── Ashfall ─────────────────────────────────────────────────────
    case "ashfall":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(V, "Distress signal, still broadcasting. 400 years and counting."),
            line(K, "The last colony to fall. They knew what was coming."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 4 },
          lines: [
            line(K, "I found their final log entry. Just one line."),
            line(K, "\"It's not destroying us. It's REMEMBERING us.\""),
            line(R, "...what does that mean?"),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 7 },
          lines: [
            line(V, "The storm is getting worse. Hold your position. We're almost through."),
          ],
          once: true,
        },
      ];

    // ── Prismara ────────────────────────────────────────────────────
    case "prismara":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(K, "These caves aren't natural. The crystal formations... they're structured. Organized."),
            line(V, "Get that resonance probe to the core. Carefully."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 3 },
          lines: [
            line(K, "Commander. The crystals are solidified neural pathways. This entire cave is a brain."),
            line(R, "A brain?!"),
            line(K, "The colonists didn't die here. They BECAME the cave. Every crystal is a preserved thought."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 6 },
          lines: [
            line(K, "The probe is reading thought patterns. Memories. They're still in there, dreaming."),
          ],
          once: true,
        },
      ];

    // ── Luminos ─────────────────────────────────────────────────────
    case "luminos":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(K, "Power readings everywhere. This city is still running. Lights, transit, comms — all active."),
            line(V, "But no life signs. Grab those data cores before the grid figures out we're here."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 3 },
          lines: [
            line(K, "The colonists didn't just build this city. They wired themselves INTO it. Neural interfaces in every wall."),
            line(R, "So when the Hollow came..."),
            line(K, "The city absorbed them. Every citizen became a processing node. They're still running in the circuitry."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 6 },
          lines: [
            line(R, "The neon signs — they're flickering in patterns. Like they're trying to talk to us."),
            line(K, "Not trying. They ARE talking. A million voices compressed into light. Don't look too long."),
          ],
          once: true,
        },
      ];

    // ── Bastion ─────────────────────────────────────────────────────
    case "bastion":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(V, "Fortress colony. Gun emplacements, blast doors, kill zones. These people were prepared."),
            line(R, "Didn't help them, did it?"),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 3 },
          lines: [
            line(K, "The battle logs... they fought for months. Every wall, every corridor. But the casualties don't match the enemy count."),
            line(V, "Meaning?"),
            line(K, "They turned on each other. The Hollow didn't breach the walls. It got inside their heads."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 6 },
          lines: [
            line(R, "The reactor's holding, but they're throwing everything at it. Heavy fire incoming!"),
            line(V, "The strongest fortress in the sector, and it fell from the inside out. Hold the line."),
          ],
          once: true,
        },
      ];

    // ── Genesis ─────────────────────────────────────────────────────
    case "genesis":
      return [
        {
          event: { type: "level_start" },
          lines: [
            line(V, "A garden. In the middle of all this destruction... a garden."),
            line(K, "Every living thing here grew from Hollow biomass. The flowers, the trees, all of it."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 3 },
          lines: [
            line(K, "The colonists' memories are encoded in every leaf. Their laughter. Their fears. Everything they were."),
            line(R, "So this is what the Hollow calls 'saving' people?"),
            line(K, "Preserving them. Forever. In a garden that will never die."),
          ],
          once: true,
        },
        {
          event: { type: "wave_start", wave: 6 },
          lines: [
            line(V, "Hold the line. The Hollow remnants are converging. This is our last stand."),
            line(K, "Every planet, every colony... this was always the end goal. A garden of memory."),
          ],
          once: true,
        },
      ];
  }
}
