# Console ENDGAME OVERVIEW («Обзор партии»)

The post-game analytics scene — an **internal scene of the endgame
workspace**, never an overlay over it and never the desktop
`EndgameResultsOverlay` (`.eg-results` is desktop-only since 2026-08-19; the
console CSS carve-outs for it are gone). The scoring ceremony answers «кто
победил»; this scene answers «почему партия закончилась именно так и чем она
была уникальна».

## Files

| Layer | File |
| --- | --- |
| pure VM (headline dedup, per-tab models) | `src/client/console/endgame/consoleOverviewModel.ts` |
| reactive scene state (phase, tab, focus, detail, reveal memory) | `src/client/console/endgame/consoleOverviewState.ts` |
| scene root (tab rail, pane machine, pad routing) | `src/client/components/console/ConsoleEndgameOverview.vue` |
| tabs | `ConsoleOvTabDigest/Score/Timeline/Cards/Params/Players.vue` |
| chart engine | `ConsoleOvChart.vue` (series shape in the VM module) |
| rich sentences | `ConsoleOvRich.vue` (over `buildNarrativeTokens`) |
| shared facts fetch | `src/client/components/endgame/endgameFactsCache.ts` |
| styles | `src/styles/console_endgame_overview.less` |
| specs | `consoleOverviewModel.spec.ts`, `consoleOverviewState.spec.ts`, e2e `console-endgame-overview.spec.ts` |

## The scene contract (two layers of ONE root)

`consoleOverviewUi.phase: closed → entering → open → leaving → closed`.
While `entering|open` the workspace root wears `con-endgame--ovopen`: the
scoring stage `.con-eg` PARKS (opacity + `visibility`, **never `display`** —
a re-shown `display:none` restarts CSS animations, which is exactly the
ceremony-flash family; layout must also survive for `measureTrack`), its rows
drift up staggered, and `.con-egov` unfolds where it stood. The Martian-night
backdrop, the frame and the command bar belong to `.con-endgame` and never
move — the trip reads as descending a level, not switching screens. `leaving`
is the crossfade back: the overview fades OVER the returning scoring layer,
so no frame is ever blank and the board/HUD never show through (e2e-probed).
Phase timers ride `gsap.delayedCall` through `consoleMotionMs` — kill-safe,
so rapid A/B retargets the scene instead of stranding a half-played phase.
Input lands from the first `entering` frame (a transition absorbs nothing);
the `leaving` beat already belongs to the scoring scene.

The press itself has a COMMIT beat: the «Обзор партии» pill fixes for
`OVERVIEW_MS.commit` (mint, the console commit register — never gold) before
the descent starts.

**Depth is a line, never a diamond**: `detail → tab → scoring results →
board («Свернуть»)`. B walks it one level at a time; «Свернуть» exists only
from the scoring scene; the main menu is only ever an A-confirmed action.

## Tabs — the LB/RB ring

`digest → score → timeline(«Хронология») → cards → parameters → players`,
wrapping both ways. ⚠ The tab label key is **'Chronology'**, not the desktop
'Timeline' («Графики») — never rewrite a translation you didn't introduce.

The pane swap is a strict TWO-PHASE machine in the scene root (`paneStage:
out → swap → in`, `pendingTab` retargets): rapid bumper presses can never
queue or stack transitions, exactly one pane is mounted at any moment
(hidden tabs run nothing — charts, observers and animations die with the
pane), and the slide direction follows the pressed bumper. Per-tab focus
lives in the module state and is restored on re-entry; `revealed[tab]`
remembers a chart's one line-draw per page load (the chart LATCHES the
`reveal` prop at mount — flipping it later would snap a mid-draw line).

## The information architecture (dedup before beauty)

