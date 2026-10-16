# TR57 Mining Mechs («Горные мехи») + the iteration «НАГРАДА ВНЕ WORKSPACE — СЦЕНА, А НЕ ФОРМА»

**Status.** Shipped 2026-10-16. The prompt: `docs/claude/prompts/project-tr57-mining-mechs.md`. The rules live in
`.claude/rules/console-ui.md` § THE WORKSPACE BAND (the reveal is no longer a full-bleed cinematic) and
`docs/claude/console/hud-frame.md` § THE CENTRAL OPENING; the entry in `docs/claude/console/card-draw-motion.md`
§ THE STANDALONE SCENE. Ledger: section AV (`docs/claude/gameplay-polish-ledger.md`). **The owner confirmed decisions
4a · 5a · 6a on 2026-10-16** (no ring on the cell after the take — PL-483 dropped); K-§6.1 (the satellite's «choice of
goods» role, PL-484) is the next item.

## 1 · The card

Blue, 7 M€, a Building tag, the INDUSTRIALISTS' plate (the TR15 class — they rule, or 2 of the player's own delegates on
their resolution; TR36 lowers no requirement), the set's EIGHTH mech holder. «Add 4 mech resources to this card.
Action: Spend 2 mechs from here to increase your steel or titanium production 1 step.» Lore: «The miners get routinely
caught playing Gacha games on their mechs.» (RU «Шахтёров то и дело ловят за гача-играми прямо в кабинах мехов.»).
Art: Lumer_B (`Mars Arts/TR57.png`, imported; TR56's art arrived the same day and was imported too).

- **ONE declaration, no hook** — TR40's `or` with ONE price and two goods: `action: {or: {behaviors: [{spend:
  {resourcesHere: 2}, production: {steel: 1}, title}, {… titanium …}], autoSelect: true}}`, `behavior: {addResources:
  4}`. The two variants share the price, so they live and die TOGETHER: with 0–1 mech the action is refused with ONE
  counted reason (the dedupe key of `actionUnavailableReasons` now carries the params).
- **The face** prints the price once — «[mech] [mech] → [steel prod] OR [titanium prod]» (Asteroid Rights' row) — and
  the console follows it: ONE «Действия карт» tile, its composer asking the variant as two OUTCOME TILES under one
  «БУДЕТ СПИСАНО [mech] 3 → 1 на этой карте».
- **The table's answer** to the step is the server's forecast (Manutech's +1 steel / titanium filed under each
  branch); the Industrialists answer with an ACTION, not a passive, so nothing is forecast for them.
- **The satellite** reads the card as plain storage: «one price, two goods» is a CHOICE, which `holderActionGood`
  deliberately does not reduce to one good (candidate К-§6.1 — a role chip «[мех] 5 · [сталь-пр.] / [титан-пр.]» —
  is the owner's call).

**PL-197 closed as a class**: a declared «spend N from here» the card cannot cover reads «1 of 2 mechs on this card» —
the count, the need AND the resource (`actionReasons.resourcesHereShort`, a plural group in the template resolved
against the need; RU «1 из 2 мехов на этой карте»). Guard: `tests/models/resourcesHereReason.spec.ts` walks the 16
in-scope declarative holders and fails with any whose resource has no row.

Spec: `tests/cards/turmoilRedux/MiningMechs.spec.ts` (rules 1–10). Fixtures: `mining-mechs`, `-action`, `-short`,
`-locked`. e2e: `tests/e2e/console-mining-mechs.spec.ts` (fhd + tv4k, A–D).

## 2 · «НАГРАДА ВНЕ WORKSPACE» — what it replaces

The same event — «вы получили карты» — spoke THREE languages: the embedded stage inside a workspace (one head row, the
fitted row, the status rail), a FORM outside one, and the fullscreen INSPECTOR for a lone card. Measured on HEAD's own
build at 4K (`screenshots/tr57/tv4k/before/`, Terra Cimmeria Nova cells '38' — two cards — and '36' — steel + a card):

1. **A box of fixed size.** The plate was `min(70rem, 94vw) × min(42rem, …)` whatever the count — 3520 × 1830 px at
   4K for two cards that filled a third of its width; its root spanned the viewport (`left: 0; right: 0`).
2. **The rails under it were dimmed.** The plate covered both rails (0…468 px and 3372…3840 px against the plate's
   160…3680) and the shade was FULL-BLEED: the reveal was the one member of `FULL_BLEED_SHADE_OWNERS`.
3. **The head was a form.** «◈ ПОЛУЧЕНЫ КАРТЫ» over «Получены карты» (the same words twice), «Карты добавлены из
   источника добора.», «ИСТОЧНИК · Бонус клетки» that never named the cell, a «ПОЛУЧЕНО 2» chip pinned to the far
   edge — 332 px of head at 4K.
4. **The card's name floated** 183 px under the row, alone in the middle of the plate.
5. **The entry grew a box round the landed cards**: the covers flew into the slots of an INVISIBLE plate, and the frame
   «materialized around the landed cards» (`--bonus-veiled` until every cover had landed).
6. **One card was a third language**: the fullscreen inspector (lore · rules · its own chip bar «ПОЛУЧЕННАЯ КАРТА ·
   ПОЛУЧЕНО 1 · A ВЗЯТЬ · ИСТОЧНИК») over the dimmed shell bar repeating «A ВЗЯТЬ · X ОСМОТРЕТЬ · B ВЗЯТЬ ВСЁ».

## 3 · One scene for both hosts

- **The host is the CENTRAL OPENING.** The reveal's root is `.con-modal-band()` (between both bars and both LIT rails)
  with the dock's reserve at the bottom; the dim is the opening's too — `FULL_BLEED_SHADE_OWNERS` is gone, no owner
  greys a bar any more. The verdict and a public reveal keep their plate, `min(70rem, 100%)` inside the opening.
- **No plate** (decision 5a). The drawn batch is the SCENE (`.con-reveal--scene`): the stage chassis of the embedded
  reveal — `ConsoleWsStageHead`, the row solved by `wsStageLayout`, the `con-ws-stage-status` rail — in a frame that
  is a SHARE of the opening (`--con-reveal-scene-h`, 78 %), the row its one flexing part, so the fit reads the row's own
  box: the cards size by the count and the opening (56–59 % of the opening's height for one or two cards), the head and
  the status hug them. A soft floor (a pool of light and a contact shadow, gradients only) lies under the row.
- **The head says it once** — ONE reading for both hosts, `console/revealStageHead.ts` (pure, spec'd): the sentence
  («Получена карта» / «Получены карты»), then the badges — in the scene the SOURCE first («КЛЕТКА ПОЛЯ» + the paying
  cell's printed bonuses as resource icons; a card by name with L3; a colony, the Venus scale, a party, a law by name),
  then «ПОЛУЧЕНО N» for more than one card (or a search's tally, or a settlement table's places). A workspace stands its
  source on stage, so its head has no source badge.
- **One card is the same scene** (decision 4a): `drawnRevealHeadless` answers false for a reward
  (`LONE_REWARD_CARD_FULLSCREEN`), and every deal / cover scene asks the same decision through
  `drawnBatchGoesFullscreen` (the board bonus, the deck draw, the colony trade each hand-rolled «one card → the
  viewer» before) — a lone cover fans into its own slot like two do. X opens the viewer as for any card; the ONE bar of
  the shell owns the verbs.
- **L3 «Источник» shows the cell** (decision 6a): `console/revealSourcePeek.ts` — the scene recedes in place (opacity),
  the dim lets go, the paying cell wears the TR45 board-peek ring in the badge's amber (`con-peek-cell--source`); L3 /
  B bring the cards back, everything else waits; the bar offers only the way back while the cell is shown.

## 4 · The entry and the leave

- **The scene assembles WITH its cards.** The covers still lift off the cell and fan into the slots (the director is
  unchanged in meaning); the board bonus now raises the scene's chrome (head · status · floor) at the FIRST touchdown
  (`runBonusFanOut.onFirstLanded` → phase `frame`), the deck draw already did (`onFrameCue`). The slots stay measurable
  while veiled (opacity, never `display`).
- **The take** is unchanged: A flies one card into the dock and the survivors re-centre; the last take dismisses the
  batch and the surface-motion director plays the leave of the head and the status with the shade's own fade.
- Witnessed by `tests/e2e/console-standalone-reveal.spec.ts` (fhd + tv4k): the scene's box ⊂ the opening, no rail digit
  under the dim or the scene, the head says it once and names the cell, the status line ≤ 3.2 rem under the row, the
  cards ≥ ⅓ of the opening, no sample with the chrome before a cover touched its slot and none with a real card under
  an unseen head (a `MutationObserver` + `setInterval` sampler, never rAF), L3 rings the cell, A takes; one card — no
  viewer on its own, a hero, X / B / A. `console-board-card-bonus-concurrency` was translated (the lone card lands in
  the scene; the steel chip finishes before the scene unveils).

## 5 · Measurements (4K, GPU; `screenshots/tr57/tv4k/{before,after1}/`)

| | before | after |
| --- | --- | --- |
| the surface's box | plate 3520 × 1830 at x 160 (over both rails) | the opening, 2876 × 1948 at x 482 — the rails clear |
| the shade | full-bleed 3840 × 2160 | the opening, 2876 × 1948 |
| rail digits under a dim / a plate | 6 / 6 | 0 / 6 |
| head | 332 px, «Получены карты» × 2 + subtitle + chips | one row, the sentence once + «КЛЕТКА ПОЛЯ [cards][cards]» + «ПОЛУЧЕНО 2» |
| card's name under the row | 183 px, mid-plate | 47 px (fhd 17 px) |
| card height / opening | 0.52 (1008 / 1948) | 0.56 (fhd 0.59) |
| one card | the fullscreen inspector, two command bars | the same scene, one hero, one bar |

## 6 · Traps

- The profile ladders restate `.con-reveal__card` (width · padding · the drawn height) at (0,2,1) — the scene's rules
  are written with a doubled class, like the embedded ones, or the TV plate comes back.
- The full-bleed shade had ONE owner; removing the owner without the mechanism would have left a dead class and a dead
  e2e field (`console-workspace-band`'s `shadeFullBleed`) — both are gone, and the band spec now holds every owner to
  the opening.
- The board-cell helpers of `console-board-card-bonus-concurrency` live in `tests/e2e/boardCellBonus.ts` (shared with the
  scene's spec); the one fixed wait they carried became a state wait (the ratchet fell 833 → 831).
- **A surface that MOVES into the scene brings its words with it** (PL-488): Pluto's card discarded by the RULES (К-5 —
  `autoDiscarded`, a hand with nothing else) used to stand in the inspector, whose status pill said «Сброшена: другой карты
  в руке не было»; in the scene the head would have read «Получена карта» over a card that never reaches the hand.
  `revealStageHead({discarded})` names the rule (the source badge stays, no count) and the card offers no «can be played
  later». Found by the regression, not by the scene's own spec — sweep the deleted surface's states when a host moves.
- **The rails are lit now, so what flies over a standing scene is SEEN** (PL-489): the board-beat park's drain waited for
  quiet with the shared 8 s cap and drained UNDER a reveal standing for the player — the oxygen step's TR token was born on
  a marker under the scene and flew over it. It predates TR57 (HEAD's own concurrency spec was red 2 / 2 on HEAD's build,
  the token over the fullscreen viewer); the drain now waits a standing reveal out and arms one waiter
  (`console-ui.md` § A BOARD BEAT WAITS).
- **An empty holder steps back by colour on its COUNT** (PL-480): the satellite's pixel contract
  (`console-extras-explorer`) lets no opacity touch a value — the icon and the badges recede, the digit is muted.
