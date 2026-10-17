# TR70 · Backroom Deal («Закулисная сделка») — the party waiver + the discount for a rating; the iteration «ПЛАНЕТА ПОКАЗЫВАЕТ»

Red EVENT, cost 2, no tag, no requirement: **«Ignore any party requirements on the next card you play this generation. It will also cost you 10 less M€. Lose 1 TR.»** The one-play class's (TR49, `docs/TURMOIL_REDUX_CUTTING_EDGE_DESIGN.md`) first card arming TWO effects at once, and the class's FOURTH kind — the PARTY waiver. The card is ≈ 15 % of the prompt; the rest is the iteration «ПЛАНЕТА ПОКАЗЫВАЕТ» (§ 4) — contract `docs/claude/console/terraformed-scene.md`. Prompt: `docs/claude/prompts/project-tr70-backroom-deal.md`; ledger section BE; e2e `console-backroom-deal` (fhd + tv4k), `console-terraformed-scene` (A–I).

## 0. The owner's decisions (defaults confirmed in the report; 5, 6, 7, 8 in the batch)

1. **RU name** — «Закулисная сделка». 2. **Lore** — EN verbatim (key `TR70`), RU «„Сговор“? Как грубо. Мы предпочитаем называть это „межпартийным сотрудничеством“.» 3. **Art** — imported (skynesher). 4. **The struck party plate** — (а) ONE render element «party requirement, waived»: `partyRequirement({cancelled: true})` → `pprq--waived` (the «any party» emblem in the MIN plate + the class's red diagonal), reusable by the next cards. 5–11 — the scene (§ 4 and the contract).

## 1. Rules (every one a case of `tests/cards/turmoilRedux/BackroomDeal.spec.ts`, 22 passing)

1. The play loses 1 TR — logged («lost 1 TR»), never taxed by the Reds (a LOSS is not a raise).
2. Arms BOTH effects on `lastCardPlayed`: `armedPlayEffectsOf` → `[{kind: 'partyWaiver'}, {kind: 'discount', amount: 10}]`.
3. The next card with a PARTY requirement (Martian Census — Mars First) is playable with the party out of office and 0 delegates; the party's EFFECT is never granted (`PartyRequirement.satisfies` meets a waived requirement BEFORE the Parliament is asked — `IPlayer.partyRequirementWaiver()` read by ONE function, `ICard.waivesPartyRequirements`).
4. A GLOBAL requirement is NEVER lifted (Lake Marineris at −30 °C stays refused; `requirementEasingOf` returns nothing of the global kind); a tag requirement, the chairman (Party Sanctions) — untouched.
5. The discount: 10, floored at 0 (Martian Census 6 → 0), spent by a cheap card too; a standard project spends nothing; the pass extinguishes both.
6. TR70 over TR49 — a replacement (one armed card at a time, the last played).
7. The journal carries both events of the next play: `requirement-eased` with the PARTY on the fact («… ignored the party requirement of … thanks to …») and the discount (Indentured Workers' own declaration).
8. The model: `armedPlayEffects` carries both; `requirementEasing` on the party card reads the party family — the party named, the delegates road as its numbers, always `waived`, `decisive` iff the raw check fails.
9. Save / load keeps both armed effects (`lastCardPlayed`).
10. The preview is pure; an event has no action to be futile.
11. The face prints one row: `next card: [party plate ×] [−10 M€] … [TR −1]` (TEXT · PARTY_REQUIREMENT cancelled · MEGACREDITS −10 · TR −1).

## 2. Server — the fourth kind

- `src/common/cards/Types.ts` — `PartyRequirementWaiver {nextCardOnly}`; `ICard.partyRequirementWaiver?` + `Card.waivesPartyRequirements(player)` (declared ∧ (¬nextCardOnly ∨ lastCardPlayed === this)); `Player.partyRequirementWaiver()` over the tableau + the removed-from-play cards.
- `PartyRequirement.satisfies` — the waiver FIRST; `models/requirementEasing.ts` — the `PartyRequirement` branch (party, printed = `standing.required ?? PARTY_EFFECT_DELEGATES`, current = the delegates, effective `waived`, decisive = ¬metRaw); `cards/armedPlayEffects.ts` — `partyWaiver` between the global bonus and the discounts; `Player.recordRequirementEasing` — the party line when every requirement is a party's.
- **The rating LOSS is always written** — `Executor` logs every `tr: -N` (`decreaseTerraformRating(…, {log: true})`; Pristar's and Terralabs' opening included); a bare corporation spec instantiates a player with no game, so the log asks `this.game?.` like the recorder beside it.

## 3. Client — every switch of the kind

`requirementEasingText.ts` (`partyWaived` / `partyBound` / `partyRequirement`, `easingSubjectLabel`, `armedEffectStruckKind`), `armedEffectFlight.ts` (the arm glyph), `effectForecastModel.ts` (`partyWaive`), the strip / chip / flight token / section / the composer's arms (`ConsoleArmedEffects*`, `ConsolePlayCardConfirm`), the forecast's modifier chip and R3 tile, the hand plate (`handEasingPlate` — the party's EMBLEM), the composer's requirement row (`composerRequirementRow` — «your delegates on the resolution of that party: N of M»), the journal's eased row (`journalEventChild` + `JournalChildRow` — `easedEmblemStyle`), the premium face (`premiumCardIcons` `{kind: 'partyRequirement', waived: true}` on `item.cancelled`, `PremiumMechNode` `pprq--waived`, `premium_card.less` the diagonal). **The price flies** (rule 9 / PL-104): `consoleActionCommit.spendLinkSpecs` turns a `cost tr` chip into a loss off the RATING cell (`RATING_RAIL_KEY`) into the printed TR disc (`consoleActionCommitMotion` — the needle `tr`); `withoutChainRows` nets the rating row only where the known moves counted it.

## 4. The iteration «ПЛАНЕТА ПОКАЗЫВАЕТ» — the ceremony plays on the real planet

The diagnosis (the owner's 4K walk, 2026-10-17): the game's biggest event was a SURROGATE — a 600 px CSS globe with three lines of text painted over whatever the player was doing (a received card, the dossier, the hand album) for 6.7 s, hiding nothing and knowing nothing about the real planet below. The owner's accent: «wherever the player is, take them to the PLANET ITSELF; the interface steps aside, the planet comes into focus and SHOWS the ceremony; the text is readable from the couch; it is short; and the player returns exactly where they were.»

What ships (contract, tacts, holds, gotchas: `docs/claude/console/terraformed-scene.md`; law: `.claude/rules/console-ui.md` § A CEREMONY PLAYS ON THE REAL OBJECT):
- ONE object — the real Mars in the central opening; ONE phrase: ARMED (the server's word, the scales' last step held in the park) → RECEDE (opacity; a section on the board's slot hands the slot to the board under its own fade) → FOCUS (the Planet Focus camera in its `ceremony` mode — the instrument frame = the disc with its ARCS; only the off-Mars flanks recede) → SHOW (the park releases ON the focused stage: markers glide to their maximum, the HUD flips to 100 % / gold; the atmosphere breathes on the real disc; the `terra` burst; the title plate under the disc) → RETURN (the camera exits to the pixel it left from, the surfaces return into the SAME pose).
- Measured (4K, CPU renderer, `screenshots/tr70/tv4k-after/scene-samples.jsonl`): recede → the surfaces back 4.3–4.5 s (the brief's ≤ 4.5 s); reduced motion 0.67 s; the stage's box ONE box through every state; the title 38 / 88 / 42 px at 4K (floor 32); the dossier and the album return in the same snapshot (B / C); the reload replays nothing (I).
- Deleted: `ConsoleTerraformingCeremony.vue` + its spec; `consoleLeakDetector` lists `.con-terraformed`; `NotificationLayer` keeps suppressing the desktop card; `ConsoleStatusStrip` pulses off the scene's `showNonce` (tact 3), never a second nonce.

### Open for the owner (the batch)
- **Decision 10 — the title plate vs the ocean arc's foot.** With the arcs on the stage the plate UNDER the disc covers the foot of the ocean track (its «9» marker peeks past the plate's right edge). Mockups over the live focus (`screenshots/tr70/tv4k-mockups/`): M1 — two lines under the disc (the kicker dropped; clears the arc), M2 — the arcs stay + the title as a caption in the zone the player rail vacated, M3 — the disc only (the placement's fit, ×1.28, the arcs recede) + the caption left. As built = three lines under the disc (`tv4k-after/s1-board-03.png`).
- **A section on the board's slot** (the hand / the colonies / the hydro): the scene fades it by opacity, then flips the slot to the board (`display` under opacity 0 — the one `display` flip of the scene, documented against the rule; the restore is identical by the album's own fit) — the alternative (an absolute box) re-fits the album twice.
- **A reveal the player never takes**: the ARMED wait is bounded (20 s) and the scene then plays over the receded reveal — the park's own 30 s net stays above it. While the wait is on cinematics only, the scene HOLDS the foreground from its arm (the finale's announce waits for the planet — PL-660); a standing reveal lowers the hold (the player's press must pass).
