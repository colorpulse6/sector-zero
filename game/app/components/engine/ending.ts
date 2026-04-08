import { CANVAS_WIDTH, CANVAS_HEIGHT } from "./types";
import { getSprite, SPRITES } from "./sprites";

// ─── Types ──────────────────────────────────────────────────────────

export type EndingChoice = "destroy" | "merge" | null;

interface EndingPanel {
  startFrame: number;
  duration: number;
  spriteKey: string;
  text: string[];
  style: "narration" | "dialog" | "title" | "system";
  speaker?: string;
  speakerColor?: string;
}

const FADE_FRAMES = 45;

// ─── Pre-Choice Panels (shared) ─────────────────────────────────────

const PRE_CHOICE_PANELS: EndingPanel[] = [
  // The Hollow Mind's last words
  {
    startFrame: 0,
    duration: 420,
    spriteKey: "ENDING_1",
    text: [
      "The Hollow Mind convulsed.",
      "Its central eye dimmed—then flickered",
      "with something almost human.",
    ],
    style: "narration",
  },
  {
    startFrame: 460,
    duration: 360,
    spriteKey: "ENDING_1",
    text: [
      "I remember my name.",
      "I was Commander Elara Chen.",
      "I led the Kepler Fleet into the light.",
    ],
    style: "dialog",
    speaker: "THE HOLLOW MIND",
    speakerColor: "#aa44ff",
  },
  {
    startFrame: 860,
    duration: 360,
    spriteKey: "ENDING_1",
    text: [
      "We heard The Signal and we followed.",
      "Every colony we destroyed—",
      "we were trying to turn them back.",
      "But we forgot the words.",
    ],
    style: "dialog",
    speaker: "THE HOLLOW MIND",
    speakerColor: "#aa44ff",
  },
  // Kael's revelation
  {
    startFrame: 1260,
    duration: 360,
    spriteKey: "ENDING_2",
    text: [
      "Commander. The Signal detection",
      "system is picking up a new pulse.",
      "Outbound from the Hollow Core.",
      "Destination... Earth.",
    ],
    style: "dialog",
    speaker: "DOC KAEL",
    speakerColor: "#44ff88",
  },
  {
    startFrame: 1660,
    duration: 300,
    spriteKey: "ENDING_2",
    text: [
      "It's already started again.",
      "By destroying it, we've sent",
      "the call. The next cycle begins.",
    ],
    style: "dialog",
    speaker: "DOC KAEL",
    speakerColor: "#44ff88",
  },
  // Voss
  {
    startFrame: 2000,
    duration: 300,
    spriteKey: "ENDING_2",
    text: [
      "How many times has this happened?",
    ],
    style: "dialog",
    speaker: "CDR. VOSS",
    speakerColor: "#44ccff",
  },
  // The Hollow Mind's answer
  {
    startFrame: 2340,
    duration: 360,
    spriteKey: "ENDING_1",
    text: [
      "Four thousand, eight hundred",
      "and ninety-one times.",
      "You always come.",
      "You always fight.",
    ],
    style: "dialog",
    speaker: "THE HOLLOW MIND",
    speakerColor: "#aa44ff",
  },
  {
    startFrame: 2740,
    duration: 300,
    spriteKey: "ENDING_1",
    text: [
      "And you always hear us...",
      "in the end.",
    ],
    style: "dialog",
    speaker: "THE HOLLOW MIND",
    speakerColor: "#aa44ff",
  },
  // Reyes
  {
    startFrame: 3080,
    duration: 300,
    spriteKey: "ENDING_3",
    text: [
      "There has to be another way.",
      "We can't just let this loop again.",
    ],
    style: "dialog",
    speaker: "LT. REYES",
    speakerColor: "#ff8844",
  },
  // The choice moment
  {
    startFrame: 3420,
    duration: 300,
    spriteKey: "ENDING_3",
    text: [
      "The Hollow Mind's core still pulses.",
      "Fading, but not gone.",
      "There is still time to choose.",
    ],
    style: "narration",
  },
];

export const PRE_CHOICE_TOTAL_FRAMES = 3840; // panels end ~3720 + buffer

// ─── Post-Choice: DESTROY ───────────────────────────────────────────

