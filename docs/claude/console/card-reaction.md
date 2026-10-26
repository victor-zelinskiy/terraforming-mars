# «СРАБАТЫВАНИЕ КАРТЫ — ОДИН ФРЕЙМВОРК» — the card-reaction scene (as built, 2026-10-26)

A printed effect of a card on the player's table fired because of something the player did — a green card with
a tile was played (TR80 Hartlan Heating), a city landed (Tharsis Republic, Rover Construction, Immigrant City,
Pets), a tag was played (Point Luna) — and the player SEES which card answered and where the resources came from:
the card comes forward, its tokens are born on the printed icons of ITS effect row, they fly to the rail, the
counters tick on the touchdowns, the card recedes. Fast, in groups, under a wall-clock ceiling, and never slowing
the scene of the play itself. Before this iteration the console had three «rises» that did not know each other
(the assembly scene's trigger, the banner stage, the asker's plate), a fourth inside the receiving stage, and the
table's answer was born anywhere but on the card that paid: on the played card's TAG (T06), on the composer's
«Сработает» CHIP (PL-220), on the scale's marker, or it simply ticked (a board placement, a single-trigger draw,
every corporation in most hosts). The owner, 2026-10-26: «стандартизировать под новый фреймворк».

## The laws (a violation is a bug)

1. **The record is the SERVER's — `GameModel.cardReactions`.** The event recorder publishes ONE
   `CardReactionRecord` per passive-effect scope that produced an impact (`EventRecorder.recordReaction`, on the
   FIRST impact; every later impact of the same scope — a deferred gain restored under it — is appended): the
   reacting card and its kind, the channel the hook fired on (= the forecast fact's `source.channel`), the root
   (the chain's `correlationId` — the SAME id a draw batch's `actionId` carries), WHAT WOKE IT (`cause`: the played
   card, the tile and its cell, the tag, the scale — stated by the trigger site through `withEffect(…, cause)`), and
   what landed in order with its recipient. The `scaleStepRewards` ring law: bounded (16), never serialized,
   consumed once by `seq`. A hook that only logged leaves no record. The client never infers «Hartlan fired» from
   a counter's delta, and every viewer reads the SAME record (the rival sees the same scene on their screen when
   their own table reacts). The forecast stays what it is — the PROMISE before the press («Сработает», the R3
   layer, the prewarmed faces); the record is the TRUTH after it.
2. **ONE predicate for «a card that places a tile»** — `server/cards/cardPlacesTile.ts`: a declarative
   `behavior.tile / city / greenery / ocean` ∪ the co-located `placesTile: true` of a bespoke placement. Hartlan's
   live hook, its forecast twin and the worklist guard (`tests/cards/greenTilePlacers.spec.ts` — every playable
   card of the scope, the predicate ⇔ the play preview's placing step) read the same function, so the promise and
   the gain agree BY CONSTRUCTION. Never the forecast's `ctx.tiles` (the OPERATION's tiles: clamped at the ocean
   ceiling, split by branch).
3. **ONE rise primitive** — `console/cardReaction/cardReactionStage.ts` `riseReactor` / `recedeReactor` (alpha
   0 → .94, y +14 → 0, `power2.out`; the recede the reverse) with the assembly scene's numbers byte for byte
   (260 / 150 / 220, overlap 140; reduced 140 / 60 / 120 / 60 — pinned against `intakeAssemblyTimings` in
   `cardReactionModel.spec`). The assembly scene's trigger rises through it too (`intakeAssemblyDirector`). A card
   that stands in the RECEIVING STAGE rises OUT OF ITS PLACE instead (`emergeTarget` — TR53 «the card comes out of
   its PLACE»; the stage publishes `holdsCard` / `emergedFaceEl` through its hooks); everything else surfaces at a
   SEAT of the app-level layer (`ConsoleCardReactionLayer.vue`, `.con-reaction__face[data-reaction-card]`).
   Invariant 15: transform and opacity only — no halo, no filter, no breathing.
