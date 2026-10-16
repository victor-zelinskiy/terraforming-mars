# TR60 Civilian Spacefighters («Гражданские истребители») + the iteration «ИНФОРМАЦИЯ — ДОСЬЕ, А НЕ ТАБЛИЦА»

**Status.** Shipped 2026-10-17. The prompt: `docs/claude/prompts/project-tr60-civilian-spacefighters.md`. The Information
contract: `docs/claude/console/information-workspace.md` § THE DOSSIER; the law: `.claude/rules/console-ui.md` § THE
INFORMATION WORKSPACE IS A DOSSIER, NOT A SPREADSHEET. Ledger: section AZ (`docs/claude/gameplay-polish-ledger.md`,
PL-560…581). Decisions 1–9 were taken at their defaults (§ 7); **the owner confirmed 5a · 6a · 7a · 8a on 2026-10-17** (one batch, with the three overview mockups).

## 1 · The card

Blue (ACTIVE), 6 M€, a Space tag, the INDUSTRIALISTS' plate (they rule, or 2 of the player's own delegates on their
resolution — the TR15 class, checked at PLAY; the action works under any ruler; TR36 lowers no requirement), a FIGHTER holder,
no VP. Play: `behavior: {addResources: 1}` — one fighter on THIS card. The action is ONE declaration of the TR40 class
(`CivilianSpacefighters.ts` — no `canAct`, no `action()`, no reason in the file):

```
action: {or: {behaviors: [
  {spend: {titanium: 1}, addResources: 2, title: 'Pay 1 titanium to add 2 fighter resources to this card'},
  {spend: {resourcesHere: 1}, production: {megacredits: 1}, stock: {megacredits: 3},
   title: 'Spend 1 fighter from here to gain 3 M€ and increase your M€ production 1 step'},
], autoSelect: true}}
```

Both alive → the `effect-choice` `OrOptions`; one alive → no question; both dead → the card-level reasons in the DECLARED
order (A first — «not enough titanium», then «0 of 1 fighter on this card», class PL-197). A is TITANIUM, never M€ with a
titanium substitute (Helion / steel / mechs pay nothing here). B pays TWO goods for ONE price at once — +3 M€ and +1 M€
production; the table's answer to the production step (Manutech) is the server's forecast `byBranch`. The face prints the
scan's order (the production box FIRST, then 3 M€); the printed row is sliced at «OR» into the two variant tiles. Fighters from
elsewhere: TR56 Robotics Factory may put them HERE, TR29 Spaceship Recycling may take them from here (B loses its fuel).
Titanium pays for the play (Space tag), EVA Mechs' `mechs` unit pays too. Futility: none on either branch. Lore (EN word for
word, key `TR60`): «Military-grade fighter craft in the hands of the average Joe. What could possibly go wrong?» — RU «Боевые
истребители в руках обычных людей. Что может пойти не так?». **Art imported** (`Mars Arts/TR60.png`, credit BoneTech3D).
Spec `tests/cards/turmoilRedux/CivilianSpacefighters.spec.ts` (37): the 12 readings of the prompt — the requirement, the play
fighter, both / one / no variant, the reasons' order, titanium only, the two goods at once, TR56 / TR29, Manutech, titanium and
EVA Mechs for the play, preview purity, save / load. The B caption is longer than the browser budget — its own `action-short`
with tokens («Spend 1 fighter for 3 M€ and 1 M€ production»).

## 2 · The holder's SET role (decision 4a)