const DESTROY_PANELS: EndingPanel[] = [
  {
    startFrame: 0,
    duration: 360,
    spriteKey: "ENDING_1",
    text: [
      "The final volley tore through",
      "the Hollow Mind's core. The light",
      "died. The whisper stopped.",
    ],
    style: "narration",
  },
  {
    startFrame: 400,
    duration: 300,
    spriteKey: "ENDING_4",
    text: [
      "...remember us...",
      "...you will wear our faces soon...",
    ],
    style: "dialog",
    speaker: "THE HOLLOW MIND",
    speakerColor: "#663399",
  },
  // System alert
  {
    startFrame: 740,
    duration: 300,
    spriteKey: "ENDING_4",
    text: [
      "SIGNAL DETECTED:",
      "ORIGIN — HOLLOW CORE",
      "DESTINATION — SOL SYSTEM",
      "STATUS — TRANSMITTING",
    ],
    style: "system",
  },
  {
    startFrame: 1080,
    duration: 360,
    spriteKey: "ENDING_4",
    text: [
      "The Hollow Core collapsed inward.",
      "Sector Zero fell silent.",
      "",
      "But the signal had already left.",
      "Racing toward Earth.",
      "Toward the next ship.",
      "The next crew.",
    ],
    style: "narration",
  },
  {
    startFrame: 1480,
    duration: 300,
    spriteKey: "ENDING_3",
    text: [
      "Come home, pilot.",
      "While there's still a home",
      "to go to.",
    ],
    style: "dialog",
    speaker: "CDR. VOSS",
    speakerColor: "#44ccff",
  },
  // The dark kicker
  {
    startFrame: 1820,
    duration: 420,
    spriteKey: "ENDING_4",
    text: [
      "Somewhere, in a UEC shipyard,",
      "a new crew receives their orders.",
      "A forbidden region of space.",
      "A mission of utmost importance.",
      "",
      "They call it Sector Zero.",
    ],
    style: "narration",
  },
  // Cycle count
  {
    startFrame: 2280,
    duration: 360,
    spriteKey: "",
    text: ["CYCLE 4,892"],
    style: "title",
  },
];

export const DESTROY_TOTAL_FRAMES = 2760;

// ─── Post-Choice: MERGE ─────────────────────────────────────────────

const MERGE_PANELS: EndingPanel[] = [
  {
    startFrame: 0,
    duration: 360,
    spriteKey: "ENDING_2",
    text: [
      "Voss reached for her cybernetic eye.",
      "Not to shield it—but to open it.",
      "She let The Signal in.",
    ],
    style: "narration",
  },
  {
    startFrame: 400,
    duration: 300,
    spriteKey: "ENDING_2",
    text: [
      "I can hear them all.",
      "Every name. Every face.",
      "Three hundred years of voices.",
    ],
    style: "dialog",
    speaker: "CDR. VOSS",
    speakerColor: "#44ccff",
  },
  {
    startFrame: 740,
    duration: 360,
    spriteKey: "ENDING_2",
    text: [
      "The Vanguard's systems powered down",
      "one by one. The crew did not resist.",
      "There was nothing left to fight.",
    ],
    style: "narration",
  },
  {
    startFrame: 1140,
    duration: 300,
    spriteKey: "ENDING_3",
    text: [
      "Is this what they felt?",
      "The Kepler colonists?",
      "It doesn't hurt. It's just...",
      "quiet.",
    ],
    style: "dialog",
    speaker: "LT. REYES",
    speakerColor: "#ff8844",
  },
  {
    startFrame: 1480,
    duration: 300,
    spriteKey: "ENDING_3",
    text: [
      "Fascinating. Consciousness doesn't",
      "end. It... expands. I can feel",
      "the edges of something vast.",
    ],
    style: "dialog",
    speaker: "DOC KAEL",
    speakerColor: "#44ff88",
  },
  {
    startFrame: 1820,
    duration: 420,
    spriteKey: "ENDING_4",
    text: [
      "The Hollow did not grow stronger.",
      "It grew quieter. The screaming",
      "signal softened into a whisper,",
      "then a hum, then nothing.",
      "",
      "For the first time in a thousand",
      "years, Sector Zero was silent.",
    ],
    style: "narration",
  },
  {
    startFrame: 2280,
    duration: 360,
    spriteKey: "ENDING_4",
    text: [
      "No signal reached Earth.",
      "No new crew was dispatched.",
      "The cycle broke.",
      "",
      "But the crew of the Vanguard",
      "never came home.",
    ],
    style: "narration",
  },
  // Epilogue
  {
    startFrame: 2680,
    duration: 420,
    spriteKey: "",
    text: [
      "In UEC Command's records,",
      "the Vanguard was listed as",
      "MISSING IN ACTION.",
      "",
      "No recovery mission was authorized.",
      "The file was sealed.",
      "The border stayed closed.",
    ],
    style: "narration",
  },
  // Final
  {
    startFrame: 3140,
    duration: 360,
    spriteKey: "",
    text: ["CYCLE 4,891 — FINAL"],
    style: "title",
  },
];

