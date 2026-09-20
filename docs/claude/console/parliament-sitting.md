# The Parliament sitting — the console contract (after the final run, 2026-09-19)

The political phase of Turmoil Redux is ONE workspace flow: `ПАРЛАМЕНТ › ЗАСЕДАНИЕ › ВЕРДИКТ | ПРИНЯТИЕ | НАГРАДА |
ВЫБОР | ПОЛУЧЕНИЕ | РАЗМЕЩЕНИЕ | ОБНОВЛЕНИЕ | ЗАКРЫТИЕ`. The rules that carry it live in `.claude/rules/console-ui.md`
§ THE PARLIAMENT SITTING (laws 1–8); this page is the map of the pieces and the numbers behind them. Design:
`docs/TURMOIL_REDUX_PARLIAMENT_ASSEMBLY.md`; implementation history: `docs/TURMOIL_REDUX_PARLIAMENT_SITTING.md`
(Э0–Э4) and `docs/TURMOIL_REDUX_PARLIAMENT_FINISH.md` (Э5 · Э8 · ПОЛИРОВКА · Э9); the journal:
`docs/claude/parliament-sitting-progress.md`.

## 1. The pieces

| Piece | File | What it owns |
| --- | --- | --- |
| Position | `console/parliament/consoleSittingFlow.ts` | the pure read of the server's step + the viewer's own prompt → stage / page / reward step (`sittingPositionOf`, `sittingPagesOf`, `sittingStageAt`, `sittingPrimaryKey`) |
| Surface | `components/console/parliament/ConsoleParliamentSitting.vue` | the stages as POSES of one mounted surface; titles nothing (the crumb is the host's) |
| Host | `components/console/ConsoleParliamentSection.vue` | the workspace root, the stage zone `[data-embed-slot="parliament-stage"]`, `stageHeld` / `deferredStep` (a pose held through a same-response step change), the played-stage memory |
| Beats | `console/parliament/sittingBeats.ts` → `sittingDirector.ts` | one GSAP master timeline per stage under a named hold; `beatReward` = impulse → wave → reaction → receipt |
| Reward ledger | `console/parliament/parliamentRewardBeat.ts` | DETECT → SEED → OWE → FLY; `REWARD_HOLD_SAFETY_MS = 8 000`, `AGENDA_BONUS_HOLD_SAFETY_MS = 30 000` (idle net, re-armed by `noteAgendaBonusProgress`); `parliamentRewardDiag()` |
| Display holds | `console/parliament/parliamentDisplayHolds.ts` | what the tiers STILL SHOW until the object has moved (returns, support, hidden cubes, lobby, fresh faces, deck pile, `govAwaits`, `parked`, and **`heldSlots`** — the voting slots as they stood while the REWARD pose is held through a step that already refreshed the table; `noteSlotsBeforeYield` / `takeSlotsBeforeYield` carry it across the board yield) |
| Flights | `parliamentFlights.ts` + `ConsoleParliamentFlightLayer.vue` | shell-mounted proxies (never a section teleport) |
| Reward address | `src/common/parliament/rewardAddress.ts` | outcome kind → stage / zone / reaction unit (guarded by `rewardAddress.spec`) |
| Embedded draw | `components/console/externalDraw/ConsoleExternalDrawWorkspace.vue` | the intake INSIDE the stage: no ghost, FLIP after landing, L3 = the resolution, the ONE status rail |

## 2. The reward stage, in order

1. The response lands. `seedParliamentRewardHold(before, after)` runs in the SAME synchronous block as the view apply
   (`gameTransport.seedRewardHolds` for an own submit, `App.update()` for a poll / WS): the rail paints
   «committed − held» — no phantom «−N».
2. The ledger OWES: the blocking hold `parliament-reward-owed` keeps the next door (`followUp` / `placement` / `host`)
   and the field pose waiting.
3. The director's `beatReward` takes the owed records, plays the ACTION COMMIT impulse on the carrier card's printed
   graphic, runs `runResourceTransfers` from those icons into the rail; every touchdown `markRewardLanded` — the
   counter ticks IN THE LANDING FRAME with its delta chip. The ruling party's reaction flies from the ruler plaque
   after the own chips have landed.
4. The Agenda bonus (`kind: tr | card`) rides the marker's glide (the glide is PENDING WORK of the enact stage):
   TR flies from the reached step's icon; a CARD bonus parks its reveal batch (`parliamentParksReveal`) until the
   glide lands, then the cover lifts off the step itself.
5. The reading language: `resolving` («ЭТА ВЫПЛАТА») until every chip has landed → `applied` («ПОЛУЧЕНО»). ONE kicker
   («ВАША НАГРАДА») for the panel's whole life; the state is the one word that moves.
6. A skip is a plate («ПРОПУЩЕНО · <награда>» + the reason, once); a foreign pick is a wait line with the seat's chip;
   a winner tile yields the stack to the board and comes back to the same stage in the «received» pose.
7. A HELD pose keeps the table (final polish A.6): when the next server step arrives WITH the record (the adjourn of
   a resolution that asks nothing) or the frame comes back from the board, the columns keep the losers with their
   ribbons and tallies (`parliamentHolds.heldSlots`, a sync snapshot of `view.slots`), and the renewal's holds are
   seeded BEFORE that render (`seedRenewalHolds` is idempotent); the renewal's entry releases the table and its beat
   flies the losers off the same homes. The returning delegates' touchdown lights the owner's reserve stack once
   (`con-parl__stack--landed`, re-keyed on the landing, ends on `animationend`).

## 3. The status rail of the embedded draw (`console_extdraw.less` § THE STATUS RAIL BUDGET)

Four members on ONE fixed-height row: NAME · CAUSE · PROGRESS pill · availability note (icon · title · fact).
- Every cut is an ellipsis INSIDE the member's own box — `text-overflow` never paints on a flex box, and a member
  cut by an ancestor's overflow says nothing about what was lost (`expectRailHonest`).
- STRICT yield order: name = progress (whole) > fact > cause (≥ 6rem) > title (≥ its icon). Strictness is
  `flex: 1 1 0` + `min-width` + `max-width: max-content` on the yielding member — a `flex-shrink` weight splits the
  overflow proportionally and trims everyone (`expectDrawRailHierarchy`).
- Handheld: four members do not fit 571 px; the CAUSE stands on the rail only while no availability note needs its
  room (the source plate and the reward chip beside the stage already state it).

## 3-bis. The surfaces around the sitting (final polish A)

- The announce plate is the console's ONE mandatory chassis at its shared position; the parliament's plate differs
  by CONTENT only — kicker «ПАРЛАМЕНТ», ask «Заседание», the family's «Открыть» — so it stays inside the band
  between the off-Mars spaces (560 px at 1080, 470 px on the Deck); the handheld density ladder of the plate lives
  in `console.less` (`html.con-profile-handheld .con-mandatory`). Guard: `console-parliament-announce.spec.ts`.
- The resolution inspector's footer carries the viewer's vote as the vote panel's own fact rows
  (`ConsoleZoomVoteFacts` over the shared `ConsoleVoteFactRow`; the party effect's edge is the status chip's own
  projection `unlocksWithVote`); the party column is rules only. The footer is TWO ROWS on every profile — the
  facts (standing · fact rows · reading · the winner's chip) over the verbs (delegate · paging · close) — and a
  member yields width only by wrapping its own lines (`flex-shrink: 0` on the chips, `min-width: auto` on the
  reading; a squeezed fact row cut its one-word key); the winner's chip drops its kicker beside the fact rows.
  The scene's actions band is FIXED per profile (8.5rem / 8.4rem Deck — sized for the tallest composition) and
  the console viewer's fit engine reserves the band it has (`CardZoomModal` reads `.card-zoom-actions`), so the
  plate never overlaps the card; guard `expectInspectorFooterWhole` (`parliamentDrive.ts`).
- The vote panel's reading row: the reading beside the party box (`.con-parl__info-party` — the emblem inside the
  printed formula + one line of moment), both stretched to the row's height, the box at ONE width per profile
  (13rem / 17.5rem TV / 9rem Deck — the line of moment wraps to two lines on the TV and the Deck); the panel's
  height is set by measure (`--con-parl-info-h` 9.9 / 10.6 / 8rem)
  with the resolution's graphic at the card's own size (`--con-parl-info-mech-zoom` .95 / .9 / .66) and the cards
  at `MAX_VOTE_ZOOM = 1.12`.
- The shared workspace head pins every member to ONE crumb line (`--con-wshead-line`, 2rem / 1.6rem Deck) from the
  top — the parity residual of «Действия карт» on the TV/Deck is zero (`KNOWN_TOP_RESIDUAL = {}`).
- The Information workspace's party strip is a BAND above the effects explorer (`.con-info__efxhost` is a column).

## 4. Profiles

| | 1080 | TV 4K | Deck |
| --- | --- | --- | --- |
| rem | 20 px | 40 px (`--con-ui-scale`) | ~17.5 px |
| stage status rail | `--con-ws-foot-h` | 2.6rem (2.5rem chips) | — |
| vote panel (`--con-parl-info-h`) | 9.9rem | 10.6rem | 8rem |
| party box beside the reading | 13rem | 17.5rem | 9rem |
| inspector actions band (`.con-zoom--parliament .card-zoom-actions`) | 8.5rem | 8.5rem | 8.4rem |
| crumb line (`--con-wshead-line`) | 2rem | 2rem | 1.6rem |
| party tile state row | 1.3rem reserved | 2rem reserved | 1.3rem |
| big draw (6 cards) | 3 × 2 | 3 × 2 | 3 × 2 |
| cause on the draw rail | ≥ 6rem | ≥ 6rem | only without a note |

## 5. The probes

- `tests/e2e/console-parliament-gallery.spec.ts` — 11 journeys × 3 profiles × {standard, reduced, fx-lite}; on every
  pose: FITS (`expectParliamentFits`), paint baseline, fx-lite «no infinite animation», reduced «no own proxy, holds
  ≤ 2 s»; frames `screenshots/parliament-final/<preset>/<mode>/NN-<surface>.png`.
- `console-parliament-sitting-reward.spec.ts` — the reward wave: travel, landing in the cell, the tick in the landing
  window, reactions after own chips, the CARD bonus park.
- `console-parliament-stability.spec.ts` — the overview is still while the player points.
- `console-parliament-chassis-parity.spec.ts` — the crumb row on the shared chassis («Действия карт» is the reference;
  TV/Deck residual pinned as a ratchet in `KNOWN_TOP_RESIDUAL`).
- `tests/console/parliamentGlossary.spec.ts`, `parliamentNoTimers.spec.ts`, `parliamentNoLocalStorage.spec.ts`.
- The driver: `tests/e2e/parliamentDrive.ts` (`PARLIAMENT_PRESETS`, `sittingStage` / `sittingStep`, `turnTo`,
  `answerGateAs` / `answerAsksAs` / `passAs`, `expectParliamentFits`, `expectRailHonest`, `waitSittingAtRest`,
  `openParliament`, `focusParliamentZone`).

## 6. Traps this flow paid for (each is a memory note too)

- A `<transition>` without `appear` plays no enter on the first render — queue the opening from `mounted()`.
- A watcher reading a child's prop in the parent's pre-flush pass sees the previous patch — `flush: 'post'`.
- A computed whose `&&` starts with a DOM query hides the reactive term — the reactive member first.
- GSAP `clearProps: 'transform'` leaves `transformOrigin` — clear both.
- Never rebuild `build/` while a Playwright run serves it — a page loads mid-write and the red is an artifact.
- JS `\b` never fires beside Cyrillic — RU guards use `(^|\s)`.
