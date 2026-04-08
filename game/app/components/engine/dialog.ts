import type { DialogLine, DialogState, DialogTrigger, DialogTriggerEvent } from "./types";

// ─── Characters ─────────────────────────────────────────────────────

const CHARACTERS = {
  VOSS: { speaker: "VOSS", portraitKey: "PORTRAIT_VOSS", color: "#44ccff" },
  REYES: { speaker: "REYES", portraitKey: "PORTRAIT_REYES", color: "#ff8844" },
  KAEL: { speaker: "DOC", portraitKey: "PORTRAIT_KAEL", color: "#44ff88" },
  HOLLOW: { speaker: "???", portraitKey: "PORTRAIT_HOLLOW", color: "#aa44ff" },
} as const;

type CharDef = (typeof CHARACTERS)[keyof typeof CHARACTERS];

function line(char: CharDef, text: string, duration: number = 300): DialogLine {
  return { speaker: char.speaker, portraitKey: char.portraitKey, text, duration, color: char.color };
}

function bossLine(bossName: string, text: string, duration: number = 300): DialogLine {
  return { speaker: bossName.toUpperCase(), portraitKey: CHARACTERS.HOLLOW.portraitKey, text, duration, color: "#ff4444" };
}

function trigger(event: DialogTriggerEvent, lines: DialogLine[], once = true): DialogTrigger {
  return { event, lines, once };
}

// ─── Dialog State Machine ───────────────────────────────────────────

export function createDialogState(): DialogState {
  return { queue: [], currentLine: null, timer: 0, fadeIn: 0, fadeOut: 0 };
}

export function updateDialog(dialog: DialogState): DialogState {
  if (!dialog.currentLine && dialog.queue.length === 0) return dialog;

  // Start next line from queue
  if (!dialog.currentLine && dialog.queue.length > 0) {
    const [next, ...rest] = dialog.queue;
    return { queue: rest, currentLine: next, timer: next.duration, fadeIn: 0, fadeOut: 0 };
  }

  // Advance current line
  if (dialog.currentLine) {
    const newTimer = dialog.timer - 1;
    const newFadeIn = Math.min(dialog.fadeIn + 1, 10);

    if (newTimer <= 0) {
      if (dialog.queue.length > 0) {
        const [next, ...rest] = dialog.queue;
        return { queue: rest, currentLine: next, timer: next.duration, fadeIn: 0, fadeOut: 0 };
      }
      return { queue: [], currentLine: null, timer: 0, fadeIn: 0, fadeOut: 0 };
    }

    return { ...dialog, timer: newTimer, fadeIn: newFadeIn, fadeOut: newTimer <= 15 ? newTimer : 0 };
  }

  return dialog;
}

// ─── Trigger Checking ───────────────────────────────────────────────

function matchesEvent(te: DialogTriggerEvent, actual: DialogTriggerEvent): boolean {
  if (te.type !== actual.type) return false;
  if (te.type === "wave_start" && actual.type === "wave_start") return te.wave === actual.wave;
  if (te.type === "wave_clear" && actual.type === "wave_clear") return te.wave === actual.wave;
  if (te.type === "boss_phase" && actual.type === "boss_phase") return te.phase === actual.phase;
  return true;
}

export function checkDialogTriggers(
  triggers: DialogTrigger[],
  event: DialogTriggerEvent,
  dialog: DialogState
): { dialog: DialogState; triggers: DialogTrigger[] } {
  const newLines: DialogLine[] = [];
  let changed = false;

  const updatedTriggers = triggers.map((t) => {
    if (t.once && t.triggered) return t;
    if (!matchesEvent(t.event, event)) return t;
    newLines.push(...t.lines);
    changed = true;
    return t.once ? { ...t, triggered: true } : t;
  });

  if (!changed) return { dialog, triggers };

  return {
    dialog: { ...dialog, queue: [...dialog.queue, ...newLines] },
    triggers: updatedTriggers,
  };
}

// ─── Dialog Scripts ─────────────────────────────────────────────────

const V = CHARACTERS.VOSS;
const R = CHARACTERS.REYES;
const K = CHARACTERS.KAEL;
const H = CHARACTERS.HOLLOW;

// ── World 1: Aurelia Belt — "First Contact" ────────────────────────
// Tone: Action, heroism. Subtle clue: comm frequencies oddly close to human bands.

const dialog_1_1: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "Pilot, you're entering the Aurelia Belt. First contact with unknown hostiles.", 350),
    line(V, "Stay sharp. We don't know what we're dealing with yet."),
  ]),
  trigger({ type: "wave_start", wave: 0 }, [
    line(R, "I see them! Contacts ahead -- small and fast. Let's see what they've got."),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(K, "New contact type. Armed drones -- they'll shoot back!"),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(R, "They keep coming! How many of these things are out here?", 250),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(V, "Last wave. Clean them out and we push deeper."),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "Sector clear. Good work, pilot. That was just the scouts.", 330),
    line(K, "Odd... their comm frequencies are remarkably close to our standard bands.", 330),
    line(V, "Coincidence. Stay focused."),
  ]),
];

