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
5. **A map that prints no MarsBot board BORROWS one** — Hollandia's profile names `borrowedBoard: THARSIS` (the A&M
   module's own rule): the generator's base is the lender (`matBase` → `fallback: true`, named in the briefing), the row
   library, the balance band and the legacy differential count PRINTED boards only (`borrowedBoard === undefined`). A
   map with no profile at all takes Tharsis the same way and is REJECTED by the creator (`AUTOMA_SUPPORTED_BOARDS`).
5a. **The generator's input is the set, the map and the options — never the deal**: the deck mix is the game's card set
   (`GameCards`), not the piles after the hands were dealt; the set's own draw reads the game's seeded stream.
5b. **«No jump» binds a single-track milestone** (`track`, «the higher of two») — the shape the six official boards keep
   it for; a «weakest of several tracks» milestone is outside it, as the official boards print it (guard
   `tests/automa/ma/botMAReview.spec.ts` § scope). **The briefing states what the MAT plays** (`mat.placement`), never
   a rule's declared form.
5c. **A map with LONGER parameters prints an EXTENDED board, and the law knows the format** (Amazonis Planitia,
   2026-11-07 — `docs/claude/amazonis-planitia-marsbot.md`): 25-cell rows = the law's 19-cell BODY (`matLaw.matBody`,
   memoized — the assembly cache compares rows by identity) + the map's LATE RESERVE (`matTail`, its own law
   `tailViolations`: no empty cell, opens with `advance`, ends on a TR). The row library holds BODIES; the generator
   assembles the body and hands the reserve back by row index; the distance is measured against the PRINTED row; a
   map's Venus row comes from `MarsBotMapProfile.venusTrackFor` (the mat's Microbe track). `matViolations` rejects a
   mixed-format mat. The module's colony cubes a printed row needs are PRINTED on the body (`colony5`) exactly where the
   generator would repair them — the golden test demands zero repairs.
6. **The client re-derives nothing**: the rule lines, the threshold marks, the tokens and the briefing ride
   `MarsBotModel` (`maRules` · `thresholds` · `tokens` · `briefing`), messages with STRING params translated client-side.
