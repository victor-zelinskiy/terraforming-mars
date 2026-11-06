---
description: MarsBot × milestones and awards — the bot-rule registry, the mat generator, the threshold law.
paths:
  - "src/server/automa/ma/**"
  - "src/server/automa/AutomaMAEvaluation.ts"
  - "src/server/automa/AutomaMilestonesAwards.ts"
  - "src/server/automa/AutomaBonusCards.ts"
  - "src/server/automa/AutomaAres.ts"
  - "tests/automa/ma/**"
---

# MarsBot × milestones and awards

Full write-up: `docs/claude/marsbot-dynamic-ma-framework.md` (architecture + decisions R1–R10); data and the band:
`docs/AUTOMA_DATA_AUDIT.md` §22; history: `docs/claude/marsbot-dynamic-ma-progress.md`.

1. **The registry is the ONE place a name's bot rule lives** — `ma/botMARules.ts`, one declarative row per milestone /
   award: criterion, target, Corporate Competition helper, placement bias, provenance. ONE interpreter
   (`botMAInterpreter.ts`) reads it for the claim, the award score, the helper, the face text (`botMADescribe.ts`),
   the threshold marks and the briefing (`botMABriefing.ts`). A predicate outside the row (a `switch` on the name, a
   second copy in a card or the Board) is a second instance of the rule — forbidden.
2. **A new name = a registry row + a spec**; the coverage guard (`tests/automa/ma/botMARegistry.spec.ts`) fails with the
   list of names missing a row. Every row carries `provenance` — the rulebook source, or `home` + the official analog
   + the law it follows. `zero` is the ONE honest zero (Entrepreneur); a new zero needs the owner.
3. **The threshold never moves** (R3): the bot's target is the player's, a constant of the name. Balance only through
   the mat's composition, and the «no jump» law (a cell sits at `target − 1`, never an `advance` across the target).
4. **The generator is deterministic** — the same set, map and options give the same mat (no randomness, cached per base
   × topology). The ten printed boards are untouched (R1): a mat is generated ONLY when `randomMA ≠ NONE`. A change to
   the generator's output bumps `MAT_GENERATOR_VERSION`; a saved mat is replayed whole (`AutomaState.mat`), never
   regenerated. Gates: the static validator (`matValidator.spec.ts`), the golden test (the ten official rows
   re-assembled — topology identical), the band bench (`MarsBotRandomSetBalance.dev.spec.ts`).
5. **A map without a profile** falls back to the Tharsis base (`MatReport.baseIsFallback`, named in the briefing); it
   is still REJECTED by the creator until it has its own profile (`AUTOMA_SUPPORTED_BOARDS`).
6. **The client re-derives nothing**: the rule lines, the threshold marks, the tokens and the briefing ride
   `MarsBotModel` (`maRules` · `thresholds` · `tokens` · `briefing`), messages with STRING params translated client-side.