const dialog_1_2: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "Debris field ahead. Enemies are using the asteroids as cover."),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(K, "Gunner class spotted! Heavy armor, slower, but those cannons hit hard."),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(R, "They're boxing us in. Watch the flanks!"),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(K, "Careful! Proximity mines detected in the debris!"),
  ]),
  trigger({ type: "level_complete" }, [
    line(R, "Clear! These things fight like they've been trained."),
    line(R, "That formation is straight out of OUR tactics textbook.", 330),
    line(K, "There's a central signal coordinating them. Like a conductor and an orchestra."),
  ]),
];

const dialog_1_3: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "Sensor readings are off the charts ahead. Could be a trap."),
    line(R, "A trap? For us? I'm flattered.", 250),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Bombers! Fast and suicidal -- don't let them get close!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "They're coming from every direction. This was planned!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(V, "Hold the line, pilot. We can't retreat through the debris."),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(R, "Last push! Give 'em everything!"),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "We survived. Barely. Intel was right -- they're adapting to us.", 330),
    line(K, "Adapting... or remembering? Their tactical shifts are oddly predictable.", 330),
  ]),
];

const dialog_1_4: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "Heavy fortifications ahead. This is their defensive line."),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(K, "Stationary turrets detected! They can't move but they hit hard."),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "Turrets AND drones? This is a killzone."),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(K, "Swarm units incoming -- dozens of tiny contacts!"),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(R, "Elite unit! That thing's shielded -- focus fire!"),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "The gauntlet is broken. Their commander should be just ahead."),
    line(K, "Energy readings are spiking. Something massive is waiting for us.", 330),
  ]),
];

const dialog_1_5: DialogTrigger[] = [
  trigger({ type: "boss_intro" }, [
    line(K, "Massive energy signature! Something huge is heading this way!"),
    line(V, "All hands, battle stations. Pilot, this is the sector commander."),
  ]),
  trigger({ type: "level_start" }, [
    bossLine("Rockjaw", "...CRRRUNCH...", 330),
    line(R, "Did that thing just... growl at us through the comms?!", 250),
    line(K, "Its mouth! The armor opens when it attacks. That's our opening!", 330),
  ]),
  trigger({ type: "boss_phase", phase: 2 }, [
    line(K, "It's enraged! The mouth is locked open now -- full assault!"),
    line(R, "It's charging! Watch out for those rams!", 250),
  ]),
  trigger({ type: "boss_defeat" }, [
    line(R, "YES! Down it goes! That was incredible!"),
    line(V, "Aurelia Belt is clear. But this is just the beginning.", 330),
    line(K, "Commander, the signal... it's coming from deeper. The Cryon Nebula.", 330),
  ]),
];

// ── World 2: Cryon Nebula — "Cold Pursuit" ─────────────────────────
// Tone: Mystery, wonder. Clue: wreckage alloys match human composition.

const dialog_2_1: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "The Cryon Nebula. Sensors are unreliable in the cold. Trust your eyes.", 350),
    line(K, "Temperature is dropping fast. The nebula is full of crystallized gas."),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(K, "New enemy type -- shielders! They can absorb more punishment."),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "These things are tougher. Not just scouts anymore."),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(R, "Shielders and gunners together? They're learning to combo."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "Unusual energy patterns. They're not just defending...", 330),
    line(K, "They're building something deeper in the nebula."),
  ]),
];

const dialog_2_2: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "Crystal formations are disrupting targeting. Keep it close range."),
  ]),
  trigger({ type: "wave_start", wave: 0 }, [
    line(R, "Shielders using the crystals as cover. Smart bastards."),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "The crystal structures are reflecting their signal. Like an echo chamber."),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(R, "Mines in the crystals! They're turning the whole cavern into a trap."),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "Good flying. The path is clear."),
    line(H, "...you...come...closer...", 250),
    line(K, "What was THAT signal?! Something... spoke on their frequency!", 330),
  ]),
];

const dialog_2_3: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "Ion storm incoming. We push through or we're trapped."),
    line(R, "Then let's not get trapped.", 330),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Bombers in the storm! Can barely see them coming!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "Wreckage trace elements in this debris... they match human alloys.", 330),
    line(K, "Coincidence. Probably. Keep moving."),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(V, "Halfway through. Keep pushing."),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(R, "I can see the other side! Almost there!"),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "Storm's behind us. Well done."),
    line(K, "That energy source is very close now. Just ahead..."),
  ]),
];

const dialog_2_4: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "This is it -- a cryo-facility. They're not manufacturing here. They're preserving.", 350),
    line(V, "Preserving what?"),
    line(K, "...memories, maybe? The data structures look like neural maps.", 330),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(R, "Turrets and shielders? They REALLY don't want us in here."),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(K, "Elite unit! Advanced combat capabilities -- be careful!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(R, "Those scout designs remind me of... never mind.", 250),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "One more push. Whatever's in there, we end this."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "Commander... the facility was preserving consciousness patterns.", 330),
    line(V, "Consciousness? Whose?"),
    line(K, "I... don't know yet. But something is behind that ice wall.", 330),
  ]),
];