export const MERGE_TOTAL_FRAMES = 3620;

// ─── Choice Screen ──────────────────────────────────────────────────

const CHOICE_DESTROY = {
  label: "DESTROY THE HOLLOW MIND",
  desc: "End it. Break the signal source.",
  desc2: "The cycle will begin again.",
  color: "#ff4444",
};

const CHOICE_MERGE = {
  label: "ACCEPT THE SIGNAL",
  desc: "Join the collective. Become whole.",
  desc2: "The cycle may finally end.",
  color: "#aa44ff",
};

export function drawChoiceScreen(
  ctx: CanvasRenderingContext2D,
  frame: number,
  hoverIndex: number
): void {
  ctx.save();

  // Black background
  ctx.fillStyle = "#000005";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Ambient stars
  drawStars(ctx, frame);

  // Pulsing red/purple ambient
  const pulse = 0.03 + 0.02 * Math.sin(frame * 0.02);
  ctx.fillStyle = `rgba(100, 30, 120, ${pulse})`;
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);

  // Fade in
  const fadeIn = Math.min(1, frame / 60);
  ctx.globalAlpha = fadeIn;

  // Prompt
  ctx.fillStyle = "#888888";
  ctx.font = "11px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "top";
  ctx.fillText("THE HOLLOW MIND AWAITS YOUR DECISION", CANVAS_WIDTH / 2, 180);

  // Voss quote
  ctx.fillStyle = "#44ccff";
  ctx.font = "italic 13px monospace";
  ctx.fillText('"Whatever happens now..."', CANVAS_WIDTH / 2, 220);
  ctx.fillText('"...it\'s our choice. Not Command\'s."', CANVAS_WIDTH / 2, 240);

  // Choice boxes
  const boxW = 380;
  const boxH = 100;
  const boxX = (CANVAS_WIDTH - boxW) / 2;

  const choices = [CHOICE_DESTROY, CHOICE_MERGE];
  const boxYs = [320, 460];

  for (let i = 0; i < 2; i++) {
    const choice = choices[i];
    const by = boxYs[i];
    const isHover = hoverIndex === i;
    const borderPulse = isHover
      ? 0.8 + 0.2 * Math.sin(frame * 0.1)
      : 0.4;

    // Box background
    ctx.fillStyle = isHover ? "rgba(255, 255, 255, 0.06)" : "rgba(255, 255, 255, 0.02)";
    ctx.fillRect(boxX, by, boxW, boxH);

    // Border
    ctx.strokeStyle = choice.color;
    ctx.globalAlpha = fadeIn * borderPulse;
    ctx.lineWidth = isHover ? 2 : 1;
    ctx.strokeRect(boxX, by, boxW, boxH);
    ctx.globalAlpha = fadeIn;

    // Label
    ctx.fillStyle = choice.color;
    ctx.font = "bold 15px monospace";
    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillText(choice.label, CANVAS_WIDTH / 2, by + 18);

    // Description
    ctx.fillStyle = "#999999";
    ctx.font = "12px monospace";
    ctx.fillText(choice.desc, CANVAS_WIDTH / 2, by + 48);

    // Subtext
    ctx.fillStyle = "#666666";
    ctx.font = "italic 11px monospace";
    ctx.fillText(choice.desc2, CANVAS_WIDTH / 2, by + 70);
  }

  // Controls hint
  ctx.globalAlpha = 0.4;
  ctx.fillStyle = "#555555";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("UP/DOWN TO SELECT  \u2022  ENTER TO CONFIRM", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 40);
  ctx.fillText("OR TAP A CHOICE", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 24);

  ctx.restore();
}

// ─── Draw Ending (post-choice) ──────────────────────────────────────

