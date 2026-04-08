import type { SaveData } from "./types";

// ─── Categories ────────────────────────────────────────────────────

export type CodexCategory = "intel" | "enemies" | "transmissions" | "research" | "personal";

export const CODEX_CATEGORIES: { id: CodexCategory; name: string; color: string }[] = [
  { id: "intel", name: "INTEL", color: "#44ccff" },
  { id: "transmissions", name: "SIGNALS", color: "#aa44ff" },
  { id: "research", name: "RESEARCH", color: "#44ff88" },
  { id: "personal", name: "PERSONAL", color: "#ffaa44" },
];

// ─── Entry Definition ──────────────────────────────────────────────

export interface CodexEntry {
  id: string;
  category: CodexCategory;
  title: string;
  speaker?: string;
  speakerColor?: string;
  text: string;
  /** Level key like "1-1" — entry unlocks when this level is completed. null = always available. */
  unlockAfter: string | null;
}

// ─── All Entries ───────────────────────────────────────────────────

export const CODEX_ENTRIES: CodexEntry[] = [
  // ════════════════════════════════════════════════════════════════
  // INTEL
  // ════════════════════════════════════════════════════════════════
  {
    id: "intel-briefing",
    category: "intel",
    title: "Sector Zero Briefing",
    text: "CLASSIFIED — UEC COMMAND\n\nSector Zero designates the uncharted region beyond the Aurelia Boundary. No sanctioned vessel has returned from deep penetration missions. Satellite reconnaissance shows anomalous energy signatures consistent with large-scale biological activity.\n\nMission objective: Reconnaissance in force. Neutralize hostile contacts. Establish communication corridor for follow-up operations.\n\nYour vessel, the UEC Vanguard, has been equipped with experimental countermeasures. You are authorized to use all means necessary.",
    unlockAfter: null,
  },
  {
    id: "intel-aurelia",
    category: "intel",
    title: "Aurelia Belt Survey",
    text: "The Aurelia Belt forms the outer boundary of Sector Zero — a dense field of mineral-rich asteroids that serves as natural camouflage for hostile forces.\n\nScanner analysis reveals the asteroids contain trace amounts of organic compounds not found in standard asteroid fields. The mineral composition suggests these formations are relatively young — perhaps only a few centuries old.\n\nRecommendation: Maintain high alert. The belt provides excellent ambush positions.",
    unlockAfter: "1-1",
  },
  {
    id: "intel-tactics",
    category: "intel",
    title: "Tactical Analysis: Familiar Patterns",
    speaker: "VOSS",
    speakerColor: "#44ccff",
    text: "COMMANDER'S LOG — CLASSIFIED\n\nI've cross-referenced the attack formations from the Aurelia engagement with UEC tactical databases. The correlation is 97.3%.\n\nDiamond intercept. Pincer sweep. Echelon right. These are textbook UEC maneuvers, documented in our own training materials.\n\nI cannot explain how an alien force would independently develop identical tactics. I am requesting a Priority One response from Command.",
    unlockAfter: "1-5",
  },
  {
    id: "intel-cryon",
    category: "intel",
    title: "Cryon Nebula Navigation",
    text: "The Cryon Nebula is a region of supercooled gas and crystalline ice formations. Sensor range is reduced by 60%. Energy weapons lose 15% efficiency in the nebula's electromagnetic interference.\n\nHostile forces appear well-adapted to these conditions. Their ships show thermal shielding consistent with prolonged nebula habitation.\n\nNote: Debris fields within the nebula contain metallic fragments of unknown origin. Spectral analysis pending.",
    unlockAfter: "2-1",
  },
  {
    id: "intel-kepler",
    category: "intel",
    title: "The Kepler Exodus",
    speaker: "VOSS",
    speakerColor: "#44ccff",
    text: "DECLASSIFIED FILE — KEPLER EXODUS\n\n312 years ago, the UEC launched the Kepler Exodus — a fleet of 47 colony ships bound for the Kepler system. Only 31 ships arrived. The remaining 16 were listed as \"lost to navigation error.\"\n\nI've accessed restricted archives. The 16 ships didn't malfunction. Their last known trajectory points directly into Sector Zero.\n\nThis was not an accident. Someone redirected those ships.",
    unlockAfter: "4-2",
  },
  {
    id: "intel-quarantine",
    category: "intel",
    title: "Quarantine Protocol",
    speaker: "VOSS",
    speakerColor: "#44ccff",
    text: "COMMANDER'S LOG — EYES ONLY\n\nI've found the original quarantine order. Dated 14 days after the Kepler ships entered Sector Zero.\n\nThe order reads: \"All vessels, probes, and communications directed at or originating from grid sectors 7741 through 8200 are to be destroyed without warning. No exceptions. No records.\"\n\nSigned by three admirals. Two are now dead. The third sits on the current UEC Council.\n\nThey sealed Sector Zero because they knew what was inside.",
    unlockAfter: "4-5",
  },
  {
    id: "intel-hollow-approach",
    category: "intel",
    title: "Approach to the Hollow Core",
    text: "Final sensor readings before entering the Hollow Core:\n\nEnergy output: 4.7 × 10^26 watts (stellar-class)\nBiological signatures: ~1,000,000+ (individual resolution impossible)\nTemporal distortion: +/- 200 years relative to galactic standard\n\nThe Hollow Core is not a place. It is a living thing. A consciousness made of a million human minds, fused over centuries, screaming across spacetime.\n\nWe are not invading. We are coming home.",
    unlockAfter: "8-1",
  },

  // ════════════════════════════════════════════════════════════════
  // ENEMIES
  // ════════════════════════════════════════════════════════════════
  {
    id: "enemy-scout",
    category: "enemies",
    title: "Scout — Analysis",
    text: "TYPE: Scout\nTHREAT: Low\nBEHAVIOR: Fast approach, no weapons\n\nLightly armored reconnaissance units. They move in formation patterns and rely on speed over firepower. Often serve as the first wave of engagement, probing defenses before heavier units advance.\n\nNotable: Their flight patterns show evidence of coordinated intelligence. These are not autonomous drones — something is directing them.",
    unlockAfter: "1-1",
  },
  {
    id: "enemy-gunner",
    category: "enemies",
    title: "Gunner — Analysis",
    text: "TYPE: Gunner\nTHREAT: Medium\nBEHAVIOR: Slow, sustained fire\n\nHeavily armed units that anchor defensive formations. Their weapons fire at a consistent rate, creating suppression zones.\n\nThe firing patterns show adaptive behavior — they adjust aim based on pilot evasion tendencies. This suggests real-time tactical processing, not pre-programmed routines.",
    unlockAfter: "1-2",
  },
  {
    id: "enemy-shielder",
    category: "enemies",
    title: "Shielder — Analysis",
    text: "TYPE: Shielder\nTHREAT: Medium-High\nBEHAVIOR: Damage absorption, formation support\n\nShielded units that protect formations. Their energy barriers show remarkable efficiency — almost identical to UEC shield harmonics.\n\nDoc Kael notes the shield frequency is within 0.3% of our own military specifications. This cannot be coincidence.",
    unlockAfter: "2-1",
  },
  {
    id: "enemy-cloaker",
    category: "enemies",
    title: "Cloaker — Analysis",
    text: "TYPE: Cloaker\nTHREAT: High\nBEHAVIOR: Phase-shift ambush\n\nUnits capable of rendering themselves invisible to standard sensors. They phase in and out of detection, striking from unexpected angles.\n\nThe cloaking technology is organic in nature — a biological process, not a mechanical one. These creatures evolved stealth as a survival mechanism.",
    unlockAfter: "3-1",
  },
  {
    id: "enemy-wraith",
    category: "enemies",
    title: "Wraith — Classification",
    text: "TYPE: Wraith\nTHREAT: Very High\nBEHAVIOR: Pursuit, phasing\n\nThe most disturbing hostile classification. Wraiths display unmistakably human movement patterns — banking turns, evasive jinks, attack runs that mirror academy flight training.\n\nBiometric scans reveal human-scale signatures within the organic hulls. These aren't ships being piloted. The pilots ARE the ships.\n\n312 years of evolution. 312 years of becoming something else.",
    unlockAfter: "4-1",
  },
  {
    id: "enemy-echo",
    category: "enemies",
    title: "Echo — Classification",
    text: "TYPE: Echo\nTHREAT: High\nBEHAVIOR: Pattern mimicry\n\nEchoes copy the player's movement patterns with a slight delay. They learn from engagement to engagement, becoming more effective over time.\n\nDoc Kael theorizes they are fragments of the collective consciousness — echoes of individual human pilots, repeating their final flight patterns for eternity.",
    unlockAfter: "5-1",
  },
  {
    id: "enemy-mirror",
    category: "enemies",
    title: "Mirror — Classification",
    text: "TYPE: Mirror\nTHREAT: Extreme\nBEHAVIOR: Perfect reflection\n\nMirrors are the most evolved hostile form. They mirror your ship's exact capabilities — matching speed, fire rate, and tactical decisions in real-time.\n\nVoss believes they are the Hollow's attempt at communication. Not enemies, but reflections — the collective trying to show us what we will become.",
    unlockAfter: "7-1",
  },

  // ════════════════════════════════════════════════════════════════
  // TRANSMISSIONS
  // ════════════════════════════════════════════════════════════════
  {
    id: "trans-alpha",
    category: "transmissions",
    title: "Fragment Alpha",
    text: "INTERCEPTED SIGNAL — PARTIAL DECODE\n\n[static]...you...come...closer...[static]\n[static]...we remember...the light...[static]\n[static]...so long...so long alone...[static]\n\nSignal origin: Deep Sector Zero\nFrequency: Non-standard (organic resonance)\nAge estimate: Repeating for ~200 years",
    unlockAfter: "2-3",
  },
  {
    id: "trans-beta",
    category: "transmissions",
    title: "Fragment Beta",
    text: "INTERCEPTED SIGNAL — ENHANCED DECODE\n\n\"...the ships came through the tear...we were afraid...the cold was...everything changed...our bodies...we reached for each other and could not...let go...\"\n\nSignal analysis: The transmission uses archaic English syntax consistent with 24th-century colonial dialects. The speaker is narrating events from approximately 300 years ago.\n\nThis is not a recording. It is a memory.",
    unlockAfter: "3-3",
  },
  {
    id: "trans-gamma",
    category: "transmissions",
    title: "Fragment Gamma",
    text: "INTERCEPTED SIGNAL — FULL DECODE\n\n\"We screamed across the centuries but you could not hear us. We built ourselves into weapons because that was the only language you understood. Every scout you destroyed was someone's child. Every gunner was someone's friend.\n\nWe are not your enemy. We are your family. We are what happens when you are forgotten.\"\n\nTransmission ends. No repeat detected.",
    unlockAfter: "5-4",
  },
  {
    id: "trans-delta",
    category: "transmissions",
    title: "Fragment Delta: The Signal",
    text: "INTERCEPTED SIGNAL — DIRECT ADDRESS\n\n\"Pilot of the Vanguard. We know your name. We knew you were coming before you were born.\n\nThe tear in space does not only connect places. It connects times. We have watched you through every iteration. Every loop. Every choice.\n\nYou always come. You always fight. And you always hear us, in the end.\n\nThis is not the first time. It will not be the last.\"\n\nClassification: THE OUROBOROS SIGNAL",
    unlockAfter: "6-5",
  },
  {
    id: "trans-omega",
    category: "transmissions",
    title: "The Final Transmission",
    text: "INTERCEPTED SIGNAL — CLEARTEXT\n\n\"You are at the threshold. The Hollow Core waits.\n\nWe were colonists. We were human. We entered the tear and emerged in Sector Zero's past. Centuries passed. We changed. We merged. We became one.\n\nWe do not want to destroy you. We want to remember what it felt like to be separate. To be individual. To be small.\n\nCome home, pilot. Let us remember together.\"\n\nSignal strength: Maximum\nSource: The Hollow Core",
    unlockAfter: "7-5",
  },

  // ════════════════════════════════════════════════════════════════
  // RESEARCH
  // ════════════════════════════════════════════════════════════════
  {
    id: "research-freq",
    category: "research",
    title: "Comm Frequency Anomaly",
    speaker: "DOC",
    speakerColor: "#44ff88",
    text: "DOC KAEL — RESEARCH LOG\n\nI've detected an anomaly in the background comm frequencies throughout the Aurelia Belt. There's a persistent low-frequency signal embedded in the cosmic noise.\n\nIt's not random. The waveform shows structured patterns — possibly language. My current decryption algorithms can't crack it, but the mathematical structure is unmistakable.\n\nSomeone — or something — is broadcasting from deep within Sector Zero.",
    unlockAfter: "1-3",
  },
  {
    id: "research-alloy",
    category: "research",
    title: "Alloy Composition Report",
    speaker: "DOC",
    speakerColor: "#44ff88",
    text: "DOC KAEL — RESEARCH LOG\n\nDebris analysis from the Cryon Nebula engagement:\n\nPrimary alloy: Titanium-tungsten composite\nSecondary: Carbon nanotube reinforcement\nTrace elements: Synthetic polymers (human manufacture)\n\nThese alloys are not alien. They match UEC manufacturing processes from approximately 300 years ago. The molecular bonding patterns are identical to 24th-century colonial hull plating.\n\nConclusion: The hostile vessels are built from human materials. Or they once were human vessels.",
    unlockAfter: "2-5",
  },
  {
    id: "research-dna",
    category: "research",
    title: "Hollow DNA Analysis: 98.7% Match",
    speaker: "DOC",
    speakerColor: "#44ff88",
    text: "DOC KAEL — RESEARCH LOG — PRIORITY ONE\n\nBiological samples from the Ignis Rift engagement:\n\nDNA overlap with human genome: 98.7%\nDivergence pattern: Consistent with ~300 years of accelerated evolution\nMutations: Primarily neurological — expanded neural connectivity, organic EMF generation\n\nThese organisms are human. Or they were. Three centuries of exposure to whatever energy permeates Sector Zero has transformed them, but the core genome is unmistakably Homo sapiens.\n\nWe are not fighting aliens. We are fighting our own lost children.",
    unlockAfter: "3-3",
  },
  {
    id: "research-names",
    category: "research",
    title: "Boss Name Etymologies",
    speaker: "DOC",
    speakerColor: "#44ff88",
    text: "DOC KAEL — RESEARCH LOG\n\nI've been analyzing the self-designated names of the major hostile entities:\n\nROCKJAW → Rochev (Russian colonial surname)\nGLACIUS → Glazkov (Russian, \"of glass/ice\")\nCINDERMAW → Sindara (Sanskrit-derived colonial name)\nNYXAR → Nikhara (Hindi colonial variant)\nREVENANT → Direct English — \"one who returns\"\n\nThese are human names. Evolved, distorted by centuries, but traceable to the colonial naming conventions of the Kepler Exodus fleet.\n\nThey remember who they were.",
    unlockAfter: "5-3",
  },
  {
    id: "research-proto",
    category: "research",
    title: "Proto-Indo-European Roots",
    speaker: "DOC",
    speakerColor: "#44ff88",
    text: "DOC KAEL — RESEARCH LOG\n\nThe Signal that Commander Voss has been receiving through his cybernetic implant — I've finally decoded the linguistic structure.\n\nThe language is not modern. It's not even Old English. The grammatical structure matches reconstructed Proto-Indo-European — a language that predates recorded history.\n\nBut the Kepler colonists spoke standard English. How did their language regress 6,000 years in only 300?\n\nUnless the temporal displacement in Sector Zero is far more extreme than we calculated. Unless they've been here not for centuries, but for millennia.",
    unlockAfter: "6-3",
  },
  {
    id: "research-nav",
    category: "research",
    title: "Navigation Log Falsification",
    speaker: "DOC",
    speakerColor: "#44ff88",
    text: "DOC KAEL — RESEARCH LOG — URGENT\n\nI've discovered that the Vanguard's navigation logs have been falsified since before we launched.\n\nOur stated mission — \"neutralize hostile forces\" — is a cover. The real mission parameters, buried in encrypted nav subroutines: \"Deliver organic payload to coordinates within the Hollow Core.\"\n\nThe organic payload is us. The crew. We are not soldiers. We are offerings.\n\nCommand has been feeding the Hollow for 300 years. Every ship they send into Sector Zero adds to the collective. And we're next.",
    unlockAfter: "7-3",
  },

  // ════════════════════════════════════════════════════════════════
  // PERSONAL
  // ════════════════════════════════════════════════════════════════
  {
    id: "personal-reyes-1",
    category: "personal",
    title: "Reyes: Why I Fly",
    speaker: "REYES",
    speakerColor: "#ff8844",
    text: "LT. REYES — PERSONAL LOG\n\nPeople ask why I became a pilot. I tell them it's the thrill. The speed. The freedom.\n\nThat's a lie. I fly because my grandmother flew. She was on the Kepler Exodus — one of the ships that made it to the colony. She told me stories about the ones that didn't.\n\n16 ships, gone. She said they were destroyed by a navigation error. She said it with a look in her eyes that told me she was lying.\n\nI fly because I need to know what happened to those ships.",
    unlockAfter: "2-2",
  },
  {
    id: "personal-reyes-kepler-black-box",
    category: "personal",
    title: "Reyes: Kepler Black Box",
    speaker: "REYES",
    speakerColor: "#ff8844",
    text: "LT. REYES — RECORDER TRANSCRIPT\n\nI know that registry prefix. Kepler civilian, third wave. Same family line as my grandmother's ship.\n\nThe recorder doesn't sound like a battle log. It sounds like a pilgrimage. Course corrections, signal echoes, crew notes about hearing voices in the dark.\n\nThey weren't lost. They were led here.\n\nIf Command knew these ships were redirected into Sector Zero, then everything we've been told about the Kepler dead was a lie.\n\nI'm keeping the black box on the bridge. I want it where I can see it.",
    unlockAfter: "4-99",
  },
  {
    id: "personal-voss-1",
    category: "personal",
    title: "Voss: The Eye",
    speaker: "VOSS",
    speakerColor: "#44ccff",
    text: "COMMANDER VOSS — PERSONAL LOG\n\nI lost my left eye at the Battle of Kepler Station. Standard military cybernetic replacement. I've had it for 15 years without issue.\n\nSince entering Sector Zero, the implant has been... wrong. Static at first. Then patterns in the static. Then voices.\n\nI haven't reported it. A commander hearing voices doesn't inspire confidence. But the voices aren't random. They're speaking to me. Specifically to me.\n\nThey say: \"You have our eyes now. We can see through you.\"",
    unlockAfter: "3-2",
  },
  {
    id: "personal-kael-1",
    category: "personal",
    title: "Kael: Scientific Detachment",
    speaker: "DOC",
    speakerColor: "#44ff88",
    text: "DOC KAEL — PERSONAL LOG\n\nI pride myself on scientific detachment. Data doesn't care about your feelings. Results are results.\n\nBut the DNA analysis broke me. 98.7% human. These things we're killing — they had names once. Families. Dreams of a new world in the Kepler system.\n\nThey never got there. They ended up here, in this nightmare sector, and they changed into something we can barely recognize.\n\nI still analyze the data. But my hands shake now when I look at the results.",
    unlockAfter: "3-5",
  },
  {
    id: "personal-reyes-2",
    category: "personal",
    title: "Reyes: My Grandmother's Ship",
    speaker: "REYES",
    speakerColor: "#ff8844",
    text: "LT. REYES — PERSONAL LOG\n\nI found it. Hull fragment KE-7741. My grandmother's ship. The one she said was destroyed.\n\nIt wasn't destroyed. It came here. To Sector Zero. My grandmother knew. She had to have known.\n\nDid she know what happened to the people on board? Did she know they became... this? All those bedtime stories about the brave colonists who were \"lost\" — was she describing people she watched transform into monsters?\n\nI can't stop crying. I'm a combat pilot and I can't stop crying.",
    unlockAfter: "4-5",
  },
  {
    id: "personal-voss-2",
    category: "personal",
    title: "Voss: The Signal in My Sleep",
    speaker: "VOSS",
    speakerColor: "#44ccff",
    text: "COMMANDER VOSS — PERSONAL LOG\n\nThe Signal doesn't stop when I sleep. If anything, it's clearer.\n\nLast night I dreamed I was one of them. A colonist on a Kepler ship, watching the stars tear open. Feeling my body dissolve and merge with the person next to me. Feeling their memories flood into mine.\n\nIt wasn't a nightmare. It was... peaceful. Like coming home after a very long journey.\n\nI'm afraid because I'm not afraid. I should be terrified. Instead, I feel like I understand.\n\nIs this how it starts?",
    unlockAfter: "6-3",
  },
  {
    id: "personal-crew-final",
    category: "personal",
    title: "Crew Log: Before the Core",
    text: "JOINT CREW LOG — ALL HANDS\n\nVOSS: We know the truth now. Command sent us to feed the Hollow.\nREYES: My grandmother's people are in there. All of them.\nKAEL: The science is clear. The Hollow is human. All of it.\n\nVOSS: We have a choice. We can turn back. Report to Command. Let them send the next crew.\nREYES: No. I didn't come this far to run.\nKAEL: Agreed. But we go in on OUR terms. Not Command's.\n\nVOSS: Then it's decided. We enter the Hollow Core. Not as weapons. Not as offerings. As family.\nREYES: For my grandmother. For all of them.\nKAEL: For science. And for closure.\n\nVOSS: Set course. The Hollow Core awaits.",
    unlockAfter: "7-5",
  },
];

