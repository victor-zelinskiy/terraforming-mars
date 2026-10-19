# The Information Workspace (Y) — the overlay workspace

Stage 3 of the information-panel rework (2026-08-30; stages 1–2b 2026-07-29
are folded in below). «Информация» is a full WORKSPACE in language and
navigation — the ConsoleWsHead crumb, semantic routes, one command-bar
contract — while staying an independent OVERLAY layer: it opens OVER any
surface (board, any workspace, a minimized prompt), never touches the
workspace STACK, and closing restores the exact captured context.

## The overlay contract (why it is NOT a stack frame)

- `Y` opens over ANYTHING; `openInfoMode` captures a SNAPSHOT of the
  transient cursors (`infoModeState.ts` — sheet/hand/board/colony indices,
  sale picks, cell focus) and closing restores them; the workspace STACK is
  never entered, so the surface below keeps its route, step, phase, claims
  and picks by construction. A placement prompt that arrived while open is
  the one exception: close lands on the board (the mandatory surface).
- While open the pad belongs to the panel (`handleIntent`'s
  `infoModeState.open` branch); everything ABOVE it in the chain (mandatory
  announce A, notification-toast B, endgame scene, cinematics) deliberately
  outranks it. A second Y closes; `openInfoMode` is idempotent (no double
  instance can exist).
- `.con-main--info` rides `open || closing` (the `closing` latch is released
  by the panel's own after-leave hook — `settleInfoModeClose`); the endgame
  seal ASKS before closing (a latch belongs to the WORK, not the attempt).
- Read-only is structural: no route submits anything; the embedded
  «Разыграно» is display-only; the transport is untouched.

## Routes (`infoRoute.ts` — pure, spec'd in `tests/console/infoRoute.spec.ts`)

```
summary ─┬─ vp            («Победные очки» — the score explorer's overview)
         │    └─ vpCategory  (ONE category's detail; param vpCategoryKey)
         │         └─ vpCards  (a card family's table; param vpCardsGroup)
         ├─ played        («Разыграно», the embedded premium table)
         ├─ extras        («Доп. ресурсы»)
         ├─ actions       («Действия», human-only)
         ├─ effects       («Эффекты», human-only)
         ├─ campaign      («Кампания», campaign missions only — a GAME fact)
         └─ botScreen     («Экран бота», bot-only)
              ├─ botBoard   («Планшет бота»)
              └─ botBonus   («Бонусные карты»)
```

**The «Кампания» route (2026-09-11, quality iteration same day).**
Campaign missions grow one more zone/route pair: the summary zone
(«Миссия 2 из 4 · Элизий» — the frame line CARRIES the board name; the
inspected seat's title emblems + the TP VALUE as one visual statement with
the scoring-semantics note DIRECTLY under it, never under an unrelated
line; the composition count) and the full in-game overview
(`ConsoleCampaignOverview` — the mission route over the REAL board
miniatures, the participant rows, and two nested read-only layers:
«Осмотр миссии» (`CampaignMissionInspect` — A on ANY route card, whatever
its state: the enlarged hero board + results/outgoing legacy for a
committed one, live facts (generation, participants) for the active one,
the honestly-known features for a future one — the A verb never dead-ends
on a future card) / «Наследие участника», both the same components the
standalone Campaign Map renders — the map offers the same inspect on X).
The participant rows are ONE GRID (cube · identity · titles · TP ·
corporations · bonus — same verticals for every row; a long name
ellipsizes inside its column, the type size never shrinks; corporations
start right after TP, left-aligned, and wrap at 3+), with the TP-semantics
note stated ONCE under the roster («ОТ — …»), tied by the term. Every
participant label resolves through `participantDisplayName` (the podium
carries raw `name`+`isBot` in the model; the renderer localizes — a raw
«MarsBot» on any campaign surface is a regression). Existence is a GAME-shape
fact, not a participant fact: `infoZonePresent`/`infoZoneFocusable`/
`infoFocusRing`/`infoZoneNavigate` take an optional `InfoZoneContext`
(`{campaign: boolean}`, default false — ordinary call sites untouched), and
the route applies to every inspected kind (the campaign is about the
campaign, LB/RB on the bot keeps it). The crumb tail is DYNAMIC
(`campaignStagePath()` in `campaignOverviewUi.ts` — «Кампания» ·
«Миссия N» / «Наследие»); the bar contract is the overview's own
`campaignOverviewUi.barCommands` (the consolePlayedUi mirror pattern);
input routes through `ConsoleShell.handleInfoIntent`'s campaign branch →
`ConsoleInfoMode.handleCampaignIntent` (unconsumed B at the base layer
falls through to `infoBack`). The entry unfolds OUT OF the pressed
«Кампания» zone (the rect is captured in the LEAVE hook — the enter hook
runs after the summary detached), the exit folds back into that box; the
overview's own choreography (mission cards surfacing, each board's real
geometry materializing, the lane drawing, seats joining) is CSS inside the
component, so seat switches / layer returns / data refreshes never replay
it (they never remount the branch). The card zoom gets NO select bridge —
read-only by construction; viewing never launches, re-grants or reveals a
hidden hand (counts are public, names owner-only, server-enforced).

The vp subtree's stage names are DYNAMIC (the selected category / family) —
`scoreStagePath` in `scoreExplorerModel.ts` supplies the tail; the static
`infoRouteStagePath` skips the '' placeholders. The params live beside the
route in `infoModeState` (`vpCategoryKey` / `vpCardsGroup`), so LB/RB keeps
the SEMANTIC depth («Карты» stay «Картами», «Ресурсные» — «Ресурсными»);
they are written by the explorer's descend verbs and cleared by its own
fold-completion (never by the shell mid-fold — the departing panel still
renders from them).

- **B walks the TREE, one level**; at the summary it closes the overlay.
  `Y` closes from any depth. **The per-route DIRECT shortcuts are RETIRED
  (extras rework, 2026-09-10)**: X/L3/LT/RT/R3 open nothing — every section
  opens through the focus ring + A only (the model that scales to new
  blocks without new physical bindings). X stays a CONTEXTUAL verb inside
  screens that inspect an object (the played table, the two explorers).