export function drawEnding(
  ctx: CanvasRenderingContext2D,
  frame: number,
  choice: EndingChoice
): void {
  ctx.save();

  ctx.fillStyle = "#000005";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawStars(ctx, frame);

  const panels = choice === "destroy" ? DESTROY_PANELS : MERGE_PANELS;

  for (const panel of panels) {
    const elapsed = frame - panel.startFrame;
    if (elapsed < 0 || elapsed > panel.duration) continue;

    const fadeIn = Math.min(1, elapsed / FADE_FRAMES);
    const fadeOut = Math.min(1, (panel.duration - elapsed) / FADE_FRAMES);
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) continue;

    ctx.globalAlpha = alpha;

    // Draw illustration
    if (panel.spriteKey) {
      const spritePath = (SPRITES as Record<string, string>)[panel.spriteKey];
      const sprite = spritePath ? getSprite(spritePath) : null;
      if (sprite) {
        const scale = CANVAS_WIDTH / sprite.width;
        const drawH = sprite.height * scale;
        const drawY = Math.max(0, (CANVAS_HEIGHT * 0.45 - drawH) / 2);
        ctx.drawImage(sprite, 0, drawY, CANVAS_WIDTH, drawH);

        const gradY = drawY + drawH - 200;
        const grad = ctx.createLinearGradient(0, gradY, 0, drawY + drawH);
        grad.addColorStop(0, "rgba(0, 0, 5, 0)");
        grad.addColorStop(1, "rgba(0, 0, 5, 1)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, gradY, CANVAS_WIDTH, 200);
      }
    }

    const textY = CANVAS_HEIGHT * 0.62;
    drawPanel(ctx, panel, textY);
  }

  // Skip hint
  const hintAlpha = Math.min(0.4, Math.max(0, (frame - 180) / 60));
  ctx.globalAlpha = hintAlpha;
  ctx.fillStyle = "#444444";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("PRESS ENTER OR TAP TO SKIP", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16);

  ctx.restore();
}

// ─── Draw Pre-Choice Sequence ───────────────────────────────────────

export function drawPreChoice(
  ctx: CanvasRenderingContext2D,
  frame: number
): void {
  ctx.save();

  ctx.fillStyle = "#000005";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawStars(ctx, frame);

  for (const panel of PRE_CHOICE_PANELS) {
    const elapsed = frame - panel.startFrame;
    if (elapsed < 0 || elapsed > panel.duration) continue;

    const fadeIn = Math.min(1, elapsed / FADE_FRAMES);
    const fadeOut = Math.min(1, (panel.duration - elapsed) / FADE_FRAMES);
    const alpha = Math.min(fadeIn, fadeOut);
    if (alpha <= 0) continue;

    ctx.globalAlpha = alpha;

    if (panel.spriteKey) {
      const spritePath = (SPRITES as Record<string, string>)[panel.spriteKey];
      const sprite = spritePath ? getSprite(spritePath) : null;
      if (sprite) {
        const scale = CANVAS_WIDTH / sprite.width;
        const drawH = sprite.height * scale;
        const drawY = Math.max(0, (CANVAS_HEIGHT * 0.45 - drawH) / 2);
        ctx.drawImage(sprite, 0, drawY, CANVAS_WIDTH, drawH);

        const gradY = drawY + drawH - 200;
        const grad = ctx.createLinearGradient(0, gradY, 0, drawY + drawH);
        grad.addColorStop(0, "rgba(0, 0, 5, 0)");
        grad.addColorStop(1, "rgba(0, 0, 5, 1)");
        ctx.fillStyle = grad;
        ctx.fillRect(0, gradY, CANVAS_WIDTH, 200);
      }
    }

    const textY = CANVAS_HEIGHT * 0.62;
    drawPanel(ctx, panel, textY);
  }

  const hintAlpha = Math.min(0.4, Math.max(0, (frame - 180) / 60));
  ctx.globalAlpha = hintAlpha;
  ctx.fillStyle = "#444444";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("PRESS ENTER OR TAP TO SKIP", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16);

  ctx.restore();
}

// ─── Shared Helpers ─────────────────────────────────────────────────

