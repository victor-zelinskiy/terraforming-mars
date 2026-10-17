# TR69 Floating Biodomes («Парящие биокуполы») + the iteration «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ»

**Status.** Shipped 2026-10-17. The prompt: `docs/claude/prompts/project-tr69-floating-biodomes.md`. The law:
`.claude/rules/console-ui.md` § THE FINALE IS A CEREMONY; the finale's contracts: `docs/claude/console/endgame-workspace.md`,
`docs/claude/console/endgame-overview.md`. Ledger: section BD (`docs/claude/gameplay-polish-ledger.md`). Decisions 1–6 and 10 were
taken at their defaults; 7 (the podium), 8 (the tokens), 9 (the overview at scene scale) and 11 (the horizon as the stage) were
built at the recommended option and go to the owner's batch. **Art imported** (`Mars Arts/TR69.png` appeared after the prompt was
written → `assets/card-images/TR69.webp` + thumb).

## 1 · The card

Blue (ACTIVE), 10 M€, Venus ≥ 10 %, Plant + Venus, a FLOATER holder (the set's second after TR27 Aurora Station), no VP, the Venus
«V» at the bottom left → `compatibility: 'venus'` (`FloatingBiodomes.ts`). The play puts two floaters HERE (`behavior:
{addResources: 2}`); the action is ONE DECLARATION of the TR40 class:

```ts
action: {or: {behaviors: [
  {spend: {plants: 1}, addResourcesToAnyCard: {type: FLOATER, count: 1, tag: Tag.VENUS}, title},
  {spend: {resourcesHere: 3}, greenery: {}, title},
], autoSelect: true}}
```

- **A** — 1 plant → a floater onto ANY Venus card: the declaration's tag filter (`AddResource.tag` → `restrictedTag` — Stratopolis'
  path); THIS card is a candidate; the target is always asked (`autoSelect: false` on every «to any card»).
- **B** — 3 floaters here → a greenery: the tile raises its own oxygen (`Game.addGreenery`) — `global: {oxygen: 1}` beside it would be
  a second step; the Redux greenery tile pays its own TR on top (`ParliamentHandler.onGreeneryPlaced` — B is TR +2 below the
  maximum, +1 at it); at the oxygen maximum the tile still lands (the action is not futile — `actionFutility.ts:141`); no legal cell →
  the PLACEMENT reason; fewer than 3 floaters → «N of 3 floaters on this card» (PL-197).
- The faces: «[plant] → [floater ⓥ]*» / OR / «3 [floater] → [greenery •O₂]»; two curated shorts (A 56 / B 79 over the caption budget).

## 2 · THE DECLARED ACTION TILE IS STAGED FOR FREE (D5 as a class)

