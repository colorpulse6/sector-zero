# Cinematic opening key art and display font

Date: 2026-09-06. Prepared for the user-approved cinematic opening/site design.

## Key art

The built-in image generator produced one clean backdrop using the approved concept as a visual reference. It is illustrative space key art, not a screenshot or a claim about gameplay graphics. No buttons, text, borders or UI are baked into it.

Final asset: 1672 × 941 WebP, 103,554 bytes. Both copies have identical bytes:

- `game/public/images/ui/sector-zero-key-art.webp`
- `site/public/images/backgrounds/sector-zero-key-art.webp`

Source retained locally: `/Users/nichalasbarnes/.codex/generated_images/01a07127-3e6a-7ae1-b54b-436d683ef1c1/exec-79385b42-d5a3-441f-a3aa-f49142819684.png`.
Reference: `/Users/nichalasbarnes/.codex/generated_images/01a07127-3e6a-7ae1-b54b-436d683ef1c1/exec-822f0cd0-134b-40dc-99fc-5a41be657374.png`.

Prompt: one wide cinematic landscape background, charcoal/deep-navy space, a huge terrestrial alien planet limb entering from the right with a fine icy-blue atmosphere, one small angular dark fighter with subtle cyan engine trails in the right third, and quiet dark negative space over the left half. Match the approved reference's elegant mood and silhouette. No text, controls, mockup panels, explosions, logos or fake gameplay screenshots. CSS provides responsive cropping; working UI is native code.

Converted to WebP at quality 88 / effort 6 with the installed Sharp encoder, without resizing, compositing or visual edits. The original generated source is preserved. CSS must retain a static fallback and respect reduced motion.

## Display type

Orbitron variable font is self-hosted from the Google Fonts repository under the SIL Open Font License; the complete license is distributed beside each copy. Use it only for the cinematic wordmark/display accents; retain readable body typography and the existing gameplay font. No remote font request is required for Orbitron.

## Provenance and hashes

```json
{
  "Orbitron-Variable.ttf": {
    "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/orbitron/Orbitron%5Bwght%5D.ttf",
    "bytes": 38576,
    "sha256": "f42db2dd16e642258e35782916eceb1dcdbea06fb958d77ad71dc5963587e8fd"
  },
  "OFL-Orbitron.txt": {
    "url": "https://raw.githubusercontent.com/google/fonts/main/ofl/orbitron/OFL.txt",
    "bytes": 4426,
    "sha256": "ab609b0e110d622435ff337cdf233288556e011bbf9bd0550be98846c0630819"
  },
  "key-art": {
    "bytes": 103554,
    "sha256": "dbd0b8bd047d9aa577d6d473aaca4e910802506b24734ceeb7b831cfaeac73f1"
  }
}
```