const dialog_2_5: DialogTrigger[] = [
  trigger({ type: "boss_intro" }, [
    line(K, "The ice wall is shattering! Something is coming through!"),
    line(V, "Engage. Don't let it reach the fleet."),
  ]),
  trigger({ type: "level_start" }, [
    line(K, "Its core is exposed -- no armor cycling. Hit it directly!"),
    line(R, "Finally, no tricks. Just a straight fight."),
  ]),
  trigger({ type: "boss_phase", phase: 2 }, [
    line(K, "Phase two! It's sending ice walls -- find the gaps!"),
    line(H, "...cold...so cold...we tried to preserve...everything...", 250),
    line(R, "There's that voice again. Focus on the fight!"),
  ]),
  trigger({ type: "boss_defeat" }, [
    line(R, "Two down! How many more of these things are there?"),
    line(K, "The facility data... they have a weapons forge. The Ignis Rift.", 330),
    line(V, "Then that's where we go next. No rest."),
  ]),
];

// ── World 3: Ignis Rift — "The Forge" ──────────────────────────────
// Tone: Creeping unease. Clue: manufacturing matches human protocols, 98.7% DNA overlap.

const dialog_3_1: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "Hull temperature is rising. The Ignis Rift is thermally active."),
    line(V, "The weapons forge is deep inside. Stay the course."),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Bombers in the volcanic debris! Weaving through lava and enemies!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "More bombers! They love this environment."),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(K, "Turret emplacements embedded in the rock. Standard defensive grid.", 330),
    line(K, "Wait -- standard? Their layout matches UEC fortification patterns.", 330),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "Outer perimeter breached. The forge is ahead."),
  ]),
];

const dialog_3_2: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "The forge gates. Heavy turret installations. This is their frontline."),
  ]),
  trigger({ type: "wave_start", wave: 0 }, [
    line(K, "Three turret clusters ahead! They've dug into the rock."),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(R, "Turrets and gunners together -- they're overlapping fields of fire."),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(K, "Their forge uses OUR manufacturing signatures. How is that possible?", 360),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(R, "Mines in the approach! They're channeling us into kill zones."),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "Gates are down. We're through."),
    line(H, "...you wear the same skin we once wore...", 330),
    line(K, "Commander... did you hear what it said?", 250),
  ]),
];

const dialog_3_3: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "Solar flare activity is destabilizing the entire sector!"),
    line(R, "Bombers love chaos. And there's a LOT of chaos here."),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(K, "Serial numbers on this Hollow wreckage. Partially human-readable.", 330),
    line(V, "Human-readable? Doc, are you sure?"),
    line(K, "Positive. But that's... that shouldn't be possible.", 330),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(R, "Elite unit in the storm! Focus fire, NOW!"),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(K, "Swarm inbound -- fifteen-plus contacts!"),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "Hold steady. This is the worst of it."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "Commander... I ran a genetic analysis on the bioforms.", 330),
    line(K, "98.7% cellular overlap with human DNA.", 360),
    line(V, "...convergent evolution?"),
    line(K, "At this scale? I don't think so.", 330),
  ]),
];

const dialog_3_4: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "The inner forge. They're producing new units faster than we can count."),
    line(K, "Shut down the spawning pods or we'll be overwhelmed."),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(R, "Elites and drones together. This is their best."),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(K, "Mines everywhere -- they're seeding the entire chamber!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(R, "Swarms are pouring from the walls! There's no end!"),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "Final push, pilot. Break the crucible."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "The forge is offline. But the energy... it's all flowing somewhere.", 330),
    line(K, "To the forge master. It's alive, Commander. It's been watching us.", 330),
  ]),
];

const dialog_3_5: DialogTrigger[] = [
  trigger({ type: "boss_intro" }, [
    line(K, "The forge core is collapsing into... it's reshaping into something!"),
    line(V, "Engage! Don't give it time to finish forming!"),
  ]),
  trigger({ type: "level_start" }, [
    line(K, "Same weak point pattern -- wait for the mouth to open!"),
    bossLine("Cindermaw", "...BURN...ALL OF YOU...BURN...", 250),
    line(R, "Great. A chatty one.", 330),
  ]),
  trigger({ type: "boss_phase", phase: 2 }, [
    line(K, "It's erupting! Phase two -- it's raining fire!"),
    line(R, "Dodge the charges! It hits like a comet!"),
  ]),
  trigger({ type: "boss_defeat" }, [
    line(R, "Three for three! Nobody stops this crew!"),
    line(H, "...you understand nothing...the abyss awaits...", 330),
    line(K, "That voice again. Commander, it's not the bosses speaking. Something ELSE is.", 360),
    line(K, "And these boss designations... 'Rockjaw.' 'Glacius.' 'Cindermaw.'", 330),
    line(K, "Those aren't alien names. They sound like... corrupted words.", 330),
    line(V, "The Void Abyss. Whatever's controlling them... it's in the dark.", 330),
  ]),
];

// ── World 4: The Graveyard — "Echoes" ──────────────────────────────
// Tone: Horror, revelation. Key: Kepler Exodus discovery, Reyes's grandmother, hybrid Wraiths.

const dialog_4_1: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "A debris field. Massive. Ancient ships... everywhere.", 350),
    line(K, "Scanning wreckage. These hulls are old. Very old."),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(K, "New contact type! Hybrid fighters -- part organic, part mechanical.", 330),
    line(R, "Those things are flying in formation. OUR formation patterns."),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "The hybrid fighters are running on human reactor cores.", 330),
    line(V, "Human reactors? How?"),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(R, "More of those Wraith things. They fly like trained pilots."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "Commander... the wreckage. These aren't alien ships.", 360),
    line(K, "These are colony ships. Human colony ships.", 360),
    line(V, "...are you certain?"),
    line(K, "I have the serial numbers.", 330),
  ]),
];