B pays two goods for one price, and the role derivation (`server/cards/holderActionGood.ts`) used to answer `undefined` for
any variant with more than one good — the card would have been a silent «storage» on the ДОП. РЕСУРСЫ satellite. The role now
has a third shape beside the single good and the CHOICE (`or`, TR57): **the SET** — `HolderActionGood.with` (goods the SAME
price pays AT ONCE). `common/cards/holderRole.ts` reads every shape through ONE helper (`roleGoodsOf` / `isActionGoodSet` /
`actionGoodSetOf`, beside `actionGoodsOf`); the client (`console/holderRoles.ts` — `holderRoleIsSet`, `holderRoleJoin`,
`holderRoleIconPlates`) draws the set on ONE plate joined by «and» (`.con-res-aux__roleand`, `--set`, `data-role-set="2"`),
never by the choice's slant; the value line reads «Потратьте 1 отсюда: +3 M€ и +1 пр. M€ — сразу»; the lane key joins the goods
by `+` (a choice joins by `/`). The played-target model (TR56's «what +N gives here») reads the same join. Guards:
`holderActionGood.spec` (the corpus — TR60 and Arborist Collective are sets), `holderRoles.spec`, the checklist §4 row.

## 3 · «ИНФОРМАЦИЯ — ДОСЬЕ, А НЕ ТАБЛИЦА» — the overview (decision 5a)

**The diagnosis (4K GPU, the saturated fixture `info-dossier`).** The summary was three narrow columns of «label — number» rows:
content bottom 69 % of the frame, ink 11 %, void 84 %, the score 12 % of the room; the bot 88 % void; a rival with a hidden
score — one line «Очки скрыты до конца игры» in an empty frame (99 % void). The Information screen looked like a settings
sheet in a premium game.

**The composition.** TWO TIERS on the whole opening (`.con-dossier`, `console_info_dossier.less`):
- **heroes** — the SCORE (`ConsoleDossierScore`: the shield + total, the share bar, the categories as MEDALLIONS with their
  emblems and short names — the score cell's and the finale's language, `liveScoreModel` semantics, the handoff anchors
  `[data-vpx-total/bar/block]` kept) and the CARD HISTORY (`ConsoleDossierCards`: the corporation's face + a bounded fan of
  mini faces per type, the count a badge, «+K»; the bot's corporation and pile at the same coordinates);
- **plates** — ACTIONS (`ConsoleDossierActions`: mini tiles art + name, the state by SHAPE ▶ ✕ ✓ ○ + a legend), EFFECTS
  (`ConsoleDossierEffects`: the explorer's families as medallions with a glyph that reads without colour + the cards as coins),
  PARLIAMENT (`ConsoleDossierParliament`: influence, the career ladder as pips, the delegates as tokens — one row by
  construction); the bot's DOOR shows its three piles with their public counts.
The pure half is `infoDossierModel.ts` (spec `tests/console/infoDossierModel.spec.ts`). The ring is tier-aware
(`INFO_SUMMARY_TIERS`, `infoZoneNavigate` by the zones' centres; spec `infoRoute.spec`); the cursor is the TR58 grammar
(`.con-info__zone` → `.con-cursor()`, ratchet −1).

**Probe before → after** (`screenshots/tr60/{before,after}/<profile>/probe.jsonl`; content bottom · ink · void · hero share ·
texts under the TV floor):

| frame | before (4K) | after 4K | after fhd | after Deck |
| --- | --- | --- | --- | --- |
| own overview | 69 · 11 · 84 · 12 · 0 | **98 · 154 · 13 · 20 · 0** | 99 · 154 · 8 · 21 | 99 · 161 · 14 · 20 |
| rival overview | 60 · 9 · 85 · 4 · 0 | **98 · 146 · 13 · 20 · 0** | 99 · 146 · 8 · 21 | 99 · 148 · 14 · 20 |
| bot overview | 51 · 5 · 88 · 14 · 0 | **98 · 119 · 13 · 20 · 0** | 99 · 120 · 8 · 21 | 99 · 134 · 13 · 20 |
| «Действия» (own) | 60 · 5 · 95 | **98 · 123 · 43 · 0 below** | 99 · 96 · 52 | 99 · 85 · 59 |
| «Действия» (rival, 2 cards) | 26 · 3 · 100 | **98 · 53 · 73** (centred, scene scale) | 99 · 42 · 77 | 99 · 41 · 77 |
| «Парламент» | 100 · 19 · 80 · 8 below | **84 · 87 · 29 · 0 below** | 83 · 83 · 29 | 112 (scroll area) · 121 · 23 |
| «Разыграно» | 73 · 101 · 83 | **92 · 182 · 65** | 89 · 177 · 65 | 126 (its own scroll) |
| rival «ПО» (hidden) | 57 · 0 · 99 · 1 below | **73 · 29 · 74 · 0** | 72 · 28 · 74 | 83 · 45 · 59 |

(«ink» counts painted leaves' areas, overlapping — above 100 % is ordinary.) Nothing on the overview scrolls on any profile.
The handheld steps the history's faces and the parliament's tokens down (`html.con-profile-handheld` block) — before that the
corporation's face stood over the zone's title and the delegates' third token wrapped out of the plate.

## 4 · Depth with objects (decisions 6a, 9a)

- **«Действия» = the SAME tiles.** The «Действия карт» group markup is extracted host-agnostic — `ConsoleActionGroupView.vue`
  (+ the pure readings `actionTileView.ts`) — and `ConsoleCardActions` renders its groups through it (behaviour unchanged).
  The Information route hosts `info/ConsoleInfoActionGallery.vue`: strict pages by the grid's cells, the page derived from the
  cursor, a few cards centred at a scene's scale (`sparse`), X / A → the card's face in the ONE zoom viewer, nothing submits.
  The viewer's own seat reads its preview verdicts (ready / refused with the server's reason / used); another seat only the
  public «used this generation». Availability is never derived by the client.
- **«Парламент»** — objects: the influence badge with its sum and sources, the CAREER LADDER of 12 rungs (the cube on its rung,
  the next reward by its icon), the delegates as tokens, the table's resolutions as tiles (emblem · name · «ПРИНИМАЕТСЯ» · the
  compact yield); every text ≥ the TV floor (the compact yield's quiet lines — a doubled-class rule, the yield sheet is imported
  after the dossier's). The glossary's words.
- **«Разыграно»** — the embedded table at the scene's scale (`EMBEDDED_SCENE_GAIN 1.35`, not on the handheld).
- **«Эффекты»** — the «ЭФФЕКТЫ ПАРТИЙ» strip recomposed at the scene's scale (emblem · law + formula · why); the explorer
  itself is unchanged.

## 5 · Empty and sealed states (decision 7a)

Another seat's hidden score is `ConsoleDossierSealed`: the shield under its seal, «Счёт откроется в финале» and WHY («Так
задано в настройках партии: очки соперников скрыты до конца игры»), beside it «УЖЕ НА СТОЛЕ» — the rating, the milestones, the
awards (emblems) in the medallions' own words (РТ · Достижения · Награды). `dossierSealedFacts` reads no score; `vpVisible` is
the only gate; no rival VP number is in the DOM (e2e (C) — text and every `data-*vp*`). The same component stands in the score
explorer's hidden state at the scene's scale. Empty zones are composed: the actions' ghost tiles + «Карт с действием на столе
нет», the history's ghost face + «Разыгранных проектов пока нет», the effect families' ghost discs. Another seat is a READ, said
once in the head: the dashed chip «Состояние соперника — только просмотр» (`[data-info-readonly]` — the key existed, unused).

## 6 · Every zone opens FROM its tile (decision 8a)

The «Кампания» phrase generalized to every zone (`ConsoleInfoMode.detailZoneEnter/Leave/Cancelled`): the summary's leave
captures every zone's rect; the pressed zone's content lets go (100 ms), the rest recede (110 ms); the detail host arrives AS
that zone's glass plate (`.con-info__unfolding`) and unfolds under a clip from the zone's rect (`descendUnfold` with the zone's
radius, `power3.out` — the first frame already gives); the rows cascade from inside. B: the plate returns, the rows cascade
out, the clip folds into the same tile, the ring stands on it, the dossier cascades back. An unmeasured zone falls back to the
old directed rise. Witness: e2e (D) — the plate's first PAINTED box (box − clip inset, task-clock samples) is the zone's own;
no frame without content on the way in or across LB/RB. Storyboards: `screenshots/tr60/after/tv4k/story-{enter,back}-*`,
`story-seat-switch`.

## 7 · Decisions

| # | default taken | status |
| --- | --- | --- |
| 1 | RU name «Гражданские истребители» | done |
| 2 | lore EN word for word, RU «Боевые истребители в руках обычных людей. Что может пойти не так?» | done |
| 3 | art imported (BoneTech3D) | done |
| 4a | the SET role (`HolderActionGood.with`) | done, guarded |
| 5a | two tiers on the whole opening | done — **confirmed by the owner 2026-10-17** over the mockups (`screenshots/tr60/mockups/`) |
| 6a | the gallery of the SAME tiles, read-only | done — **confirmed 2026-10-17** |
| 7a | the sealed cell + public facts | done — **confirmed 2026-10-17** |
| 8a | every zone opens from its tile | done — **confirmed 2026-10-17** |
| 9a | the parliament as objects | done |

## 8 · Tests

Card: `CivilianSpacefighters.spec` (37). Role: `holderActionGood.spec`, `holderRoles.spec`, `cardInformation` (ACCEPTED row
for the description's «resource»). Client: `infoDossierModel.spec` (9), `infoRoute.spec` (17), the cursor ratchet
(`cursorGrammarGuard` — `.con-info__zone` / `.con-dgal__tile` MIGRATED). e2e: the new `console-info-dossier.spec.ts` (fhd +
tv4k + deck, A–E); the driver `focusInfoZone` walks the tiers by geometry, and every spec that walked the old ring by a
memorised key sequence was translated in the same diff (desc-tier-fit, effects-explorer, parliament, -craze, -forestry,
-gallery, -heat, -metal, -skyscrapers, -urban, info-workspace, campaign-overview); four dead hooks the liveness guard named
were pointed at their replacements (the effects plate's family medallions, the armed family).

## 9 · Open (the ledger, AZ)

The score explorer's overview (the «ПО» depth) keeps half the 4K frame empty (probe: bottom 48 %) — not this iteration's
surface, backlog. A rival's «Разыграно» with five cards leaves the lower half empty (the played table's own density ladder).
The finale's title crossfade and the flat journal (prompt § 6) — backlog with frames.
