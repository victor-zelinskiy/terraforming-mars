# The Information Workspace (Y) — layout · inspected-player context · seam

Stage 1 of the information-panel rework (2026-07-29). The Y panel is no longer
a centered modal over the whole shell: it is a WORKSPACE that shares the main
layout with the left resource rail, and the rail is its live SUMMARY half.

## Layout — a `.con-main` child, never a fixed band

`ConsoleInfoMode` mounts INSIDE `.con-main` as an absolute child filling
everything right of the rail: `inset: 0 0 0 calc(var(--con-rail-w) +
var(--con-main-gap))`. `.con-main`'s own box IS the space between the top HUD
and the command bar, so the workspace needs no per-resolution constants.

**Seam tokens.** `--con-rail-w` / `--con-main-gap` live on `.con-main` and are
the ONE source of the rail↔workspace seam geometry: `.con-res` width and the
workspace's `left` both derive from them. Profiles override the TOKENS (tv →
9.8rem in `console_tv.less`; handheld → 7.3rem / .4rem in the handheld block)
— **never a bare `width:` on `.con-res` again**, or the workspace's left edge
silently drifts off the rail (this exact bug shipped in the first iteration:
the handheld block still had `width: 7.3rem` and the seam gaped 36px).

**Stacking.** `.con-main--info` (bound to `open || closing`) drops the
`z-index: 1` trap (precedent: `--hand`) so the workspace root (z 11560) and
the ELEVATED rail host (z 11561) compete at the root level — above every band
surface (sheets / composers / task host, 11480+) and above the workspace's own
full-viewport dim (`__backdrop`, fixed inset 0), below the bars (11700+) and
the fallback/cinematic layers. This reproduces the old fixed modal's layering
exactly, with the rail lifted OUT of the dim.

**`closing` is load-bearing:** `closeInfoMode()` raises it, the shell's
`@after-leave` (`settleInfoModeClose`) clears it. Binding `--info` to `open`
alone lets a band surface pop OVER the still-fading panel the moment Y is
pressed. A re-open mid-dismiss clears it via `openInfoMode`.

The frame body is `rgba(6, 11, 18, 0.97)` — denser than `@con-glass` (0.92),
because the workspace covers LIVE bright surfaces (the right dashboard) and
their rows ghosted through at 0.92.

## Inspected player — ONE view-only context

`infoModeState.playerColor` is the single source. The shell derives
`inspectedPlayer` / `railPlayer` (`railPlayer = open ? inspected : thisPlayer`
— the close flip is ATOMIC with `open`, no flash) and passes it to
`ConsoleResourcePanel`, which now takes:

- `own` — the displayed seat is the viewer's own. Gates the viewer-specific
  readouts: the «Приватный счёт» own-VP mask and the resource-transfer HOLDS
  (an inspected opponent's numbers must never be reduced by the viewer's
  in-flight chips).
- `vpHidden` — the game rule (`showOtherPlayersVP === false`) masks an
  inspected opponent's VP cell with the shared `PrivateScoreMask`.

Gameplay never reads the inspected context: convert-highlights are gated to
`railShowsSelf`, the ДОП.РЕСУРСЫ satellite parks while the mode is open
(`boardVisible && !open` — it would otherwise paint OVER the workspace from
the elevated rail host), and submissions are untouched.

`AnimatedMetricValue` needs no help: scope switches (PoV flips) silently
re-baseline per its manager contract, so LB/RB and close never fire spurious
delta chips, while realtime changes to the CURRENTLY inspected seat still do.

## Dedup — the rail is the summary, the panel is the detail

Removed from the panel: the resources/production block, the tags block, the
header TR/VP totals, the big VP hero numbers, the bot Economy M€ row. The ONE
exception: a `Total` row renders in the VP block/detail ONLY while the rail
masks the own score (`isSelf && shouldMaskOwnPassiveVp`) — otherwise the
number's home is the rail's score cap. Kept (detail the rail cannot carry):
VP breakdown, cards/actions/effects availability, extra card resources, the
hotkey detail screens, the MarsBot sections.

Human dashboard = three calm columns (`__cols`/`__col`, capped widths, spare
workspace width stays as breathing room); the bot dashboard keeps the block
grid (`__grid`, now width-capped).

## Seam identity — accent tokens