const dialog_4_2: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "Commander, I've confirmed it. These ships are from the Kepler Exodus.", 400),
    line(K, "Humanity's first colonial fleet. Vanished two thousand years ago.", 400),
    line(R, "...the Kepler fleet?", 250),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Shielders protecting the wreckage. What are they guarding?"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "The hulls are fused with Hollow biotech. Organic growth covering human steel.", 360),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(R, "My grandmother... Lieutenant Ana Reyes. She served on the Kepler escort fleet.", 400),
    line(R, "They told us the fleet was lost. Everyone on board. Just... gone.", 360),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(H, "...we tried to warn them...but we had already forgotten the words...", 360),
  ]),
  trigger({ type: "level_complete" }, [
    line(R, "She didn't die out here. She BECAME one of these things.", 360),
    line(V, "Reyes..."),
    line(R, "Don't. Just... don't.", 250),
  ]),
];

const dialog_4_3: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "I'm pulling data from the wreckage. Ship logs, flight recorders...", 330),
    line(V, "What do they say?"),
    line(K, "They describe encountering 'a beautiful light.' Then the entries stop.", 400),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Bombers with Wraith escorts. These things work together seamlessly."),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(K, "More log fragments. 'The light spoke to us. It welcomed us home.'", 360),
    line(K, "Then static. Then nothing. For two thousand years.", 360),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(H, "...the light called to us too...we followed...as you will follow...", 360),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(R, "Elite unit leading the Wraiths! That thing fights like an ace pilot!"),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "Hold the line. We need those logs."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "Commander... the last coherent log entry. From the Kepler's captain.", 360),
    line(K, "'We see now. The light is not a beacon. It is a mouth.'", 400),
    line(V, "...keep moving.", 250),
  ]),
];

const dialog_4_4: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "The escort fleet's remains. Warships fused with Hollow growth."),
    line(R, "These were the ships that were supposed to protect the colonists.", 330),
  ]),
  trigger({ type: "wave_start", wave: 0 }, [
    line(K, "Wraiths and cloakers -- the most dangerous combination we've faced.", 330),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(R, "Grandma Ana's ship... the UEC Vigilance. I see the hull number.", 400),
    line(R, "She's been out here this whole time. Two thousand years.", 360),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(H, "...we remember her...she fought so hard...she screamed for so long...", 400),
    line(H, "...and then she was us...and we were her...", 360),
    line(R, "SHUT UP! SHUT UP!", 250),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(K, "Wraiths converging from all directions. They're protecting something ahead."),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "Last push. Whatever's ahead... we face it."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "Commander... there's a ship ahead. Not wreckage. Intact. Powered.", 360),
    line(K, "A UEC Dreadnought-class. It's massive. And it's waking up.", 360),
    line(R, "If we're going to end up like them... then I'm going down fighting.", 330),
  ]),
];

const dialog_4_5: DialogTrigger[] = [
  trigger({ type: "boss_intro" }, [
    line(K, "The Dreadnought is powering up! Hull half-consumed by Hollow growth!"),
    line(V, "That's a human warship fused with alien biotech. Engage!"),
  ]),
  trigger({ type: "level_start" }, [
    bossLine("Revenant", "...remember...us...", 330),
    line(K, "The bridge is shielded! Human-style weapons -- twin cannons, aimed fire!", 330),
    line(R, "It fights like US. Because it WAS us.", 330),
  ]),
  trigger({ type: "boss_phase", phase: 2 }, [
    line(K, "The Hollow growth is consuming the hull! The bridge is EXPOSED!", 330),
    line(K, "Hit the bridge! That's where the original crew is!", 330),
    line(R, "Organic weapons now -- it's firing like a Hollow! Both sides at once!"),
  ]),
  trigger({ type: "boss_defeat" }, [
    line(R, "...it's down. That was someone's ship. Someone's crew.", 360),
    line(K, "That bridge is a UEC Dreadnought-class. That's a HUMAN warship.", 400),
    line(H, "...you cannot destroy what you will become...", 330),
    line(V, "The Void Abyss. Whatever turned these people... the answer is deeper.", 360),
    line(K, "Commander... I'm starting to think the answer is something we don't want to find.", 400),
  ]),
];

// ── World 5: Void Abyss — "Darkness" ──────────────────────────────
// Tone: Tragic realization. Clue: language is Proto-Indo-European. Boss names are human names.

const dialog_5_1: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "No light reaches here. Trust your instruments and your instincts."),
    line(R, "I don't like this. I can't see ANYTHING.", 250),
  ]),
  trigger({ type: "wave_start", wave: 0 }, [
    line(K, "Cloaker units! They phase in and out of visibility!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "Mines in the dark?! That's just cruel."),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(K, "More cloakers. They're everywhere we can't see."),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "Good. Stay alert. It only gets worse from here."),
    line(H, "...you bring light into our domain...how brave...how foolish...", 330),
  ]),
];

