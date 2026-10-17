# TR67 Enceladean Incubator («Инкубатор Энцелада») + the iteration «КЛЕТКА — ОДНО ДОСЬЕ»

**Status.** Shipped 2026-10-17. The prompt: `docs/claude/prompts/project-tr67-enceladean-incubator.md`. The law:
`.claude/rules/console-ui.md` § THE PLACEMENT PANEL IS A DOSSIER — «…AND THE INSPECTION IS THE SAME DOSSIER». Ledger: section
BA of `docs/claude/gameplay-polish-ledger.md` (PL-582…598). Decisions 1–9 were taken at their defaults (§ 7); **the owner confirmed 4a · 6a · 7a · 8a on
2026-10-17** (one batch, with the mockups `screenshots/tr67/after-tv4k/m*.png`).

## 1 · The card

Green (AUTOMATED), 23 M€, Jovian + Space (the printed order — the banded planet, then the star), an EMPTY MIN plate (no
requirement — playable under any ruler), a fixed 2 VP on the Mars disc. ONE declaration, no bespoke play, no hook:

```
behavior: {ocean: {}, addResourcesToAnyCard: {type: CardResource.MICROBE, count: 4}},
victoryPoints: 2,
```

- **The microbes first.** `Executor` defers the «any card» pick at `PLAY_CARD_RESOURCE_CHOICE` ahead of the ocean
  (`PLACE_OCEAN_TILE` — the Imported Hydrogen precedent), so the composer asks «КУДА» before the board, the answer lands where
  it was addressed (law 27). Any of the player's OWN microbe holders (never a rival's), mandatory, never chosen for the player
  (one holder is still a question — invariant 3, `autoSelect: false`); no holder → the skip BY NAME (`skippedAddToCard` —
  «Нет подходящей карты — этот ресурс не будет добавлен.» before the press, the journal's «Пропущено» after it).
- **The ocean** is an ordinary placement (the cell's bonus, +2 M€ per adjacent ocean, +1 TR; the table's answers — Arctic
  Algae… — are their own hooks and the server's forecast). **Nine oceans**: no placement and no TR, the card still plays and keeps
  its 2 VP — and the loss is NAMED before the press. That last half was a real fork-wide gap this card found: `stepsForBehavior`
  dropped the ocean's board step silently at nine (no note, no chip — the composer simply did not mention the ocean). It now
  pushes the card's own `maxoceans` sentence as a warning note (`actionPreviews.OCEANS_MAXED_NOTE` — the client's `WARNING_TEXT`
  key, RU «Примечание: все океаны уже на поле.»), for every declarative ocean card.
- **The tags**: Jovian counts for Io Mining Industries & co.; Space lets titanium pay and EVA Mechs' `mechs` pay. Not an event.
- **The face** reads the scan: `b.oceans(1).nbsp.resource(MICROBE, 4).asterix()` — four squares (`showDigit` only past 5).
- **Lore** (EN word for word, key `TR67`): «That's "En-ce-ladus", not "En-chi-ladus"!» — RU «Правильно — „Эн-це-лад“, а не
  „Эн-чи-лада“!» (the pun kept). **Art** imported (`assets/card-images/TR67.webp`, the owner's `Mars Arts/TR67.png`).
- Spec: `tests/cards/turmoilRedux/EnceladeanIncubator.spec.ts` (rules 1–10: any ruler; the pick before the ocean; one holder
  asked; a rival never offered; no holder → the named skip; nine oceans → the warning, the named preview note, no TR, 2 VP;
  Io Mining; titanium / mechs; Topsoil Contract forecast + payout; the batch landing whole; purity; save / load).

## 2 · «КЛЕТКА — ОДНО ДОСЬЕ» — what was wrong

The right board column opens at every tile placement and every board inspection, and on 4K it was the worst surface left
(the preparation walk, 2026-10-17): the inspection filled 9–18 % of the drawer's height with 3–7 % ink, spoke the desktop's
px `BoardFactGroups` stretched by `zoom` (×2.7 on 4K) beside the placement's rem-native rows — two families of rows, two
rhythms, two kinds of «+2» chip in one column — and said almost nothing about the cell («ОЗЕЛЕНЕНИЕ player1» and that was all):
no printed bonus as an object, no neighbours, no card that put the tile there, no points; the field lit neighbours only during
a placement. Five labels were under the couch floor.

## 3 · What shipped

**A · ONE LANGUAGE.** `console/cellDossier.ts` (pure, spec'd under the server runner) sections the hover's facts by INTENT —
the toll (`hazard-identity`) → «при размещении здесь» (printed bonus, the ocean money, a hazard's cleanup) → «под тайлом» (the
covered bonus, its row naming «Бонус клетки», never the section's words twice) → «при размещении рядом» (the cell's standing
mechanic: the ocean's rule, an Ares source, a hazard's adjacency tax) → «в конце игры» BY RECIPIENT → the field rules at the
FOOT — built by the placement's own `buildDossierRows`, rendered by ONE `ConsoleDossierSections` on the placement's
`ConsolePlacementFactRow`s and four type tokens. `BoardFactGroups` + `zoom` are gone from the console (the desktop keeps its
readers). The kicker speaks the scanner's amber.

**B · THE PORTRAIT.** `ConsoleCellPortrait` draws the server's `BoardCellInfo.portrait` (`BoardInformationEngine.cellPortrait`
— the square's kind and printed bonus as DATA, the piece on top, the owner, `sourceCard = tile.card`): the printed bonus as
large icons on the kind's ground (land rust · ocean reserve water · cove · deflection · reserved hatched), the tile in the
board's own art (the native 46×51 box zoomed to the hex), the owner's cube, the tile's OWN points as the score cell's gold
shield (`cellOwnVp` — `score-*` facts about this tile, never what it gives a neighbour), marks for what the art cannot say
(reserved, off the grid, the water under the city, a stack). The head names the OBJECT (a special tile by its name), the owner
and «Поставлено · ‹карта›» as chips. **X opens that card's face** (the grammar «X — the current object»: the cell's object is
its tile, a tile's face is its card); a cell with no card keeps X in the bar, refused, its reason as the label («Без
карты-источника»). The placement shows the same portrait one step smaller under its cell line.

**C · THE NEIGHBOURS.** Six slots in the engine's own clockwise geometry (`getAdjacentSpacesClockwise` — top-left, top-right,
right, bottom-right, bottom-left, left; `null` = the board's edge, no hex drawn), each a miniature of its piece, lit by the
SAME classifier as the board (`relationToneOf` over the facts' `spaces` — the preview in a placement, the hover in an
inspection) with what ONE neighbour means: the new `BoardFact.each` (the ocean money's rate, a city's +1 VP per greenery,
Capital's +1 per ocean — stated by the server from the same rule call) or the fact itself when it names one cell. New hover
facts: a greenery names every city beside it that scores it (`score-greenery-city-*` — the city's OWNER, once per tier, a
neutral city for nobody — `calculateVictoryPoints`' own rule; under Redux the only point a greenery is worth). On the field the
inspection now lights the same marks (`relationsFromInfo` → `con-board--inspecting` wears the aim's `con-rel--*` with NO
entry fade). ONE PALETTE: ocean cyan · VP gold (was the plants' green) · a gain «now» mint (was the action gold) · toll red ·
event pale — the ring, the marks and the section accents.

**D · THE DRAWER'S HEIGHT.** Head · portrait (≈ a third of the drawer at 4K) · facts · the rules and the lore pinned to the
foot. The outer box is the drawer's own (`top: 0; bottom: 0`) — constant; no scroll in any probed cell.

**E · R3.** The step on the same chassis: the scale as the title, a STEP PLATE in the scale's accent (its glyph, «СЕЙЧАС»
value, what the step gives — large), «КОГДА» as a section of rows (the rule, who took it), the scale's description at the foot.

**Smoothness.** A d-pad step swaps data in the same frame: the portrait's six slots are fixed by CSS, values flick 100 ms (the
dossier's one motion), and the hover answers of the six neighbours are WARMED (`boardInfoState.prefetchBoardCells`, bounded to
one ring, dropped on a cache epoch change) so the next step is a cache hit — decode ≠ mount, for data.

## 4 · Numbers (4K TV, GPU, `screenshots/tr67/{tv4k,after-tv4k}/`)

| mode · cell | content bottom | ink | under the floor |
| --- | --- | --- | --- |
| L3 · ocean reserve with a bonus | 18 % → 63 % | 6 % → 34 % | 1 → 0 |
| L3 · land with a bonus | 13 % → 56 % | 3 % → 28 % | 1 → 0 |
| L3 · empty land | 12 % → 59 % | 7 % → 33 % | 0 → 0 |
| L3 · own greenery | 9 % → 62 % | 3 % → 38 % | 0 → 0 |
| L3 · greenery on Tharsis Tholus (lore) | 34 % → 97 % | 14 % → 54 % | 1 → 0 |
| R3 · a scale bonus | 35 % → 97 % | 14 % → 19 % | 2 → 0 |
| placement · ocean (aimed) | 37 % → 57 % | 9–10 % → 16 % | 2 → 0 |

No scroll in any probed cell. The ledger's section BA carries the same table with the defects found on the way (PL-582…598).

## 5 · What not to break

The four laws of the placement dossier and its «nothing animates while the player points»; the two-phase placement; the
reticle; the see-through `data-peek` of a removal; the planet untouched (the drawer stays absolute — its width did not grow).
The portrait is DATA: never a transition, never a `filter` on state, never a client rule (no adjacency, no score computed).

## 6 · Tests

`tests/cards/turmoilRedux/EnceladeanIncubator.spec.ts`, `tests/boards/cellPortrait.spec.ts` (the portrait, `each`, the
greenery's cities, purity), `tests/console/cellDossier.spec.ts` (sections by intent over the real engine, the ring ≡ the field's
relations in both modes), `tests/client/components/console/ConsoleContextPanel.spec.ts` (§ inspection — the same dossier),
e2e `tests/e2e/console-cell-dossier.spec.ts` (fhd · tv4k · deck).

## 7 · Decisions (defaults taken; 4a · 6a · 7a · 8a confirmed by the owner 2026-10-17)

1. RU name «Инкубатор Энцелада» — taken. 2. Lore with the pun — taken. 3. Art — the file arrived, imported.
4. Height — (a) the drawer filled by hierarchy. 5. One language — (a) the inspection on the placement's rows.
6. Neighbours — (a) the ring + the same marks on the field. 7. Portrait — (a) the real art + the large bonus + marks + owner +
source + VP. 8. X — (a) the source card's face. 9. R3 — (a) the same chassis.