`ConsoleShell.conMainClasses` publishes `con-insp-<color>` on `.con-main`
while open; a LESS `each(@players)` loop maps it to `--con-insp-accent`
(-soft/-faint). Consumers: the rail's ring (`.con-main--info .con-res`
box-shadow — functional state on box-shadow, perf-lite safe), the frame's
left inset bar, the header underline. Accent drops at close START (the rail
returns to neutral with the atomic context flip); fallbacks are cyan.

## Motion

- **Open/dismiss** — own `info-mode` branches in `surfaceMotionDirector`: the
  frame unfolds from the rail seam (x −20·u, origin left) with the backdrop
  fading alongside (never a dim pop), content cascades left→right
  (`contentCascade('info-mode')`: header, then `__col`s / bot grid blocks);
  dismiss returns into the seam with the backdrop fading out.
- **LB/RB switch** — `inspectSwitchMotion.ts`: `[data-insp-slide]` zones
  (identity, head-meta, dashboard/detail container) get a small directional
  recompose matching the pressed bumper; `[data-insp-fade]` (the rail root)
  answers with an opacity dip only — the rail is the anchor and never
  travels. Rapid presses COALESCE: state lands on the final player per press,
  each call kills the live tweens and restarts from live values.
- **Close settle** — `playInspectedReturnMotion()` dips the rail once when it
  was showing another seat.
- Reduced motion: the director's generic fade covers open/dismiss; the switch
  helpers snap (clear props, no travel).

## The MarsBot rail (dedicated presentation)

Inspecting the BOT seat swaps the rail's two zones to the Automa's REAL state
(`marsBotRailModel.ts` — pure, unit-tested; the shell passes `automa` only
while the workspace shows the bot):