const dialog_5_2: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "I'm detecting relay nodes -- cloaked stations coordinating attacks."),
    line(V, "Destroy the relays. Break their coordination."),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Turrets hidden in the dark! Watch for muzzle flashes!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "Mines blanketing the area. They're herding us into ambush zones."),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(R, "Elite cloaker! It vanishes every time I lock on!"),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(K, "The cloaker network isn't military. It's a communications web.", 360),
    line(K, "They're not hiding. They're trying to TALK.", 330),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "Commander... I've decoded their language.", 330),
    line(K, "The root structure is Proto-Indo-European. That's a HUMAN language family.", 400),
    line(V, "...that's impossible."),
    line(K, "I know.", 250),
  ]),
];

const dialog_5_3: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "An entire fleet appeared on sensors and vanished. They're hunting us."),
    line(R, "For once, I'd like to be the hunter.", 250),
  ]),
  trigger({ type: "wave_start", wave: 0 }, [
    line(K, "Six cloakers at once! They're surrounding us!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "Gunners and shielders -- visible ones are the distraction!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(K, "Commander... I've been analyzing the boss designations.", 330),
    line(K, "Rockjaw. Rochev? Glacius. Glazkov? Cindermaw. Sindara?", 360),
    line(K, "Those aren't alien names. They're human names. Corrupted.", 360),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(H, "...we screamed across the centuries and you heard only war...", 330),
    line(R, "Is that thing... guiding us somewhere?"),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "Sector clear. Doc, I need you to stop theorizing and--"),
    line(K, "It's not a theory anymore, Commander. The evidence is overwhelming.", 360),
    line(V, "...keep moving.", 250),
  ]),
];

const dialog_5_4: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "Gravity distortions ahead. Something massive is pulling everything inward."),
    line(V, "This is it. Their command node. Break through."),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Turrets AND shielders blocking the approach. This is their last stand."),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "Bombers and mines -- they're desperate to stop us!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(R, "They're throwing everything at us!"),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(H, "...you have come so far...little pilot...but the void does not release what it swallows...", 400),
    line(V, "Ignore it. Focus on the mission."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "The command node is exposed. And beyond it...", 330),
    line(K, "Something I can't explain. A signal. Older than anything I've ever measured.", 360),
    line(V, "One more sector. One more fight. We end this.", 330),
  ]),
];

const dialog_5_5: DialogTrigger[] = [
  trigger({ type: "boss_intro" }, [
    line(K, "The command node is collapsing into a singular form! It controls the darkness!"),
    line(V, "It's the void commander. Engage!"),
  ]),
  trigger({ type: "level_start" }, [
    bossLine("Nyxar", "...I have seen your thoughts, little light...I know your fear...", 330),
    line(R, "Well, I know YOUR weakness. Bullets.", 250),
    line(K, "It's teleporting! Track its position between jumps!"),
  ]),
  trigger({ type: "boss_phase", phase: 2 }, [
    line(K, "Phase two! Spiral patterns -- find safe lanes!"),
    bossLine("Nyxar", "...we were not always this...we had names once...faces...", 330),
  ]),
  trigger({ type: "boss_phase", phase: 3 }, [
    line(R, "Phase three?! This thing won't quit!"),
    line(K, "It's enraged and charging! Maximum aggression!"),
  ]),
  trigger({ type: "boss_defeat" }, [
    line(R, "DOWN! Another sector commander eliminated!"),
    line(H, "...you approach the mind...your victory means nothing...we are eternal...", 360),
    line(K, "The Hollow Core is exposed. Commander... are we sure about this?", 330),
    line(K, "The DNA, the language, the names... what if we're destroying--", 360),
    line(V, "We don't have a choice, Doc. Pilot, this is the final mission.", 360),
  ]),
];

// ── World 6: The Scar — "Static" ───────────────────────────────────
// Tone: Cosmic horror, disorientation. Key: Voss's implant, The Signal, memory flashes.

const dialog_6_1: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "The Signal is overwhelming our sensors. Space ahead is... flickering.", 350),
    line(K, "New contact type -- they're phasing in and out of existence!", 330),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Those things disappear and reappear! Can't get a lock!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "They're only vulnerable when visible. Time your shots!", 330),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(V, "I've heard The Signal before. Every night for a year. I thought it was tinnitus.", 400),
    line(R, "...Commander?"),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "The Echo units are temporal -- they exist between two moments simultaneously.", 360),
    line(K, "Commander... how long have you been hearing The Signal?", 330),
    line(V, "...keep moving.", 250),
  ]),
];

const dialog_6_2: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "Space is warping. My instruments can't distinguish past from present.", 350),
    line(R, "Is anyone else seeing... flashes? Memories that aren't mine?", 330),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Shielders with Echo support -- hit the visible ones first!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "I'm seeing it too. Cities I've never visited. Faces I've never known.", 360),
    line(K, "The Signal is projecting memories. But whose?", 330),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(R, "Elite phasing in! It's huge!"),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(H, "...the light called to us too, once...we were just like you...curious, brave, doomed...", 400),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "These memories... a launch ceremony. A fleet. Cheering crowds.", 360),
    line(K, "It's showing us the Kepler Exodus. The moment they left Earth.", 360),
  ]),
];