TR69 is the first DECLARATIVE action that places a tile (a manifest scan found none). Rather than a card hook re-stating the whole
declarative preview to attach a staged payload (CometAiming's shape), the staged derivation of a declaration moved into ONE module
— `models/stagedBehaviorPlacement.ts` (`stagedPlacementForBehavior` + `attachStagedPlacement`) — and both doors call it: the PLAY
(`cardPlayPreview.withStagedPlacement` — the unpaid card's price folded in through `canAffordOptions`) and the ACTION
(`actionPreview.declaredActionSteps` — no price: an action's cost is spent before its placement resolves). So every declared
action tile — a greenery, an ocean, a city, a `tile` — is the action's LAST REVERSIBLE STEP with no card code: the composer parks
the batch, the board picks the cell, B returns to the composer, the cell's confirm is ONE POST `[{or: B}, {space}]`. Guard:
`stagedPlacementParity.spec` § ACTION (the TR69 row: the staged greenery ≡ the live `PlaceGreeneryTile`, title and reasons
included); e2e `console-floating-biodomes` (B — the board at a standing age, B restores the composer, one POST).

## 3 · THE HOLDER BUYS A TILE (decision 5a)

`ActionGood {kind: 'tile', tile: 'greenery' | 'ocean' | 'city'}` (`common/cards/holderRole.ts`), derived in `holderActionGood.goodsOf`
from a declared greenery / one ocean / a city (a special tile, a target, a colony stay storage). The console's reader
(`holderRoles.ts`): the value line «Потратьте 3 отсюда: озеленение», the printed greenery as the role's icon (`wgt-icon--greenery`),
the caption «Тайл», its own lane `tile-greenery`, the gain outcome «the action opens 3 / 3». Guards: `holderActionGood.spec` (the
corpus reads a tile as one), `holderRoles.spec`.

## 4 · «ФИНАЛ — ЭТО ЦЕРЕМОНИЯ» — the iteration

**Diagnosis (4K GPU, the saturated fixtures `finale-rich-5p` / `-2p` — every base category, the winner not the viewer).** The
results were five 60 px bars in 168 px rows on 29–72 % of the height over an empty horizon: 5 % of the screen inked, the winner 8 %
of the height, no face, no token, no medallion; 41 texts under the 32 px couch floor at five players. The overview's «Счёт» was a
0.8rem-track matrix on the top 40–66 %, «Игроки» the top 59 %, 17–29 texts under the floor.

### 4.А THE PODIUM (decisions 7a + 11a)

Every player is a SEAT standing on the horizon: the corporation's premium face (a human's first corporation card; the MarsBot
corporation's own face — `ConsoleEndgameRow.face`), the place medal on the face's foot, the name, the score in the score cell's
language (the award shield `ConsoleVpBadge` + the running total — where the tokens land), the counting bar under it (the
instrument — the anchored label plan retired: the values stand in the medallions), and the category MEDALLIONS (the dossier's discs,
`scoreCategoryGlyph` — one glyph table with Information). The geometry is the pure planner `consoleEndgamePodium.ts`
(`planPodium` — the measured box, the live rem, never the count alone):

- `stack` (3–5 seats) — a portrait seat; `side` (the duel and a solo game) — the face BESIDE the reading block, so two heroes fill
  the opening instead of standing as two pillars in an empty field;
- every seat takes an equal share of the row and keeps it — the crowning moves no seat sideways; the drama is HEIGHT: while the count
  runs the seats are equal at `EQUAL_HEADROOM` (0.86) of the hero, once crowned the winner(s) take the full height and the largest
  face, the rest step down to `placeRatio` (0.76 / 0.88);
- ranked, the seats stand as a PODIUM — the winner on the horizon's crest, the runner-up at its left, the third at its right
  (`podiumOrder`), each on the planet's curve (`horizonDrop` — the same radius the CSS draws the limb with, `--eg-arc-r`); during the
  count they stand level (a curve under an untold ranking would crown the middle seat by geometry);
- the horizon is the STAGE (`.con-endgame::before`): its crest exactly at the podium's measured foot (`--eg-horizon-y`), a rim of
  dusted light, the lit ground under it — the actions stand on the ground.

### 4.Б THE COUNT FLOWS (decision 8a)

A category's phrase gained a beat: focus → **fly** → grow → settle → pause (`CEREMONY_MS.categoryFly` 300 ms; a sub-step's own
`subFly` 200 ms inside its window). On `fly` the category's TOKENS — its disc (symbol + hue) and the signed points — are born on the
rail's medallion and arc into every seat's shield (`flyTokens`); the director starts the count-up at the flight's END, so the score
cell ticks on the touchdown, the segment grows and the seat's medallion lights with it (`segOn` / `landed` exclude `fly`). Every
flight is handed to the director's clock (`attach`): the ceremony's pause freezes it, a skip / an unmount kills it and empties the
layer. The ranking FLIPs the seats along both axes; the crowning is its own FLIP (`onCrown` — translate + a uniform scale from the
seat's foot). A zero brings no token; reduced motion flies nothing and snaps the crowning. The «+N» edge chips are gone (the token
IS the «+N»).

### 4.В THE OVERVIEW AT SCENE SCALE (decision 9a)

«Счёт» is a BOARD: the places are columns led by the corporation's face, the place, the name and the total in the score cell's
language; the categories are rows led by their medallion; the cells are the value + a bar on one shared scale, the leader gold; the
rows share the opening's height; the breakdown stands in the same plate at a fixed height. «Игроки»: the participant as a HERO
column (the face, the identity, the total), the metric groups filling the rest (two rows sharing the height), the milestones /
awards as MEDALLIONS (`OvPlayerCard.maMedals` — the emblem's art, the name, the VP; the server's breakdown rows), the score
sources as the ceremony's medallions (`face` / `maMedals` on the VM — `OvRankRow.face`, `OvPlayerCard.face`: a `CardName` / a
`MarsBotCorpId`, never the display string).

### 4.Г THE TV PROFILE (decision 10a)

The podium is authored AT the floor (its type is rem ≥ 0.85; the faces are the objects that scale). The overview's six tabs kept
their desk sizes for badges, units, ticks and table heads — `console_tv.less` § THE FINALE AND ITS OVERVIEW ON THE COUCH raises
every one of them to the floor on the TV profile (the `consoleTvTypeFloor` guard covers the block).

### Shares — before / after (4K GPU, the saturated fixtures; `screenshots/tr69/tv4k/{before,after4}/probe.jsonl`, the Deck in `screenshots/tr69/deck/after6/`)

| screen | before: ink · content foot · hero · under the floor | after: ink · content foot · hero · under the floor |
| --- | --- | --- |
| results · 5 players | 5 % · 97 % · 8 % · 41 | 27 % · 97 % · 67 % · 0 |
| results · 2 players | 5 % · 97 % · 16 % · 1 | 45 % · 97 % · 63 % · 0 |
| overview «Счёт» · 5 | 12 % · 66 % · — · 1 | 24 % · 97 % · — · 0 |
| overview «Игроки» · 5 | 13 % · 59 % · — · 25 | 22 % · 92 % · — · 0 |
| overview «Игроки» · 2 | 13 % · 62 % · — · 29 | 23 % · 97 % · — · 0 |

The Deck (1280 × 800): results 5 / 2 — the content's foot 97 % / 97 %, the hero 60 %; «Счёт» 98 %; «Игроки» 89 % / 92 % (the
handheld density: the hero column 13.5rem, the score sources as «disc + value» four to a row — PL-648); the duel's reading column
fits its seat (PL-646 — the side seat is the taller of the face and the column, the handheld voice one step down).

### What not to break

The overview contract (two layers of ONE root, `.con-eg` parks by opacity + visibility, never `display`); the boundary teardown;
«Свернуть» and the read-only free roam; the road back from «Мои партии»; the mandatory campaign champion beat (the ribbon / plate /
keel / rim are absolute on the SEAT now — zero layout); the atomic skip (`finalizeCeremony`); PL-576's head handoff and plates; the
hidden score opens here and only here; the stability probe now reads PER SEAT during the count (`console-endgame.spec` — the
podium's two deliberate moves, the ranking and the crowning, come after it).