The VM is a re-projection of the SAME layers every endgame surface shares —
`EndgameModel` (episodes/story/insights/verdict) + `ConsoleEndgameVm` (the
ceremony's category numbers; Σ categories ≡ final totals stays spec-true) —
plus `consoleOverviewExtrasFromView` (expansions, `globalsPerGeneration`,
raw per-player stats). Facts arrive through `endgameFactsCache` — ONE fetch
per page load shared with the desktop host; every scoring number is complete
without them (they only enrich episodes/insights).

- **Digest**: compact ranking echo (the ceremony rows' continuation), the
  finish VERDICT banner, story para-1 as the lead, then `selectHeadline` —
  ≤ 4 cards, role-prioritised (decisive → turning → twist → near-miss …),
  deduped on `dedupeKey ?? id`, ≤ 2 per role, `final_scoring`/`flavor_only`
  excluded (the verdict already owns the finish). Observations = the
  residual insight layer, capped 4, never repeating a headline id.
- **Score**: a category COMPARISON MATRIX (one row per ceremony category,
  every player's bar on ONE shared scale `maxCategoryValue`), the focused
  category's two-level РТ/Карты breakdown in a fixed-height context zone,
  the tie-break note, and «Наибольший отрыв» = the winner's biggest
  category edge over the runner-up. A → the full per-player breakdown grid.
- **Chronology**: the VP chart (all players, legend + cursor readout — the
  fixed game palette fails strict CVD pairs, so identity is always swatch +
  NAME + the readout, never colour alone), an episode strip pinned to
  generations (majors bigger), ←/→ generation cursor, ↑/↓ jumps between
  pinned episodes, A → the generation dossier (VP + deltas + parameter
  values + episodes of that gen).
- **Cards**: a ranked impact list in strict pages (album grammar, no scroll),
  ←/→ player-filter ring, the focused row previews ONE live-model premium
  face (stored resources honest), A → the enlarged card detail. Never a wall
  of thumbnails; ≤ 2 faces mounted at any moment (e2e-pinned).
- **Parameters**: only the tracks this game has (venus/moon expansion-gated;
  the core three always exist), all series indexed to **% completion** (one
  honest axis for °C/%/counts — never dual axes), the focused parameter in
  full ink over quiet same-hue context, ←/→ cursor readout with the RAW
  value + %, and «Кто двигал планету» per-player steps for the focused
  track. Old saves (no `globalsPerGeneration`) get the honest empty state.
- **Players**: a player ring (←/→; the bot is an ordinary participant),
  metric GROUPS on ↑/↓ (production / stock / stats / tags / MA / score
  sources) — each value carries a quiet table-max comparison bar; A on a
  comparable group → the cross-player grid at one shared scale.

## Command bar

Root: `LB◀ Вкладка ▶RB · dpad Выбрать · [A Подробнее] · B Итоги партии` —
the A hint appears only when the focused element honestly has a deeper
layer (`consoleOverviewUi.primaryAvailable`, written by the scene root).
Detail: `dpad Выбрать · B Закрыть`. The scene names itself in its own
header; the bar context stays empty.

## Performance

Hidden tabs are unmounted; the chart has no rAF loop and no filters (perf
mode safe — focus cues are box-shadow); pane/scene motion is
transform/opacity under `--motion-scale`; after settle nothing animates
inside `.con-egov` (e2e-asserted); the VM builds are plain computeds over
the settled endgame snapshot. The `.con-endgame` root selector already
covers the scene for the leak detector (`WORKSPACE_KINDS` rootSelector).

## The MarsBot endgame profile (2026-08-19 iteration)

ONE canonical card story for the bot, everywhere. `AutomaScoring` owns the
rules (M€ → VP by the final-generation rate 8→1 · Neural Instance adjacency ·
hard/brutal +1 VP per non-negative VP icon in the played pile; TR/milestones/
awards/greenery/city/colony/delta ride the standard engine paths).
`endgameModel.categoryValue('cards')` folds `automaCardsTotal(breakdown)` in,
so the INSIGHT layer sees the same «Карты» the ceremony reveals; the Cards
tab synthesizes the three bot rows (`bot:` `mc`/`neural`/`icons`) with the
ceremony's OWN segment labels and shows the real formula (stock/rate/count/
difficulty) instead of a fake card face; the filter chips read the canonical
category value **with the ПО unit** (the human chip therefore equals the
Score tab — penalties stay visible rows under their own category, which is
the whole «63 vs 61» story). Difficulty (`DIFFICULTY_LABEL`) rides the
identity line in the ceremony row, the digest ranking and the Players
profile; the award-funder chip remaps the RAW server name through
`OvPlayers.displayNames` (never «MarsBot» in a localized UI). The Players
tab gives the bot its OWN groups (`boteco`/`stats`/`bottracks`/`ma`/
`categories` — no fake production/stock/tags), and a metric bar renders only
when ≥2 participants carry the metric (`OvPlayers.comparable`) — a lone
value is a plain cell. `analyzeAutomaCards` tells the DOMINANT bot card
source factually (never «luck» — the engine has no expected-value data for
bot draws). Specs: `consoleOverviewBot.spec.ts` (classification per source,
the Score=Cards=Players=Insights invariants, difficulty ladder, honest-bars
rule, human-only regression, the diagnostic contribution table).

## E2E

`tests/e2e/console-endgame-overview.spec.ts`: the seamlessness probe
(no `.eg-results` sample, no HUD-through sample, no blank frame, one root
box) around the descent/return; the six-tab ring + wrap; a rapid-bumper
burst landing true with ONE mounted pane; d-pad depth + B hierarchy on
score/cards/players; re-entry restoring the tab; quiet-after-settle; a 4K
five-player fit sweep (no scrollable overflow, no clipped RU labels).
`console-endgame.spec.ts` §7 keeps the round-trip smoke in the main journey.