- **LB/RB switches the PARTICIPANT, never the place.** The route survives
  the seat ring; a route the new participant cannot serve KEEPS the route
  and presents the workspace FALLBACK («Не применимо», `.con-info__na`) at
  the same depth — never a silent reset (the old `reconcileInfoDetail`
  did exactly that and is gone). Capability is ONE table
  (`infoRouteApplies`), read by the router, the bar, the ring and the
  fallback alike; entering an inapplicable route from the summary is
  REFUSED (the fallback exists for arriving-by-seat-switch only).
- **The crumb** is ConsoleWsHead: `ИНФОРМАЦИЯ › <участник> › <раздел>` —
  root fixed, the participant is the SUBJECT (recomposes on LB/RB), the
  route is the STAGE tail; depth 2 reads as the hosted-step phrase
  («ЭКРАН БОТА · ПЛАНШЕТ БОТА»). Identity chips + corp/difficulty ride the
  trailing slot (`.con-info__meta`, the `data-insp-slide` target).

## ONE participant summary — THE DOSSIER (`.con-info__layout.con-dossier`, TR60)

**«ИНФОРМАЦИЯ — ДОСЬЕ, А НЕ ТАБЛИЦА» (TR60, 2026-10-17).** The summary was three
narrow columns of «label — number» rows over 84 % of an empty 4K opening (probe:
content bottom 69 %, void 84 %, the score 12 % of the room). It is now a DOSSIER of
TWO TIERS over the whole opening — ONE canonical layout for every participant, the
SHARED zones at the same coordinates (e2e-guarded ±2px):

| tier · zone (`data-zone` / body) | human | bot |
| --- | --- | --- |
| satellite — `extras` (**the RAIL SATELLITE**, not a panel block, left of everything) | card-resource cells | the bot's real pools (`marsBotExtraGroups`) |
| HEROES — `vp` (`data-dossier-hero`, `ConsoleDossierScore`) | ONE hero — the shield + the total (`[data-vpx-total]`) — over the share bar (`[data-vpx-bar]`) and a quiet two-column LEDGER of the categories (`[data-vpx-block]`: disc · name · leader · value; the rows solved from the count — § «СДЕРЖАННО И ДОРОГО») | the SAME zone — no bot variant |
| HEROES — `played` (weight 1.4, `ConsoleDossierCards`) | the CARD HISTORY: the corporation's face + ONE neat PILE per printed type (active / automated / events, preludes / CEO when present) — the newest face upright (the events face DOWN), the paper edges of what lies under (three at most), the count and the name in the ledger's quiet type under the pile | `playedPile` **+ the corporation** (parity) |
| PLATES — `actions` (`ConsoleDossierActions`) | mini tiles (art + name) with their state by SHAPE: ▶ ready · ✕ blocked · ✓ used — the viewer's own seat; another seat: ✓ used / ○ idle only (public) | HIDDEN — absence never shifts the shared zones |
| PLATES — `effects` (`ConsoleDossierEffects`) | the explorer's families as medallions with a glyph that reads without colour (↻ ◆ − × ≡) + the cards as art coins | HIDDEN |
| PLATES — `botdoor` | — | the bot's door in the PLAYERS' grammar — the effects plate's medallions (action deck · bonus deck · bonus discard · destroyed) with their public counts + one note; the bot's own presentation lives INSIDE the door |
| PLATES — `parliament` (`ConsoleDossierParliament`) | influence (`[data-parl-zone-influence]`), the career ladder as pips (the next reward's icon), the delegates as TOKENS (lobby · reserve ×N · on resolutions) — ONE row by construction | the bot's honest line (`[data-parl-zone-absent]`) |
| PLATES — `campaign` (`ConsoleDossierCampaign`) | the campaign as OBJECTS: the mission's board miniature, the route as nodes (done · now · ahead), the title points as a token with the titles' emblems | same |

The pure half is `infoDossierModel.ts` (`dossierMedallions`, `dossierSealedFacts`,
`dossierCardHistory`, `dossierActionTiles` — the state is the SERVER's
`actionReasons` for the viewer's own seat and the PUBLIC `actionsThisGeneration`
for anybody else, never a client rule — `dossierEffectFamilies`, `dossierLadder`;
spec `tests/console/infoDossierModel.spec.ts`). Every zone shows its OBJECTS at the
scene's scale (a face, an emblem, a token; a number is the object's badge) — never a
label—number row where an object exists. Probe after (4K GPU): content bottom 98 %,
void 13 %, the score 20 % of the room, nothing under the TV floor; fhd 99 / 8 %;
Deck 99 / 14 % (the handheld steps the faces and tokens down — `html.con-profile-handheld`
in `console_info_dossier.less`); nothing scrolls on any profile.

**A SEALED SCORE IS AN OBJECT TOO (decision 7a).** Another seat's score the game's
options keep hidden (`vpVisible` false — the ONLY gate) is `ConsoleDossierSealed`:
the shield under its seal, «Счёт откроется в финале» + WHY («Так задано в настройках
партии…»), and beside it what is PUBLIC on the table — the rating, the claimed
milestones, the funded awards (their emblems) — from `dossierSealedFacts`, which
reads no score at all. Not one VP number of that seat is in the DOM (e2e
`console-info-dossier` (C) searches the text AND every `data-*vp*`). The same
component stands at the scene's scale in the score explorer's hidden state
(`.con-vpx__hidden`). **Another seat is a READ, said once in the HEAD**: the
dashed chip «Состояние соперника — только просмотр» (`[data-info-readonly]`) beside
the corporation — no zone below repeats it.

