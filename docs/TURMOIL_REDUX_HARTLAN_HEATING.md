# TR80 Hartlan Heating — the third new corporation of Turmoil Redux (2026-10-26)

«You start with 48 M€ and 2 heat production. EFFECT: after you play a GREEN project card that PLACES A TILE, gain
6 heat and increase your M€ production 1 step. ACTION: pay 12 heat to draw 2 cards.» Space + Building tags, no
VP, no first action. Card `src/server/cards/turmoilRedux/HartlanHeating.ts`, spec
`tests/cards/turmoilRedux/HartlanHeating.spec.ts`, art `assets/card-images/TR80.webp`, lore `TR80` (EN + RU —
printed on the scan), registry row `common/cards/turmoilReduxCorporations.ts` (`authored`).

## 1. The ONE predicate — `cards/cardPlacesTile.ts`

«A card that places a tile» is a PRINTED CLASS of the card, never a fact of the board: a declarative
`behavior.tile / city / greenery / ocean` (the Moon's tiles stated honestly), or the co-located `placesTile: true`
a bespoke placement declares beside its `bespokePlay` (Noctis City, Urbanized Area, the mining cards, Lava Tube
Settlement, Great Dam, Kaguya Tech, Solar Farm, TR21 Arboretum, TR22 Nova City, Sponsored Settlement; whatever
the colour — Immigrant City, Ecological Zone, Industrial Center, Flooding, Boom Town, Administration District,
Frontier Town). A card that only MOVES a tile (TR14, TR39) is not of the class. The owner's decision 1: the
ocean card played at the ninth ocean still pays — the class, not «a tile really landed»; a two-tile card pays
ONCE (per card). The guard `tests/cards/greenTilePlacers.spec.ts` walks every playable card of the premium scope
and demands the predicate ⇔ the play preview's placing step (a reserved off-Mars city and a colony-pick city
count; a tile move does not) — a bespoke card that forgets its flag fails by name.

## 2. The hook and its twin (the Point Luna / Tharsis family)

`onCardPlayed(player, card)`: `card.type === AUTOMATED && cardPlacesTile(card)` → `GainResourcesDeferred(HEAT,
6)` + `GainProduction(M€, 1)` (both at `GAIN_RESOURCE_OR_PRODUCTION` — AFTER the play's own placement prompt and
every `DEFAULT` question; the journal shows them under the corporation's chip after the tile).
`cardPlayedForecast` reads the SAME predicate (never `ctx.tiles`) and states ONE `exact` fact on block #0
(`printedEffect: 0`), `after-card` at the gain's priority, with the bare deltas — so the composer's «Сработает:
+6 [heat] +1 [M€ prod]» and the R3 layer's «Вы получите» with the corporation's own face come for free, and the
play's landing scene holds the two rows as its rail half's answer. A green card without a tile forecasts
NOTHING (no `no` fact). The parity guard's tile-play pass (`effectForecastParity.spec` — Nuclear Zone, the cell
answered, the marker read after it; Research — no fact, no event) keeps the two sides honest.

## 3. The action — declarative

`action: {spend: {heat: 12}, drawCard: 2}` (`ActiveCorporationCard`): «Not enough heat» from the engine's own
reason below 12 (Stormcraft's floaters count through `spendHeat`); the two cards are ONE batch of the action
(`enqueueCardDrawReveal`, source — this card, the «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» law). In the console: the ACTION
COMMIT — the price leaves the heat row FIRST into the printed heat (PL-099 / PL-104), the deck answers, the two
cards come as one batch into the hand.

## 4. The record — what the next reactor corporation inherits for free

Hartlan is the first owner of the CARD-REACTION framework (`docs/claude/console/card-reaction.md`): the event
recorder publishes a `CardReactionRecord` for EVERY passive-effect scope that produced an impact (the reacting
card, the channel, the root, the cause — the played card here — and the impacts with their recipients), and the
console plays it: the corporation rises at a SEAT beside the rail after the tile's own story (every card Hartlan
answers is a STAGED play — the landing ritual has no reward beat and the card is sealed on the board, so the
record is the standalone chain's; «out of its place on the receiving stage» belongs to a non-tile play), six heat
tokens are born on ITS printed heat and the production token on its plate, the rows tick on the touchdowns; with
four reactors off one play the last in the server's order — Hartlan's deferred gain — starts past the chain's
1.8 s ceiling and is summarized (PL-1059, the owner's call). A new corporation with a hook therefore needs: the live hook, its forecast twin (the coverage guard
names a hook without one), `printedEffect` on the fact when the card prints several effects — and nothing on the
client. The face: `b.emptyTile('normal', {secondaryTag: AltSecondaryTag.GREEN})` draws the scan's «empty tile
with the green card's tab» (the corner mark `shape: 'card'` with the type's band — `premiumCardIcons`).

## 5. Tests and stands

Server: `HartlanHeating.spec` (rules 0–6), `greenTilePlacers.spec`, `CardReactionRecord.spec`,
`effectForecastParity.spec` § green tile plays, the caption / information / manifest / deck guards. Client:
`cardReactionModel.spec`, `cardReactionDirector.spec`, `effectIconEnds.spec`, `railReward.spec` § the answer
flight. e2e (TIMING, the Steam Machine): `console-hartlan-heating.spec.ts` (B · C · A on the `hartlan-heating`
fixture), `console-card-reaction.spec.ts` (MANY · BOARD on `card-reaction-many`).
