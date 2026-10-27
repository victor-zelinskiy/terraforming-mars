# TR82 Proteus — the fifth new corporation of Turmoil Redux (2026-10-27)

«You start with 45 M€ and 2 data resources on this card. EFFECT: after you play a non-wild tag that matches a non-wild
tag on your Preludes, add 1 data resource to this card (your Preludes count). ACTION: spend 6 data from here to place a
colony or ocean tile.» Wild tag, a data holder, no VP, no first action. Card `src/server/cards/turmoilRedux/Proteus.ts`,
spec `tests/cards/turmoilRedux/Proteus.spec.ts`, art `assets/card-images/TR82.webp`, lore `TR82` (EN + RU — printed on
the scan), registry row `common/cards/turmoilReduxCorporations.ts` (`authored`). The scan's left edge prints the Prelude
(«<») and Colonies («▲») marks: the manifest entry is `compatibility: ['prelude', 'colonies']` — without Preludes the
effect is dead, without Colonies half the action.

## 1. The rule — ONE match predicate

`matchingPreludeTags(player, card)` (exported from the card file) is the ONE reading of «a played tag that matches a tag
on your Preludes», read by the live hook and the forecast twin alike — never a second copy on the client, in a preview or
in a text:

- the PRINTED non-wild tags of the played card, duplicates kept (Research's two Science tags are two matches);
- each one present among the non-wild tags of the owner's OTHER played Preludes — the played card is already in
  `playedCards` when `Player.onCardPlayed` fans out, so a Prelude never matches itself (the owner's decision 1, (a));
- `Tag.WILD` matches nothing on either side (Research Network's wild tag pays nothing, the corporation's own play pays
  nothing);
- the letter of the print is compared — never `Tags.cardTagCount`, which reads MARS as SCIENCE under Habitat Marte.

«Your Preludes count»: a Prelude's own play is a play of its tags, so the SECOND Prelude whose tag matches the first pays
and the first pays nothing (the pool is empty without itself). An event's tags count (they are played). The data land at
once — `addResourceTo(this, {qty: N, log: true})` — one call under the corporation's own `card-played` scope, so ONE
reaction record for the play (`EventRecorder.recordReaction` — the framework's scene comes for free).

## 2. The forecast twin — one fact per matching tag

`cardPlayedForecast` maps the same predicate to ONE `exact` fact per matching tag (the T06 convention — GMO Contract):
`id: proteus-<i>`, `reasonTag: <tag>`, the reason the existing `tagReason(tag)` («Вы играете карту с меткой …» — no new
key), `printedEffect: 0` (the effect row of `corpBox('effect-action')`), the gain `cardGain(this, 1)`. The «Сработает» row
merges them into «+N [data]» (one pool, one address); a play that matches nothing forecasts NOTHING (not a `no` fact).
Timing is the default `immediate` — the hook is synchronous like Arklight's; the prompt's `AFTER_CARD` would have
described a deferred hook this card does not have. Parity: a block of its own in `effectForecastParity.spec`
(`PRELUDE_TAG_REACTORS` — Biolab seated, Research played: two facts, the `card-played` event).

## 3. The action — declarative, the branches are outcome tiles

`action: {spend: {resourcesHere: 6}, or: {behaviors: [{title: 'Place a colony', colonies: {buildColony: {}}},
{title: 'Place an ocean tile', ocean: {}}]}}` on an `ActiveCorporationCard` — no bespoke `canAct` / `action`:

- below 6 data the engine's own refusal (`resourcesHereShort` — «N of 6 data on this card»);
- the colony branch is refused with no colony to build on (`getPlayableColonies`) — its tile DISABLED with its reason
  (invariant 2), never hidden;
- the ocean branch stays EXECUTABLE at the ninth ocean (`maxoceans` warning) and carries the futility verdict
  `parameter-maxed` on its tile; with the colony refused too the whole action carries the verdict and stays available —
  the player may spend a turn (`futile-actions` §1; the owner's decision 4, (a));
- both live → ONE `OrOptions` marked `effect-choice`, never auto-selected; the spend leaves first (synchronous, before the
  deferred choice).

Proteus is the FIRST card ACTION in scope whose branch builds a colony. The preview announces the branch's colony pick as
a `boardPlacement` of `placementType: 'colony'` (`actionPreview.ts`), and the prompt-coverage walk now knows that this
announces a live `colony` prompt (`actionPromptCoverage.spec` § `namedCovers`).

## 4. The start flow — the queue's Prelude is a forecast DOOR

The deployment queue's focused Prelude reads «Сработает» on the ceremony status rail (`[data-start-prelude-forecast]`,
the shared `ConsoleForecastRow`) off the forecast the start scene already fetched with the play preview
(`prefetchPlayRewards` → `playForecasts`, version-scoped). R3 opens the SAME «Эффекты» layer of host `'start'` the first
action's briefing opens (`startForecast` = the briefing's forecast while it stands, else the queue's; one layer, one
room `.con-start__fxhost`); the crumb gains «· ЭФФЕКТЫ» after the stage it stood on (`startFxStage`); the queue parks
under the layer (`con-start--queuefx`, opacity); the bar advertises R3 (`consoleStartUi.queueEffects`). The door closes
the moment it can no longer open (`startForecastCanOpen` watcher → `foldForecastHost('start')`).

## 5. The start shelf — the reactor rises IN ITS SLOT, into its own capsule

The owner's decision 3 asked for `startFirstActionRail` to be generalized into a `startPlayRail` hosting the Preludes.
The framework had already moved under it: iteration 3 («ONE PLACE», `reactorPlaces.ts`) lifts ANY visible painted face
carrying `data-played-key` IN ITS PLACE, and the start shelf's top slot of the corporation family carries exactly that
hook (`ConsoleStartPlayedDock`, `.con-splayed__top[data-played-key]`). So a Prelude's reaction needs no second rail
module: the framework's chain finds Proteus lying on «РАЗЫГРАНО», lifts that face (transform only), births the data on its
printed effect row. What was missing was the END:

- the shelf's top face of a HOLDER now wears its LIVE model (`capsuleModelOf` — the seat's `seatCapsuleModel` phrase: the
  committed count minus what is still in the air, `heldCardCapsule`), so its capsule is a counter that ticks on the
  touchdown;
- the transfer ladder lands a card-resource token on that capsule first
  (`.con-start__played [data-played-key] .pcard__res`, before the face);
- the e2e witness reads a lifted shelf face as the reactor (`transferWitness.ts`);
- the deployment does not settle while the chain plays (`deploymentSettled` ⇐ `reactionStage.phase === 'idle'`, PL-1093):
  the last Prelude closed the start before the table answered, and the answer rose at the stage into the satellite.

Measured on the box (`console-proteus` A, tv4k): the Prelude's own plates first (6 M€ · steel · energy off the landed
card), then ONE data token born on Proteus' printed data on the shelf (`reactor:Proteus:data`), landing on its own face
(`played:Proteus`), the capsule 2 → 3 on the touchdown, the lift before it.

`startFirstActionRail` stays the first action's own (its cause is a rating the rail half flies off the printed plates —
a Prelude play's rating rides the played hero's rail). Whether the owner still wants the rise ATTACHED to the hero's
rail half rather than the framework's chain is in the report's question (decision 3).

## 6. What the next corporation that answers a Prelude inherits

The predicate in its file (the T06 one-fact-per-tag twin), `compatibility` with the second module the effect needs, and
nothing else: the queue's door reads the play preview's forecast, the shelf's top slot is a reactor place with a live
capsule.

## 7. Tests and stands

Server: `Proteus.spec` (rules 0–6), `effectForecastParity` § prelude-tag plays, `actionPromptCoverage` (the colony
branch), the manifest / deck / information guards. e2e (the Steam Machine, TIMING): `console-proteus` — A the real start
flow (the second Prelude's row, R3, the rise on the shelf, 2 → 3 in the capsule), B a Building card from the hand and
then the colony branch (`proteus` fixture), C the futile tiles (`proteus-futile`).
