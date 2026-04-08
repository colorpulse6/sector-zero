import type { SaveData } from "./types";

// ─── Characters ────────────────────────────────────────────────────

export interface CrewMember {
  id: string;
  name: string;
  role: string;
  portraitKey: string;
  color: string;
}

export const CREW: CrewMember[] = [
  { id: "voss", name: "COMMANDER VOSS", role: "Commanding Officer", portraitKey: "PORTRAIT_VOSS", color: "#44ccff" },
  { id: "reyes", name: "LT. REYES", role: "Pilot & Weapons", portraitKey: "PORTRAIT_REYES", color: "#ff8844" },
  { id: "kael", name: "DOC KAEL", role: "Science Officer", portraitKey: "PORTRAIT_KAEL", color: "#44ff88" },
];

// ─── Conversation Definitions ──────────────────────────────────────

export interface ConversationLine {
  speaker: string;
  text: string;
  color: string;
}

export interface Conversation {
  id: string;
  crewId: string;
  title: string;
  unlockAfter: string | null; // level key like "1-5" or null for always available
  lines: ConversationLine[];
}

function vossLine(text: string): ConversationLine {
  return { speaker: "VOSS", text, color: "#44ccff" };
}
function reyesLine(text: string): ConversationLine {
  return { speaker: "REYES", text, color: "#ff8844" };
}
function docLine(text: string): ConversationLine {
  return { speaker: "DOC", text, color: "#44ff88" };
}

// ─── All Conversations ─────────────────────────────────────────────

