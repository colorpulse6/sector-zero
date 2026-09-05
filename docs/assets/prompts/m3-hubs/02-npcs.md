# M3 Hubs — NPC Identity Prompts

Each role is an **identity pair**: one portrait and one FP idle billboard showing the same
person, clothing, equipment, age cues, and silhouette. Generate the portrait first. Lock the
accepted portrait as the canonical reference for every billboard and later walk frame.

Do not generate multiple poses in one image. Do not mirror a selected frame to fake a new
pose. Rejected attempts stay outside the repository; selected full-resolution sources are
committed at their manifest `sourcePath`.

## Shared frontier rules

- These are living humans near the start of the frontier, not Fold-mutated descendants.
- Clothing is repaired industrial workwear, pressure gear, improvised armor, and practical
  role equipment. No clean uniforms, superhero costumes, fantasy robes, or House heraldry.
- Important roles need distinct black silhouettes at 48 px tall.
- Identity must survive changes of framing. Face, age, hair, scars, body build, clothing
  layers, and carried equipment remain stable.
- Visible diversity should arise from people, ages, builds, and lived roles—not arbitrary
  neon clothing. Surface colors remain desaturated; accent color comes from light.

## Portrait base prompt

Append the role brief, then the master positive suffix:

```text
square 512x512 character portrait for a dark science-fiction game dialog interface,
head and upper torso, three-quarter view looking toward the player, exact single subject,
crisp face and role-defining equipment, worn Ashfall frontier workwear, dark simple
industrial background, strong silhouette, directional rim light, no text or border
```

Append the master negative suffix plus:

```text
full body, multiple people, duplicate face, helmet hiding the entire face, cropped head,
cropped chin, UI frame, nameplate, readable badge, mutation, demonic anatomy, fantasy robe,
royal heraldry
```

## Billboard base prompt

Attach the accepted portrait as the identity reference and append:

```text
Create the exact same person from the reference as one full-body first-person raycaster NPC
billboard. Preserve face, age, body build, clothing, equipment, materials, and color accents.
Relaxed but alert idle stance, feet fully visible and grounded at the bottom edge, arms and
gear separated enough to read at 48 pixels tall, centered with generous padding, perfectly
flat solid #00ff00 chroma-key background, no cast shadow, no green in the subject, no text.
Production derivative will be 128x256 transparent PNG.
```

Walk-frame prompts use the same reference and say `one restrained mid-stride pose, frame 1`
or `frame 2`; preserve scale and ground contact. Reject any result whose limb placement,
costume, or face changes identity.

## Cantina roles

### `hub-bartender`

A broad, middle-aged bartender and former ship engineer. One reinforced prosthetic forearm,
heavy rolled sleeves, heat-scarred apron over pressure-workwear, compact tool belt, patient
but unsentimental face. Warm amber key light. The prosthetic and square shoulder line must
remain legible in the billboard silhouette. No cowboy styling, cocktail glamour, or comedy.

### `hub-regular`

An older colony maintenance veteran with a compact build, dust-damaged respiratory collar,
patched insulated jacket, permanently tired posture, and one carefully maintained keepsake
fastened inside the collar. Warm side light with cold shadow. Reads as a person who has kept
the settlement alive for years, not as a soldier or drunk caricature.

### `hub-signal-chaser`

A lean itinerant surveyor obsessed with unexplained signals. Asymmetric sensor headset,
folded antenna pack, layered dust cloak over practical pressure gear, alert sleepless eyes,
one cyan instrument glow. Distinct narrow silhouette with one chunky shoulder-mounted sensor;
no mystical robes, alien mutation, or explicit Fold iconography.

## Marketplace roles

### `hub-arms-dealer`

A stocky former convoy guard turned equipment dealer. Reinforced vest, locked sample case,
one heavy mechanical shoulder brace, scarred face, and controlled skeptical expression.
Cold task light with a small amber reflection. The role reads from security posture and gear,
not from holding a gun at the player.

### `hub-provisioner`

A practical logistics specialist in layered cargo-handling gear. Compact inventory scanner,
thick gloves, modular pouches, dust scarf, attentive eyes, and a balanced load-bearing
silhouette. Slight cyan scanner light. Avoid shopkeeper stereotypes, aprons, bright trade
colors, or floating merchandise.

### `hub-contract-broker`

A precise, difficult-to-read operations broker who converts local needs into located jobs.
Long armored coat over utilitarian workwear, wrist data slate, one damaged optical implant,
careful posture, restrained cyan data light. The silhouette should feel administrative and
dangerous without becoming a spy cliché. No briefcase, sunglasses, or readable contract.

## Town Hall roles

### `hub-governor`

A frontier governor selected from the people rather than a ceremonial ruler. Mature,
weathered face; repaired command coat over pressure workwear; compact emergency respirator;
one old Earth-service pin rendered as an abstract metal shape with no logo. Calm, burdened,
direct gaze. Severe cyan-white key with faint warm fill. No cape, crown, medals, or heraldry.

### `hub-civic-clerk`

A younger civic systems clerk who manages petitions, archives, and absent-colony reports.
Practical layered uniform, portable archive module, tired but focused expression, reinforced
gloves, one cyan record-display light. The silhouette needs a chunky side-mounted archive
case. No office suit, paper stack, comedy bureaucracy, or readable badge.

## Identity-pair rejection rules

Reject the pair when:

- portrait and billboard could be two different people;
- body build, age, skin tone, hair, scars, clothing, or equipment changes materially;
- the billboard has halo fog, a ground rectangle, cropped feet, or green spill;
- the role reads only from tiny details lost at 48 px;
- the person looks clean, wealthy, royal, or late-Fold;
- a pose introduces a weapon aimed at the player unless the gameplay role requires it;
- the portrait contains UI chrome, text, a nameplate, or watermarks.

Record accepted output identifiers, reference inputs, matte method, exact dimensions, and
rejection reasons in the matching review folder. `not exposed` is the correct seed entry when
the generation surface does not expose a seed.