**THE EXTRAS ZONE IS THE RAIL SATELLITE** (`.con-res-aux`, extras rework
2026-09-10; STABLE-CHASSIS + per-chip ring, 2026-09-11; the NORMALIZATION
iteration, 2026-09-12): the persistent ДОП.РЕСУРСЫ column beside the left
rail is the zone's ONE physical body — the panel renders no duplicate, and
it carries NO caption (the chips are the label; the bar names the focused
TYPE). It exists only WITH CONTENT: an empty seat renders NO column at all
— no «—» ghost plate, no leftover focus contour (the ring skips the zone
via `InfoZoneContext.extras`); the workspace lane stays constant either
way (`--con-info-satellite-w` is a token, not content). With content it
rides above the panel's dim on the host stacking (`.con-main--info
.con-res-host` z11561) and is PIXEL-IDENTICAL to its board pose by
construction (same node, same anchor — e2e-sampled per frame in
`console-extras-explorer.spec.ts`). Its cells are the rows' own plate
family at a compact register (fixed `--cr-aux-w` width, `--cr-aux-off`
clearance so they stand PAST the frame's accent seam instead of clinging
to it; the info mode adds a paint-only column WELL binding them into one
group). The bot seat fills the same cells from its real CARD-TYPE pools
in the HUMAN key space (`cardResourceKey` — so LB/RB preserves the
semantic chip focus); an inspected seat's cells carry NO
`data-aux-resource` landing anchors (resource flights must never aim at a
foreign column).

**The SEAT-SWITCH content swap (`con-extra-swap`, 2026-09-12).** LB/RB
swaps the whole composition, and the transition-group's ordinary
`con-extra` mode (in-flow leaves + slide-in enters) made the new set mount
BELOW the departing cells and rise after their removal. The panel's
`player.color` watcher (pre-flush — same patch as the cell swap) arms
`auxSwapMode` for ~320 ms: leaves are INSTANT (`transition: none` — the
new composition owns the final layout from its FIRST frame), enters fade
IN PLACE (no translate), a shared type keeps its NODE by type key and only
patches its number under the rail's `data-insp-fade` dip, and a slot
change is one small FLIP move. The in-game type unlock keeps the ordinary
`con-extra` slide. Delta chips are PoV-safe by scope (silent rebaseline) —
a seat switch never rolls a counter.

**The STABLE CHASSIS (2026-09-11):** the frame itself keeps the ORDINARY
workspace inset — `.con-info__frame` reserves nothing for the satellite,
so the crumb/header sits where every workspace's does, whatever the seat's
resource composition. The CONTENT zones step past the chips by one
constant (`--con-info-satellite-w`, applied by the single
`.con-info__frame > :not(.con-info__head)` rule) — one chip, five chips
and zero chips are the same chassis (e2e-pinned in
`console-campaign-overview.spec.ts`: header hugs the frame, content steps
the lane). **The chips are INDIVIDUAL ring stops on the summary**
(`infoModeState.extrasCursor`; up/down walk the column, the cursor is the
same cyan chip ring the extras screen uses): A opens the extras screen ON
the focused type (`selectExtrasType`, the same road as a cell click), the
bar reads «A Открыть: <ресурс>» (`infoExtrasChips.ts` — the SAME
derivation as the painted cells, `additionalResourceGroups` /
`marsBotExtraGroups`, so ring order and column can never disagree), and B
from the screen restores the cursor to the type the player was reading.

**The old «КАРТЫ» readout zone is GONE (hand-dock integration, 2026-09):
the HAND DOCK is the ONE physical representation of the inspected seat's
hand** for the workspace's whole lifetime — the real pack + «КАРТЫ n/m» for
the viewer, a read-only closed fan + the exact public count for another
human (`cardsInHandNbr`), the SAME fan over the bot's action deck
(`actionDeckSize` — the deck it plays from and, empty, passes on). The
bonus deck stays on «Экран бота», where the deck MECHANICS live. Contract:
`hand-dock-presence.md` § THE INSPECTION CONTEXT; model:
`handDock/dockInspection.ts`.

The summary is a FOCUS RING (`infoModeState.summaryFocus`, d-pad +
`infoZoneNavigate` — TIER-aware since TR60: `INFO_SUMMARY_TIERS` declares the two
tiers with their zones' flex weights, a vertical press crosses to the zone whose
CENTRE stands nearest under / over the focused one, the satellite stays LEFT of
everything, a stranded focus lands on the first focusable zone; the initial focus
stays `vp`. ⚠ A spec never walks the ring by a memorised key sequence — the e2e
driver `focusInfoZone(page, zone)` walks the zones' own geometry): A opens the focused zone's route;
every zone opens one (a pure-readout zone would advertise a dead A and is
forbidden — `infoRoute.spec.ts` pins it); an absent zone is not focusable.
B from a detail lands the ring on the zone it was entered from (`botScreen`
family → `botdoor`). **No zone carries a button badge** — the ONE bottom
bar names the press contextually («A Открыть: Разыграно», `labelParams` on
ConsoleCommand); a satellite cell click selects the type AND opens the
extras screen. No separate bot corp zone, no «Треки бота» panel, no bot
deck tiles on the summary — all of it moved to «Экран бота».

## «СДЕРЖАННО И ДОРОГО» — the Information polish (the owner's 4K report, 2026-10-19)

TR60 made the summary a dossier; its first pass was louder than the room. The owner, on the 4K TV: the score zone
pushed categories past its plate and its text past its boxes, its focus was overloaded («нужен total ПО первостепенным
фокусом, а остальное более сдержано»); the card history was too bright and too busy; on the bot's seat text left its
blocks outright. The plates (actions, effects) were the iteration's success and set the register for the rest. Six
decisions, each guarded:

1. **THE SCORE IS ONE HERO OVER A QUIET LEDGER** (`ConsoleDossierScore`, `.con-dscore`). The total (the shield + the
   number, `[data-vpx-total]`) is the zone's ONE large type — ≥ 2.5 × every category value, e2e-measured; the share bar
   under it; then the LEDGER — two columns of rows «disc · name · leader · value» in the body's quiet type (`.con-dscore__row`
   over the old `.con-infovp__cat`, a zero row muted, a penalty with a TRUE minus U+2212). The rows are SOLVED from the
   category count (`data-dscore-rows` = ⌈n / 2⌉): a long ledger (5–6 rows — the Hydronetwork, the Moon, card penalties)
   takes the height the hero yields (`--dscore-total` 6 → 5.2 → 4.6 rem), never the frame's. A name that cannot fit
   ellipsizes in its own box (`flex: 0 1 auto`), the leader takes what is left (`flex: 1 1 0; min-width: 0`). The dossier's
   rules are scoped `.con-dossier .con-dscore__…` (0,3,0) so the TV / handheld profile rules for the overview's
   `.con-infovp__*` (0,2,1) cannot re-inflate them. The explorer's handoff anchors (`[data-vpx-total]`, `[data-vpx-bar]`,
   `[data-vpx-block]`) stand where `scoreExplorerMotion` looks for them.
2. **THE CARD HISTORY IS ONE NEAT PILE PER TYPE** (`ConsoleDossierCards`, `.con-dcards`) — the table's own law, no fan, no
   badge: the corporation's face, then per printed type ONE face (`DOSSIER_FACES_PER_STACK = 1` — the newest, upright;
   the EVENTS face DOWN, `.con-card-back`), the paper edges of what lies under it (`edgesOf(count)` — none for a lone
   card, three at most, the farthest first), and under the pile its count and its name in the ledger's quiet type. The
   face size is solved by the number of piles (`data-stacks`).
3. **THE BOT IS ONE MORE PLAYER ON THE SUMMARY** (the owner's correction of this iteration's first draft: «отличие и
   уникальная для бота подача — когда игрок переходит ВНУТРЬ блока „экран бота“; на общей панели — максимальная
   стандартизация»). The bot's door speaks the EFFECTS PLATE's grammar — four `.con-deff` medallions (`con-deff--bot-action`
   ▤ · `-bonus` ◈ · `-discard` ↺ · `-destroyed` ✕) with their public counts and one `.con-deffs__note`, centred in its plate
   (`.con-deffs--bot`); no card backs, no mat, no glyph badge on the summary (the bar names the press). LB / RB across
   the seats changes the content of the same plates, never the register. On the TV profile the door's one plate spans
   the whole plates tier, so its medallions take the tier's scale (the owner's batch, 2026-10-19: «крупнее на TV» —
   discs 5.2 rem, counts 2.9 rem, every name whole).
4. **INSIDE THE DOOR, EVERY RULE STANDS WITH ITS OBJECT** (`ConsoleMarsBotSections`, `.con-botscr` — § «Экран бота» below).
5. **NOTHING STANDS OUTSIDE ITS PLATE, ON ANY PROFILE** — the hub's prose steps down by MEASUREMENT (`fitHub`), the
   bonus faces wrap with a zoom by count, the handheld ledger values take `min-width: 0`, the handheld action art keeps
   a 2.3 / 1 aspect (its legend sat under the frame on the Deck — pre-existing, fixed here).
6. **THE CAMPAIGN IS OBJECTS** (`ConsoleDossierCampaign`, `.con-dcmp`): the mission's board in miniature
   (`PremiumMapFingerprint`, the mission card's own drawing; no frame while the campaign model loads), the route as
   nodes (done ◆ · now ◆ ringed · ahead ◇), the title points as a gold token with the titles' emblems and their scoring
   semantics, the composition count in the ledger's type.

Guards: `tests/client/components/console/ConsoleDossierPolish.spec.ts` (the rows solved from the count, the true minus,
the anchors; the piles, the edges, the events face down, no badge; the route's nodes); e2e
`console-info-polish.spec.ts` on the worst honest table (`info-dossier-rich` — two humans + MarsBot, the Hydronetwork,
card penalties, generation 10, 40 blue cards) × tv4k / fhd / deck: (A) every painted descendant of every zone inside
the zone for the own, a rival's and the bot's seat, no ledger name cut, no two pile names overlapping; (B) the total ≥
2.5 × the largest category value; (C) the bot's door = four medallions, nothing bot-only; (D) every hub plate holds its
content, the board ≥ 80 % of the opening with its three rules inside it, the discard pile shows its two faces. ⚠ A cut
name is measured on a hidden CLONE in the label's own font (`cutNames`), never by `scrollWidth`: Chromium reports an
ellipsized box's `scrollWidth` as its client width + 1 px, so «Сброс бонусных ка…» passed a `scrollWidth` check.

## The score OVERVIEW and a sparse «Разыграно» fill the opening (PL-574 / PL-575, 2026-10-17)

- **«Победные очки» (level 1)**: the grid takes the WHOLE stage (`grid-auto-rows: minmax(0, 1fr)`, `align-content:
  stretch`) and a tile is a category OBJECT — the medallion (`info/ConsoleScoreDisc.vue`, the ONE disc the dossier's
  score wears; milestones / awards: the earned emblems, so the ledger keeps only their reading), the name over a value
  at the scene's scale, the ledger at body size on the TV; a long name wraps. The handoff anchors are untouched.
- **«Разыграно» embedded**: since TR65 (2026-10-17) the embedded table is the SAME shelf planner as the standalone screen
  (`consolePlayedModel.planPlayedTable` against the host's zone — the identity column + shelves of full faces + strict pages;
  `docs/claude/console/played-table.md`); the PL-575 `fitEmbeddedRoom` / `roomGain` fit is DELETED — the planner fills the room
  by construction. The stage phrase appends the open category's label (`ConsoleInfoMode.stagePhrase`).

## The LIVE SCORE (`liveScoreModel.ts`) — one system with the finale

`buildLiveScoreModel(breakdown, {isBot, hasMoon, hasPathfinders, hasDelta})`
is a POLICY REUSE of the endgame: `FINAL_SCORING_SEGMENTS` (each segment
pulls exactly ONE field the server's builder summed — Σ ≡ total by
construction) grouped by `SCORE_CATEGORY_TABLE` (the ceremony's order and
keys, which are also the `.con-eg-cat--<key>` colour classes) with
`AUTOMA_SEGMENT_FAMILY` dissolving the bot's summands into the card
families (mcToVp → resource, neuralInstance → conditional, cardVp/corpVp →
fixed). **No opaque «Подсчёт бота» exists anywhere in the live UI.**
Category stability is per-GAME: the six core categories always render
(honest dim 0), moon/tracks/delta by table configuration, the penalty row
appends only when real — an LB/RB switch morphs VALUES, never re-composes
the list. Parity is spec-guarded against `buildConsoleEndgameVm` values
(`tests/client/components/console/liveScoreModel.spec.ts`).

- Summary zone (`.con-infovp`): total → ONE segmented bar (one hue per
  category, widths on the positive total) → the category legend. The
  `data-vpx-total` / `data-vpx-bar` / `data-vpx-block` anchors are the
  SHARED ELEMENTS of the explorer's entry.
- THE SCORE EXPLORER (`ConsoleScoreExplorer.vue`, `.con-vpx` — replaces the
  old `.con-infovpd` bar list): ONE component for the whole vp subtree
  (constant zone key — a level change is its own FLIP phrase, never an
  out-in blink). Levels are LAYERS of one surface (the overview parks under
  a category, the category under a table — cursors survive B for free);
  the descends ride `workspaceDescend` (unfold out of the pressed tile /
  fold back into it). Pure models in `scoreExplorerModel.ts`:
  · `buildScoreOverview` — tiles in ceremony order, `sharePct` =
    value/positiveTotal (THE one bar semantic; the max-category detail
    scale is retired), zero tiles stay IN the list as a quiet pose;
  · `buildTrProvenance` — Σ named rows ≡ the displayed rating (base /
    handicap / parameters / hazards / `cardEntries` sources with card ids
    and generations / the honest `legacyUnknown` residual);
  · `buildCardsHub` + `buildCardGroupTable` — the three family doors, then
    rows with the SERVER's own formula (`detailsCards[].mechanics`:
    shape / each / per / counted from the engine Counter — the client
    computes no rule), sorted by current VP desc (stored resources break
    ties, zeros below); pseudo-rows (Turmoil / Colony VP / bribe) are
    facts, never fake cards; `buildBotGroupFacts` is the bot's fold;
  · fact builders for milestones / awards (places + standings + ties) /
    cities (`detailsCities` — every owned city's own contribution) /
    greenery / hydro (track position) / penalties (every loss named).
  The PREVIEW column is the focused row's live tableau `CardModel`; X goes
  through the ONE console zoom inspector (`slotZoomOrigin` on the preview
  slot — physical origin, LB/RB browses the rows via `onBrowse`, B lands
  the card back; never the endgame's two-instance duplicate). Cursors +
  the explorer's command contract live in `consoleScoreExplorer.ts`
  (`scoreExplorerUi.barCommands` — ConsoleInfoMode republishes verbatim).
  The summary ⇄ explorer entry is `scoreExplorerMotion.ts`: proxy handoff
  for the total + bar (arm on leave, FLIP on enter, reveal-then-remove —
  the total provably never misses a frame; e2e frame probe) + the grid
  unfolding out of the legend's rect. ⚠ Reduced motion: an out-in hook's
  `done` must be a MICROTASK (`Promise.resolve().then(done)`) — a
  synchronous `done` wedges Vue's swap (the old zone stays mounted).

  ITERATION 2 (2026-08-31) — the SOURCE-LEDGER contract + MA inspection:
  · A category card NEVER draws a share track (an empty track reads as
    unfinished progress). The top segmented bar is the ONE share surface;
    each card carries a `ScoreLedger` — `chain` (an arithmetic story,
    «20 старт · +1 фора», honest «ещё N» cut), `medallions` (the REAL
    earned MA emblems — `assets/ma/<maArtSlug(name)>.png`, the workspace's
    own art) or `empty` (one quiet sentence). Uniform card geometry: a
    zero category changes INK only.
  · FOCUS↔SEGMENT: the focused/selected category's stripe stays lit, the
    others dim (`litKey`); a ZERO category lights nothing (no stripe
    exists) and the absolute share line answers «0 ПО» (`shareKey`). The
    line never pushes the bar's geometry.
  · The SHARED TOTAL keeps one structure on both sides of the handoff —
    no contextual label inside `data-vpx-total` (the «Всего»-in-one-state
    morph snap; e2e structure probe).
  · `descendCascade` animates every element to its OWN resting opacity
    (inline cleared, computed read) — a zero row can never flash bright
    mid-cascade (the measured zero-state flicker; e2e frame samplers on
    both directions).
  · TR is an ARITHMETIC STORY: `TrProvenanceRow.running` walks
    «20 → 21 → … = TR» (spec: the chain ends at the displayed rating).
  · MILESTONES/AWARDS are COLLECTIONS of real earned laurels
    (`buildMilestoneCollection`/`buildAwardCollection` — entries ONLY from
    `detailsMilestones/Awards`, enriched from the public MA models:
    threshold/score, funder, resolved standings with shared places, ties;
    award places speak LOCALIZED sentences, never the raw '1st').
    X opens the MA INSPECTION — a read-only layer inside the explorer
    (not a route): the entry's emblem FLIPs into the hero pedestal (the
    source art holds `visibility: hidden` — one physical object), the
    dossier unfolds from the entry's rect, B folds everything back
    (`consumeScoreBack` — the shell asks it before `infoBack`), a seat
    switch drops it instantly (`dropInspect`).
  · ACTUAL DATA ONLY, everywhere: cities are the REAL owned tiles
    (`detailsCities[].cardName` names the tile's card — Ganymede Colony;
    a plain city stays «Город»), hydro shows the position + the ONE
    APPLIED VP slot (never future slots), zero categories render one
    empty sentence — no placeholder rows, no future slots, no fake
    entities anywhere (a REAL card at 0 VP stays visible with its
    formula — that is a different thing from a placeholder).
- The bot's breakdown is REAL mid-game: `ServerModel` opens the VP gate for
  `isMarsBot` seats (its score is table-public by the Automa rules; a
  human opponent keeps the hidden-VP contract). Spec:
  `tests/models/ServerModel.spec.ts`.

## THE EXTRAS EXPLORER (`ConsoleExtrasExplorer.vue`, `.con-exr`) — «Доп. ресурсы»

The extras route is a full workspace screen (extras rework 2026-09-10; the
old scrolling section list is DELETED). The architecture in one sentence:
**the rail satellite is the TYPE NAVIGATION and the pixel-anchored half of
the screen; the panel hosts only the selected type's content.**

- **State**: `consoleExtrasExplorer.ts` (`extrasExplorerUi` — selected
  `typeKey`, `typeCursor`, `zone: 'types' | 'cards'`, `cardCursor`;
  `barCommands` published verbatim through `ConsoleInfoMode.footCommands`;
  reset on every info-mode open). The satellite paints the cursor
  (`__cell--cursor`) and the selection (`__cell--active`) FROM this state —
  one owner, the column and the screen can never disagree. Focused ≠
  selected: the cursor moves freely, A commits the type (a CHOICE IS A
  PRESS), and the content swap slides from the pressed cell's direction.
- **Model**: `extrasExplorerModel.ts` (pure, spec'd in
  `tests/console/extrasExplorerModel.spec.ts`). The type list is
  `additionalResourceGroups` (first-appearance order, ZERO holders
  included — the same derivation the satellite renders). Per-card VP is
  the SERVER's own `detailsCards[].mechanics` row: per-card flooring by
  construction, `special` clauses named CONDITIONAL and never folded into
  the linear «ПО от ресурсов» sum, a holder's non-resource VP kept in its
  own bucket (no double count). A hidden score (zeroed breakdown) keeps
  the PRINTED rule from the manifest and withholds every number. Payment
  grants (`railMcBadges.cardBound`) belong to the ENABLING card alone;
  protection marks ride `railProtections.cardResources`. The bot fill is
  `buildBotExtrasTypes(marsBotExtraGroups(automa, ctx))` — CARD-TYPE pools
  only, each carrying its `botNotes` (`pool` / `storage` / `pluto` /
  `corp` — one honest rule line per source kind: the shipping-board
  steal/remove law covers the ordinary areas only, Pluto's science area
  is deliberately outside it (RB-C p.5), and the floater pool / a corp
  card's store spend by their own printed rules).
- **Composition**: HERO (type icon + name + total + «Накопителей: N» +
  honest chips: VP sum / conditional / actions / «Оплата: 1 = N M€» /
  «под защитой») → GALLERY (real premium faces via CardFace lightweight,
  strict pages — 4 per page, 3 on the Deck, the page DERIVED from the
  cursor; per-card meta plate UNDER the face: ×N + the VP chip, a zero
  count calms its ink only) → the FACT STRIP (fixed height: name · ×N ·
  the printed rule `per → each ПО` · «Сейчас: N ПО» · «M до следующего
  ПО» (linear per>1 only) · usage chips). The bot fill lists its pools
  (colony areas / the common floater pool) — no card faces, no VP rows.
- **Input**: the shell forwards the pad while the route is up (global
  Y/LB/RB/B stay global); ←/→ cross between the column and the gallery
  (left at card 0 returns to the column), the gallery edge IS the page
  turn. X (and the unadvertised A alias) opens the ONE console zoom
  inspector (`slotZoomOrigin` on `[data-exr-card]` slots; `onBrowse`
  drives the cursor so the derived page follows and B lands on the very
  card being read).
- **Motion**: the screen UNFOLDS OUT OF the satellite column
  (`descendUnfold` from the column's live rect in the detail-zone enter
  hook — no proxy handoff needed: the column itself is the continuity)
  and FOLDS BACK INTO it on B; type/page swaps are directional out-in
  beats that SNAP under reduced motion (microtask `done`) and while the
  zoom viewer is open (its slot hold must not chase a transition).
- **Empty state**: a seat with no holders gets the full honest room
  («Нет карт, способных хранить ресурсы»); the satellite COLUMN simply
  does not exist for such a seat (no ghost plate) and its ring stop is
  skipped — the route stays reachable only via a seat switch, presenting
  the room, never a bare frame.

## THE EFFECTS EXPLORER (`ConsoleEffectsExplorer.vue`, `.con-efx`) — «Эффекты»

Full rework 2026-09-12 — the route hosts a first-class explorer in the
card-actions browse language: per-EFFECT family counts on the summary zone
(Триггеры / Скидки / Ценность оплаты / Правила — the old per-card
«Активные/Скидки» pair, whose discount predicate was always true, is gone),
a dossier + per-effect tile grid with honest live metas from
`/api/game/effect-stats` (version-keyed store, per-effect CHANNEL split for
multi-effect cards), and an in-explorer DETAIL layer (hero card + printed
rule + the «За партию» summary; LB/RB steps the sibling effect; a seat
switch drops it instantly). Entry unfolds out of `[data-zone="effects"]`;
the descend is the action-focus phrase re-pointed (`effect-*` keys). The
stage tail is dynamic (`effectsStagePath` — the campaign pattern). Full
contract: `docs/claude/console/effects-explorer.md`.

## «Экран бота» — the internals hub (the botdoor zone)

Everything explaining HOW the algorithm works, as a DOSSIER of the bot's internals (the Information polish,
2026-10-19): a grid of plates solved to the opening (`corp · decks · bonus / board · scoring`, a fourth column for the
shipping storage / the Hydronetwork — `data-botscr-extras`), each rule standing WITH ITS OBJECT — the paragraph of the
shared teaching layer (`marsBotGuide` sections) under the thing it explains, at the scene's scale: the corporation's
premium face + difficulty + the clock (`.con-info__block--botcorp`), the decks as piles of backs with their counts, the
bonus piles, the board's own mat in miniature, the M€ → VP ladder (`mcPerVp` from the live breakdown) + the Hard /
Brutal card-VP clause. Nothing scrolls and nothing is clipped: the prose steps DOWN by measurement (`fitHub` — a
`ResizeObserver` over the hub, `data-botscr-fit` 0 → 1 → 2, judged by every plate's `scrollHeight`), never past the
plate; the handheld flows the plates in two columns inside the ordinary `.con-info__scroll`. The two FOCUSABLE deep
entries (`.con-botscr__entry`, `[data-bot-entry="botBoard|botBonus"]`, `infoModeState.botScreenFocus`) wear the cursor
grammar (`.con-cursor()` — the ring is the plate's own layer): «Планшет бота» (`.con-botboard` — `MarsBotTracks large`
at the scene's scale, `zoom: var(--con-ui-scale)`, the legend, and the THREE rules that read it — turn · tracks ·
failed — as plates beside it) and «Бонусные карты» (`.con-botbonus` — the open piles as columns, the faces wrapping
with a zoom by count; an empty pile is its outline and one word). A d-pad press at the ring's edge degrades to a plain
scroll on the handheld, so the plates below stay reachable.

## The MarsBot rail — the PARTICIPANT presentation (`marsBotRailModel.ts`)

ONE preparation layer classifies the bot's pools by RESOURCE TYPE (the
normalization iteration, 2026-09-12) — the rail is the SAME instrument for
every seat, never a technical panel:

- **The six standard rows exist for the bot exactly like for a human**
  (`marsBotStandardRows` — canonical order, zeros as definite 0s, the
  SAME `<key>.stock` metric keys scoped by the bot color). A
  standard-typed stock is a standard row WHEREVER the Automa keeps it:
  Ceres steel / Triton titanium / Ganymede plants / Callisto energy / Io
  heat (shipping storage) and the corp's own plant store all land in
  their type's row (`sources` keeps the split for the detail surfaces).
  The bot has NO production: the rows keep the production track's
  reserved width (`--cr-prod-w`) visually EMPTY (`.con-res__prod--void`)
  — never a fake «+0», never a dash — so the value axis and the row
  geometry are seat-invariant BY CONSTRUCTION. `.con-res__rows--bot` is a
  MARKER now (no reserved-height math exists: the old `min-height` formula
  drifted from the font-driven human rows and sat МЕТКИ ~0.3rem apart;
  explicit `line-height: 1` on the value/prod ink keeps the row height
  icon-token-driven on every profile).
- **M€ is the one deliberate exception**: the row's value is the bot's
  MAIN SUPPLY only; the INDEPENDENT M€ stores (the Luna area, a corp
  card's bank/till — C06/C20) ride the row as the compact CUBE CAPSULE
  (`.con-res__store` — the `.con-valbadge` corner-layer geometry in its
  own dark-steel material, deliberately unlike the gold rate coin and the
  brown production tile; sized by the shared `--valbadge-*` tokens). They
  are never folded into the supply; the aria + «Экран бота»'s storage
  block name the split and the «spent by its own rule» semantics. No
  progress «N/5» is ever drawn over a SUM of independent stores.
- **Card-type pools are «Доп. ресурсы»** (`marsBotExtraGroups(automa,
  ctx)` — `MarsBotExtrasContext` = Venus in play + colony tiles in play,
  built once via `marsBotExtrasContext(game)`): the floater pool (exists
  while a floater mechanism exists — Venus or the Titan area — zeros
  included), Enceladus microbes, Miranda animals, Pluto's SCIENCE stock
  («MarsBot does not gain cards for Pluto. Instead it gains [science]
  resources…», RB-C p.5; the printed area reads «5 [science] → [science
  tag]», and Pluto is deliberately absent from the steal/remove list —
  its note says so), and a corp science store (Philares/Spire) — the SAME
  science type, ONE group with the split named per holder. Keys are the
  HUMAN `cardResourceKey` space; order is
  canonical (pool → board order → corp); a storable colony IN PLAY shows
  its honest 0, a mechanism not in this game never appears. Cube markers
  are state and never appear anywhere.
- МЕТКИ: the SAME tag matrix (`consoleAvailableTags` cells), counts from
  the printed tracks — the track position IS the engine's tag count
  (`AutomaTargeting.effectiveTagCount`); one track fills every of its tag
  cells (POWER+JOVIAN share a number — that is the rule); a tag no track
  serves reads «—» with `.con-tagmx__cell--na` (never a lying 0). The old
  progress-bar «Треки бота» array lives on «Планшет бота» only.

## Motion

- Open/dismiss — the `info-mode` surface-motion branches (unfold from the
  rail seam, own dim, content cascade over `.con-info__head` + the
  dossier's `.con-dossier__zone`s).
- **EVERY ZONE OPENS FROM ITS TILE (TR60, decision 8a)** — the generic
  `detailZoneEnter/Leave` (the «Кампания» precedent generalized): the
  summary's LEAVE captures every zone's rect (the enter hook runs after the
  summary has detached); the pressed zone's content lets go first (100 ms)
  and the others recede (110 ms); the detail host arrives AS that zone's
  glass plate (`.con-info__unfolding` — its `::before` is the zone's own
  gradient and edge) and unfolds to the whole room under a clip
  (`descendUnfold(…, zoneRadiusPx(), 'power3.out')` — a door that gives
  from its first frame), its rows cascading from inside; B is the reverse —
  the plate returns, the rows cascade out, the clip folds into the SAME
  zone's rect (`descendFold`), the ring stands on it (`returningZone`), the
  zone's children surface and the rest of the dossier cascades back. A zone
  that did not measure falls back to the old directed rise — never an empty
  slot. The score keeps its own shared-element handoff
  (`playScoreHandoff` — the anchors `[data-vpx-total/bar/block]` survive in
  `ConsoleDossierScore`). Guard: e2e `console-info-dossier` (D) — the
  plate's first PAINTED box (the box minus the clip's inset, task-clock
  samples only) is the zone's own, the frame never empty on the way in, B
  lands the ring on the zone.
- A seat switch keeps the key (routes are semantic) → instant patch, the
  beat is the `inspectSwitchMotion` slide; rapid presses coalesce; the
  frame is never empty (e2e (D)).
- Reduced motion: snaps (clear props), both axes.

## «Действия» in depth — THE SAME TILES, read-only (TR60, decision 6a)

The route hosts `info/ConsoleInfoActionGallery.vue`: the seat's actions as
the «Действия карт» groups THEMSELVES — `ConsoleActionGroupView.vue` (the
card plate + its printed action on the canvas, the sentence, the state
chip, the diagnostics line), extracted host-agnostic from
`ConsoleCardActions` (one markup, two hosts; `readonly` strips input, never
content) with the pure readings in `actionTileView.ts`. The groups come from
the acting workspace's own builder (`buildActionEntries` →
`buildConsoleActionsModel`, availability `all`); the viewer's own seat reads
its preview verdicts, another seat only the public «used this generation».
STRICT PAGES by the grid's cells (3 × 3, handheld 2 × 2; a two-variant card
spans two columns), the page DERIVED from the cursor (the album's law), a
few cards stand centred at a scene's scale (`sparse` — one page of ≤ 2 rows:
the used columns only, `zoom` 1.4 / 1.18; the canvas fit is a ratio of two
painted rects, so it is zoom-blind). X (and A) open the focused card's face
in the ONE zoom viewer; nothing here submits (e2e (B) watches the network).
The bar is the gallery's own (`infoActionsUi.barCommands`), the shell routes
the pad to `handleActionsIntent` while the route stands.

## «Парламент» in depth — objects (TR60, decision 9a)

`ConsoleInfoParliament` keeps every `data-parl-info-*` hook and its four
sections; the influence is a badge with its sum, the Agenda is the CAREER
LADDER (the 12 rungs of `AGENDA_TRACK`, the seat's cube on its rung, the
next reward by its icon), the delegates are TOKENS (lobby · reserve ×N ·
on resolutions · access · actions used), the table's resolutions are TILES
(the party's emblem, the name, «ПРИНИМАЕТСЯ», the compact yield). Every
text ≥ the TV floor (the compact yield's quiet lines are raised in this host).

## Command bar

PanelOwner `'infoMode'` via consolePanelUi; per-route sets in
`ConsoleInfoMode.footCommands`. Summary: `LB/RB Игроки (1) · A Открыть:
<зона> (contextual — `labelParams`; disabled with no target) · Y Закрыть
(0)`; depth 1: `B К обзору`; depth 2: `B Назад`; the played route keeps
the table's own grammar; the two explorers publish their own sets
(`scoreExplorerUi` / `extrasExplorerUi` `.barCommands`, returned
verbatim). Y(0) and LB/RB(1) survive the Deck bar.

## Tests

- `tests/console/infoRoute.spec.ts` — the tree (vp subtree included),
  capability, ring (the two tiers by geometry, the satellite left of
  everything, botdoor, a stranded focus), clamps.
- `tests/console/infoDossierModel.spec.ts` — the dossier's pure half:
  medallions (short labels, emblems), the sealed facts (no score read),
  the card history (fans, «+K», the bot's corporation), the action tiles
  (own: ready / blocked with the server's reason / used; another seat:
  idle / used only), the effect families, the ladder.
- `tests/e2e/console-info-dossier.spec.ts` — fhd + tv4k + deck: (A) two
  tiers, foot ≥ 85 %, nothing scrolls, nothing outside the frame, the total
  is the server's, the plate's three states, the delegates one row, nothing
  under the TV floor; (C) the rival — the head chip, the sealed cell, the
  public rating, no rival VP number in text or `data-*vp*`; (B) the gallery
  is the «Действия карт» groups, X / A open the face, no POST; (D) the zone
  opens from its tile, never an empty frame, B lands on the zone, LB/RB
  never blinks; (E) TR60 — its two variants in «Действия карт», its
  fighters' SET role on the satellite.
- `tests/client/components/console/ConsoleDossierPolish.spec.ts` — «сдержанно
  и дорого»: the score's rows solved from the count (four for eight, six
  for eleven, one for one), the true minus, the handoff anchors; one pile
  per type (three edges at most, none for a lone card, the events face
  down, no badge); the campaign's route as nodes, no empty board frame.
- `tests/e2e/console-info-polish.spec.ts` — tv4k / fhd / deck on the
  worst honest table (`info-dossier-rich`): every painted object inside
  its zone for the own, a rival's and the bot's seat, no ledger name cut,
  no two pile names overlapping, the total ≥ 2.5 × every category value;
  the bot's door = the effects plate's four medallions and nothing
  bot-only; inside the door every plate holds its content, the board
  ≥ 80 % of the opening with its three rules, the discard pile's two
  faces (`screenshots/info-polish/final/`).
- `tests/console/extrasExplorerModel.spec.ts` — the extras model: order +
  zeros, per-card flooring, conditional vs linear, no double count, the
  hidden-score rule fallback, payment attribution, navigation/paging.
- `tests/e2e/console-extras-explorer.spec.ts` — the satellite PIXEL
  CONTRACT (per-frame sampler over board → summary → extras → back: rect,
  value text, opacity), the screen journey (zero holder, no-VP holder,
  zoom round trip, seat switch to the bot's empty state), three profiles +
  the flow video (`screenshots/extras-explorer/<preset>/`).
- `tests/console/dockInspection.spec.ts` — the dock's inspection seat:
  source selection (self / human / bot / legacy corpless), the fan cap +
  exact count, the compact-pose geometry parity.
- `tests/client/components/console/consoleHandDockInspection.spec.ts` —
  the dock's guest presentation: read-only by construction, the bay's
  three-state priority, privacy shape of the DOM, a11y count.
- `tests/client/components/console/liveScoreModel.spec.ts` — Σ ≡ total,
  the ceremony parity (human + bot), the bot fold, TR labels, penalties.
- `tests/client/components/console/scoreExplorerModel.spec.ts` — the
  explorer levels: share math (Σ sharePct ≡ 100), TR provenance Σ ≡ TR,
  family tables (formulas, sorting, zeros, pseudo-rows), bot facts,
  award standings, the dynamic stage path, the grid clamps.
- `tests/calculateVictoryPoints.spec.ts` — the read-model extension:
  `detailsCards[].mechanics` (per/fixed/special + the floor invariant)
  and `detailsCities` (per-city contribution, opponents' greenery counts).
- `tests/e2e/console-score-explorer.spec.ts` — the whole vertical on three
  profiles: no-scroll overview, the shared-element entry (frame probe: the
  total never misses a frame), TR Σ, formulas, preview → X fullscreen →
  B (slot yields, focus survives), family sorting, bot parity at depth,
  the B chain, reduced motion; also the screenshot + flow-video source
  (`screenshots/score-explorer/<preset>/`).
- `tests/client/components/console/infoModeState.spec.ts` — lifecycle +
  route reset on open/close.
- `tests/client/components/console/marsBotRailModel.spec.ts` — the six
  standard rows (type classification, the M€ supply/store split, corp
  stores, zeros), the matrix parity, «not tracked», the card-type extras
  (context-gated zeros, canonical order), the no-double-count invariant.
- `tests/client/components/console/ConsoleResourcePanel.spec.ts` — the bot
  rail markup (six rows, void production track, the M€ store capsule,
  matrix, «—»), the satellite (type-keyed identity across a seat switch,
  the swap mode, no ghost plate).
- `tests/models/ServerModel.spec.ts` — the bot VP gate.
- `tests/e2e/console-info-workspace.spec.ts` — the full contract per
  display profile (standard / tv-4k / deck): geometry, crumb, zone parity
  (±2px), route preservation, the fallback, «Экран бота» depth walk, the
  embedded table, restore, reduced motion; also the screenshot source
  (`screenshots/info-workspace/<preset>/`).