4. **The token is born on the REACTOR's effect row** — `effectIconEnds.resolveEffectIconEnds(face, printedEffect,
   specs)`: the declared block (the card file's `printedEffect`, the n-th EFFECT frame in print order — never an
   action frame), else the frame that PRINTS the token's resource, else the whole face; the icons by the ONE icon
   grammar of every commit beat (`resolveGainIconEnds` — the k-th token on the k-th icon, a production step on its
   plate), as OBJECT ends re-measured at the birth (T06). A face that prints no such icon births nothing — that
   token ticks, by name (`cardReactionState.degraded`). THE CAUSE IS MARKED, NOT A BIRTH PLACE (the owner's
   decision 2): the played card's tag / the composer's chip wears a one-shot kant (`[data-reaction-cause]`,
   `con-reaction-cause` — a `@keyframes` that ends on its own) while the token is born on the reactor.
5. **The seat is beside the RECEIVER** (the owner's decision 7) — `reactionSeatRect(stage, receiver, avoid, height,
   slot)`: right of the rail (the left hull member), centred on the receiving row (a holder's satellite cell for a
   card resource), a card-shaped box of a reading size (≤ 22 % of the stage, ≤ 320 px × uiScale), sliding past the
   hero, the composer's focus card, the reveal's row, the start stage and the emergence layer (down, then up),
   the top-right corner at a reduced size when nothing is clear; the second seat stands below the first.
6. **Two shapes, one director** (`cardReactionDirector.ts`): **ATTACHED** — a host already HOLDS the reaction's
   rows (the play scene's rail half, the action commit's — the table's answer promised by the forecast and
   verified against the two views) **and DECLARED them** (`declareHeldAnswers` in the same apply block — the rail
   module's `seedRailReward` for its verified reactions, the hero's PL-035 `holdHeroAnswers`; the seeder takes the
   ledger once per block): a host's OWN promise on the same row is never mistaken for the reaction's share (the
   first field run: a standard project's +1 M€ production absorbed Tharsis Republic's, which then ticked unseen
   under the placement scene's release — `cardReactionDirector.spec` § own promise). A holder's cell keeps the
   raw-hold attribution (the hero's card half and the board's cell scene hold AND fly those themselves). The host
   asks `cardReactionAnswerFlight()` and gets a `RailAnswerFlight` whose
   `prepare` rises every claimed reactor (out of its place or at a seat, 80 ms apart), whose `tokensOf` splits a
   held row into the RECORDS' shares (a wave of six off the printed heat — `reactionTokensOf`, cap 6; what no
   record names keeps the tick), whose `originOf` births each on its group's effect row, whose `onDone` recedes
   the faces; the rail module keeps its holds, its order and its release (`answerRailReward` awaits `prepare`,
   re-holds the split tokens, calls `onDone` once). A host composes it over its old flight
   (`composeAnswerFlights(reactor, tag | chip)`): the hero's `heroAnswerFlight` and `answerHeroAfterWave`, the
   action rail's `flyActionCommitRail`. **STANDALONE** — nobody holds the rows (a standard project's city, a
   reaction with no host scene): `seedCardReactionHolds` (LAST in `gameTransport.seedRewardHolds`, after every
   host, with the rail holds snapshotted BEFORE them — `snapshotRailHolds`) holds the viewer's own rows and the
   holders' cells in the apply block and plays the chain after the board's own story (`waitRewardPayoutQuiet`):
   rise → hold → birth on the effect row → fly → tick on touchdown → recede, group after group.
7. **The chain is a PLAN with a ceiling** (`planReactionChain`, the owner's decision 4): groups in the server's
   order; the next rises `overlapMs` before the previous group's last landing on the OTHER seat (two faces never
   share a box — two seats from the second group on); from THREE groups the chain quickens (`pace` 1.35); a group
   whose rise would start past the ceiling — `REACTION_CHAIN_CEILING_MS` (1.8 s), `REACTION_CHAIN_CEILING_MANY_MS`
   (2.4 s) from FOUR groups (`chainCeilingFor`; the owner's decision 2026-10-26 on PL-1059) — is not risen: its counters tick at once and its
   name stands on the state (`data-reaction-summarized`); the play's own scene never waits for the chain beyond
   its own tempo (the attached flight is the hero's answer beat; the standalone chain plays after the board's
   story). **A / B hurries** (`hurryCardReactions` — the hero's result skip calls it): whatever is left ticks at
   once, the faces let go.
8. **The hold is notification-only and bounded** (`card-reaction`, the registry's ceiling with `expire` → abort):
   a reaction never holds a question. Reduced motion claims the records and holds nothing (the counters tick with
   the commit). **And the chain's rows SURVIVE a foreign scene's belt-and-braces clear** — the tile scene's
   `clearPanelRewardHold()` «safety» at its end (the start bonus's, the hydro marker's, the nomads' too) drops every
   hold on the board, and on the first field run it ticked Tharsis Republic's 3 M€ a beat before its tokens were
   born: the director is a `registerRewardHoldKeeper` (the `vpHoldKeeper` precedent, TR55) — the clear re-seeds
   what the chain still holds, held TOKEN BY TOKEN (`entry.held` is exactly what has not touched down), released
   by each touchdown, by A / B (the queue AND the batch in flight) or by the ceiling.
9. **PL-124 on the framework**: a holder that pays ITSELF on its own hook (Decomposers' microbe) has emerged — its
   token is born on ITS effect row (`originsOnHolder`), the woken tag marked; a holder whose face prints no such
   icon keeps the T06 birth on the tag.
10. **A single hook's draw rises its trigger too** (the owner's decision 5): `intakeAssemblyPresentsBatch` — a
    one-cause batch whose cause is a card NOT on the stage goes through the assembly scene (the trigger surfaces
    beside the row and deals from its printed draw icon) instead of degrading to the deck; the claims and the parks
    keep judging by `intakeAssemblyOwnsBatch`.

## TR81 Lotus Innovations — the third ATTACHED host, one rise per play (2026-10-26)

11. **The START STAGE is the third ATTACHED host** (`console/startFirstActionRail.ts`; the hero and the action commit are
    the other two). A corporation's first action that pays the rail (Lotus' «+2 TR») has a rail half of its own — ARMED
    at the stage's A off the briefing's preview (the action's rail gains, a rating split into one token per printed
    plate; the forecast's exact rail rows AND capsule rows as the reactions), SEEDED in the apply block before the
    reaction seeder (so the record ATTACHES — the capsule row is the raw-hold attribution), FLOWN by the stage: the
    rating tokens off the seated face's printed TR plates into the score cell, then `cardReactionAnswerFlight` with
    the SEAT as the reactor's place (`ReactorEmergence` — the seated face lifts in place, transform only), the tokens
    born on its effect row landing in its OWN capsule (the seat wears the live model; the transfer ladder's
    `.con-start__embedsource [data-start-seat-card]` rung), the rating cell marked as the cause. The stage's completion
    barrier waits for the half and the reactor's settle.
12. **One play, one rise** — `mergeCardReactions`: records of the same card of the same owner under the same root are ONE
    group (the first record's `seq` and `printedEffect`, every impact appended). A rating card that raises a scale AND
    prints a TR calls the rating funnel twice — two records — and its reactor rises once.
13. **A card resource is a wave too** — `reactionTokensOf` counts a card-resource GAIN one token per unit (cap 6), so
    «+2 [data]» is two tokens and the capsule ticks twice; a loss stays one token.
14. **A corporation is a holder of the play scene** — `playCardReactions` admits a `corporation` source (a corporation
    lies in the receiving stage's own zone and rises out of it). **An answer to the play's RATING is the rating's
    answer** — a `tr-increase` fact is never a holder group flown BEFORE the TR: `ratingAnswerSpecs` puts its capsule
    rows into the play's rail half (the composer, the start's prelude rails), so the reactor rises one beat after the
    TR's touchdown (`heroAnswerFlight` → `cardReactionAnswerFlight` with the receiving stage's emergence); with no
    rating of the chain's own (a scale's TR, a walk's) the answer is the scale's / the walk's story and leaves the half
    (`withoutScaleStepAnswers` / `withoutAgendaWalkAnswers`).
15. **The Parliament's sitting field is on the seat's avoid list** (`avoidRects`); the standalone chain plays after the
    blocking scenes (the sitting's beats) — a rating the sitting paid is the cause, its token lands first.
16. **A rating reactor waits for the SCALE's rating story** (`waitRatingStoryQuiet`, bounded like the blocking wait): a
    scale step's TR is the scale-step rating beat's, born on the marker once it has ARRIVED, under a NOTIFICATION-ONLY
    hold the blocking wait never sees — on the box the asteroid project's Lotus data rose and paid at 0.85 s while the
    step's TR left the marker at 1.9 s. A standalone batch with a `tr-increase` record now starts once
    `scaleStepRatingBusy()` falls; a reactor to the step itself (Homeostasis Bureau) is not held by it. e2e:
    `console-lotus-innovations` C (the data born after the rating's touchdown).

## What this iteration did NOT migrate (named, honest)

**A STAGED play's reactor rises at a SEAT, never out of its place.** Every green card that places a tile — every
card Hartlan Heating answers — is a staged play (the cell pick is the last reversible step): the hand's landing
ritual runs BEFORE the cell confirm with no reward beat (`runStagedPlayedLanding` / `finishStagedPlayedLanding`),
the card is SEALED on the board, and the response's hero is inactive — so nobody declares the table's answer and
the record goes STANDALONE: Hartlan surfaces at the seat beside the rail after the seal wave (`BOARD` / `MANY` on
the box). «Out of its place on the receiving stage» is reached only by a play that lands on the receiving stage
(a non-tile play waking a corporation — Point Luna's Earth tag). With FOUR rail groups off one staged play (MANY:
Tharsis · Rover · Immigrant City, then Hartlan's DEFERRED gain last in the server's order) the fourth rise would
start past 1.8 s — the reactor the forecast PROMISED was the one that ticked without a face; the owner's decision
(2026-10-26, PL-1059): from four groups the ceiling is 2.4 s, the server's order stays, every face is seen.

**Iteration 2 (2026-10-26, PL-1060…1067) migrated the rest of the first list** — each on the same primitive, none
on a second one:
- **Pristar's income** — the production hooks run under their OWN effect scope on the server (`Player.ts`,
  channel `production-phase` → a record), the generation scene DECLARES the hook rows and composes
  `cardReactionAnswerFlight` over its mark flight: the mark on the rating cell CHARGES as the cause while the
  corporation rises beside the rail and its 6 M€ and the preservation are born on ITS printed effect
  (`console-pristar` E: `+6 reactor:Pristar`, `+1 reactor:Pristar`).
- **The scale step** — the step's OWN reward keeps the marker (TR24 — the marker is the law, and the beat DECLARES
  it); a CARD's answer to the step (Homeostasis Bureau's 3 M€ per temperature step) is the chain's, risen beside
  the rail, and the rating beat subtracts the records' M€ before matching the party's answer
  (`cardReactionMegacredits`) — the Greens' 2 M€ are never refused for the card's 3 (`SCALE` on the box).
- **The board's cell scene** — a holder paid by a city (Pets' animal) is born on the HOLDER's printed icon on its
  plate (`cityDataPayoutBeat` re-plots the token proxies through `resolveEffectIconEnds`), the paying cities
  answering with their wakes — the cause, marked; a face printing no such icon keeps the city's edge.
- **A RIVAL's reactor** — a record whose owner is another seat (`rivalSpecsOf`: the stock / production / rating
  addressed to that seat) rises COMPACTLY beside that seat's chip in the status strip (`RIVAL_SEAT_SCALE`, the
  receiver = the chip), after the viewer's own chain, with the strip clear of workspaces (bounded — a covered strip
  skips the rise, the feed tells it); its tokens are born on its effect row and land on the chip's INTAKE plaque
  (`statusIntake` — opened EXPECTING before the birth, ticking «+N» per touchdown), a production step on the chip's
  dot wearing its frame (the plaque prints stock only). Nothing of the viewer's is held.
- **The summary past the ceiling** (PL-1056) — ONE feed card «Эффекты карт» (`cardReactionSummary.ts` →
  `pushTransient`): the viewer's merged deltas leading, one line per summarized reactor with its card token, a cause
  per reactor, «В журнал» as the way in. Never a card per reactor, never a silent tick.
- **The chain waits for every BLOCKING scene** (`waitBlockingQuiet`, bounded at 12 s) — a sitting's beats, a
  landing — so PoliticalScience's data on the Parliament's refresh rises after the renewal, never into it.
- **Attribution hygiene** — every host that flies a card's reaction ITSELF declares its rows (`declareHeldAnswers`):
  the scale-step beat (TR24 / Aphrodite off the marker), the patent sale's answers, the tile scene's doubled printed
  bonus (TR79's second pass), its Ares neighbours and the table's answers to a city payout, the remote placement's
  income; the seeder's trail names any standalone row that sits over an undeclared raw hold
  (`standaloneOverRawHold` — the next double flight shows up there first).

**Still not migrated, by name**: the banner stage (TR77 Septem Tribus:redux — the card rises OUT OF THE VOTING
TABLE'S CELL where the eye is, the cube born on its printed glyph: the framework's shape on its own choreography;
the ONE primitive would move that rise to a seat beside the rail, against the owner's 2026-10-25 decision — left as
is until the owner says otherwise), the hero's `holdHeroAnswers` path for a card-resource answer with no record. A
`card-resource` group with NO scene holding it is held and flown by the standalone chain to the holder's satellite
cell.

## Files

Server: `common/models/CardReactionModel.ts`, `server/events/EventRecorder.ts` (`recordReaction`, the `cause`
parameter of `withEffect`), `Game.publishCardReaction`, `ServerModel`, `cards/cardPlacesTile.ts`,
`cards/turmoilRedux/HartlanHeating.ts`. Client: `console/cardReaction/{cardReactionModel,cardReactionStage,
effectIconEnds,cardReactionDirector}.ts`, `components/console/cardReaction/ConsoleCardReactionLayer.vue`,
`styles/console_card_reaction.less`; hosts: `resourceTransfer/railReward.ts` (`RailAnswerFlight.prepare /
tokensOf / onDone`), `played/consolePlayedHero.ts`, `consoleActionCommitRail.ts`, `transport/gameTransport.ts`,
`cardIntake/intakeAssemblyDirector.ts` + `intakeAssemblyPlan.ts`, `deckDraw/ConsoleDeckDrawLayer.vue`,
`played/ConsolePlayedReceivingStage.vue`. Guards: `tests/events/CardReactionRecord.spec.ts`,
`tests/console/cardReactionModel.spec.ts`, `tests/client/console/{cardReactionDirector,effectIconEnds,railReward}.spec.ts`,
`tests/console/intakeAssemblyPlan.spec.ts`; e2e `console-hartlan-heating` (B · C · A), `console-card-reaction`
(MANY · BOARD) — TIMING class, fixtures `hartlan-heating` / `card-reaction-many`; the witness anchor
`reactor:<card>:<sprite>` (`transferWitness.ts`).