- the six human resource rows → the bot ECONOMY: the M€ supply (the bot
  seat's real `megacredits`) and the floater stock once it holds any — **no
  production chips**: a `+0` column would be a fake readout for a
  participant that has no production;
- the МЕТКИ matrix → the printed TAG TRACKS (`.con-tagmx--bot`): one row per
  track with **every** mapped tag medal (POWER+JOVIAN, EARTH+CITY, the bio
  track — never just the first tag), the position count and a progress fill
  toward that track's OWN max (Venus = 12, not 18). Positions clamp
  defensively; zero rows ride the matrix's dim language; the fill is
  width/opacity only (perf-lite safe). Delta chips ride the same
  AnimatedMetricValue families (`megacredits.stock`, `bottrack.<key>`).

The workspace bot dashboard drops its «Экономика» and «Треки бота» summary
blocks in exchange (the rail carries them now); the M€→VP conversion note
moves under the VP block, and the printed-board detail (X) stays the deep
reference. `ConsoleMarsBotSections` keeps decks / piles / shipping storage.

## The played-cards block + the embedded «Разыграно» (X)

Stage 2 (2026-07-29). The dashboard carries a UNIFIED «Разыгранные карты»
summary block for EVERY participant: zone counts through the SAME
`buildPlayedZones` grouping as the table (color-dot legend per family — the
palette mirrors the table's zone captions), the bot reads its public
`automa.playedPile` (`botTableauCards`) + the honest provenance note.

**X is the ONE default details verb** for every seat — it opens
`ConsolePlayedOverlay` EMBEDDED as the workspace detail `'played'`
(a SHARED detail: it survives LB/RB — rail, header and table switch seats
as one). The displaced readers moved to the sticks: **L3 = extras (human),
R3 = the bot's printed board**; keyboard parity via `KeyC`/`KeyV` in
`CONSOLE_KEY_BUTTON` (the sticks had NO keyboard binding before — a
desktop-fallback player would have been locked out).

The overlay adaptation (same component, both hosts):
- `embedded` re-seats it inside the workspace frame (`--embedded`: no fixed
  band, no own plate; the category view goes `position: absolute` over the
  TABLE AREA — the workspace header and the rail stay visible around it;
  the flights keep fixed viewport proxies — rect math is viewport-px in
  both hosts);
- `forcedColor` makes the seat CONTROLLED (the workspace's inspected
  player); a forcedColor switch folds an open category (watcher), and the
  internal LB/RB cycle is inert — the shell routes the bumpers globally at
  TABLE level only (inside a category they are dead, matching standalone);
- `automa` teaches BOTH hosts the bot seat (its tableau is empty — the pile
  is the truth); the seat name renders через `participantDisplayName`
  (the raw «MarsBot» leak in the RU UI is fixed), and the bot table carries
  the provenance line under the head;
- the embedded shell branch (`detail === 'played'`) forwards nav/A/X/B/
  scroll to the table; B folds a category first (the overlay's own close
  event returns to the dashboard); footCommands mirror `consolePlayedUi`.

### Smart open + the fullscreen PROVENANCE plate (stage 2b)

- **A one-card zone skips the grid.** `openCategory` opens the fullscreen
  DIRECTLY when the zone holds exactly one card — lifted physically out of
  its table slot (`slotZoomOrigin`) and returned into it on close. A grid
  around a single tile was ceremony. Multi-card zones are unchanged.
  ⚠️ Specs that exercise the category episode must use a MULTI-card zone
  (two existing ones were on `active`/`corporation` and silently took the
  new shortcut).
- **Every fullscreen opened from «Разыграно» carries a provenance plate.**
  `ConsoleZoomProvenance` (in `consoleCardZoom`) + `playedProvenance.ts`
  (pure: `playedProvenanceByName` over the SAME `buildPlayedZones` grouping
  the table renders from, `zoomProvenanceOver` maps it into the viewer's
  index space). The plate leads the viewer bar: seat dot + localized name,
  the verb («РАЗЫГРАНО» / «ВСКРЫТО» for the Automa — key `Flipped`), the
  printed zone, and «N / M» inside that zone (omitted when the zone holds
  one card). The seat's own colour runs through the plate's left edge
  (`con-zoom-seat-<color>` → `--con-seat-accent`, the shared `@players`
  loop). It is passed as a RESOLVER, so LB/RB browsing keeps it honest;
  hosts: the table shortcut and `ConsolePlayedCategoryView`
  (`provenanceByName` prop).
- **«РАЗЫГРАНО» is NOT stage-parked while the fullscreen is up.** The
  `body.con-zoom-open` suspend list (console.less) used to include
  `.con-played`, so the table was `visibility: hidden` for the whole dialog
  lifetime — and the class only drops in `onCardZoomClosed`, i.e. AFTER the
  return flight. The card physically flew back into a VOID and the table
  popped in a frame later. The table now stays on stage: the veil
  (`.con-zoom-veil`, z 11890, dim-strong) already covers it, its `--lifted`
  fade-out reveals the table gradually UNDER the returning card, and the
  source slot is held empty by the motion director (`.con-zoom-hold`), so
  there is never a double image. The hand dock / draft tray / journal keep
  parking. Guard: `tests/e2e/console-played-zoom-return.spec.ts`.

**Zone-swap beat:** the workspace's content zones (dashboard / played /
details) swap through an out-in gsap beat (`detailZone*` hooks). The
DASHBOARD is ONE persistent zone (`key="dash"`, the human/bot variants are
inner templates) — an LB/RB seat switch patches instantly and can never
queue zone transitions (rapid presses broke exactly this in the first cut;
Vue also forbids duplicate keys across v-if branches, hence the wrapper).

Opening the workspace closes a board-home «Разыграно» overlay first — the
two hosts share the singleton `playedCategoryState` and must never coexist.

## Command bar

`footCommands` (published via `consolePanelUi`) now carries explicit drop
priorities: Y «Закрыть» = 0 and LB/RB «Игроки» = 1 survive the narrow Deck
bar; the detail hotkey hints (X/LT/RT, priorities 2–3) drop first — they stay
discoverable on the blocks themselves. Known pre-existing issue (NOT part of
this rework): the BOT set's long RU labels («РАЗЫГРАННЫЕ КАРТЫ»…) ellipsize on
the standard bar — the fit model estimates widths from the English keys.

## Tests

- `tests/client/components/console/infoModeState.spec.ts` — the
  open/closing/settle lifecycle.
- `tests/client/components/console/ConsoleResourcePanel.spec.ts` — the
  inspected-seat VP masking matrix + the `data-insp-fade` anchor.
- `tests/e2e/console-info-workspace.spec.ts` — a real human+MarsBot game per
  display profile (standard / tv-4k / deck): seam geometry, rail↔panel sync
  on LB/RB, rapid-press coalescing, dedup, detail navigation, close restore,
  reduced motion; also the screenshot source
  (`screenshots/info-workspace/<preset>/`).