const dialog_6_3: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "Commander, I need to tell you something.", 330),
    line(K, "I scanned your cybernetic eye. The molecular structure matches Hollow biotech.", 400),
    line(V, "...that's impossible. I got it after an accident. Standard issue.", 350),
    line(K, "It isn't.", 250),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Wraiths and Echoes together. Watch for the phase shifts!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "Swarms! They're using the distortion as cover!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(V, "My accident. The implant. Was it really an accident?", 350),
    line(K, "Commander, I don't think any of this has been an accident.", 360),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(H, "...we planted the seed long ago...in the eye that sees what we need you to see...", 400),
    line(V, "GET OUT OF MY HEAD.", 250),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "The implant has been receiving The Signal since before the mission launched.", 400),
    line(K, "Commander... you were chosen. Guided. Used.", 360),
    line(V, "I know. And we're still going forward.", 330),
  ]),
];

const dialog_6_4: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "The Signal relay is just ahead. Everything is converging to stop us.", 350),
    line(R, "Then everything can try.", 250),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Turrets and Echoes! The turrets anchor while the Echoes flank!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "Bombers and mines -- they're creating a gauntlet!"),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(H, "...you cannot silence The Signal...it is older than your species...", 360),
    line(H, "...it sang the first star into being...it will sing the last one dark...", 400),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(R, "They're throwing everything at us! Swarms, Echoes, all of it!"),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "The relay is ahead. Destroy it and we open the path to The Fold."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "The relay is vulnerable. But what's beyond it...", 330),
    line(K, "The Fold. A scar in spacetime. The source of everything.", 360),
    line(V, "Then that's where we go.", 330),
  ]),
];

const dialog_6_5: DialogTrigger[] = [
  trigger({ type: "boss_intro" }, [
    line(K, "The Signal relay is massive! It's not a creature -- it's infrastructure!", 350),
    line(V, "Destroy it. Cut the connection."),
  ]),
  trigger({ type: "level_start" }, [
    line(K, "The core is shielded during emission cycles! Hit it during pauses!", 330),
    bossLine("The Beacon", "...I AM THE VOICE BETWEEN STARS...I AM THE CALL THAT CANNOT BE UNHEARD...", 400),
    line(R, "Shockwave rings! Weave through the gaps!", 250),
  ]),
  trigger({ type: "boss_phase", phase: 2 }, [
    line(K, "Phase two! The rings are denser! It's summoning reinforcements!", 330),
    line(R, "Echoes spawning from the rifts! Focus on the core!"),
  ]),
  trigger({ type: "boss_defeat" }, [
    line(R, "The relay is down! The Signal is... quieter.", 330),
    line(K, "The path is open. The Fold is ahead.", 360),
    line(H, "...you silence one voice...but The Fold has a thousand tongues...", 400),
    line(V, "Into The Fold. Whatever's on the other side... we face it together.", 360),
  ]),
];

// ── World 7: The Fold — "Through the Mirror" ──────────────────────
// Tone: Surreal, existential dread. Key: mirror enemies, DNA merging, navigation lies.

const dialog_7_1: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "We're inside The Fold. Reality has... inverted.", 350),
    line(R, "Those ships -- they look like OURS. Dark copies. Wrong colors.", 330),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(K, "Mirror copies! They use our own flight patterns against us!", 330),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "They're fast and they dodge! These things KNOW how we fight!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(H, "...do you see it now?...the light that called us?...it's calling you too...", 360),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "These mirror ships... they're not copies of us. They're copies of who we WILL be.", 400),
    line(V, "Explain that, Doc."),
    line(K, "I can't. Not yet.", 250),
  ]),
];

const dialog_7_2: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "Spacetime is fracturing around us. Past and present are overlapping.", 350),
    line(R, "I can see... a fleet. Leaving Earth. That's the Kepler launch.", 330),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(K, "The mutagenic radiation here doesn't destroy DNA. It MERGES it.", 360),
    line(K, "Multiple consciousnesses fused into one body.", 360),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "Turrets anchoring while mirrors flank! Watch both sides!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(K, "That's what the Hollow are. Not a species. A graveyard of minds.", 400),
    line(R, "...every one of those things is a person? Multiple people?", 330),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(H, "...we are ten thousand voices screaming as one...", 330),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "Keep moving. We can grieve later. If there IS a later."),
  ]),
];

const dialog_7_3: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(R, "I can see the visions clearly now. A fleet entering a beautiful light.", 360),
    line(R, "Faces transforming. Screaming. Then silence.", 360),
    line(K, "Then the screams become the Hollow Voice.", 330),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Bombers with mirror escorts! They're mirroring our approach vectors!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "Swarms phasing through with mirrors. They're everywhere!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(H, "...it has been calling you since before you launched...", 360),
    line(H, "...The Signal was in the ship before you left dock...", 360),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "Whatever we find at the end of this... we face it."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "Commander... the ship has been lying to us. Since day one.", 400),
    line(K, "Navigation logs. Every course correction. Altered. From the start.", 400),
    line(V, "By what?"),
    line(K, "By The Signal. It's been in our systems since before we launched.", 400),
  ]),
];

