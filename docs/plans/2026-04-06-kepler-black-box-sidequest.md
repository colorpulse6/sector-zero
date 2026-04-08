# Kepler Black Box Sidequest Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a World 4 first-person sidequest that unlocks after `4-2`, can launch immediately from a Reyes prompt, stays replayable from the Mission Board, and awards a unique black box quest item exactly once.

**Architecture:** Add a small replayable mission layer parallel to planet missions rather than forcing the sidequest through the planet-mission objective system. Persist unlock/completion/item state in save data, expose the mission through the cockpit Mission Board, and create a dedicated first-person mission definition with placeholder objective handling.

**Tech Stack:** Next.js 15, TypeScript, existing Sector Zero canvas engine, local save-data persistence, existing cockpit/mission/codex systems.

---

### Task 1: Add persistence for the sidequest and black box

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/types.ts`
- Modify: `games/sector-zero/web/app/components/engine/save.ts`
- Test: `games/sector-zero/web/app/components/engine/save.ts`

- [ ] **Step 1: Write the failing self-tests**

Add dev self-tests that assert migrated saves receive default sidequest fields and that unique story-item fields survive migration.

- [ ] **Step 2: Run build/self-test path to verify failure**

Run: `cd games/sector-zero/web && yarn build`
Expected: build or self-tests fail because new save fields/helpers do not exist yet.

- [ ] **Step 3: Implement minimal persistence**

Add save fields for:
- unlocked replayable side missions
- completed replayable side missions
- unique story items / recovered black box flags
- one-time post-`4-2` prompt tracking

- [ ] **Step 4: Run build to verify green**

Run: `cd games/sector-zero/web && yarn build`
Expected: build passes with new save schema and migration.

### Task 2: Define the replayable mission and first-person map content

**Files:**
- Create: `games/sector-zero/web/app/components/engine/specialMissions.ts`
- Create: `games/sector-zero/web/app/components/engine/keplerBlackBoxMission.ts`
- Modify: `games/sector-zero/web/app/components/engine/types.ts`
- Test: `games/sector-zero/web/app/components/engine/keplerBlackBoxMission.ts`

- [ ] **Step 1: Write failing self-tests for mission definition helpers**

Add tests asserting:
- mission unlock condition keys are stable
- black-box mission map contains one spawn and one objective
- replay mode removes the black box objective pickup

- [ ] **Step 2: Run build to verify failure**

Run: `cd games/sector-zero/web && yarn build`
Expected: failure because mission definition/helpers do not exist yet.

- [ ] **Step 3: Implement minimal mission definition layer**

Create a narrow mission-definition module for replayable special missions with one initial mission:
- `kepler-black-box`
- world affinity: 4
- offered by Reyes
- launchable in `first-person`

Create a dedicated ASCII wreck map and enemy placement module with placeholder black-box objective metadata.

- [ ] **Step 4: Run build to verify green**

Run: `cd games/sector-zero/web && yarn build`
Expected: build passes with mission definition and content modules.

### Task 3: Add launch flow for immediate prompt and replayable mission entry

**Files:**
- Modify: `games/sector-zero/web/app/components/Game.tsx`
- Modify: `games/sector-zero/web/app/components/engine/cockpit.ts`
- Modify: `games/sector-zero/web/app/components/engine/cockpitRenderer.ts`
- Modify: `games/sector-zero/web/app/components/engine/types.ts`
- Test: `games/sector-zero/web/app/components/engine/cockpit.ts`

- [ ] **Step 1: Write failing self-tests for mission availability / prompt logic**

Add tests for:
- mission appears after `4-2` unlock
- mission remains available after declining prompt
- mission remains replayable after completion

- [ ] **Step 2: Run build to verify failure**

Run: `cd games/sector-zero/web && yarn build`
Expected: failure because launch action types and availability helpers are missing.

- [ ] **Step 3: Implement minimal launch path**

Add:
- a dedicated cockpit action for launching replayable missions
- a Mission Board presentation for the new sidequest
- immediate post-`4-2` Reyes prompt UI in `Game.tsx`
- launch handlers for accept / return behavior

- [ ] **Step 4: Run build to verify green**

Run: `cd games/sector-zero/web && yarn build`
Expected: build passes with prompt and Mission Board launch flow.

### Task 4: Wire the first-person mission objective and unique black-box reward

**Files:**
- Modify: `games/sector-zero/web/app/components/engine/firstPersonEngine.ts`
- Modify: `games/sector-zero/web/app/components/engine/firstPersonRenderer.ts`
- Modify: `games/sector-zero/web/app/components/Game.tsx`
- Modify: `games/sector-zero/web/app/components/engine/codex.ts`
- Test: `games/sector-zero/web/app/components/engine/firstPersonEngine.ts`

- [ ] **Step 1: Write failing self-tests for objective pickup / replay suppression**

Add tests that assert:
- the black box objective can be collected on first clear
- collection marks mission complete
- replay state suppresses the pickup/objective reward

- [ ] **Step 2: Run build to verify failure**

Run: `cd games/sector-zero/web && yarn build`
Expected: failure because objective state and reward wiring do not exist yet.

- [ ] **Step 3: Implement minimal objective handling**

Add:
- placeholder black-box pickup detection in first-person mode
- mission completion on pickup
- unique save-state reward updates
- codex / hub unlock hooks tied to first recovery

- [ ] **Step 4: Run build to verify green**

Run: `cd games/sector-zero/web && yarn build`
Expected: build passes with objective collection and unique reward persistence.

### Task 5: End-to-end verification

**Files:**
- Modify: `games/sector-zero/web/app/components/Game.tsx` (only if verification exposes issues)

- [ ] **Step 1: Run full verification**

Run: `cd games/sector-zero/web && yarn build`
Expected: exit code 0.

- [ ] **Step 2: Manual checklist**

Verify in-game:
- clear `4-2`
- Reyes prompt appears once
- accept launches mission immediately
- decline leaves mission selectable later
- mission is replayable from Mission Board
- black box is only present before first recovery
- black box recovery unlocks story content

- [ ] **Step 3: Record remaining gaps**

Document any non-blocking follow-up items:
- custom black-box sprite
- richer hub inspection UI
- more advanced wreck-map art dressing
