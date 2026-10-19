# Ashfall recovery implementation plan

Owner: Codex, implementing directly. Fable independently owns fighter presentation.

Goal: repeatable, persistent salvage work removes Ashfall's failure dead end and early waiting grind.
Architecture: a separate galaxy command module uses the existing strict save store and world-cycle projection. A compact management panel invokes a rendered quote. No save schema change or shared economy rebalance.
Tech: TypeScript, React, Node test runner, Playwright.

- [x] Add failing command/route tests in `game/tests/colony/galaxySalvage.test.ts`: free entry, one-cycle reward, repeat/stale rejection, save errors, access/operation locks, legacy isolation, zero-stock settlement within 25 shifts.
- [x] Implement `game/app/components/engine/galaxy/galaxySalvage.ts` using canonical validation, cycle advancement, and an atomic-to-the-existing-store write.
- [x] Add `GalaxySalvagePanel.tsx`, wire its quote/handler in `Game.tsx` and `GalaxyColonyManagementScreen.tsx`, and update time guidance.
- [x] Add real browser routes for fresh-save recovery, building/growth, reload and stale storage; preserve the user's save by using isolated test profiles.
- [x] Run focused tests and typecheck, build the static game, run affected browser routes and inspect captures. Broaden engine/colony tests once before handoff.
- [x] Record measured shift counts, remaining trade/acceptance boundaries and release state in the roadmap/handoff. Fable changes remain a separate pending review; retain that environment until review and integration are complete.