const dialog_7_4: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "Nothing here is real. Or everything is. I can't tell anymore.", 350),
    line(K, "The Fold is showing us the truth. The full cycle.", 330),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(R, "Mirrors and Echoes everywhere! Everything is wrong!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "I can see it now. The cycle. Humanity rises. Hears The Signal. Follows.", 400),
    line(K, "Reaches The Fold. Transforms. Becomes the Hollow. Waits for the next cycle.", 400),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(H, "...now you understand...you are not the first...you are not the last...", 400),
    line(H, "...we have danced this dance four thousand, eight hundred and ninety times...", 430),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "I don't care how many times it's happened. We end it HERE."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "The source of The Fold is just ahead. A reflection of... us.", 360),
    line(R, "Of course it is.", 250),
  ]),
];

const dialog_7_5: DialogTrigger[] = [
  trigger({ type: "boss_intro" }, [
    line(K, "It's... our ship. A massive, warped version of our own ship!", 350),
    line(V, "Engage. Don't hesitate."),
  ]),
  trigger({ type: "level_start" }, [
    bossLine("The Reflection", "...I AM WHAT YOU WILL BECOME...I AM WHAT YOU HAVE ALWAYS BEEN...", 400),
    line(K, "It's not mimicking us. It IS us. From before. From the last cycle.", 400),
    line(R, "Then let's make sure there ISN'T a next cycle.", 330),
  ]),
  trigger({ type: "boss_phase", phase: 2 }, [
    line(K, "Phase two! It's using our upgraded weapons! Three-way spread with side gunners!", 330),
    line(R, "It knows every move we'll make before we make it!"),
  ]),
  trigger({ type: "boss_phase", phase: 3 }, [
    line(K, "Phase three! Full mirror! Everything we have, reflected back!", 330),
    line(V, "It's tracking our position! Keep moving! KEEP MOVING!"),
  ]),
  trigger({ type: "boss_defeat" }, [
    line(R, "It's... shattering. Like a mirror breaking.", 330),
    line(K, "The path to the Hollow Core is open.", 360),
    line(H, "...you broke the mirror...but the face behind it is still yours...", 400),
    line(V, "The Hollow Core. This ends now.", 330),
    line(K, "Commander... whatever we find in there... I think we already know.", 360),
  ]),
];

// ── World 8: The Hollow Core — "The Truth" ─────────────────────────
// Tone: Grief, tragedy, inevitability. Reveal: UEC Kepler, Elara Chen.

const dialog_8_1: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "We're inside. The Hollow Core. The walls are... alive.", 350),
    line(K, "Bioforms everywhere. This isn't a base. It's an organism."),
  ]),
  trigger({ type: "wave_start", wave: 0 }, [
    line(R, "Swarms pouring from the walls! The hive is waking up!"),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(K, "The walls have faded murals. Human art. Human writing.", 360),
    line(R, "...what?"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "Elites leading the swarm! They're protecting the membrane!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(H, "...you are inside us now...we feel you...like a splinter...", 330),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "The outer membrane is breached. Push deeper."),
    line(K, "Commander... the spawning chambers aren't factories. They're cocoons.", 360),
  ]),
];

const dialog_8_2: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "These corridors pulse with neural energy. We're inside its brain.", 350),
    line(R, "Please tell me you did NOT just say we're inside its brain.", 250),
  ]),
  trigger({ type: "wave_start", wave: 1 }, [
    line(K, "Elites and shielders protecting the pathways. They're antibodies."),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(R, "Swarms and cloakers -- it's throwing everything from all sides!"),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(H, "...we were you...once...before the light took us...before we forgot our names...", 400),
    line(H, "...and you come here to end us...who is the monster, pilot?", 360),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(K, "Commander... those murals. Human faces. Human writing. This was a HUMAN place.", 400),
    line(V, "That's not possible. Stay focused."),
  ]),
  trigger({ type: "level_complete" }, [
    line(R, "Path is clear. I don't like what that thing is saying, though.", 330),
  ]),
];

const dialog_8_3: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(K, "Spawning pods everywhere. This is where all those enemies come from."),
    line(V, "Destroy the pods. Cut off the supply."),
  ]),
  trigger({ type: "wave_start", wave: 0 }, [
    line(R, "Swarms! Twenty contacts! The pods are active!"),
  ]),
  trigger({ type: "wave_start", wave: 3 }, [
    line(K, "Elites guarding the core pods. They're prioritizing defense."),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(H, "...every unit you destroy was once a mind...a life...a memory absorbed...", 400),
    line(K, "They're not manufactured. They're converted. Merged. Millions of minds fused into one.", 400),
  ]),
  trigger({ type: "wave_start", wave: 6 }, [
    line(R, "I don't care what they WERE. Right now they're trying to kill us!"),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "Last wave. Push through."),
  ]),
  trigger({ type: "level_complete" }, [
    line(K, "The spawning chamber is offline. But the Hollow Mind is still active.", 330),
    line(K, "Commander... when we destroy it, every Hollow unit dies. All of them. Millions.", 400),
    line(V, "I know, Doc. I know.", 330),
  ]),
];

