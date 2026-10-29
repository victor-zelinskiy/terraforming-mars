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
   its PLACE»; the stage publishes `holdsCard` / `emergedFaceEl` through its hooks) — and since iteration 3 so does
   EVERY card whose face stands on screen (`reactorPlaces.ts`, § iteration 3); everything else surfaces at THE ONE
   STAGE of the app-level layer (`ConsoleCardReactionLayer.vue`, `.con-reaction__face[data-reaction-card]` — the
   centre of the central opening). Invariant 15: transform and opacity only — no halo, no filter, no breathing.
4. **The token is born on the REACTOR's effect row** — `effectIconEnds.resolveEffectIconEnds(face, printedEffect,
   specs)`: the declared block (the card file's `printedEffect`, the n-th EFFECT frame in print order — never an
   action frame), else the frame that PRINTS the token's resource, else the whole face; the icons by the ONE icon
   grammar of every commit beat (`resolveGainIconEnds` — the k-th token on the k-th icon, a production step on its
   plate), as OBJECT ends re-measured at the birth (T06). A face that prints no such icon births nothing — that
   token ticks, by name (`cardReactionState.degraded`). THE CAUSE IS MARKED, NOT A BIRTH PLACE (the owner's
   decision 2): the played card's tag / the composer's chip wears a one-shot kant (`[data-reaction-cause]`,
   `con-reaction-cause` — a `@keyframes` that ends on its own) while the token is born on the reactor.
5. **THE ONE STAGE is the centre of the central opening** (iteration 3 — the owner, 2026-10-27; it REPLACES the
   seat beside the receiver of decision 7, whose «right of the rail, centred on the row» put the M€ reactor in the
   top-left corner, its degrade in the top-right and a rival's beside the chip — three corners, «неинтуитивно») —
   `reactionStageSlots(opening, n, {uiScale, maxSlots, scale})`: a card-shaped slot of `REACTION_STAGE_SHARE` (34 %)
   of the opening's height (capped at the natural frame × uiScale), centred in the opening the band geometry mirror
   publishes (`--con-stage-t/-b/-l/-r` — the same box a workspace's band stands in, so the place is the same in EVERY
   state, over a composer's receipt too); several groups are ONE ROW of up to `REACTION_STAGE_MAX_SLOTS` (3; a
   handheld takes 2), centred, played left to right; a RIVAL's face stands there too, `REACTION_RIVAL_SCALE` (0.8)
   smaller, under a caption with its seat's dot and name (`.con-reaction__caption`). Nothing is avoided any more — a
   card the player is CHOOSING (a reveal, a deck pick) is WAITED for instead (`waitDecisionClear`, bounded 6 s). The
   layer stands ABOVE every band by its z and is `pointer-events: none`, so the ONE visibility verdict
   (`transferEndVerdict`) knows it: the hit test under a reactor's face names the band it paints over, and that band
   is never «cover» for it — without that exemption a token born on a reactor over a standing composer was refused as
   `covered` and ticked (Supercomputer C on the box, the first run of iteration 3).
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
   story). **A press or a navigation HURRIES — a pace, never a cut** (iteration 3: `hurryCardReactions` → what is
   left plays at `REACTION_HURRY_PACE` 2.4 — every face still rises, every token still flies, the read beats shorten;
   a SECOND hurry past the one-gesture window is `cutCardReactions` — whatever is left ticks at once, the faces let
   go; the shell fires it from every `press` at the top of `handleIntent` and from the `section` / `sheet` watchers
   when a surface OPENS — a fold home is the flow's own ending). Since iteration 3 the chain's steps go by EVENT
   (the previous group's last birth + the overlap's share of the flight, the slot's own recede) — the plan's times
   are the ceiling's arithmetic and the probe's reading, never a schedule a slow device can bunch.
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

## Iteration 3 — «МЕСТО · ТЕМП · НЕПРЕРЫВНОСТЬ» (the owner's field report of 2026-10-27, PL-1077…1084)

The owner tested the CI build of iteration 2 and named four defects; each is a law now.

17. **A CARD THAT STANDS ON SCREEN REACTS IN ITS PLACE — never a second instance** (PL-1077; TR18 Martian Fiber's
    «+1 data here» woke its own «data added: +1 M€» while the card stood as the composer's hero, and the framework
    rose a COPY beside the rail). `reactorPlaces.ts`: a REGISTERED host's place answers first (`registerReactorPlace`
    — the receiving stage's and the start seat's own choreographies stay as explicit `emergence`), else the DOM's —
    the first VISIBLE painted face on the product's own hooks, most specific first: `data-reaction-home` (the action
    composer's inner hero body, lifted through `data-reaction-lift`), `data-composer-card` (a target miniature),
    `data-played-key` (the played table's stacks, the start dock, the city payout plate…), judged by the ONE
    visibility verdict every flight end uses (`firstVisibleEnd` — covered, hidden, faded or receded faces are no
    place), never the reaction layer's own face, never a sliver (a cascade's title band). The face is LIFTED in place
    (`liftInPlace` — scale 1.05, a 3 % lift, transform only, `data-reaction-lifted` while forward), its effect row lit,
    its tokens born on it, then settled (`clearProps`). The director's `rise` asks the place for BOTH shapes.
18. **TWO TEMPI** (PL-1079; the owner: «быстро» was for MANY effects). `reactionTempo(groups)`: CALM for one or two —
    rise 420 (a lift from 6 % below with a hair of scale to FULL opacity — a protagonist, not a seat's .94), a READ
    beat of 480 with the effect row lit as the WHY (`markReactionRow` → `[data-reaction-row]`, a one-shot
    `@keyframes con-reaction-row` kant whose length is the beat's), births 90 ms apart, a SETTLE of 240 after the last
    touchdown (the counter's delta lands under the eye), recede 320 — ≈ 2.2 s a card; QUICK from `REACTION_MANY_GROUPS`
    (3) — the assembly scene's numbers, overlapping on the row of slots, under the ceiling as before.
19. **A HURRY IS A PACE, NEVER A CUT** (PL-1080) — law 7 above. A press while reactions play never holds input and
    never cuts the scene; the first press paces, a later second press completes.
20. **A RISE STARTS ON A PAINTED FACE, AND THE CHAIN GOES BY EVENTS** (PL-1081 / PL-1082 — the Steam Deck's one-frame
    rise: the face was MOUNTED in the task of its rise, the premium face's layout + art decode stalled the main thread
    for the length of the tween, and the GSAP clock — wall-clock — completed the rise, the read and the births in the
    first frame that came; the chain's absolute schedule then bunched the later rises into the same frame). The faces
    are WARMED at the seed (`warmReactorFaces` — mounted hidden in the layer at the stage's size, `--warm`, the art
    decoded under the cause's own scene; a rise TAKES the warm face over under the same key, `seatReactor`, so the
    element survives), `riseReactor` poses the face at opacity .002 (painted — never `visibility: hidden`, which
    rasters nothing) and starts its tween only after two painted frames (`nextPaintedFrame`, the probe tick — never
    rAF); the read beat is counted from a painted frame of the risen face; the steps start on the previous step's
    `launched` (its last token LEFT) + `pop + arc − overlap`, and on their slot's own recede. A stall now STRETCHES the
    chain; it never swallows a face. Diagnostics: `reaction:rise` in the transfer trail names `place` / `stage`.
21. **Honesties kept, two fixed**: a reactor never covers a card the player is choosing (`waitDecisionClear` — the
    reveal, the deck pick; bounded, PL-1083); the quick chain's flights were SLOWED by `pace: plan.pace` (a transfer
    pace above 1 is slower — the featured pace) while its waits quickened — now `1 / pace` (PL-1084).

Guards: `cardReactionModel.spec` (two tempi, the row of slots, the stage's geometry on three openings),
`cardReactionDirector.spec` (hurry = pace, the one-gesture window, the later cut), `reactorPlaces.spec` (registry
first, the DOM's visible face, never the layer's own, never a sliver), `cardReactionStage.spec` (the warm take-over
under one key); e2e `console-card-reaction` — MANY / BOARD / RIVAL / SCALE re-aimed at the stage (`expectAtTheStage`:
every face in the opening's middle, a protagonist's size, two never in one box), FIBER (the hero lifted, its row lit,
its M€ born on it, no copy in the layer — fixture `card-reaction-fiber`), HURRY (one B — every face still rises,
nothing summarized) and SLOW (the handheld under a 4× CPU throttle — every face stands ≥ 320 ms, the row holds two);
`console-supercomputer` (C) re-aimed from PL-220's chip birth to the framework's (the Fiber's +2 M€ — two tokens off
ITS printed M€, the chip marked, never a birth place — red since iteration 1 and unnoticed until this run).

## Iteration 4 — THE ENACTED LAW IS A REACTOR (the owner, 2026-10-27, PL-1085…1089)

The owner: «срабатывание эффектов карт резолюций тоже через фреймворк — когда они и так на экране, с них просто
летит, когда нет — всплывают (например «Поддержка лесничества» и размещение на поле); и для таких кейсов игроку не
должна приходить обычная нотификация — чтобы не дублировать инфу». Four laws, each on the SAME primitive:

22. **A RESOLUTION'S SCOPE WRITES A RECORD** (PL-1085). `EventRecorder.recordReaction` admits the enacted law's
    scope (`ParliamentHandler.enactedPassive` → `withEffectSource({kind: 'resolution'})`) beside a card's and a
    corporation's: `kind: 'resolution'`, the catalog id in the face-key slot `card` (the premium face's own
    convention — `resolutionPremiumVm` keys a law's face by its id; a ResolutionId never collides with a CardName),
    the cause the trigger site states (the tile and its cell for `tile-placed`). Nothing else changes on the server:
    the law's marker, its log line and its model stay what they were.
23. **THE LAW RISES — OR REACTS IN ITS PLACE — AND ITS CHIPS LEAVE ITS OWN PRINTED ICONS.** The tile scene DECLARES
    the law wave's rows in the apply block (`lawWaveSpecsOf` → `declareHeldAnswers`), so the seeder ATTACHES the
    record to the scene; `runLawWave` asks for the flight (`cardReactionAnswerFlight({rows})`) — `prepare` brings
    the law forward out of its place when a face of it stands on screen (the government's card and the composer's law
    hero carry `data-reaction-home="<id>"` — law 17's registry), else at the ONE stage (law 18's calm tempo, the
    effect row lit); every beat of the wave then births its chips on the law's printed icons through a `ReactorOrigin`
    (`adjacencyPayoutBeat` — the water, the groves — and `runPrintedBonusBeat`): the neighbours still WAKE as the
    cause (the pulse), nothing condenses in them, the token is not board-sourced; `onDone` settles and recedes the
    law after the last beat. The layer paints a law face as `PremiumCard :vmOverride` (`resolutionPremiumVmById`) —
    the same object the government shows — under `data-reaction-kind="resolution"`.
24. **ONE END SHORT — THE WHOLE BEAT KEEPS ITS OLD CHOREOGRAPHY** (PL-1087). A face that prints no icon of the
    resource (Development Craze prints «bonuses ×2», no steel) cannot be a birth place: `reactorEndsFor` accepts the
    reactor only when EVERY chip of the beat has an end on it; else the chips condense where they used to (the
    cell's icons, the water) while the law still rises as the cause and recedes after. Never half a beat off the
    face and half off the cell.
25. **A REACTION THE SCENE PLAYS IS NOT TOLD AGAIN** (PL-1086). The director marks every OWN reaction it will play at
    the seed (`reactionToldOnStage.ts` — chain root · seat · source; the record's `root.actionId` IS the law marker's
    `correlationId`, pinned in `CardReactionRecord.spec`; only with the layer mounted and never in reduced motion),
    and `lawAnswerNotification` builds no «Сработал эффект» card for that key. The apply block runs BEFORE the feed
    ingests the response's events (the `accessToldOnStage` precedent), so the mark is always there when asked. A
    RIVAL's reaction keeps its card: that card is about the rival's move, not the reactor. The summary card past the
    ceiling names a law as a RESOLUTION token (PL-1088). **The order is not assumed** (PL-1090 — the box's first run
    showed the card beside the risen law): the events read legitimately lands before the transport applies the
    response, builds the card and stashes it while the chain is open; so the ingest holds a chain the APPLIED VIEW
    still lists as open (`viewOpenCorrelations`, united with the coherent read's set — a card never presents before
    the view the scene plays on), the SERVER's ring rides the ingest (`cardReactions` off the applied view —
    `ringTellsReaction`: a resolution record under this chain, for this seat and law, with a share the scene flies
    says «the scene plays it» with no clock at all), whether the scene can play is the director's registered probe
    (`registerReactionScenePlays` — the layer mounted, motion not reduced; a spec registers its own), and the ONE
    answer `reactionTold` (the mark ∨ the probe ∧ the ring) is asked at the build AND again at the presentation
    (`toldByTheScene` in `presentRootModels`, against the last pass's ring). The director marks every own group at the
    seed (an attached one too — a declared row is the host's word that it presents the payout itself) and again at
    the claim. **And the feed WAITS for the view** (the box's third run: the record right, the law risen, four births —
    and the card still standing): the events read lands while the transport still HOLDS the old view behind the
    landing cinematic, a view with neither the chain open nor the record, so a viewer's own law card the applied view
    cannot vouch for waits in PREPARING under the RING GRACE (`awaitsRing` / `graceHeld`, `RING_GRACE_MS` 4 s): the
    view that carries the record DROPS it (the scene tells it), a view that never does RELEASES it at the grace's end
    (Urban Development's draw — no scene — presents as before; never silence). The
    REPLACEMENT gates (RX35 `terraforming-diverted`, RX42 `rating-vetoed`) leave no record at all — the struck icon
    under the law's seal, the pick's receive and the named skip are their telling; a reactor would tell it twice and
    fly the data a second time (`REPLACEMENT_TRIGGERS`, guarded in `DivertedResearch.spec`).

Guards: `CardReactionRecord.spec` (Forestry Support on a city beside two groves — kind, cause, the root ≡ the
marker's correlation), `cardReactionDirector.spec` (the told marks: own / rival / no stage / reduced motion),
`notificationModel.spec` (the law card suppressed by chain · seat · law, kept otherwise); e2e
`console-parliament-forestry` (the law at the stage for a readable beat, four births `reactor:<law>:*` landing on
the rail, no coin in a grove, no `:law` card at any instant) and `console-parliament-craze` (the law at the stage
for its second wave, no card).

## Iteration 5 — THE STAGE AT THE RAIL'S EDGE (the owner, 2026-10-27, PL-1091)

The owner, on the iteration-2 frame of Lotus Innovations standing beside the rail: «не лучше будет вернуть
отображение всплывающих карт ближе сюда — зона ближе к фактической точке назначения, куда летят ресурсы». It is: every
destination of a reaction stands on that side of the screen — the rail's rows, the score cell, the «Доп. ресурсы»
satellite, a rival's chip in the strip — so a card at the centre (iteration 3's one place) stood far from what it
changed, sent every token across the planet and covered the board where the tile had just landed.

26. **THE ONE STAGE IS THE RAIL'S EDGE.** Still ONE place in every state (law 18's protagonist size, tempi, caption,
    warm faces — unchanged): the row of slots grows RIGHTWARDS from the free canvas's left edge, on the rail's
    resource line. `reactionStageSlots` takes an `anchor` (`left`, `centreY`) and clamps the row inside the opening;
    the director's `stageAnchor` MEASURES both — the opening's left edge, moved past a hero column a workspace stands
    at the band's edge (`STAGE_EDGE_OCCUPANTS`: the action composer's hero wrap, a law / party hero, the play
    composer's card — judged by the one visibility verdict, so a hero parked under a hosted step does not move the
    edge; the owner's «сдвиг за героя»: one place by meaning, the free canvas's edge), and the midpoint of the
    M€ … heat rows' span. No rail measurable (a spec): the opening's own edge and vertical centre.

Guards: `cardReactionModel.spec` § the rail's edge (the edge, the measured anchor, the clamps, the row growing
rightwards, the fit from the edge); e2e `console-card-reaction` (`expectAtTheStage`: a face flush with the edge,
every face right of the edge and in the rail's row, on the resource line) and `console-parliament-forestry` (the law
flush with the edge, on the line).

## Iteration 6 — A PARTY IS A REACTOR, and the Hydronetwork reads «СРАБОТАЕТ» (the owner, 2026-10-27, PL-1099…1101)

The owner: «карточки партий сейчас вообще никак не подключены в новый фреймворк (например поднятие производства
тепла когда правят зелёные) — хотя премиум вид карточек партий у нас есть. И вторая итерация — интерфейс
гидросети: показывать «сработает» и R3 чтобы embedded войти и осмотреть, какие эффекты сработают.» Decisions taken
with the owner: a party's tempo is the CARDS' (CALM for one or two), a choice stage's answers stand ON THE OPTION
TILES (the plan row and R3 follow the chosen option), and the Hydronetwork's answer rises AFTER THE RESULT.

27. **A PARTY'S EFFECT IS A RECORD OF KIND `party`** — the party's name in the face slot (the charter face's own key,
    `partyPremiumVm`; a PartyName never collides with a CardName), written by the same `withEffectSource` scope the
    live hooks already open (`ParliamentHandler.forEachEffect` — the Greens' 2 M€ per TR step on `tr-increase`, their
    M€ production on `production-gain`, Mars First's tile on `tile-placed`, now with the tile's cause). The layer draws
    it as the party's CHARTER (`PremiumCard :vmOverride`, theme `charter` — the composer's hero, the inspector, the
    effects explorer: ONE object); the composer's party hero is its PLACE (`data-reaction-home="<party>"`, law 1 of
    iteration 3); the summary card names it as a party (`LogMessageDataType.PARTY`), never as a card. The rail's two
    halves compose it like any record; the scale-step rating beat subtracts its M€ and the chain plays it AFTER the
    rating story (law 20) — a standard asteroid under the ruling Greens: the degree's rating lands, then the charter
    rises at the rail's edge and its 2 M€ are born on the charter's printed M€. **Every host that flies the party's
    answer ITSELF declares it** (`declareHeldAnswers` — the Career walk's `queueAgendaBonuses`, the enactment tail's
    `rulingChangeDraw`, and since 2026-10-28 the sitting's REWARD WAVE: `seedParliamentRewardHold` declares a law
    payout's `reaction` entries and `beatReward.flyReactions` claims and finishes the attached record — the answer
    leaves the ruler's plaque as before, and the charter no longer rises a second time at the rail's edge after it,
    its tokens standing in the air until the wave budget's safety: a blocking `resource-transfer` hold at «rest»,
    `console-parliament-sitting-reward` RX05 / RX03). The seeder's trail names the class: `standaloneOverRawHold`.
    **…and the chain waits for the SITTING'S BEATS** (`waitSittingQuiet` — the `parliament-sitting:<stage>[/<beat>]`
    holds, bounded 40 s on top of each beat's own ceiling): a record of the sitting's response nobody's wave declares
    rises at the rail's edge only once the beats have played, never into the reward wave — the generic 12 s blocking
    wait is shorter than a sitting, and the charter rose BESIDE the plaque's chip.
    **…and A STEP OF THE CAREER CARRIES ITS OWN ANSWER** (2026-10-28, the gap the waits above left): `ChairmanSeat.walkAgenda`
    MEASURES what the seat's stock / production gained around each step's bonus (`server/parliament/standardMoves.ts` —
    the ONE measure `rulingAnswers` is read by too; a step pays a rating or a card and nothing in stock, so the gain IS
    the table's answer — the ruling Greens' 2 M€ first of all; MarsBot measures nothing, its card is 1 M€ under the hood)
    and records it on the step (`AgendaAdvanceStep.answer` → `lastAdvance.steps`, a law walk's outcome, the sitting's
    `summary.agenda.answer`). The sitting's ПОВЕСТКА (`detectAgendaBonus`) and the quest (`detectChairmanQuestAdvance`
    → `seedQuestAgendaBonus`) ride it on the TR step's entry — held with the rating, DECLARED at the queue, so the
    party's record attaches and `flyAgendaAnswer` tells it a beat after the step's chip (the charter at the rail's edge,
    the enactment tail's and a card walk's own grammar) — and both hosts wait for it to LAND (`agendaAnswerSettled`)
    before their next beat: ПОДДЕРЖКА, the quest's receipt never start under the charter's tokens. A card's walk keeps
    its preview's verified promise (`agendaWalkReactions` — the play's rail half hands the M€ over by the same preview,
    `withoutAgendaWalkAnswers`; a server fallback there would double-hold a play that carries its own rating). A law
    walk's answer stays the reward wave's `reaction` record (the phase's scan). Guards: `AgendaWalk.spec` § THE TABLE'S
    ANSWER, `ParliamentPhase.spec` § THE WINNER'S STEP, `parliamentRewardBeat.spec` § THE WINNER'S STEP / § LANDS BEFORE,
    `chairmanQuestFlow.spec` § THE QUEST'S STEP.
28. **THE HYDRONETWORK'S PLAN READS THE TABLE'S ANSWER BEFORE THE PRESS.** The server's `DeltaTrackDestination.forecast`
    (`DeltaProjectExpansion.destinationForecast` — the FORECAST TWIN of `resolveReward`, `stageRewardEffects`, pinned
    against the live grant for every stage by `tests/delta/hydroStageForecast.spec.ts`; the crossed stages' fixed
    rewards under a traversal, the movement bonuses the cards pay; through `rewardReactionForecast` — the parties,
    the law, the card reactors, the cascade) and, for a CHOICE stage, `forecastOptions` — one per option in the stage's
    option order. The plan body carries a RESERVED «⚡ сработает» line under the gains (`[data-hydro-fxline]`,
    `ConsoleForecastDoor`): a fixed stage's answer there; empty for a choice stage (it answers nothing by itself).
    The choice step CONFIRMS ITSELF (A on an option seals it and arms the commit right under it — the plan body is
    never returned to), so each option tile prints ITS OWN note (`[data-hydro-choice-fx]`, the composers' «ИЛИ»
    grammar) and at the step's CONFIRM stage the same line with the chosen option's door stands IN the choice layer
    (`.con-hydro__fxline--choice`; a traversal's choice returns to the rail and carries none). R3 opens the `hydro`
    forecast host's layer INSIDE the workspace on either level (`forecastCanOpen`: the plan's browse, or the choice at
    its confirm stage; `ConsoleForecastLayer`, the three columns parked under it by `.con-hydro__panel--fxopen`, the
    crumb «ГИДРОСЕТЬ › … › ЭФФЕКТЫ» via `forecastStageText('hydro', …)`); B / R3 fold it with the choice intact; a
    cursor move to another stop folds it (its answer is another forecast); a target pick, a payment, a commit fold it
    instantly; the section's unmount closes it.
29. **THE HYDRONETWORK'S OWN STORY FIRST.** The chain's `waitHydroStoryQuiet` waits while the flow's commit stands
    at `moving`, the marker is active, a traversal's legs are pending, or the terminal ceremony plays / is owed (the
    ceremony's hold is notification-only, so the blocking wait never saw it); the reward wave is `waitRewardPayoutQuiet`'s
    — bounded like the blocking wait: the marker glides, the stage's reward wave lands, THEN the Greens' charter rises
    at the rail's edge past the hydro's context column (`.con-hydro__ctx` joined `STAGE_EDGE_OCCUPANTS` — the hero
    column of this workspace) and its M€ production is born on the charter's printed row for the M€ production plate;
    the flow's RESULT stage opens on the rail's holds letting go, i.e. after the charter's answer has landed. ⚠ The
    result stage is deliberately NOT waited for: `hydroResolutionBusyOf` holds `resolving` while ANY rail hold stands,
    and the chain holds the party's row — a wait for `result` was a mutual wait broken only by the 12 s bound (the
    charter rose 13 s into `resolving` on the box).

Guards: `tests/events/CardReactionRecord.spec.ts` § a PARTY's effect, `tests/delta/hydroStageForecast.spec.ts`,
`cardReactionSummary.spec`; e2e `console-card-reaction` § PARTY (the asteroid under the Greens — the charter at the
stage after the rating's touchdown, `reactor:Greens:*` births landing on the M€ row) and § HYDRO (the order probe: the
charter never while `moving` / `resolving`), `console-hydro-forecast` (functional: the empty line before the choice,
the heat tile's note, the door after the pick, R3 → the layer → B, the commit's two productions) on the `hydro-greens`
fixture.

## What this iteration did NOT migrate (named, honest)

**A STAGED play's reactor rises at a SEAT, never out of its place.** Every green card that places a tile — every
card Hartlan Heating answers — is a staged play (the cell pick is the last reversible step): the hand's landing
ritual runs BEFORE the cell confirm with no reward beat (`runStagedPlayedLanding` / `finishStagedPlayedLanding`),
the card is SEALED on the board, and the response's hero is inactive — so nobody declares the table's answer and
the record goes STANDALONE: Hartlan surfaces at the stage (the centre of the opening since iteration 3) after the seal wave (`BOARD` / `MANY` on
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
  corporation rises at the stage (the centre of the opening since iteration 3) and its 6 M€ and the preservation are born on ITS printed effect
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
the ONE primitive would move that rise to the stage, against the owner's 2026-10-25 decision — left as
is until the owner says otherwise), the hero's `holdHeroAnswers` path for a card-resource answer with no record. A
`card-resource` group with NO scene holding it is held and flown by the standalone chain to the holder's satellite
cell.

## TR82 Proteus — the START SHELF is a reactor's place (2026-10-27, PL-1093…1095)

A corporation answering a Prelude's tag (Proteus — `matchingPreludeTags`) lies on the start shelf «РАЗЫГРАНО» while the
Prelude is played. No new host: the chain finds it IN ITS PLACE through `reactorPlaces` (the shelf's top slot carries
`data-played-key`), lifts that face, births on its printed effect row. Two things the shelf owed the framework: the top
face of a HOLDER wears its live model (`ConsoleStartPlayedDock.capsuleModelOf` — the capsule ticks on the touchdown;
the ladder's `.con-start__played [data-played-key] .pcard__res` rung lands the token there), and the deployment may not
settle while the chain plays (`deploymentSettled` ⇐ `reactionStage.phase === 'idle'`) — released first, the last
Prelude's answer rose at the stage and landed on the satellite. The owner's decision 3 asked for the first action's rail
module to host the Preludes too (`startPlayRail`); with iteration 3's ONE PLACE the framework already does it, so no
second rail module was written — the question stands in the TR82 report. e2e: `console-proteus` (A).

## TR84 Titan Holdings — a corporation that answers ITS OWN play (2026-10-27)

«Including these»: the corporation's own Earth + Jovian pay it 2 leverage through the same `onCardPlayed`
(`playCorporationCardScoped` fans out over the table the corporation already stands on) — ONE record, the cause the card
itself. The deferred corporation of the start queue is a forecast DOOR like a Prelude (`queueForecastCard` takes
`kind: 'corp'`): its play preview already carries its own facts (the forecast adds the played card to the reactor set),
so the status rail reads «Сработает: +2 [leverage]» and R3 opens the same layer. The reaction itself rides the record:
the corporation rises in its place (the shelf / the seat — `reactorPlaces`) or at the stage. e2e: `console-titan-holdings` (A).

**The start is a REGISTERED place (PL-1098).** A corporation's own answer can arrive in the same response as the solo
colony step, while its face stands nowhere yet (it is on its way from the queue to the shelf / the seat). The start scene
registers itself (`registerReactorPlace` — every corporation the ceremony carries, never during the first action's own
rail): `emergeTarget` waits, bounded (2.4 s on `probeTick`), for the face to stand and lifts it there. The director also
waits for a face still under its deal hold (`waitPlaceArrival`), and a rise at the stage names every face it rejected
(`reaction:rise` → `places`: selector · verdict · height · hold).

## TR78 Arwind Inc. — A REACTOR THAT ASKS: the ANSWER STAGE (2026-10-28, the owner's field report)

A corporation whose effect answers a WALK of the Career («add 1 fighter to ANY card» per step) owes the table a question — or,
with no other holder, a landing. The first cut asked per step, made the player press the one card they could choose, played
the framework's standalone chain a second time after the player's own pick (the record attached to nobody — a pick's receive
scene holds nothing the seeder reads), and hosted the question in three ad-hoc ways. Four laws now (`docs/TURMOIL_REDUX_ARWIND_INC.md`):

30. **THE RECORD'S CAUSE NAMES THE WALK** — `CardReactionCause.walk {reason, from, to}`, stated by `ChairmanSeat.answerWalk`
    (ONE `withEffect` per walk, after the last step's bonus). The console chooses the stage's host off it — the quest's flow,
    the sitting (the winner's step on the enactment page, a law's on the reward page), a card's walk — never off `lastAdvance`.
31. **A REACTION THE PLAYER DIRECTS IS TOLD BY ITS OWN SCENE** — the pick's receive (`promptReceive`, born on the asker's face
    on the stage: `asker:<sprite>`) or the layout's (`tableAnswerBeat.runTableAnswerPayout`) notes the answer BEFORE the apply
    block (`noteTableAnswerTold`); the seed then only DECLARES the record's rows (`declareHeldAnswers`), so the reaction
    seeder attaches it to the stage and the standalone chain never rises for it. The feed builds no card (the attached mark).
    Two mechanics carry it (the first box run, 2026-10-28): the seeder's raw-hold attribution of a card-resource row never
    UNDERCUTS a declaration (`Math.max` — a told scene holds nothing, and the raw loop once zeroed its row into a second
    chain at the rail's edge), and the beat RESERVES the record (`reserveCardReaction(seq, 'table-answer:told')`) so no
    host's flight takes it either.
32. **A REACTION NOBODY ASKED FOR IS A RECEIPT ON THE SAME STAGE** — the asker alone: the server lands the units; the
    answer stage (`ConsoleParliamentTableAnswer`, `.con-tans` — the asker's face on the hero wearing `data-reaction-home`,
    the recipients' row beside it) is the fourth ATTACHED host: the seed holds the capsules and declares the rows, the host's
    beat (the quest's `afterAgenda`, the sitting's `beatTableAnswer`, the hand walk's `playWalkAnswer`) asks
    `cardReactionAnswerFlight({rows, reserved: TABLE_ANSWER_RESERVATION})` — the seed RESERVED the record for the stage
    (`reserveCardReaction`; `Attached.reserved`), so the play scene's UNFILTERED claim («every attached group» —
    `heroAnswerFlight` / `answerHeroAfterWave`) skips it instead of rising the asker at the rail's edge for nothing and
    leaving the stage with no flight; a reserved group is a flight's only under the same name. `prepare` lifts the asker IN
    ITS PLACE (law 17), `originOf` births each token on its
    effect row, the token lands in the recipient's capsule on the stage (the transfer ladder's `.con-tans [data-tans-card]
    .pcard__res` / `[data-receipt-card]` rungs), `onDone` settles. Nobody standing to host it → the record stays the chain's
    (the reactor at the rail's edge, the holder's satellite cell).
33. **THE QUESTION IS ONE** — N steps → N units in ONE prompt (the family's layout over ≥ 2 holders, else its pick), stamped
    `agendaWalkPrompt` on both shapes; the composer pre-collects it as ONE row (a layout with LB/RB lanes); the Parliament hosts
    it on the same stage (`[data-embed-slot="parliament-answer"]`, published by the stage once it has ENTERED — the picker never
    paints inside an unfolding surface).

Guards: `tests/client/console/tableAnswerBeat.spec.ts` (detect · host · seed · told · the layout gate), `tests/console/agendaReaction.spec.ts`,
`tests/parliament/AgendaWalkHook.spec.ts`; e2e `console-arwind-inc` (A · A2 · B · B2 · C · C2 — the probe counts the ASKER's face at the
reaction layer: ZERO beside the stage's own telling; another reactor of the same response — the ruling party's charter answering
the Career's M€ — rises there legitimately, so a probe asking «told once» names the asker, never «any face»; a red prints every
face's name and the director's `reaction:*` trail).

## TRP9 Medical Institute — a PRELUDE answers its own play (2026-10-29, PL-1117 · PL-1118)

The start's reactor place (`ConsoleStartScene.startCarriesReactor`) held CORPORATIONS only; a PRELUDE whose effect
answers its OWN Science tag is still in flight from the queue to the shelf «РАЗЫГРАНО» when its reaction rises, so the
director raised a second instance at the reaction stage. The place now holds a carried prelude too (the face is the
shelf's `data-played-key`, or the seat «Источник» while its pick stands — waited for as PL-1098 waits for the seat).
Its «where?» pick after the draw stands INSIDE the start: `playOwesTargetPick` keeps the play claim through every seam
of the take (PL-1117). Contract: `docs/TURMOIL_REDUX_MEDICAL_INSTITUTE.md`.

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
`reactor:<card>:<sprite>` (`transferWitness.ts`). Iteration 4 (the enacted law): `server/parliament/ParliamentHandler.ts`
(`enactedPassive`'s `cause`), `console/cardReaction/reactionToldOnStage.ts`, `components/notifications/notificationModel.ts`
(`lawAnswerNotification`), `console/tilePlacement/consoleTilePlacement.ts` (`lawWaveSpecsOf`, `runLawWave`),
`console/tilePlacement/adjacencyPayoutBeat.ts` (`ReactorOrigin`, `reactorEndsFor`), the law-face hosts
`parliament/ConsoleParliamentGovernment.vue` / `ConsoleActionComposer.vue` (`data-reaction-home`); e2e
`console-parliament-forestry`, `console-parliament-craze`.