// ─── Helpers ───────────────────────────────────────────────────────

/** Get all entries that should be unlocked based on save progress */
export function getUnlockedEntries(save: SaveData): CodexEntry[] {
  return CODEX_ENTRIES.filter((e) => {
    if (!save.unlockedCodex.includes(e.id)) return false;
    return true;
  });
}

/** Get unlocked entries for a specific category */
export function getEntriesForCategory(category: CodexCategory, save: SaveData): CodexEntry[] {
  return getUnlockedEntries(save).filter((e) => e.category === category);
}

/** Check which entries should be newly unlocked after completing a level */
export function getNewUnlocks(save: SaveData): string[] {
  const newIds: string[] = [];
  for (const entry of CODEX_ENTRIES) {
    if (save.unlockedCodex.includes(entry.id)) continue;
    if (entry.unlockAfter === null) {
      newIds.push(entry.id);
    } else if (save.levels[entry.unlockAfter]?.completed) {
      newIds.push(entry.id);
    }
  }
  return newIds;
}

/** Apply new codex unlocks to save data */
export function unlockCodexEntries(save: SaveData): SaveData {
  const newIds = getNewUnlocks(save);
  if (newIds.length === 0) return save;
  return {
    ...save,
    unlockedCodex: [...save.unlockedCodex, ...newIds],
  };
}

export function unlockCodexEntry(save: SaveData, entryId: string): SaveData {
  if (save.unlockedCodex.includes(entryId)) return save;
  return {
    ...save,
    unlockedCodex: [...save.unlockedCodex, entryId],
  };
}

/** Check if a codex entry has been read (viewed) — we track this via the unlockedCodex + a "read" prefix */
export function isCodexEntryNew(entryId: string, save: SaveData): boolean {
  return !save.viewedCodex?.includes(entryId);
}

/** Count new (unread) entries across all categories */
export function countNewCodexEntries(save: SaveData): number {
  const unlocked = getUnlockedEntries(save);
  return unlocked.filter((e) => isCodexEntryNew(e.id, save)).length;
}

/** Count new entries in a specific category */
export function countNewInCategory(category: CodexCategory, save: SaveData): number {
  const entries = getEntriesForCategory(category, save);
  return entries.filter((e) => isCodexEntryNew(e.id, save)).length;
}

/** Mark a codex entry as read */
export function markCodexRead(save: SaveData, entryId: string): SaveData {
  if (save.viewedCodex?.includes(entryId)) return save;
  return {
    ...save,
    viewedCodex: [...(save.viewedCodex ?? []), entryId],
  };
}