const dialog_8_4: DialogTrigger[] = [
  trigger({ type: "level_start" }, [
    line(V, "Final defensive line before the core. Every unit in the sector is converging."),
    line(R, "Then we'd better be fast."),
  ]),
  trigger({ type: "wave_start", wave: 0 }, [
    line(R, "Elites and cloakers leading the charge! They know we're here!"),
  ]),
  trigger({ type: "wave_start", wave: 2 }, [
    line(K, "Commander. The nerve center has a name etched in Old Earth script.", 360),
    line(K, "It reads: UEC KEPLER -- FLEET COMMAND.", 400),
    line(V, "...the Kepler Exodus? That fleet vanished two thousand years ago.", 360),
  ]),
  trigger({ type: "wave_start", wave: 4 }, [
    line(H, "...do you understand now?...we are not your enemy...", 330),
    line(H, "...we are your future...and your past...", 360),
  ]),
  trigger({ type: "wave_start", wave: 5 }, [
    line(R, "...no. No. That's not possible.", 250),
  ]),
  trigger({ type: "wave_start", wave: 7 }, [
    line(V, "The nerve center is collapsing. The Mind is just ahead."),
  ]),
  trigger({ type: "level_complete" }, [
    line(V, "Pilot. What comes next... there's no going back.", 400),
    line(V, "If you're ready... engage.", 350),
    line(K, "...for what it's worth, I'm sorry it came to this.", 330),
  ]),
];

const dialog_8_5: DialogTrigger[] = [
  trigger({ type: "boss_intro" }, [
    line(K, "The Hollow Mind is manifesting! It's enormous! It IS the core!", 350),
    line(V, "Pilot. This is everything. End it.", 330),
  ]),
  trigger({ type: "level_start" }, [
    bossLine("Hollow Mind", "I remember my name. I was Commander Elara Chen.", 400),
    bossLine("Hollow Mind", "I led the Kepler Fleet into the light. We heard The Signal and we followed.", 430),
    line(R, "...Commander Chen? The Kepler Fleet?", 330),
    line(K, "The central eye is the weak point! Everything you've got!", 330),
  ]),
  trigger({ type: "boss_phase", phase: 2 }, [
    bossLine("Hollow Mind", "Every colony we destroyed -- we were trying to turn them back.", 400),
    bossLine("Hollow Mind", "But we forgot the words. We forgot how to be anything but what The Fold made us.", 430),
    line(K, "Phase two! Neural pulse patterns -- find the gaps!"),
    line(R, "It's spawning elite units! Stay on the eye!"),
  ]),
  trigger({ type: "boss_phase", phase: 3 }, [
    bossLine("Hollow Mind", "ENOUGH. If the cycle cannot be broken, then let it end in fire.", 400),
    line(V, "It's going all out! Everything it has! Don't stop firing!"),
    line(R, "I'm with you, pilot! To the end!"),
  ]),
  trigger({ type: "boss_defeat" }, [
    line(K, "The signal is fading. The Hollow Mind is... gone.", 400),
    bossLine("Hollow Mind", "...remember us...you will wear our faces soon...", 400),
    line(R, "...we did it?"),
    line(V, "Sector Zero is clear.", 330),
    line(K, "Commander... I need to show you something. Our navigation logs.", 400),
    line(K, "Every course correction since mission start. Someone's been guiding us.", 400),
    line(V, "Who?"),
    line(K, "Not who. What. The Signal. It's been in the ship since before we launched.", 430),
    line(K, "...and my instruments are picking up something else. A new signal. Outbound.", 400),
    line(V, "Outbound where?"),
    line(K, "...Earth.", 400),
    line(V, "...come home, pilot. While there's still a home to go to.", 430),
  ]),
];

// ─── Lookup ─────────────────────────────────────────────────────────

const DIALOG_MAP: Record<string, DialogTrigger[]> = {
  "1-1": dialog_1_1,
  "1-2": dialog_1_2,
  "1-3": dialog_1_3,
  "1-4": dialog_1_4,
  "1-5": dialog_1_5,
  "2-1": dialog_2_1,
  "2-2": dialog_2_2,
  "2-3": dialog_2_3,
  "2-4": dialog_2_4,
  "2-5": dialog_2_5,
  "3-1": dialog_3_1,
  "3-2": dialog_3_2,
  "3-3": dialog_3_3,
  "3-4": dialog_3_4,
  "3-5": dialog_3_5,
  "4-1": dialog_4_1,
  "4-2": dialog_4_2,
  "4-3": dialog_4_3,
  "4-4": dialog_4_4,
  "4-5": dialog_4_5,
  "5-1": dialog_5_1,
  "5-2": dialog_5_2,
  "5-3": dialog_5_3,
  "5-4": dialog_5_4,
  "5-5": dialog_5_5,
  "6-1": dialog_6_1,
  "6-2": dialog_6_2,
  "6-3": dialog_6_3,
  "6-4": dialog_6_4,
  "6-5": dialog_6_5,
  "7-1": dialog_7_1,
  "7-2": dialog_7_2,
  "7-3": dialog_7_3,
  "7-4": dialog_7_4,
  "7-5": dialog_7_5,
  "8-1": dialog_8_1,
  "8-2": dialog_8_2,
  "8-3": dialog_8_3,
  "8-4": dialog_8_4,
  "8-5": dialog_8_5,
};

export function getDialogTriggers(world: number, level: number): DialogTrigger[] {
  const key = `${world}-${level}`;
  const triggers = DIALOG_MAP[key];
  if (!triggers) return [];
  // Deep copy so triggers are fresh (triggered flags reset)
  return triggers.map((t) => ({ ...t, triggered: false, lines: [...t.lines] }));
}