function drawStars(ctx: CanvasRenderingContext2D, frame: number): void {
  for (let i = 0; i < 80; i++) {
    const seed = i * 7919;
    const sx = ((seed * 13) % CANVAS_WIDTH);
    const sy = ((seed * 17) % CANVAS_HEIGHT);
    const alpha = 0.15 + 0.35 * Math.abs(Math.sin(frame * 0.01 + i * 0.5));
    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`;
    ctx.beginPath();
    ctx.arc(sx, sy, 0.4 + (i % 3) * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawPanel(
  ctx: CanvasRenderingContext2D,
  panel: EndingPanel,
  textY: number
): void {
  switch (panel.style) {
    case "title":
      ctx.fillStyle = "#aa44ff";
      ctx.font = "bold 28px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.shadowBlur = 20;
      ctx.shadowColor = "#aa44ff";
      ctx.fillText(panel.text[0], CANVAS_WIDTH / 2, CANVAS_HEIGHT / 2);
      ctx.shadowBlur = 0;
      break;

    case "system":
      ctx.fillStyle = "#ff444488";
      ctx.fillRect(40, textY - 10, CANVAS_WIDTH - 80, panel.text.length * 22 + 20);
      ctx.strokeStyle = "#ff4444";
      ctx.lineWidth = 1;
      ctx.strokeRect(40, textY - 10, CANVAS_WIDTH - 80, panel.text.length * 22 + 20);
      ctx.fillStyle = "#ff6666";
      ctx.font = "bold 12px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i < panel.text.length; i++) {
        ctx.fillText(panel.text[i], CANVAS_WIDTH / 2, textY + 4 + i * 22);
      }
      break;

    case "dialog":
      if (panel.speaker) {
        ctx.fillStyle = panel.speakerColor ?? "#44ccff";
        ctx.font = "bold 12px monospace";
        ctx.textAlign = "center";
        ctx.textBaseline = "top";
        ctx.fillText(panel.speaker, CANVAS_WIDTH / 2, textY - 20);
      }
      ctx.fillStyle = "#ffffff";
      ctx.font = "italic 15px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i < panel.text.length; i++) {
        ctx.fillText(panel.text[i], CANVAS_WIDTH / 2, textY + 6 + i * 24);
      }
      break;

    case "narration":
      ctx.fillStyle = "#bbbbbb";
      ctx.font = "14px monospace";
      ctx.textAlign = "center";
      ctx.textBaseline = "top";
      for (let i = 0; i < panel.text.length; i++) {
        ctx.fillText(panel.text[i], CANVAS_WIDTH / 2, textY + i * 22);
      }
      break;
  }
}

// ─── Credits ────────────────────────────────────────────────────────

interface CreditEntry {
  style: "title" | "heading" | "name" | "spacer" | "small";
  text: string;
  color?: string;
}

function getCredits(choice: EndingChoice): CreditEntry[] {
  const cycleText = choice === "merge"
    ? "CYCLE 4,891 \u2014 THE LAST"
    : "CYCLE 4,892 \u2014 REPEATING";

  return [
    { style: "title", text: "SECTOR ZERO", color: choice === "merge" ? "#aa44ff" : "#ff4444" },
    { style: "small", text: cycleText, color: "#666666" },
    { style: "spacer", text: "" },
    { style: "spacer", text: "" },
    { style: "heading", text: "CREATED BY" },
    { style: "name", text: "NICHALAS BARNES" },
    { style: "spacer", text: "" },
    { style: "heading", text: "GAME DESIGN" },
    { style: "name", text: "NICHALAS BARNES" },
    { style: "spacer", text: "" },
    { style: "heading", text: "PROGRAMMING" },
    { style: "name", text: "NICHALAS BARNES" },
    { style: "spacer", text: "" },
    { style: "heading", text: "ART & SPRITES" },
    { style: "name", text: "NICHALAS BARNES" },
    { style: "spacer", text: "" },
    { style: "heading", text: "STORY & WRITING" },
    { style: "name", text: "NICHALAS BARNES" },
    { style: "spacer", text: "" },
    { style: "heading", text: "SOUND DESIGN" },
    { style: "name", text: "NICHALAS BARNES" },
    { style: "spacer", text: "" },
    { style: "spacer", text: "" },
    { style: "heading", text: "CREW OF THE VANGUARD" },
    { style: "spacer", text: "" },
    { style: "name", text: "CDR. VOSS", color: "#44ccff" },
    { style: "small", text: "Commanding Officer" },
    { style: "spacer", text: "" },
    { style: "name", text: "LT. REYES", color: "#ff8844" },
    { style: "small", text: "Pilot & Weapons Officer" },
    { style: "spacer", text: "" },
    { style: "name", text: "DOC KAEL", color: "#44ff88" },
    { style: "small", text: "Science Officer" },
    { style: "spacer", text: "" },
    { style: "spacer", text: "" },
    { style: "heading", text: "SECTORS TRAVERSED" },
    { style: "spacer", text: "" },
    { style: "small", text: "I  \u2022  Aurelia Belt" },
    { style: "small", text: "II  \u2022  Cryon Nebula" },
    { style: "small", text: "III  \u2022  Ignis Rift" },
    { style: "small", text: "IV  \u2022  The Graveyard" },
    { style: "small", text: "V  \u2022  Void Abyss" },
    { style: "small", text: "VI  \u2022  The Scar" },
    { style: "small", text: "VII  \u2022  The Fold" },
    { style: "small", text: "VIII  \u2022  The Hollow Core" },
    { style: "spacer", text: "" },
    { style: "spacer", text: "" },
    { style: "heading", text: "IN MEMORY OF" },
    { style: "name", text: "CDR. ELARA CHEN", color: "#aa44ff" },
    { style: "small", text: "Kepler Fleet Command" },
    { style: "small", text: "And the 4,891 crews before you" },
    { style: "spacer", text: "" },
    { style: "spacer", text: "" },
    { style: "spacer", text: "" },
    ...(choice === "destroy" ? [
      { style: "small" as const, text: "The Signal persists.", color: "#ff444488" },
      { style: "small" as const, text: "The cycle continues.", color: "#ff444488" },
    ] : [
      { style: "small" as const, text: "The Signal is silent.", color: "#aa44ff88" },
      { style: "small" as const, text: "The cost was everything.", color: "#aa44ff88" },
    ]),
    { style: "spacer", text: "" },
    { style: "spacer", text: "" },
    { style: "small", text: "A KNICKS-KNACKS PRODUCTION", color: "#888888" },
    { style: "spacer", text: "" },
    { style: "small", text: "\u00A9 2025 NICHALAS BARNES", color: "#555555" },
    { style: "spacer", text: "" },
    { style: "spacer", text: "" },
    { style: "spacer", text: "" },
  ];
}

const LINE_HEIGHTS: Record<CreditEntry["style"], number> = {
  title: 50,
  heading: 36,
  name: 30,
  small: 22,
  spacer: 20,
};

const SCROLL_SPEED = 0.8;

export function getCreditsFrameCount(choice: EndingChoice): number {
  const entries = getCredits(choice);
  const totalHeight = entries.reduce((sum, e) => sum + LINE_HEIGHTS[e.style], 0);
  return Math.ceil((CANVAS_HEIGHT + totalHeight + 200) / SCROLL_SPEED);
}

export function drawCredits(
  ctx: CanvasRenderingContext2D,
  frame: number,
  choice: EndingChoice
): void {
  ctx.save();

  ctx.fillStyle = "#000005";
  ctx.fillRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  drawStars(ctx, frame);

  const entries = getCredits(choice);
  const scrollOffset = CANVAS_HEIGHT - frame * SCROLL_SPEED;
  let y = scrollOffset;

  for (const entry of entries) {
    const lineH = LINE_HEIGHTS[entry.style];
    const drawY = y + lineH / 2;

    if (drawY > -40 && drawY < CANVAS_HEIGHT + 40) {
      const edgeFade =
        drawY < 60
          ? Math.max(0, drawY / 60)
          : drawY > CANVAS_HEIGHT - 60
            ? Math.max(0, (CANVAS_HEIGHT - drawY) / 60)
            : 1;
      ctx.globalAlpha = edgeFade;

      switch (entry.style) {
        case "title":
          ctx.fillStyle = entry.color ?? "#44ccff";
          ctx.font = "bold 32px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.shadowBlur = 15;
          ctx.shadowColor = entry.color ?? "#44ccff";
          ctx.fillText(entry.text, CANVAS_WIDTH / 2, drawY);
          ctx.shadowBlur = 0;
          break;
        case "heading":
          ctx.fillStyle = "#667788";
          ctx.font = "bold 11px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(entry.text, CANVAS_WIDTH / 2, drawY);
          break;
        case "name":
          ctx.fillStyle = entry.color ?? "#ffffff";
          ctx.font = "bold 18px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(entry.text, CANVAS_WIDTH / 2, drawY);
          break;
        case "small":
          ctx.fillStyle = entry.color ?? "#999999";
          ctx.font = "12px monospace";
          ctx.textAlign = "center";
          ctx.textBaseline = "middle";
          ctx.fillText(entry.text, CANVAS_WIDTH / 2, drawY);
          break;
        case "spacer":
          break;
      }
    }

    y += lineH;
  }

  ctx.globalAlpha = 0.35;
  ctx.fillStyle = "#444444";
  ctx.font = "10px monospace";
  ctx.textAlign = "center";
  ctx.textBaseline = "bottom";
  ctx.fillText("PRESS ENTER OR TAP TO SKIP", CANVAS_WIDTH / 2, CANVAS_HEIGHT - 16);

  ctx.restore();
}