export const CONVERSATIONS: Conversation[] = [
  // ── Pre-mission (available from start) ──
  {
    id: "voss-intro",
    crewId: "voss",
    title: "Mission Parameters",
    unlockAfter: null,
    lines: [
      vossLine("Sector Zero. The most classified region in UEC space."),
      vossLine("No ship has returned from beyond the boundary. Until now, no ship had a reason to try."),
      vossLine("Our mandate is simple: neutralize the threat. But something about these transmissions..."),
      vossLine("Stay sharp out there. I have a feeling this won't be a routine sweep."),
    ],
  },
  {
    id: "reyes-intro",
    crewId: "reyes",
    title: "Pre-Flight Check",
    unlockAfter: null,
    lines: [
      reyesLine("Hey, pilot. Ready for this?"),
      reyesLine("I've been running simulations all week. Whatever's in Sector Zero, it hits hard and fast."),
      reyesLine("Stick to the fundamentals. Watch your shields, manage your fire, and don't get cocky."),
      reyesLine("We've got your back from the Vanguard. You're not alone out there."),
    ],
  },
  {
    id: "kael-intro",
    crewId: "kael",
    title: "Scientific Curiosity",
    unlockAfter: null,
    lines: [
      docLine("Fascinating readings from the boundary zone. Truly fascinating."),
      docLine("The energy signatures don't match anything in our databases. Not Kree, not Thallian, not even Old Earth tech."),
      docLine("I've set up spectrographic analysis on your combat feeds. Every enemy you encounter gives us data."),
      docLine("Try not to destroy them too quickly? ...I'm joking. Mostly."),
    ],
  },

  // ── After World 1 Boss ──
  {
    id: "voss-w1",
    crewId: "voss",
    title: "Familiar Formations",
    unlockAfter: "1-5",
    lines: [
      vossLine("Those attack formations in the Aurelia Belt. Did you notice anything... familiar?"),
      vossLine("Diamond intercept. Pincer sweep. Page 47 of the UEC Tactical Manual."),
      vossLine("These hostiles are using OUR tactics. Not similar. Identical."),
      vossLine("I've filed a classified report. Command hasn't responded. That's... unusual."),
    ],
  },
  {
    id: "reyes-w1",
    crewId: "reyes",
    title: "Those Formations",
    unlockAfter: "1-5",
    lines: [
      reyesLine("Commander showed me the tactical analysis. Those were UEC formations."),
      reyesLine("I've flown with three different squadrons. I KNOW those patterns."),
      reyesLine("There's no way hostile aliens independently developed the exact same maneuvers."),
      reyesLine("Someone taught them. Or... they already knew."),
    ],
  },

  // ── After World 2 Boss ──
  {
    id: "kael-w2",
    crewId: "kael",
    title: "Alloy Analysis",
    unlockAfter: "2-5",
    lines: [
      docLine("I've finished analyzing the debris from the Cryon Nebula engagement."),
      docLine("The alloy compositions... I ran the spectrograph three times. The results don't change."),
      docLine("These alloys match human manufacturing processes. Not similar. MATCH."),
      docLine("Either someone is selling our technology to the enemy, or..."),
      docLine("...I need more data before I voice that hypothesis."),
    ],
  },
  {
    id: "voss-w2",
    crewId: "voss",
    title: "Radio Silence",
    unlockAfter: "2-5",
    lines: [
      vossLine("Still no response from Command. Fourteen days of silence on a Priority One channel."),
      vossLine("I've seen communication blackouts before. During the Kepler Exodus. During the Collapse."),
      vossLine("They only go silent when they don't want questions asked."),
      vossLine("We continue the mission. But I'm beginning to wonder whose mission it really is."),
    ],
  },

  // ── After World 3 Boss ──
  {
    id: "kael-w3",
    crewId: "kael",
    title: "The DNA Report",
    unlockAfter: "3-5",
    lines: [
      docLine("I need to tell you something. About the biological samples from Ignis Rift."),
      docLine("98.7% DNA overlap with human genome. Not convergent evolution. Direct lineage."),
      docLine("These aren't aliens, pilot. Or at least, they weren't always aliens."),
      docLine("The timeline doesn't work with any known human diaspora. Unless..."),
      docLine("Unless they've been here much, much longer than the records say."),
    ],
  },
  {
    id: "reyes-w3",
    crewId: "reyes",
    title: "Pushing Forward",
    unlockAfter: "3-5",
    lines: [
      reyesLine("Doc showed me the DNA results. I... don't know what to do with that information."),
      reyesLine("Every sortie, I'm out there shooting at things that might be human. Or used to be."),
      reyesLine("My grandmother was part of the Kepler Exodus. She told me stories about the ships that didn't make it."),
      reyesLine("What if they DID make it? Just... not where we expected?"),
    ],
  },

  // ── After World 4 Boss ──
  {
    id: "reyes-w4",
    crewId: "reyes",
    title: "My Grandmother",
    unlockAfter: "4-5",
    lines: [
      reyesLine("I found something in the Graveyard wreckage. A hull fragment with a serial number."),
      reyesLine("KE-7741. That's my grandmother's ship. The one she said was lost to 'navigation error.'"),
      reyesLine("It wasn't lost. It came HERE. To Sector Zero."),
      reyesLine("All those years she told me the missing ships were destroyed... she KNEW. She had to have known."),
      reyesLine("I need a minute. Just... give me a minute."),
    ],
  },
  {
    id: "voss-w4",
    crewId: "voss",
    title: "Classified Files",
    unlockAfter: "4-5",
    lines: [
      vossLine("Lieutenant Reyes found her grandmother's hull number in The Graveyard."),
      vossLine("I've seen those serial numbers before. In classified UEC files I accessed years ago."),
      vossLine("The Kepler Exodus wasn't a colonization failure. It was a quarantine."),
      vossLine("They sent those ships INTO Sector Zero. On purpose. And then they sealed the border."),
      vossLine("We were never meant to find this."),
    ],
  },

  // ── After World 5 Boss ──
  {
    id: "kael-w5",
    crewId: "kael",
    title: "The Names",
    unlockAfter: "5-5",
    lines: [
      docLine("I've been studying the boss designations from our encounters."),
      docLine("Rockjaw. Glacius. Cindermaw. I thought they were codenames we assigned."),
      docLine("They're not. The entities NAMED THEMSELVES. And the etymologies are..."),
      docLine("Rochev. Glazkov. Sindara. These are HUMAN names. Evolved over centuries."),
      docLine("They remember being human. On some level, they still ARE."),
    ],
  },
  {
    id: "reyes-w5",
    crewId: "reyes",
    title: "What Are We Doing",
    unlockAfter: "5-5",
    lines: [
      reyesLine("Doc says those things out there used to be people. Used to have names."),
      reyesLine("And we're just... shooting them. On orders from Command, who won't even pick up the comm."),
      reyesLine("I'm not saying we stop fighting. They're still trying to kill us. But we need to understand WHY."),
      reyesLine("Something changed them. Something in Sector Zero. And it's still here."),
    ],
  },

  // ── After World 6 Boss ──
  {
    id: "voss-w6",
    crewId: "voss",
    title: "The Signal",
    unlockAfter: "6-5",
    lines: [
      vossLine("I haven't been entirely honest with the crew. Or with you."),
      vossLine("I can hear it. The Signal. It started as static in my cybernetic eye implant."),
      vossLine("But it's not static. It's language. Old language. Proto-Indo-European roots, Doc says."),
      vossLine("It says: 'You come closer. You come home. You are already us.'"),
      vossLine("I don't know what that means. But I know I'm not the only one who can hear it."),
    ],
  },
  {
    id: "kael-w6",
    crewId: "kael",
    title: "The Scar Analysis",
    unlockAfter: "6-5",
    lines: [
      docLine("The Scar isn't a natural phenomenon. It's a wound in spacetime."),
      docLine("Something was torn open here, centuries ago. And it never healed."),
      docLine("The energy readings match theoretical models for temporal displacement."),
      docLine("I think the Kepler colonists didn't just arrive in Sector Zero."),
      docLine("They arrived in Sector Zero's PAST. And had centuries to... change."),
    ],
  },

  // ── After World 7 Boss ──
  {
    id: "kael-w7",
    crewId: "kael",
    title: "The Ship Knows",
    unlockAfter: "7-5",
    lines: [
      docLine("I've been digging through the Vanguard's core systems. Navigation logs. Mission parameters."),
      docLine("The ship has been lying to us since day one."),
      docLine("Our 'mission to neutralize hostile forces' was actually a retrieval operation."),
      docLine("Command doesn't want us to destroy the Hollow. They want us to BECOME part of it."),
      docLine("We're not soldiers. We're offerings."),
    ],
  },
  {
    id: "voss-w7",
    crewId: "voss",
    title: "The Choice Ahead",
    unlockAfter: "7-5",
    lines: [
      vossLine("Doc found the truth in the nav logs. I should have told you sooner."),
      vossLine("The Signal gets louder every day. I understand more of it now."),
      vossLine("It's not malevolent. It's lonely. A thousand years of human consciousness, fused together, reaching out."),
      vossLine("We have one more sector to cross. The Hollow Core. Where it all began."),
      vossLine("Whatever happens in there... it's our choice. Not Command's. Ours."),
    ],
  },
  {
    id: "reyes-w7",
    crewId: "reyes",
    title: "Before the End",
    unlockAfter: "7-5",
    lines: [
      reyesLine("So this is it. The final push."),
      reyesLine("My grandmother's ship is out there. Her crewmates became... whatever the Hollow is now."),
      reyesLine("I used to hate them. The things in Sector Zero. Now I just feel... sad."),
      reyesLine("A thousand years of screaming across the void, trying to tell us who they were."),
      reyesLine("Let's finish this. Not as executioners. As family coming home."),
    ],
  },
];

// ─── Helpers ────────────────────────────────────────────────────────

/** Get conversations available for a specific crew member based on progression */
export function getAvailableConversations(crewId: string, save: SaveData): Conversation[] {
  return CONVERSATIONS.filter((c) => {
    if (c.crewId !== crewId) return false;
    if (c.unlockAfter === null) return true;
    return !!save.levels[c.unlockAfter]?.completed;
  });
}

/** Check if a conversation has been viewed */
export function isConversationViewed(conversationId: string, save: SaveData): boolean {
  return save.viewedConversations.includes(conversationId);
}

/** Count unread conversations for a crew member */
export function countUnread(crewId: string, save: SaveData): number {
  const available = getAvailableConversations(crewId, save);
  return available.filter((c) => !isConversationViewed(c.id, save)).length;
}

/** Count total unread across all crew */
export function countTotalUnread(save: SaveData): number {
  return CREW.reduce((sum, crew) => sum + countUnread(crew.id, save), 0);
}

/** Mark a conversation as viewed (returns new save) */
export function markConversationViewed(save: SaveData, conversationId: string): SaveData {
  if (save.viewedConversations.includes(conversationId)) return save;
  return {
    ...save,
    viewedConversations: [...save.viewedConversations, conversationId],
  };
}
