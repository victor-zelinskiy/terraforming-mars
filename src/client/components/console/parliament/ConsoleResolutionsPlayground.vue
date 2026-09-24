<template>
  <!--
    REDUX RESOLUTIONS — the playground stand («Полигон» → «Витрина резолюций
    Redux»). One instrument for THIS resolution and every one after it: the
    catalog as it ships (the client manifest — nothing hand-drawn here), the
    face at the three sizes the game uses and in the REAL fullscreen viewer,
    the influence-scaled payout under a chosen CONTEXT for a chosen TEST
    PLAYER, every seat's own payout side by side, and the SHARED recipient
    picker with a resolution source. Every number on this screen comes from
    the same model the game uses (`influenceYieldModel` → the common
    `scaledAmount`); every face is the same `PremiumCard`.

    SCENARIOS make a reading reproducible: each one sets the whole instrument
    (who looks, both seats' Agenda positions and card bonuses, the winner, the
    context, «no eligible card») — influence 0 / 1 / several, the winner's
    Agenda step counted before the enactment, influence beyond the track, a
    forfeited payout, a recorded payout, a spectator. The pad then moves any
    one parameter from there, and the chip says the scenario was modified.

    A resolution whose effect COUNTS the tableau (Architecture Award: «+1 M€
    production per Building card with a non-negative VP icon + influence, max
    5») gets its own scenario family: each seat holds a synthetic tableau of
    REAL card definitions, counted by the SHARED predicate the server uses
    (every card shows its verdict — counted, or why not), and the family walks
    zero / influence only / cards only / below, at and over the cap / seats
    with different results / the winner's Agenda step / the recorded result /
    the chairman quest at 0, 1 and 2 of 2.

    A resolution that pays EVERYONE a supply resource by influence and gives
    the WINNER a tile (Biodome Contest: 2 plants per influence + a greenery
    that raises oxygen) gets the winner-tile family: influence 0 / 1 / 3 /
    beyond the track, every seat's own plants, the winner's and another
    seat's view of the same placement, a neutral winner, the Agenda step
    counted first, oxygen below / at its maximum / at the 8 % step, no legal
    cell, the chairman quest at 0, 1 and 2 of 2, the recorded result — the
    winner's part read through the SAME `winnerRewardModel` the vote surface,
    the fullscreen and the results use.

    LIVE SCENARIOS (the same ring, marked «live»): an ENGINE-GENERATED fixture
    booted as a real game (`/api/dev/playground-scenario`) — A opens it, and
    the player goes through the real political phase: the announced
    placement, the dossier, the cell choice, the cascade, the other seat's
    payout, the results scene. A build without the fixtures names why.

    Test data only (the live scenarios aside): a synthetic parliament model
    for two seats, synthetic candidate cards for the picker.

    Pad: ◀ ▶ the catalog cursor · X the fullscreen viewer · RT the next
    scenario · View the test player · A influence +1 (wraps) — or, on a live
    scenario, open the real game · Y the context · L3 the winner · LT the
    picker's cursor · LB/RB the stand's sections · B back. Keyboard through
    the same semantic map.
  -->
  <div class="con-rxpg" :class="{'con-rxpg--embedded': embedded}" data-resolutions-playground>
    <header class="con-rxpg__head">
      <div class="con-rxpg__hints">
        <span class="con-rxpg__hint"><GamepadGlyph control="dpad" />{{ $t('Resolution') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="secondary" />{{ $t('Inspect') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="triggerR" />{{ $t('Scenario') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="view" />{{ $t('Test player') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="confirm" />{{ $t(liveScenario !== undefined ? 'Play live' : 'Influence') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="inspect" />{{ $t('Context') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="stickL" />{{ $t('Winner of the vote') }}</span>
        <span class="con-rxpg__hint"><GamepadGlyph control="triggerL" />{{ $t('Recipient picker') }}</span>
      </div>
    </header>

    <!-- ── 1. THE CATALOG — every resolution the client manifest carries. ── -->
    <section class="con-rxpg__section">
      <h2>{{ $t('Real resolutions') }} · {{ real.length }} <span class="con-rxpg__dim">/ {{ $t('Development examples (never dealt)') }} · {{ others.length }}</span></h2>
      <div class="con-rxpg__catalog" data-rxpg-catalog>
        <div v-for="(entry, i) in catalog" :key="entry.id"
             class="con-rxpg__slot"
             :class="{'con-rxpg__slot--cursor': i === cursor, 'con-rxpg__slot--uncoded': entry.code === undefined}"
             :data-rxpg-id="entry.id"
             :data-rxpg-code="entry.code ?? ''"
             @click="cursor = i">
          <div class="con-rxpg__slot-face" :data-zoom-slot="'resolution:' + entry.id">
            <PremiumCard :name="cardNameOf(entry)" :vmOverride="vmOf(entry)" inert lightweight />
          </div>
          <span class="con-rxpg__slot-name">{{ $t(entry.text.name) }}</span>
          <span class="con-rxpg__slot-meta">
            <b class="con-rxpg__code">{{ entry.code ?? '—' }}</b>
            <img class="con-rxpg__emblem" :src="emblemUrl(entry.party)" alt="" />
            <span>{{ $t(partyNameKey(entry.party)) }}</span>
          </span>
        </div>
      </div>
    </section>

    <!-- ── 2. THE FACE at the three sizes the game paints it. ── -->
    <section class="con-rxpg__section" v-if="selected !== undefined">
      <h2>{{ $t('Card sizes') }} · {{ $t(selected.text.name) }} <b class="con-rxpg__code">{{ selected.code ?? '—' }}</b></h2>
      <div class="con-rxpg__sizes">
        <div class="con-rxpg__size" v-for="s in SIZES" :key="s.key" :data-rxpg-size="s.key">
          <div class="con-rxpg__size-face" :style="{zoom: s.zoom}">
            <PremiumCard :name="cardNameOf(selected)" :vmOverride="selectedVm" inert :lightweight="s.zoom < 0.7" :tier="s.zoom < 0.7 ? 'thumb' : 'full'" />
          </div>
          <span class="con-rxpg__label">{{ $t(s.label) }} · ×{{ s.zoom }}</span>
        </div>
        <!-- The inspector's columns beside the large face: the party (left),
             the resolution's own rules (right) — the same panels the
             fullscreen viewer mounts (X opens the real one), fed the same
             annotations. -->
        <div class="con-rxpg__inspect" data-rxpg-inspect>
          <ConsoleResolutionAside class="con-rxpg__aside" :party="selected.party" :parliament="undefined" :viewer="undefined" :contextKey="undefined" />
          <ConsoleCardRulesPanel class="con-rxpg__rules" embedded keepOrder :annotationsOverride="annotations" :nonce="0" />
        </div>
      </div>
      <!-- THE FACE'S ACCEPTANCE FRAMES — the two tests a resolution's face must pass by eye, and its back.
           BESIDE PROJECT CARDS: the peripheral-vision test — resolutions stand between real project cards and
           a prelude at one size and must be told apart without reading. ACROSS THE ZOOM RANGE: the scale test
           — the same face at every size the game paints it (×0.2 the enacted card on the Deck … ×1.12 the
           vote row): no element turns to mush, none leaves an empty box behind. THE BACK: what the
           Parliament's deck and a card dealt from it show. Sub-headings, never section stops (LB/RB). -->
      <div v-if="selectedVm !== undefined" class="con-rxpg__lab" data-rxpg-face-lab>
        <h3>{{ $t('Beside project cards') }}</h3>
        <div class="con-rxpg__labrow" data-rxpg-lab="peripheral">
          <template v-for="(name, i) in LAB_PROJECTS" :key="name">
            <div class="con-rxpg__labcell" style="--lab-zoom: 0.5" data-rxpg-lab-project><PremiumCard :name="name" inert lightweight /></div>
            <div v-if="labResolutions[i] !== undefined" class="con-rxpg__labcell" style="--lab-zoom: 0.5" data-rxpg-lab-resolution>
              <PremiumCard :name="cardNameOf(labResolutions[i])" :vmOverride="vmOf(labResolutions[i])" inert lightweight />
            </div>
          </template>
        </div>
        <h3>{{ $t('Across the zoom range') }}</h3>
        <div class="con-rxpg__labrow" data-rxpg-lab="ladder">
          <div v-for="zoom in LAB_LADDER" :key="zoom" class="con-rxpg__labcell" :style="{'--lab-zoom': zoom}" :data-rxpg-lab-zoom="zoom">
            <PremiumCard :name="cardNameOf(selected)" :vmOverride="selectedVm" inert lightweight />
            <span class="con-rxpg__label">×{{ zoom }}</span>
          </div>
          <div class="con-rxpg__labcell" data-rxpg-lab-back>
            <span class="con-rxpg__back"></span>
            <span class="con-rxpg__label">{{ $t('The back of a resolution') }}</span>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 3. SCENARIO × CONTEXT × PLAYER — the influence-scaled payout. ── -->
    <section class="con-rxpg__section" v-if="selected !== undefined">
      <h2>{{ $t(resultHeading) }}</h2>
      <div class="con-rxpg__scenarios" data-rxpg-scenarios>
        <span v-for="(entry, n) in scenarioList" :key="entry.s.key"
              class="con-rxpg__scenario"
              :class="{'con-rxpg__scenario--active': entry.i === scenario}"
              :data-rxpg-scenario="entry.s.key"
              @click="applyScenario(entry.i)">
          <b class="con-rxpg__scenario-n">{{ n + 1 }}</b>
          <i v-if="entry.s.live !== undefined" class="con-rxpg__scenario-live" data-rxpg-live-mark>{{ $t('Live run') }}</i>
          <span>{{ $t(entry.s.label) }}</span>
          <i v-if="entry.i === scenario && modified" class="con-rxpg__scenario-mod" data-rxpg-modified>{{ $t('modified') }}</i>
        </span>
      </div>
      <div class="con-rxpg__controls" data-rxpg-controls>
        <span class="con-rxpg__control"><span class="con-rxpg__ckey">{{ $t('Context') }}</span><b data-rxpg-context>{{ $t(contextLabel) }}</b></span>
        <span class="con-rxpg__control">
          <span class="con-rxpg__ckey">{{ $t('Test player') }}</span>
          <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="14" :glow="false" />
          <b :data-rxpg-player="viewerColor ?? 'spectator'">{{ $t(viewerLabel) }}</b>
        </span>
        <span v-if="viewerSeatIndex !== undefined" class="con-rxpg__control">
          <span class="con-rxpg__ckey">{{ $t('Influence') }}</span>
          <i class="con-parl__inf-icon" aria-hidden="true"></i>
          <b data-rxpg-influence>{{ viewerInfluence }}</b>
          <span class="con-rxpg__agenda" :class="{'con-rxpg__agenda--advanced': agendaAdvanced}" data-rxpg-agenda>{{ agendaLine }}</span>
        </span>
        <span class="con-rxpg__control">
          <span class="con-rxpg__ckey">{{ $t('Winner of the vote') }}</span>
          <PlayerCube v-if="winnerColor !== undefined" :color="winnerColor" :size="14" :glow="false" />
          <b :data-rxpg-winner="winnerColor ?? 'neutral'">{{ winnerLabel }}</b>
        </span>
        <span v-if="pickerEffect !== undefined" class="con-rxpg__control"><span class="con-rxpg__ckey">{{ $t('No eligible card') }}</span><b data-rxpg-norecipient>{{ noRecipient ? '✓' : '—' }}</b></span>
        <template v-if="selected.winnerReward !== undefined">
          <!-- A winner TILE reads its parameter's room; the winner's COLONY (Colony Contest) moves no parameter — its one control is the empty table. -->
          <span v-if="selected.winnerReward.kind === 'tile'" class="con-rxpg__control">
            <span class="con-rxpg__ckey">{{ $t(selected.winnerReward.tile === 'greenery' ? 'Oxygen' : 'Oceans') }}</span>
            <b data-rxpg-table>{{ selected.winnerReward.tile === 'greenery' ? table.oxygen + '%' : table.oceans + '/9' }}</b>
            <span v-if="selected.winnerReward.tile === 'greenery'" class="con-rxpg__dim" data-rxpg-temperature>{{ table.temperature }}°C</span>
          </span>
          <span v-if="family === 'winner-tile'" class="con-rxpg__control"><span class="con-rxpg__ckey">{{ $t(selected.winnerReward.kind === 'colony' ? 'No colony is available' : 'No legal cell') }}</span><b data-rxpg-nocell>{{ noCell ? '✓' : '—' }}</b></span>
        </template>
      </div>
      <!-- A LIVE SCENARIO: the real game this scenario boots (an engine-generated
           fixture), what it stops on, and A to open it — or why it cannot. -->
      <div v-if="liveScenario !== undefined" class="con-rxpg__live" :class="'con-rxpg__live--' + liveState" data-rxpg-live :data-rxpg-live-state="liveState">
        <span class="con-rxpg__live-kicker">{{ $t('Live scenario — a real game') }}</span>
        <span class="con-rxpg__live-what">{{ $t(liveScenario.liveNote ?? liveScenario.label) }}</span>
        <span class="con-rxpg__live-verb" v-if="liveState !== 'error'"><GamepadGlyph control="confirm" />{{ $t(liveState === 'starting' ? 'Starting the game…' : 'Play live') }}</span>
        <span class="con-rxpg__live-error" v-else data-rxpg-live-error>✕ {{ $t(liveError) }}</span>
      </div>
      <div class="con-rxpg__yieldrow">
        <div class="con-rxpg__yieldcard">
          <PremiumCard :name="cardNameOf(selected)" :vmOverride="selectedVm" inert />
        </div>
        <div class="con-rxpg__yieldcol">
          <!-- The PROPOSAL context reads the way the vote panel does — one number
               per effect, the win's difference as its suffix (the same model). -->
          <ConsoleInfluenceYield v-if="yields.length > 0" :yields="yields" :oneNumber="context === 'proposal'" size="hero" :note="yieldNote" :kicker="contextLabel" data-rxpg-yield />
          <p v-else class="con-rxpg__none" data-rxpg-yield-none>{{ $t('Not scaled by influence') }}</p>
          <!-- THE COLONY LEDGER (Colonial Affairs): the viewer's tiles the multiplier above multiplies — the
               same reading the vote panel, the inspector and the sitting print. -->
          <ConsoleColonyLedger v-if="ledger !== undefined" :reading="ledger" size="normal" data-rxpg-ledger />
          <!-- …and the answer of the party the card brings to power — its own
               law, so its own block, under the numbers it answers. -->
          <ConsolePartyReaction v-for="r in reactions" :key="r.reaction.id" :reading="r" size="normal" data-rxpg-reaction />
          <!-- THE WINNER'S TILE — its own block, apart from everyone's numbers,
               read by the SAME model the vote surface and the fullscreen read. -->
          <ConsoleWinnerReward v-if="winnerReading !== undefined"
                               :reading="winnerReading"
                               :viewerColor="viewerColor"
                               :nameOf="seatName"
                               size="normal"
                               variant="block"
                               data-rxpg-winner-block />
          <ConsoleResolutionStatus v-if="status !== undefined" class="con-rxpg__status" :status="status" :viewerColor="viewerColor" />
          <!-- EVERY SEAT by its OWN influence — the rule «each player gets
               their own number», read through the same model per seat; the
               winner's Agenda step and the winner-only part are marked where
               the context has reached them. -->
          <div v-if="seatRows.length > 0" class="con-rxpg__seats" data-rxpg-seats>
            <span class="con-rxpg__ckey">{{ $t('For every player') }}</span>
            <div v-for="row in seatRows" :key="row.color"
                 class="con-rxpg__seat"
                 :class="{'con-rxpg__seat--viewer': row.viewer}"
                 :data-rxpg-seat="row.color">
              <PlayerCube :color="row.color" :size="12" :glow="false" />
              <span class="con-rxpg__seat-name">{{ $t(row.label) }}</span>
              <i v-if="row.winner" class="con-rxpg__seat-star" aria-hidden="true"></i>
              <ConsoleInfluenceYield :yields="row.yields" :formula="false" :oneNumber="context === 'proposal'" size="compact" />
              <span v-if="row.advance !== undefined" class="con-rxpg__seat-tag con-rxpg__seat-tag--agenda" data-rxpg-seat-advance>{{ row.advance }}</span>
              <span v-if="row.winnerPart && selected.text.winner !== undefined" class="con-rxpg__seat-tag con-rxpg__seat-tag--winner" data-rxpg-seat-winner-part>{{ $t(selected.text.winner) }}</span>
            </div>
          </div>
          <!-- THE CHAIRMAN QUEST as the government block reads it: the printed
               graphic, the race per seat, the completion and the seat. -->
          <div v-if="questView !== undefined" class="con-rxpg__quest con-parl__quest" :class="{'con-parl__quest--done': questView.completedBy !== undefined}" data-rxpg-quest>
            <div class="con-parl__quest-head">
              <span class="con-parl__kicker">{{ $t('Chairman quest') }}</span>
              <span v-if="questView.completedBy !== undefined" class="con-parl__quest-state" data-rxpg-quest-done>✓ {{ $t('Completed') }}</span>
            </div>
            <div class="con-parl__quest-cond">
              <PremiumMechanicsPanel v-if="!questMechanics.textOnly" class="con-parl__quest-graphic" :mechanics="questMechanics" />
              <span class="con-parl__quest-text">{{ $t(selected.text.quest) }}</span>
            </div>
            <div v-if="questView.completedBy === undefined" class="con-parl__quest-progress" data-rxpg-quest-progress>
              <span v-for="row in questView.rows" :key="row.color" class="con-parl__quest-row" :class="{'con-parl__quest-row--me': row.color === viewerColor}" :data-rxpg-quest-row="row.color">
                <PlayerCube :color="row.color" :size="12" :glow="false" />
                <b class="con-parl__tick">{{ row.value }}</b><span class="con-parl__quest-of">/{{ selected.quest.count }}</span>
              </span>
            </div>
            <div v-else class="con-parl__quest-foot">
              <span class="con-parl__quest-reward">
                <span class="con-parl__quest-reward-kicker">{{ $t('Won by') }}</span>
                <PlayerCube :color="questView.completedBy ?? 'neutral'" :size="12" :glow="false" />
                <b>{{ $t(questView.completedLabel) }}</b>
              </span>
              <span class="con-parl__chair">
                <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
                <b>{{ $t(questView.completedLabel) }}</b>
              </span>
            </div>
          </div>
          <!-- A METRIC count (Generous Funding's sets of 5 TR over 15): every seat's
               synthetic RATING, divided by the SHARED threshold rule — the ladder of
               set boundaries the value has climbed, and the breakdown in words (value,
               threshold, step, sets, distance to the next); the number above is the
               sets. No list: the explanation of a threshold count is the arithmetic. -->
          <div v-if="countEffect !== undefined && countKind === 'threshold'" class="con-rxpg__tableaus" data-rxpg-metrics>
            <span class="con-rxpg__ckey">{{ $t('Terraform rating') }}</span>
            <div v-for="row in metricRows" :key="row.color"
                 class="con-rxpg__tableau"
                 :class="{'con-rxpg__tableau--viewer': row.viewer}"
                 :data-rxpg-metric-of="row.color">
              <span class="con-rxpg__tableau-who">
                <PlayerCube :color="row.color" :size="12" :glow="false" />
                <span class="con-rxpg__seat-name">{{ $t(row.label) }}</span>
                <PremiumCountGlyph v-if="countGlyph !== undefined" class="con-rxpg__tableau-glyph" :glyph="countGlyph" />
                <b data-rxpg-count>{{ row.count }}</b>
              </span>
              <div class="con-rxpg__metric">
                <span class="con-rxpg__metric-value" :data-rxpg-metric-value="row.metric.value">
                  <PremiumCountGlyph v-if="countGlyph !== undefined" class="con-rxpg__metric-glyph" :glyph="countGlyph" />
                  <b>{{ row.metric.value }}</b>
                </span>
                <span class="con-rxpg__ladder" aria-hidden="true">
                  <span v-for="mark in row.ladder" :key="mark.at"
                        class="con-rxpg__ladder-mark"
                        :class="{'con-rxpg__ladder-mark--reached': mark.reached, 'con-rxpg__ladder-mark--threshold': mark.threshold}"
                        :data-rxpg-ladder="mark.at"
                        :data-rxpg-reached="mark.reached ? 'true' : 'false'">{{ mark.at }}</span>
                </span>
                <span class="con-rxpg__metric-words" data-rxpg-metric-words>{{ row.words }}</span>
              </div>
            </div>
          </div>
          <!-- A PRODUCTION count (Industrialist Budget's steel + titanium + energy steps): every seat's synthetic
               TRACK, term by term — the SHARED reader adds them up, and a zero is listed, never dropped; beside it
               the SUPPLY the levy reads (what «lose 10 M€» can actually take). No list of cards: the explanation of
               a production count is its terms. -->
          <div v-else-if="countEffect !== undefined && countKind === 'production'" class="con-rxpg__tableaus" data-rxpg-productions>
            <span class="con-rxpg__ckey">{{ $t('Production steps') }}</span>
            <div v-for="row in productionRows" :key="row.color"
                 class="con-rxpg__tableau"
                 :class="{'con-rxpg__tableau--viewer': row.viewer}"
                 :data-rxpg-production-of="row.color">
              <span class="con-rxpg__tableau-who">
                <PlayerCube :color="row.color" :size="12" :glow="false" />
                <span class="con-rxpg__seat-name">{{ $t(row.label) }}</span>
                <PremiumCountGlyph v-if="countGlyph !== undefined" class="con-rxpg__tableau-glyph" :glyph="countGlyph" />
                <b data-rxpg-count>{{ row.count }}</b>
              </span>
              <div class="con-rxpg__metric">
                <span v-for="term in row.terms" :key="term.resource" class="con-rxpg__prodterm" :data-rxpg-production-term="term.resource" :data-rxpg-production-steps="term.count">
                  <i class="con-rxpg__prodterm-unit" :class="productionUnitClass(term.resource)" aria-hidden="true"></i>
                  <b>{{ term.count }}</b>
                </span>
                <span v-if="row.heldText !== undefined" class="con-rxpg__metric-words" data-rxpg-held>{{ row.heldText }}</span>
              </div>
            </div>
          </div>
          <!-- A BOARD count (Colonization Funding's space cities): every seat's
               synthetic CELLS of the Mars board — the reserved areas off Mars by
               the names the board's information layer gives them, a city ON Mars,
               an EMPTY area — each with the SHARED cell predicate's verdict (the
               engine's own rule, pinned by spec); the number above is these ticks. -->
          <div v-else-if="countEffect !== undefined && countKind === 'board'" class="con-rxpg__tableaus" data-rxpg-cells>
            <span class="con-rxpg__ckey">{{ $t('Tiles on the board') }}</span>
            <div v-for="row in cellRows" :key="row.color"
                 class="con-rxpg__tableau"
                 :class="{'con-rxpg__tableau--viewer': row.viewer}"
                 :data-rxpg-cells-of="row.color">
              <span class="con-rxpg__tableau-who">
                <PlayerCube :color="row.color" :size="12" :glow="false" />
                <span class="con-rxpg__seat-name">{{ $t(row.label) }}</span>
                <PremiumCountGlyph v-if="countGlyph !== undefined" class="con-rxpg__tableau-glyph" :glyph="countGlyph" />
                <b data-rxpg-count>{{ row.count }}</b>
              </span>
              <div class="con-rxpg__tableau-cards">
                <div v-for="cell in row.cells" :key="cell.id"
                     class="con-rxpg__cell"
                     :class="{'con-rxpg__cell--counted': cell.counts}"
                     :data-rxpg-cell="cell.id"
                     :data-rxpg-counts="cell.counts ? 'true' : 'false'">
                  <span class="con-rxpg__cell-tile" :class="{'con-rxpg__cell-tile--empty': !cell.city}" :style="cell.city ? {backgroundImage: `url(${cityTileUrl})`} : undefined"></span>
                  <span class="con-rxpg__cell-name">{{ cell.name }}</span>
                  <span class="con-rxpg__tcard-verdict">{{ cellVerdictOf(cell) }}</span>
                </div>
                <span v-if="row.cells.length === 0" class="con-rxpg__dim">{{ $t('No tiles on the board') }}</span>
              </div>
            </div>
          </div>
          <!-- THE COUNTED TERM (a resolution that counts the tableau): every
               seat's synthetic tableau of REAL card definitions, each card with
               the SHARED predicate's verdict — the number above is these ticks. -->
          <div v-else-if="countEffect !== undefined" class="con-rxpg__tableaus" data-rxpg-tableaus>
            <span class="con-rxpg__ckey">{{ $t('Cards in play') }}</span>
            <div v-for="row in tableauRows" :key="row.color"
                 class="con-rxpg__tableau"
                 :class="{'con-rxpg__tableau--viewer': row.viewer}"
                 :data-rxpg-tableau="row.color">
              <span class="con-rxpg__tableau-who">
                <PlayerCube :color="row.color" :size="12" :glow="false" />
                <span class="con-rxpg__seat-name">{{ $t(row.label) }}</span>
                <PremiumCountGlyph v-if="countGlyph !== undefined" class="con-rxpg__tableau-glyph" :glyph="countGlyph" />
                <b data-rxpg-count>{{ row.count }}</b>
              </span>
              <div class="con-rxpg__tableau-cards">
                <div v-for="card in row.cards" :key="card.name"
                     class="con-rxpg__tcard"
                     :class="{'con-rxpg__tcard--counted': card.counts}"
                     :data-rxpg-card="card.name"
                     :data-rxpg-counts="card.counts ? 'true' : 'false'">
                  <div class="con-rxpg__tcard-face"><PremiumCard :name="card.name" inert lightweight /></div>
                  <!-- A TAG count can owe SEVERAL units to one card: the verdict says how many. -->
                  <span class="con-rxpg__tcard-verdict" :data-rxpg-units="card.counts ? card.units : undefined">{{ verdictOf(card) }}</span>
                  <!-- A DISTRIBUTED payout: which of the counted-or-not cards can HOLD it (the layout's candidates). -->
                  <span v-if="card.holds" class="con-rxpg__tcard-holds" data-rxpg-holds>{{ $t('Can hold') }}</span>
                </div>
                <span v-if="row.cards.length === 0" class="con-rxpg__dim">{{ $t('No cards in play') }}</span>
              </div>
            </div>
          </div>
          <div class="con-rxpg__texts">
            <p v-if="selected.text.effect !== undefined"><span class="con-rxpg__ckey">{{ $t('When enacted') }}</span> {{ $t(selected.text.effect) }}</p>
            <p v-if="selected.text.winner !== undefined" :class="{'con-rxpg__texts--winner': viewerIsWinner}"><span class="con-rxpg__ckey">{{ $t('For the winner of the vote') }}</span> {{ $t(selected.text.winner) }}</p>
            <p><span class="con-rxpg__ckey">{{ $t('Chairman quest') }}</span> {{ $t(selected.text.quest) }}</p>
          </div>
        </div>
      </div>
    </section>

    <!-- ── 4. THE SHARED RECIPIENT PICKER with a resolution source. ── -->
    <section class="con-rxpg__section" v-if="selected !== undefined && pickerEffect !== undefined">
      <h2>{{ $t('Recipient picker') }}</h2>
      <div class="con-rxpg__picker" data-rxpg-picker>
        <ConsoleSourceDock :view="sourceView" compact>
          <template #under>
            <ConsoleInfluenceYield v-if="pickerYield !== undefined" :yields="[pickerYield]" size="compact" />
          </template>
        </ConsoleSourceDock>
        <div class="con-rxpg__picker-body">
          <p v-if="pickerSkip !== undefined" class="con-rxpg__skip" data-rxpg-skip>✕ {{ $t(pickerSkip) }}</p>
          <!-- THE LAYOUT (a distributed payout over several holders): the facts the shared step asks about — the
               holders as real faces with their stored count and the 0…N each may take. The surface itself is the
               game's (`ConsoleTaskHost` in layout mode) and is never re-drawn here — the live scenario boots it. -->
          <div v-else-if="pickerLayout !== undefined" class="con-rxpg__layout" data-rxpg-layout :data-rxpg-layout-amount="pickerLayout.amount">
            <span class="con-rxpg__ckey">{{ $t('Layout') }}</span>
            <span class="con-rxpg__dim">{{ pickerLayoutLine }}</span>
            <div class="con-rxpg__tableau-cards">
              <div v-for="h in pickerLayout.holders" :key="h.name" class="con-rxpg__tcard con-rxpg__tcard--counted" :data-rxpg-holder="h.name">
                <div class="con-rxpg__tcard-face"><PremiumCard :name="h.name" inert lightweight /></div>
                <span class="con-rxpg__tcard-verdict">{{ h.resources }} → {{ h.resources }}…{{ h.resources + pickerLayout.amount }}</span>
              </div>
            </div>
          </div>
          <ConsolePlayedTargetStep v-else-if="targetModel !== undefined"
                                   :model="targetModel"
                                   :layout="targetLayout"
                                   :focus="targetFocus"
                                   :selection="{mode: 'single'}"
                                   :bandHeight="pickerBandHeight"
                                   :lockedCard="lockedCard" />
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {partyNameKey} from '@/client/console/parliament/partyNames';
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {CardResource} from '@/common/CardResource';
import {Message} from '@/common/logs/Message';
import {LogMessageDataType} from '@/common/logs/LogMessageDataType';
import {PartyName} from '@/common/turmoil/PartyName';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {ParliamentEnactOutcomeModel, ParliamentModel, ParliamentPlayerModel} from '@/common/models/ParliamentModel';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {colonyBonusesEffectOf, familyOf} from '@/client/console/parliament/resolutionFamily';
import {ColonyName} from '@/common/colonies/ColonyName';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {ColonyTradeGrantModel} from '@/common/models/ColonyTradeManifestModel';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {ColonyLedgerReading, colonyLedgerOf} from '@/client/console/parliament/colonyLedgerModel';
import ConsoleColonyLedger from '@/client/components/console/parliament/ConsoleColonyLedger.vue';
import {
  fixedSequelYield, fixedYield, InfluenceScaledEffect, InfluenceYield, referenceYield, scaledAmount, sequelAmount, uncappedAmount,
} from '@/common/parliament/influenceScaling';
import {PartyReactionReading, partyReactionsOf} from '@/client/console/parliament/partyReactionModel';
import {
  cardCountUnits, cardCountVerdict, CardCountContext, countCardsToward, CountedSpaceFacts, countMetricToward, countProductionToward, countSpacesToward,
  ResolutionCountByResource, ResolutionCountKind, ResolutionCountMetricModel, ResolutionCountModel, resolutionCountKind, spaceCountVerdict,
} from '@/common/parliament/resolutionCounts';
import {LEVY_STEP_KEY, levyNothingReasonKey, levyPaid, levyShortReasonKey} from '@/common/parliament/resolutionLevy';
import {SpaceId} from '@/common/Types';
import {SpaceName} from '@/common/boards/SpaceName';
import {SpaceType} from '@/common/boards/SpaceType';
import {CITY_TILES, TileType} from '@/common/TileType';
import {getSpecialCellInfo} from '@/client/components/board/specialCellInfo';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import PremiumCountGlyph from '@/client/components/premiumCard/PremiumCountGlyph.vue';
import {countedTileIconUrl} from '@/client/components/premiumCard/premiumCardIcons';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {AGENDA_TRACK, influenceAtAgenda, ReduxParty, resolutionInstanceId} from '@/common/parliament/ParliamentTypes';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {allResolutions} from '@/client/parliament/ClientParliamentManifest';
import {getCard} from '@/client/cards/ClientCardManifest';
import PremiumCard from '@/client/components/premiumCard/PremiumCard.vue';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {PARLIAMENT_GRAPHIC, resolutionPremiumVm} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsolePartyReaction from '@/client/components/console/parliament/ConsolePartyReaction.vue';
import ConsoleWinnerReward from '@/client/components/console/parliament/ConsoleWinnerReward.vue';
import {WinnerRewardReading, winnerRewardReadingOf} from '@/client/console/parliament/winnerRewardModel';
import {WinnerRewardTable} from '@/common/parliament/winnerReward';
import {ParameterMoveId} from '@/common/parliament/parameterMove';
import {Resource} from '@/common/Resource';
import {apiUrl} from '@/client/utils/runtimeConfig';
import {paths} from '@/common/app/paths';
import {PlaygroundScenarioBoot} from '@/common/models/PlaygroundScenarioModel';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import ConsoleResolutionStatus from '@/client/components/console/parliament/ConsoleResolutionStatus.vue';
import ConsoleResolutionAside from '@/client/components/console/parliament/ConsoleResolutionAside.vue';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';
import ConsoleSourceDock from '@/client/components/console/ConsoleSourceDock.vue';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import {CardAnnotation} from '@/client/components/cardAnnotations/annotationModel';
import {resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {resolutionAnnotations} from '@/client/console/parliament/parliamentAnnotations';
import {resolutionStatusOf, ResolutionStatusVm} from '@/client/console/parliament/resolutionInspectModel';
import {
  countedMetricParts, enactedYieldsOf, noRecipientForecastKey, noRecipientReasonKey, resolvingYieldOf, sequelPresentation, sequelSourceOf,
  voteYieldsOf, yieldCountPresentation, YieldCountGlyph,
} from '@/client/console/parliament/influenceYieldModel';
import {choiceSourceView, PromptSourceView} from '@/client/console/promptSource';
import {
  buildPlayedTargetModel, planPlayedTargetLayout, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetPreviewFor, playedTargetResourceFor} from '@/client/console/played/consolePlayedTargetPreview';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {stepIndex} from '@/client/console/consoleRouter';

/** The contexts a surface computes a yield for, in the order Y cycles them. */
type PgContext = 'reference' | 'proposal' | 'resolving' | 'applied';
const CONTEXTS: ReadonlyArray<PgContext> = ['reference', 'proposal', 'resolving', 'applied'];
const CONTEXT_LABEL: Readonly<Record<PgContext, string>> = {
  reference: 'Reference', proposal: 'Proposal', resolving: 'Enactment', applied: 'Applied',
};

/** The two test seats; a third viewer index is the spectator (no seat at all). */
type SeatIndex = 0 | 1;
const SEATS: ReadonlyArray<SeatIndex> = [0, 1];
const TEST_PLAYERS: Readonly<Record<SeatIndex, {color: Color, label: string}>> = {
  0: {color: 'blue' as Color, label: 'Test player A'},
  1: {color: 'red' as Color, label: 'Test player B'},
};
type ViewerIndex = SeatIndex | 2;
const SPECTATOR: ViewerIndex = 2;

/**
 * A seat's standing BEFORE the political phase: its Agenda position, the
 * influence it holds beyond the track, and — for a resolution that counts the
 * tableau — its cards in play (REAL card names) and its production before.
 */
/**
 * A synthetic CELL of the Mars board — the facts the SHARED cell predicate reads
 * (`CountedSpaceFacts`): a reserved area off Mars or a land cell, with or without
 * a tile. The board-counted family's seats hold these instead of cards.
 */
type PgCell = CountedSpaceFacts;
type PgSeat = {
  agenda: number, bonus: number, cards?: ReadonlyArray<CardName>, production?: number,
  /** The board-counted family: the seat's own cells of the Mars board (REAL cell ids), counted by the shared predicate. */
  cells?: ReadonlyArray<PgCell>,
  /** The metric-counted family: the seat's terraform rating (a synthetic VALUE), divided by the shared threshold rule. */
  tr?: number,
  /** The production-counted family: the seat's production TRACK (synthetic steps per resource), added up by the shared reader. */
  productions?: Readonly<Partial<Record<Resource, number>>>,
  /** …and the SUPPLY the levy reads (a budget's «lose 10 M€» takes what the seat holds, never more). */
  megacredits?: number,
  /** The colony-bonuses family: the tiles this seat has a cube on (the server's registry, synthesized from the colony manifest). */
  colonies?: ReadonlyArray<ColonyName>,
};
type PgWinner = SeatIndex | 'neutral';
/**
 * Which family of scenarios a resolution reads: influence alone (a payout onto
 * a card), a counted term + influence — told apart by WHAT is counted, because
 * the tableaus that make the rule read are different objects (cards with a VP
 * icon vs. cards that print the tag vs. CELLS of the board) — or a supply
 * resource by influence + the WINNER's tile.
 */
type PgFamily = 'influence' | 'counted' | 'counted-tags' | 'counted-board' | 'counted-metric' | 'counted-production' | 'distributed' | 'winner-tile' | 'sequel' |
  'colony-bonuses' | 'world-move';
/** The table's global parameters a winner tile reads (oxygen %, temperature °C, oceans placed). */
type PgTable = {oxygen: number, temperature: number, oceans: number, venus: number};
const DEFAULT_TABLE: PgTable = {oxygen: 5, temperature: -14, oceans: 3, venus: 10};

/** A reproducible reading: the whole instrument at once. */
type PgScenario = {
  key: string,
  label: string,
  family: PgFamily,
  viewer: ViewerIndex,
  seats: readonly [PgSeat, PgSeat],
  winner: PgWinner,
  context: PgContext,
  noRecipient: boolean,
  /** The chairman quest's race: each seat's progress and who completed it. */
  quest?: {progress: readonly [number, number], completedBy?: SeatIndex},
  /** The winner-tile and world-move families: the table's parameters (absent = the default table). */
  table?: Partial<PgTable>,
  /**
   * The world-move family: the scenario exercises ONE parameter's limit, so it
   * is listed only for a law that MOVES that parameter (Gas Export's oxygen
   * ceiling means nothing to Heat Capture's temperature). Absent = every law
   * of the family reads it.
   */
  parameter?: ParameterMoveId,
  /** The winner-tile family: the general validator leaves the winner no legal cell. */
  noCell?: boolean,
  /** A LIVE scenario: the engine-generated fixture the A press boots as a real game. */
  live?: string,
  /** …and what that game stops on (an English key), when the label is not enough. */
  liveNote?: string,
};

/*
 * THE COUNTED FAMILY's tableaus — real cards of the base game and Corporate
 * Era, chosen for what the shared predicate must tell apart: a positive fixed
 * icon, a variable icon scoring 0 now, a building card WITHOUT an icon, a
 * negative icon, and an icon without a building tag.
 */
const LAKE = CardName.ARTIFICIAL_LAKE; // building, +1 VP
const CRATER = CardName.DOMED_CRATER; // city + building, +1 VP
const ELEVATOR = CardName.SPACE_ELEVATOR; // space + building, +2 VP
const PHYSICS = CardName.PHYSICS_COMPLEX; // science + building, 2 VP per science resource (0 now)
const CAPITAL = CardName.CAPITAL; // city + building, 1 VP per adjacent ocean
const MINE = CardName.MINE; // building, no VP icon
const COMBUSTORS = CardName.BIOMASS_COMBUSTORS; // power + building, −1 VP
const STRONGHOLD = CardName.CORPORATE_STRONGHOLD; // city + building, −2 VP
const TUNDRA = CardName.TUNDRA_FARMING; // plant, +2 VP — no building tag

/*
 * THE TAG-COUNTED FAMILY's tableaus — real cards chosen for what a TAG count
 * must tell apart from a card count: a card with TWO power tags, power tags on
 * sources of different kinds (a corporation, a prelude, a project), the VP
 * icon playing NO part at all (a power card without one and one with a
 * negative one both count), a card that raises energy PRODUCTION without
 * printing the tag, and a wild tag that is not a power tag at an enactment.
 */
const PLANT_P = CardName.POWER_PLANT; // power + building, no VP icon
const SOLAR_P = CardName.SOLAR_POWER; // power + building, +1 VP
const FUSION_P = CardName.FUSION_POWER; // science + power + building, no VP icon
const TAPPING = CardName.ENERGY_TAPPING; // power, −1 VP — counts all the same
const HE3 = CardName.HE3_FUSION_PLANT; // power + power + moon — ONE card, TWO tags
const THORGATE = CardName.THORGATE; // corporation with a power tag
const POWERGEN = CardName.POWER_GENERATION; // prelude with a power tag
const PHOTOSYNTHESIS = CardName.ARTIFICIAL_PHOTOSYNTHESIS; // science, +2 energy PRODUCTION, no power tag
const NOBEL = CardName.NOBEL_PRIZE; // a WILD tag — never a power tag at an enactment

/*
 * THE DISTRIBUTED FAMILY's tableaus (Cloud Development: floaters by Venus +
 * Jovian tags + influence, LAID OUT over the player's holders) — real Venus
 * Next / Colonies / Prelude 2 cards chosen for what the layout must tell apart
 * from a count: a holder that prints a counted tag, a holder that prints NONE
 * (it holds, it counts nothing), a card that COUNTS but cannot hold (a tag is
 * not storage), one card printing BOTH tags (two units, one holder), a played
 * EVENT (face down — its tag is not in play), a corporation, and the wild tag.
 */
const DIRIGIBLES = CardName.DIRIGIBLES; // Venus, holds floaters
const JFS = CardName.JUPITER_FLOATING_STATION; // Jovian, holds floaters (a flat 1 VP — the count is what it adds)
const ATMO = CardName.ATMO_COLLECTORS; // no tag, holds floaters
const ATMOSCOOP = CardName.ATMOSCOOP; // Jovian + Space — counts, holds nothing
const CLOUD_TOURISM = CardName.CLOUD_TOURISM; // Venus + Jovian on ONE card, holds floaters — two units
const IO_MINING = CardName.IO_MINING_INDUSTRIES; // Jovian, no floaters
const AIR_SCRAPPING = CardName.AIR_SCRAPPING_EXPEDITION; // a Venus EVENT — face down once played
const CELESTIC = CardName.CELESTIC; // corporation: a Venus tag, holds floaters

/*
 * THE BOARD-COUNTED FAMILY's cells (Colonization Funding: 2 M€ production per
 * SPACE CITY + influence, max 6) — REAL cells of the Mars board, counted by the
 * SHARED cell predicate the engine's reading is pinned to: the two base
 * reserved areas, the promo and a Venus one, an EMPTY reserved area (nothing to
 * count), and a city ON Mars (not a space city).
 */
const GANYMEDE: PgCell = {id: SpaceName.GANYMEDE_COLONY, spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}};
const PHOBOS: PgCell = {id: SpaceName.PHOBOS_SPACE_HAVEN, spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}};
const TORUS: PgCell = {id: SpaceName.STANFORD_TORUS, spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}};
const DAWN: PgCell = {id: SpaceName.DAWN_CITY, spaceType: SpaceType.COLONY, tile: {tileType: TileType.CITY}};
const PHOBOS_EMPTY: PgCell = {id: SpaceName.PHOBOS_SPACE_HAVEN, spaceType: SpaceType.COLONY};
const MARS_CITY: PgCell = {id: '35', spaceType: SpaceType.LAND, tile: {tileType: TileType.CITY}};

const SCENARIOS: ReadonlyArray<PgScenario> = [
  // Step 0 of the Agenda: influence 0 — the step asks nothing and names the skip.
  {key: 'influence-0', family: 'influence', label: 'Influence 0 — nothing is paid', viewer: 0, seats: [{agenda: 0, bonus: 0}, {agenda: 5, bonus: 0}], winner: 1, context: 'resolving', noRecipient: false},
  {key: 'influence-1', family: 'influence', label: 'Influence 1', viewer: 0, seats: [{agenda: 1, bonus: 0}, {agenda: 5, bonus: 0}], winner: 1, context: 'resolving', noRecipient: false},
  {key: 'influence-3', family: 'influence', label: 'Influence 3 — several animals', viewer: 0, seats: [{agenda: 5, bonus: 0}, {agenda: 1, bonus: 0}], winner: 1, context: 'resolving', noRecipient: false},
  // Agenda 4 = influence 2; winning takes the marker to step 5 (influence 3) BEFORE the effect.
  {key: 'winner-agenda', family: 'influence', label: 'The winner advances on the Agenda first', viewer: 0, seats: [{agenda: 4, bonus: 0}, {agenda: 3, bonus: 0}], winner: 0, context: 'resolving', noRecipient: false},
  {key: 'beyond-track', family: 'influence', label: 'Influence beyond the track', viewer: 0, seats: [{agenda: 4, bonus: 1}, {agenda: 3, bonus: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'no-recipient', family: 'influence', label: 'No eligible card', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 5, bonus: 0}], winner: 1, context: 'resolving', noRecipient: true},
  {key: 'applied', family: 'influence', label: 'Recorded payout', viewer: 0, seats: [{agenda: 4, bonus: 0}, {agenda: 0, bonus: 0}], winner: 0, context: 'applied', noRecipient: false},
  {key: 'spectator', family: 'influence', label: 'Spectator — the formula alone', viewer: SPECTATOR, seats: [{agenda: 5, bonus: 0}, {agenda: 3, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false},
  // ── THE COUNTED FAMILY (min(cap, B + I)) ──
  {key: 'counted-zero', family: 'counted', label: 'No qualifying cards and no influence', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [MINE, COMBUSTORS, TUNDRA], production: 2}, {agenda: 3, bonus: 0, cards: [LAKE], production: 1}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'counted-influence-only', family: 'counted', label: 'Influence alone', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [MINE, STRONGHOLD], production: 3}, {agenda: 1, bonus: 0, cards: [CRATER], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-cards-only', family: 'counted', label: 'Cards alone', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [LAKE, PHYSICS, MINE], production: 1}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-below-cap', family: 'counted', label: 'Below the maximum', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE, CRATER, COMBUSTORS], production: 4}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-exact-cap', family: 'counted', label: 'Exactly +5', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE, CRATER, ELEVATOR, TUNDRA], production: 6}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-over-cap', family: 'counted', label: 'Over the maximum', viewer: 0,
    seats: [{agenda: 5, bonus: 0, cards: [LAKE, CRATER, ELEVATOR, PHYSICS, STRONGHOLD], production: 10}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'counted-seats', family: 'counted', label: 'Every player gets their own result', viewer: 0,
    seats: [{agenda: 1, bonus: 0, cards: [LAKE, MINE], production: 3}, {agenda: 8, bonus: 0, cards: [CRATER, ELEVATOR, CAPITAL, COMBUSTORS], production: -2}], winner: 0, context: 'applied', noRecipient: false},
  // Agenda 4 = influence 2; winning takes the marker to step 5 (influence 3) BEFORE the effect: 2 + 2 → 4 becomes 2 + 3 → 5.
  {key: 'counted-winner-agenda', family: 'counted', label: 'The winner advances on the Agenda first', viewer: 0,
    seats: [{agenda: 4, bonus: 0, cards: [LAKE, PHYSICS], production: 5}, {agenda: 3, bonus: 0, cards: [MINE], production: 0}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'counted-applied', family: 'counted', label: 'Recorded result', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE, CRATER, MINE], production: 8}, {agenda: 0, bonus: 0, cards: [STRONGHOLD], production: 1}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'counted-quest-0', family: 'counted', label: 'Chairman quest 0/2', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE], production: 2}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [0, 0]}},
  {key: 'counted-quest-1', family: 'counted', label: 'Chairman quest 1/2', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE], production: 2}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [1, 0]}},
  {key: 'counted-quest-done', family: 'counted', label: 'Chairman quest completed', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [LAKE], production: 2}, {agenda: 1, bonus: 0, cards: [MINE], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [2, 1], completedBy: 0}},
  // ── THE TAG-COUNTED FAMILY (min(cap, P + I), P = the player's power TAGS) ──
  {key: 'grid-zero', family: 'counted-tags', label: 'No power tags and no influence', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [PHOTOSYNTHESIS, NOBEL], production: 2}, {agenda: 3, bonus: 0, cards: [PLANT_P], production: 1}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'grid-influence-only', family: 'counted-tags', label: 'Influence alone', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [PHOTOSYNTHESIS], production: 3}, {agenda: 1, bonus: 0, cards: [PLANT_P], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'grid-tags-only', family: 'counted-tags', label: 'Power tags alone', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [PLANT_P, SOLAR_P], production: 1}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  // Agenda 2 = influence 1; winning takes the marker to step 3 (influence 2): 2 + 1 → +3 becomes 2 + 2 → +4, both below the cap.
  {key: 'grid-below-cap', family: 'counted-tags', label: 'Below the maximum', viewer: 0,
    seats: [{agenda: 2, bonus: 0, cards: [PLANT_P, SOLAR_P, PHOTOSYNTHESIS], production: 4}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'grid-exact-cap', family: 'counted-tags', label: 'Exactly +5', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [PLANT_P, SOLAR_P, FUSION_P], production: 6}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'grid-over-cap', family: 'counted-tags', label: 'Over the maximum', viewer: 0,
    seats: [{agenda: 5, bonus: 0, cards: [PLANT_P, SOLAR_P, FUSION_P, TAPPING], production: 10}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  // ONE card, TWO tags: the whole difference from Architecture Award, on the stand.
  {key: 'grid-multi-tag', family: 'counted-tags', label: 'One card with two power tags', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [HE3, PLANT_P], production: 2}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'grid-sources', family: 'counted-tags', label: 'Tags on a corporation, a prelude and a project', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [THORGATE, POWERGEN, PLANT_P], production: 1}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'grid-no-vp', family: 'counted-tags', label: 'A power card without a VP icon counts', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [PLANT_P, FUSION_P, PHOTOSYNTHESIS], production: 3}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'grid-negative-vp', family: 'counted-tags', label: 'A power card with a negative VP icon counts', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [TAPPING, SOLAR_P], production: 3}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'grid-wild', family: 'counted-tags', label: 'A wild tag is not a power tag', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [NOBEL, PLANT_P], production: 2}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  // The SAME tableau read at the enactment: a wild tag counts for the player's
  // own actions, never for this — the number the proposal showed is the number paid.
  {key: 'grid-own-turn', family: 'counted-tags', label: 'Looked at on your own turn — the enactment counts the same', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [NOBEL, PLANT_P], production: 2}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'resolving', noRecipient: false},
  {key: 'grid-seats', family: 'counted-tags', label: 'Every player gets their own result', viewer: 0,
    seats: [{agenda: 1, bonus: 0, cards: [PLANT_P, PHOTOSYNTHESIS], production: 3}, {agenda: 8, bonus: 0, cards: [HE3, SOLAR_P, FUSION_P, TAPPING], production: -2}], winner: 0, context: 'applied', noRecipient: false},
  // Agenda 4 = influence 2; winning takes the marker to step 5 (influence 3) BEFORE the effect: 2 + 2 -> 4 becomes 2 + 3 -> 5.
  {key: 'grid-winner-agenda', family: 'counted-tags', label: 'The winner advances on the Agenda first', viewer: 0,
    seats: [{agenda: 4, bonus: 0, cards: [PLANT_P, SOLAR_P], production: 5}, {agenda: 3, bonus: 0, cards: [], production: 0}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'grid-negative-production', family: 'counted-tags', label: 'Negative production rises the ordinary way', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [PLANT_P, SOLAR_P], production: -3}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'grid-high-production', family: 'counted-tags', label: 'Production 8 becomes 13 — the cap bounds the increase', viewer: 0,
    seats: [{agenda: 5, bonus: 0, cards: [HE3, SOLAR_P, FUSION_P], production: 8}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'grid-applied', family: 'counted-tags', label: 'Recorded result', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [HE3, PLANT_P, PHOTOSYNTHESIS], production: 8}, {agenda: 0, bonus: 0, cards: [TAPPING], production: 1}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'grid-quest-0', family: 'counted-tags', label: 'Chairman quest 0/2', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [PLANT_P], production: 2}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [0, 0]}},
  {key: 'grid-quest-1', family: 'counted-tags', label: 'Chairman quest 1/2', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [PLANT_P], production: 2}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [1, 0]}},
  {key: 'grid-quest-done', family: 'counted-tags', label: 'Chairman quest completed', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [PLANT_P], production: 2}, {agenda: 1, bonus: 0, cards: [], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [2, 1], completedBy: 0}},
  // ── THE SEQUENTIAL FAMILY (Climate Research: +1 heat production per influence,
  //    THEN 1 card per full 3 steps of the heat production that leaves behind) ──
  //    `production` is the seat's HEAT production before the enactment. Test
  //    player A is the viewer; B wins unless the scenario says otherwise (a
  //    winner's Agenda step would move A's influence).
  {key: 'seq-zero', family: 'sequel', label: 'Influence 0, production 0 — nothing at all', viewer: 0,
    seats: [{agenda: 0, bonus: 0, production: 0}, {agenda: 3, bonus: 0, production: 1}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'seq-no-influence-3', family: 'sequel', label: 'Influence 0, production 3 — one card all the same', viewer: 0,
    seats: [{agenda: 0, bonus: 0, production: 3}, {agenda: 3, bonus: 0, production: 0}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'seq-no-influence-6', family: 'sequel', label: 'Influence 0, production 6 — two cards, no raise', viewer: 0,
    seats: [{agenda: 0, bonus: 0, production: 6}, {agenda: 3, bonus: 0, production: 0}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'seq-below-threshold', family: 'sequel', label: 'A raise that reaches no threshold: 1 → 2', viewer: 0,
    seats: [{agenda: 1, bonus: 0, production: 1}, {agenda: 3, bonus: 0, production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'seq-2-to-3', family: 'sequel', label: 'The first threshold: 2 → 3 — one card', viewer: 0,
    seats: [{agenda: 1, bonus: 0, production: 2}, {agenda: 3, bonus: 0, production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'seq-4-to-6', family: 'sequel', label: '4 → 6 — two cards', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 1, bonus: 0, production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'seq-7-to-9', family: 'sequel', label: '7 → 9 — three cards', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: 7}, {agenda: 1, bonus: 0, production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'seq-beyond-track', family: 'sequel', label: 'Influence beyond 5 — no maximum', viewer: 0,
    seats: [{agenda: 12, bonus: 2, production: 4}, {agenda: 1, bonus: 0, production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'seq-many-cards', family: 'sequel', label: 'A big draw — nothing is trimmed to fit', viewer: 0,
    seats: [{agenda: 12, bonus: 2, production: 18}, {agenda: 1, bonus: 0, production: 0}], winner: 1, context: 'resolving', noRecipient: false},
  {key: 'seq-seats', family: 'sequel', label: 'Every player gets their own result', viewer: 0,
    seats: [{agenda: 1, bonus: 0, production: 5}, {agenda: 8, bonus: 0, production: 2}], winner: 0, context: 'applied', noRecipient: false},
  // Agenda 4 = influence 2; winning takes the marker to step 5 (influence 3) BEFORE the effect: 4 → 6 becomes 4 → 7.
  {key: 'seq-winner-agenda', family: 'sequel', label: 'The winner advances on the Agenda first', viewer: 0,
    seats: [{agenda: 4, bonus: 0, production: 4}, {agenda: 3, bonus: 0, production: 0}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'seq-neutral', family: 'sequel', label: 'Neutral winner — the effect still reaches everyone', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 5, bonus: 0, production: 7}], winner: 'neutral', context: 'applied', noRecipient: false},
  {key: 'seq-negative', family: 'sequel', label: 'Negative production rises the ordinary way', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: -3}, {agenda: 1, bonus: 0, production: 0}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'seq-resolving', family: 'sequel', label: 'The chain being resolved', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 1, bonus: 0, production: 2}], winner: 1, context: 'resolving', noRecipient: false},
  {key: 'seq-applied', family: 'sequel', label: 'Recorded result', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 0, bonus: 0, production: 8}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'seq-spectator', family: 'sequel', label: 'Spectator — the formula alone', viewer: SPECTATOR,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 1, bonus: 0, production: 0}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'seq-quest-0', family: 'sequel', label: 'Chairman quest 0/3', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 1, bonus: 0, production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [0, 0]}},
  {key: 'seq-quest-2', family: 'sequel', label: 'Chairman quest 2/3 — partial progress', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 1, bonus: 0, production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [2, 1]}},
  {key: 'seq-quest-done', family: 'sequel', label: 'Chairman quest completed', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 1, bonus: 0, production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [3, 1], completedBy: 0}},
  // ── LIVE (Climate Research): real games from the engine-generated fixtures.
  {key: 'seq-live-vote', family: 'sequel', label: 'Live: the vote', viewer: 0,
    seats: [{agenda: 2, bonus: 0, production: 4}, {agenda: 5, bonus: 0, production: 1}], winner: 0, context: 'proposal', noRecipient: false,
    live: 'parliament-climate-vote', liveNote: 'Climate Research up for the vote: your heat production now and if you win, and the cards each result would draw'},
  {key: 'seq-live-enact', family: 'sequel', label: 'Live: the raise and the draw', viewer: 0,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 1, bonus: 0, production: 2}], winner: 0, context: 'resolving', noRecipient: false,
    live: 'parliament-climate-enact', liveNote: 'Your take stands inside the enactment stage: the raise is recorded, the Greens answered, the cards are owed'},
  // RED wins this one (the fixture's seat order rotates in generation 2, and
  // the dev loader opens the seat that opens the generation).
  {key: 'seq-live-recap', family: 'sequel', label: 'Live: the results of the generation', viewer: 1,
    seats: [{agenda: 3, bonus: 0, production: 4}, {agenda: 1, bonus: 0, production: 2}], winner: 1, context: 'applied', noRecipient: false,
    live: 'parliament-climate-recap', liveNote: 'Generation 2: open the Parliament — the card moves into the government and the results name both halves'},
  // ── THE WINNER-TILE FAMILY (everyone's supply resource by influence + the winner's tile) ──
  // Test player A is the viewer; B wins unless the scenario says otherwise (a winner's Agenda step would move A's influence).
  {key: 'tile-influence-0', family: 'winner-tile', label: 'Influence 0 — nothing is paid', viewer: 0, seats: [{agenda: 0, bonus: 0}, {agenda: 5, bonus: 0}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'tile-influence-1', family: 'winner-tile', label: 'Influence 1', viewer: 0, seats: [{agenda: 1, bonus: 0}, {agenda: 5, bonus: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'tile-influence-3', family: 'winner-tile', label: 'Influence 3', viewer: 0, seats: [{agenda: 5, bonus: 0}, {agenda: 1, bonus: 0}], winner: 1, context: 'proposal', noRecipient: false},
  // Agenda 12 (influence 5) + 2 from cards = 7 → 14 plants: no cap.
  {key: 'tile-beyond-track', family: 'winner-tile', label: 'Influence beyond the track — no maximum', viewer: 0, seats: [{agenda: 12, bonus: 2}, {agenda: 3, bonus: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'tile-seats', family: 'winner-tile', label: 'Every player gets their own result', viewer: 0, seats: [{agenda: 1, bonus: 0}, {agenda: 8, bonus: 0}], winner: 0, context: 'applied', noRecipient: false},
  // Agenda 4 = influence 2; winning → step 5 = influence 3 BEFORE the plants: +4 now, +6 if A wins.
  {key: 'tile-winner-agenda', family: 'winner-tile', label: 'The winner advances on the Agenda first', viewer: 0, seats: [{agenda: 4, bonus: 0}, {agenda: 3, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'tile-winner-view', family: 'winner-tile', label: 'The winner\'s view of the placement', viewer: 0, seats: [{agenda: 4, bonus: 0}, {agenda: 3, bonus: 0}], winner: 0, context: 'resolving', noRecipient: false},
  {key: 'tile-other-view', family: 'winner-tile', label: 'Another player\'s view of the placement', viewer: 1, seats: [{agenda: 4, bonus: 0}, {agenda: 3, bonus: 0}], winner: 0, context: 'resolving', noRecipient: false},
  {key: 'tile-neutral', family: 'winner-tile', label: 'Neutral winner — the plants still reach everyone', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 5, bonus: 0}], winner: 'neutral', context: 'applied', noRecipient: false},
  {key: 'tile-oxygen-low', family: 'winner-tile', label: 'Oxygen below the maximum', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false, table: {oxygen: 5, temperature: -14, oceans: 3}},
  {key: 'tile-oxygen-max', family: 'winner-tile', label: 'Oxygen at its maximum — the tile still pays its TR', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false, table: {oxygen: 14, temperature: -4, oceans: 5}},
  {key: 'tile-threshold', family: 'winner-tile', label: 'The 8 % step raises the temperature too', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false, table: {oxygen: 7, temperature: -10, oceans: 3}},
  {key: 'tile-no-cell', family: 'winner-tile', label: 'No legal cell — the greenery is named and skipped', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'applied', noRecipient: false, noCell: true},
  {key: 'tile-recorded', family: 'winner-tile', label: 'Recorded result', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 5, bonus: 0}], winner: 0, context: 'applied', noRecipient: false, table: {oxygen: 7, temperature: -10, oceans: 3}},
  {key: 'tile-quest-0', family: 'winner-tile', label: 'Chairman quest 0/2', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [0, 0]}},
  {key: 'tile-quest-1', family: 'winner-tile', label: 'Chairman quest 1/2', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [1, 0]}},
  {key: 'tile-quest-done', family: 'winner-tile', label: 'Chairman quest completed', viewer: 0, seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [2, 1], completedBy: 0}},
  // ── LIVE: real games from the engine-generated fixtures (the readings above mirror each table).
  {key: 'live-vote', family: 'winner-tile', label: 'Live: the vote', viewer: 0, seats: [{agenda: 2, bonus: 0}, {agenda: 5, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false,
    live: 'parliament-biodome-vote', liveNote: 'Biodome Contest up for the vote: your plants now and if you win, the winner\'s greenery at 5 % oxygen'},
  {key: 'live-enact', family: 'winner-tile', label: 'Live: the winner places the greenery', viewer: 0, seats: [{agenda: 2, bonus: 0}, {agenda: 5, bonus: 0}], winner: 0, context: 'resolving', noRecipient: false,
    table: {oxygen: 7, temperature: -2, oceans: 0}, live: 'parliament-biodome-enact',
    liveNote: 'Your placement stands: 7 % → 8 % raises the temperature to 0 °C and grants a free ocean; a cell with a card bonus is legal'},
  {key: 'live-maxed', family: 'winner-tile', label: 'Live: oxygen at its maximum', viewer: 0, seats: [{agenda: 2, bonus: 0}, {agenda: 5, bonus: 0}], winner: 0, context: 'resolving', noRecipient: false,
    table: {oxygen: 14, temperature: -10, oceans: 0}, live: 'parliament-biodome-maxed', liveNote: 'Your placement stands with oxygen at 14 %: the tile pays its own TR only'},
  {key: 'live-nocell', family: 'winner-tile', label: 'Live: no legal cell', viewer: 0, seats: [{agenda: 2, bonus: 0}, {agenda: 5, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false, noCell: true,
    live: 'parliament-biodome-nocell', liveNote: 'Pass to end the generation: every land cell is taken, the greenery is named and skipped, the plants still land'},
  {key: 'live-neutral', family: 'winner-tile', label: 'Live: neutral winner', viewer: 0, seats: [{agenda: 2, bonus: 0}, {agenda: 5, bonus: 0}], winner: 'neutral', context: 'proposal', noRecipient: false,
    live: 'parliament-biodome-neutral', liveNote: 'Pass to end the generation: neutral delegates carry the card, nobody places the greenery'},
  {key: 'live-recap', family: 'winner-tile', label: 'Live: the results of the generation', viewer: 1, seats: [{agenda: 1, bonus: 0}, {agenda: 4, bonus: 0}], winner: 1, context: 'applied', noRecipient: false,
    live: 'parliament-biodome-recap', liveNote: 'Generation 2: open the Parliament — the card moves into the government, your plants fly, the greenery is named'},
  // ── THE DISTRIBUTED FAMILY (Cloud Development: N = Venus tags + Jovian tags + influence, laid out over the
  //    player's floater holders — 0..N per card, the sum exactly N; N = 1 or ONE holder is the family's ordinary pick) ──
  {key: 'cloud-zero', family: 'distributed', label: 'No Venus or Jovian tags and no influence', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [ATMO]}, {agenda: 3, bonus: 0, cards: [DIRIGIBLES]}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'cloud-influence-only', family: 'distributed', label: 'Influence alone', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [ATMO]}, {agenda: 1, bonus: 0, cards: [DIRIGIBLES]}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'cloud-tags-only', family: 'distributed', label: 'Tags alone', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [DIRIGIBLES, JFS]}, {agenda: 1, bonus: 0, cards: []}], winner: 1, context: 'proposal', noRecipient: false},
  // Agenda 2 = influence 1; winning takes the marker to step 3 (influence 2): 2 tags + 1 → 3 becomes 2 + 2 → 4 — over TWO holders: the layout.
  {key: 'cloud-layout', family: 'distributed', label: 'The layout — two holders', viewer: 0,
    seats: [{agenda: 2, bonus: 0, cards: [DIRIGIBLES, JFS]}, {agenda: 1, bonus: 0, cards: [ATMO]}], winner: 1, context: 'proposal', noRecipient: false},
  // Atmoscoop COUNTS (a Jovian tag) and holds nothing: 2 tags + 2 = 4, all onto the ONE holder — the ordinary pick, shown and confirmed.
  {key: 'cloud-one-holder', family: 'distributed', label: 'One holder — the ordinary pick', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [DIRIGIBLES, ATMOSCOOP]}, {agenda: 1, bonus: 0, cards: []}], winner: 1, context: 'resolving', noRecipient: false},
  {key: 'cloud-both-tags', family: 'distributed', label: 'One card with a Venus and a Jovian tag', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [CLOUD_TOURISM]}, {agenda: 1, bonus: 0, cards: []}], winner: 1, context: 'proposal', noRecipient: false},
  // Two tags and influence 2 are OWED — and forfeited, named with their size: a Jovian tag is not storage.
  {key: 'cloud-no-holder', family: 'distributed', label: 'No card can hold floaters — the payout is named and forfeited', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [ATMOSCOOP, IO_MINING]}, {agenda: 1, bonus: 0, cards: [DIRIGIBLES]}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'cloud-event', family: 'distributed', label: 'A played event lies face down', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [AIR_SCRAPPING, DIRIGIBLES]}, {agenda: 1, bonus: 0, cards: []}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'cloud-wild', family: 'distributed', label: 'A wild tag is neither', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [NOBEL, DIRIGIBLES]}, {agenda: 1, bonus: 0, cards: []}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'cloud-corporation', family: 'distributed', label: 'Tags on a corporation and a project', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cards: [CELESTIC, DIRIGIBLES]}, {agenda: 1, bonus: 0, cards: []}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'cloud-seats', family: 'distributed', label: 'Every player gets their own result', viewer: 0,
    seats: [{agenda: 1, bonus: 0, cards: [DIRIGIBLES]}, {agenda: 8, bonus: 0, cards: [JFS, CLOUD_TOURISM, ATMO]}], winner: 0, context: 'applied', noRecipient: false},
  // Agenda 4 = influence 2; winning takes the marker to step 5 (influence 3) BEFORE the effect: 2 + 2 → 4 becomes 2 + 3 → 5.
  {key: 'cloud-winner-agenda', family: 'distributed', label: 'The winner advances on the Agenda first', viewer: 0,
    seats: [{agenda: 4, bonus: 0, cards: [DIRIGIBLES, JFS]}, {agenda: 3, bonus: 0, cards: []}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'cloud-applied', family: 'distributed', label: 'Recorded result', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [DIRIGIBLES, JFS, ATMO]}, {agenda: 0, bonus: 0, cards: [ATMO]}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'cloud-spectator', family: 'distributed', label: 'Spectator — the formula alone', viewer: SPECTATOR,
    seats: [{agenda: 3, bonus: 0, cards: [DIRIGIBLES, JFS]}, {agenda: 1, bonus: 0, cards: []}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'cloud-quest-0', family: 'distributed', label: 'Chairman quest 0/2', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [DIRIGIBLES]}, {agenda: 1, bonus: 0, cards: []}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [0, 0]}},
  {key: 'cloud-quest-1', family: 'distributed', label: 'Chairman quest 1/2', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [DIRIGIBLES]}, {agenda: 1, bonus: 0, cards: []}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [1, 0]}},
  {key: 'cloud-quest-done', family: 'distributed', label: 'Chairman quest completed', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cards: [DIRIGIBLES]}, {agenda: 1, bonus: 0, cards: []}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [2, 1], completedBy: 0}},
  // ── LIVE (Cloud Development): real games from the engine-generated fixtures — a VENUS game, a FOUR-party table.
  {key: 'cloud-live-vote', family: 'distributed', label: 'Live: the vote', viewer: 0,
    seats: [{agenda: 2, bonus: 0, cards: [DIRIGIBLES, JFS]}, {agenda: 5, bonus: 0, cards: [ATMO]}], winner: 0, context: 'proposal', noRecipient: false,
    live: 'parliament-cloud-vote', liveNote: 'Cloud Development up for the vote on a four-party table: your floaters by Venus and Jovian tags plus influence, now and if you win'},
  {key: 'cloud-live-layout', family: 'distributed', label: 'Live: the layout inside the sitting', viewer: 0,
    seats: [{agenda: 2, bonus: 0, cards: [DIRIGIBLES, JFS]}, {agenda: 5, bonus: 0, cards: [ATMO]}], winner: 0, context: 'resolving', noRecipient: false,
    live: 'parliament-cloud-enact', liveNote: 'Your layout stands inside the enactment stage: 4 floaters over two holders, nothing placed until A'},
  /*
   * THE COLONY-BONUSES FAMILY (Colonial Affairs): each seat holds SYNTHETIC CUBES on real tiles of the
   * colony manifest — the server's registry shape — and the ledger multiplies them: a supply tile (Luna),
   * a resource-onto-card tile (Titan), a plain draw (Miranda), the pair that never merges (Pluto).
   */
  {key: 'colonial-vote', family: 'colony-bonuses', label: 'Four tiles — a supply gain, a card resource, a draw, the pair', viewer: 0,
    seats: [{agenda: 5, bonus: 0, colonies: [ColonyName.LUNA, ColonyName.TITAN, ColonyName.MIRANDA, ColonyName.PLUTO]}, {agenda: 1, bonus: 0, colonies: [ColonyName.LUNA]}],
    winner: 0, context: 'proposal', noRecipient: false},
  // ── THE BOARD-COUNTED FAMILY (Colonization Funding: min(6, 2 × S + I), S = the player's SPACE CITIES —
  //    CELLS of the board, never cards; the stand counts them by the shared cell predicate) ──
  {key: 'funding-zero', family: 'counted-board', label: 'No space cities and no influence', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cells: [MARS_CITY], production: 2}, {agenda: 3, bonus: 0, cells: [GANYMEDE], production: 1}], winner: 1, context: 'applied', noRecipient: false},
  // Influence pays on its own: no space city and influence 3 is +3 — an input of 0 cities, never an empty place.
  {key: 'funding-influence-only', family: 'counted-board', label: 'Influence alone', viewer: 0,
    seats: [{agenda: 5, bonus: 0, cells: [], production: 3}, {agenda: 1, bonus: 0, cells: [GANYMEDE], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'funding-cities-only', family: 'counted-board', label: 'Space cities alone', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cells: [GANYMEDE, PHOBOS], production: 1}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  // Agenda 2 = influence 1; winning takes the marker to step 3 (influence 2): 2 × 1 + 1 → +3 becomes 2 + 2 → +4.
  {key: 'funding-below-cap', family: 'counted-board', label: 'Below the maximum', viewer: 0,
    seats: [{agenda: 2, bonus: 0, cells: [GANYMEDE], production: 4}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'funding-exact-cap', family: 'counted-board', label: 'Exactly +6', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cells: [GANYMEDE, PHOBOS], production: 6}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  // Two cities and influence 3: 7 owed, 6 paid — the cap bounds the SUM.
  {key: 'funding-over-cap', family: 'counted-board', label: 'Over the maximum', viewer: 0,
    seats: [{agenda: 5, bonus: 0, cells: [GANYMEDE, PHOBOS], production: 10}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'funding-mars-city', family: 'counted-board', label: 'A city on Mars does not count', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cells: [GANYMEDE, MARS_CITY], production: 2}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'funding-empty-area', family: 'counted-board', label: 'An empty reserved area counts nothing', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cells: [GANYMEDE, PHOBOS_EMPTY], production: 2}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'funding-venus-area', family: 'counted-board', label: 'A Venus reserved area counts like the base ones', viewer: 0,
    seats: [{agenda: 0, bonus: 0, cells: [DAWN, TORUS], production: 2}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'funding-seats', family: 'counted-board', label: 'Every player gets their own result', viewer: 0,
    seats: [{agenda: 1, bonus: 0, cells: [GANYMEDE], production: 3}, {agenda: 8, bonus: 0, cells: [PHOBOS, TORUS], production: -2}], winner: 0, context: 'applied', noRecipient: false},
  // Agenda 4 = influence 2; winning takes the marker to step 5 (influence 3) BEFORE the effect: 2 + 2 → +4 becomes 2 + 3 → +5.
  {key: 'funding-winner-agenda', family: 'counted-board', label: 'The winner advances on the Agenda first', viewer: 0,
    seats: [{agenda: 4, bonus: 0, cells: [GANYMEDE], production: 5}, {agenda: 3, bonus: 0, cells: [], production: 0}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'funding-negative-production', family: 'counted-board', label: 'Negative production rises the ordinary way', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cells: [GANYMEDE], production: -3}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'funding-applied', family: 'counted-board', label: 'Recorded result', viewer: 0,
    seats: [{agenda: 5, bonus: 0, cells: [GANYMEDE, PHOBOS], production: 8}, {agenda: 0, bonus: 0, cells: [MARS_CITY], production: 1}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'funding-spectator', family: 'counted-board', label: 'Spectator — the formula alone', viewer: SPECTATOR,
    seats: [{agenda: 3, bonus: 0, cells: [GANYMEDE]}, {agenda: 1, bonus: 0, cells: []}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'funding-quest-0', family: 'counted-board', label: 'Chairman quest 0/1', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cells: [GANYMEDE], production: 2}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [0, 0]}},
  {key: 'funding-quest-done', family: 'counted-board', label: 'Chairman quest completed', viewer: 0,
    seats: [{agenda: 3, bonus: 0, cells: [GANYMEDE], production: 2}, {agenda: 1, bonus: 0, cells: [], production: 0}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [1, 0], completedBy: 0}},
  // ── LIVE (Colonization Funding): the engine-generated fixture — two space cities and influence 3, the maximum.
  {key: 'funding-live-vote', family: 'counted-board', label: 'Live: the vote', viewer: 0,
    seats: [{agenda: 5, bonus: 0, cells: [GANYMEDE, PHOBOS], production: 3}, {agenda: 1, bonus: 0, cells: [], production: 1}], winner: 0, context: 'proposal', noRecipient: false,
    live: 'parliament-colonization-vote', liveNote: 'Colonization Funding up for the vote: your two space cities and influence 3 reach the maximum — one number, nothing left for a win to add'},
  // ── RX12 · GAS EXPORT (the Reds — «M€ по влиянию; кислород −1, Венера +2, РТ никому») and RX14 · HEAT
  //    CAPTURE (temperature −2): the WORLD-MOVE family. Its instrument is the GLOBAL PARAMETERS, so its
  //    scenarios are their LIMITS — the one place a world move can fail to happen, and the one thing a
  //    reading has to be honest about. A limit scenario names its PARAMETER and is listed only for a law
  //    that moves it; the room, the neutral winner and the recorded result are every law's.
  {key: 'world-room', family: 'world-move', label: 'Room for every move', viewer: 0,
    seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false,
    table: {oxygen: 5, venus: 10, temperature: -20}},
  {key: 'world-oxygen-max', family: 'world-move', label: 'Oxygen at its maximum — it is not reduced', viewer: 0, parameter: 'oxygen',
    seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false,
    table: {oxygen: 14, venus: 10}},
  {key: 'world-oxygen-min', family: 'world-move', label: 'Oxygen at its minimum — it cannot go lower', viewer: 0, parameter: 'oxygen',
    seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false,
    table: {oxygen: 0, venus: 10}},
  {key: 'world-venus-cut', family: 'world-move', label: 'Venus at 28% — only one step happens', viewer: 0, parameter: 'venus',
    seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false,
    table: {oxygen: 5, venus: 28}},
  {key: 'world-venus-max', family: 'world-move', label: 'Venus at its maximum — it is not terraformed', viewer: 0, parameter: 'venus',
    seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false,
    table: {oxygen: 5, venus: 30}},
  {key: 'world-temperature-max', family: 'world-move', label: 'Temperature at its maximum — it is not reduced', viewer: 0, parameter: 'temperature',
    seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false,
    table: {temperature: 8}},
  {key: 'world-temperature-cut', family: 'world-move', label: 'Temperature at −28 °C — only one step happens', viewer: 0, parameter: 'temperature',
    seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false,
    table: {temperature: -28}},
  {key: 'world-temperature-min', family: 'world-move', label: 'Temperature at its minimum — it cannot go lower', viewer: 0, parameter: 'temperature',
    seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 0, context: 'proposal', noRecipient: false,
    table: {temperature: -30}},
  {key: 'world-neutral', family: 'world-move', label: 'A neutral winner — the world moves all the same', viewer: 0,
    seats: [{agenda: 3, bonus: 0}, {agenda: 1, bonus: 0}], winner: 'neutral', context: 'proposal', noRecipient: false,
    table: {oxygen: 5, venus: 10, temperature: -20}},
  // ── THE METRIC-COUNTED FAMILY (Generous Funding: 2 × (S + I), S = the complete SETS of 5 TR over 15 — one
  //    VALUE per seat, divided by the shared threshold rule; the scenarios are the thresholds themselves) ──
  {key: 'generous-zero', family: 'counted-metric', label: 'No TR sets and no influence', viewer: 0,
    seats: [{agenda: 0, bonus: 0, tr: 15}, {agenda: 3, bonus: 0, tr: 20}], winner: 1, context: 'applied', noRecipient: false},
  // The remainder pays nothing: TR 19 is four points over 15 and no set — influence 3 alone is +6.
  {key: 'generous-influence-only', family: 'counted-metric', label: 'Influence alone', viewer: 0,
    seats: [{agenda: 5, bonus: 0, tr: 19}, {agenda: 1, bonus: 0, tr: 20}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'generous-sets-only', family: 'counted-metric', label: 'Sets alone', viewer: 0,
    seats: [{agenda: 0, bonus: 0, tr: 30}, {agenda: 1, bonus: 0, tr: 15}], winner: 1, context: 'proposal', noRecipient: false},
  // Agenda 4 = influence 2; winning takes the marker to step 5 (influence 3, the rating stands): 2 × (1 + 2) → +6 becomes +8.
  {key: 'generous-one-set', family: 'counted-metric', label: 'One set — TR 24', viewer: 0,
    seats: [{agenda: 4, bonus: 0, tr: 24}, {agenda: 1, bonus: 0, tr: 15}], winner: 0, context: 'proposal', noRecipient: false},
  // 15 is the CARD's threshold, not the starting rating: a rating below it is zero sets, six points from the first.
  {key: 'generous-below', family: 'counted-metric', label: 'Below the threshold — TR 14', viewer: 0,
    seats: [{agenda: 3, bonus: 0, tr: 14}, {agenda: 1, bonus: 0, tr: 20}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'generous-two-sets', family: 'counted-metric', label: 'Exactly two sets — TR 25', viewer: 0,
    seats: [{agenda: 3, bonus: 0, tr: 25}, {agenda: 1, bonus: 0, tr: 20}], winner: 1, context: 'proposal', noRecipient: false},
  // Agenda 5 = influence 3; winning takes the marker to step 6 — a TR step: the rating is 25 BEFORE the effect reads it (+8 → +10).
  {key: 'generous-tr-step', family: 'counted-metric', label: 'A TR step of the Agenda counts first', viewer: 0,
    seats: [{agenda: 5, bonus: 0, tr: 24}, {agenda: 1, bonus: 0, tr: 20}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'generous-seats', family: 'counted-metric', label: 'Every player gets their own result', viewer: 0,
    seats: [{agenda: 1, bonus: 0, tr: 20}, {agenda: 8, bonus: 0, tr: 31}], winner: 0, context: 'applied', noRecipient: false},
  {key: 'generous-applied', family: 'counted-metric', label: 'Recorded result', viewer: 0,
    seats: [{agenda: 5, bonus: 0, tr: 24}, {agenda: 0, bonus: 0, tr: 22}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'generous-spectator', family: 'counted-metric', label: 'Spectator — the formula alone', viewer: SPECTATOR,
    seats: [{agenda: 3, bonus: 0, tr: 24}, {agenda: 1, bonus: 0, tr: 20}], winner: 0, context: 'proposal', noRecipient: false},
  {key: 'generous-quest-0', family: 'counted-metric', label: 'Chairman quest 0/3', viewer: 0,
    seats: [{agenda: 3, bonus: 0, tr: 24}, {agenda: 1, bonus: 0, tr: 20}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [0, 0]}},
  {key: 'generous-quest-done', family: 'counted-metric', label: 'Chairman quest completed', viewer: 0,
    seats: [{agenda: 3, bonus: 0, tr: 24}, {agenda: 1, bonus: 0, tr: 20}], winner: 0, context: 'applied', noRecipient: false, quest: {progress: [3, 1], completedBy: 0}},
  // ── LIVE (Generous Funding): the engine-generated fixture — TR 24 and Agenda 4, one set and influence 2, a win adds one influence.
  {key: 'generous-live-vote', family: 'counted-metric', label: 'Live: the vote', viewer: 0,
    seats: [{agenda: 4, bonus: 0, tr: 24}, {agenda: 1, bonus: 0, tr: 20}], winner: 0, context: 'proposal', noRecipient: false,
    live: 'parliament-generous-vote', liveNote: 'Generous Funding up for the vote: your TR 24 is one set and your influence 2 — +6, and +2 more if you win'},
  // ── THE PRODUCTION-COUNTED FAMILY (Industrialist Budget — the first BUDGET: −10 M€ FIRST, then 1 M€ per step of
  //    steel + titanium + energy production + influence, then +4 M€ production flat). The instrument is the seat's
  //    production TRACK and the SUPPLY the levy reads; the scenarios are the levy's edges and the track's. ──
  // The reference reading: 34 M€ held, steel 2 · titanium 1 · energy 2 = 5, Agenda 4 = influence 2 → −10 → +7 = −3; a win adds 1.
  {key: 'budget-net', family: 'counted-production', label: 'Levy first, then the payout — net −3', viewer: 0,
    seats: [{agenda: 4, bonus: 0, productions: {[Resource.STEEL]: 2, [Resource.TITANIUM]: 1, [Resource.ENERGY]: 2}, megacredits: 34},
      {agenda: 1, bonus: 0, productions: {}, megacredits: 20}], winner: 0, context: 'proposal', noRecipient: false},
  // 4 M€ held: the levy takes the 4 and says so; the payout still comes (steel 1 + energy 1 + influence 2 = +4) — net 0.
  {key: 'budget-short', family: 'counted-production', label: 'Short of the levy — 4 M€', viewer: 0,
    seats: [{agenda: 3, bonus: 0, productions: {[Resource.STEEL]: 1, [Resource.ENERGY]: 1}, megacredits: 4},
      {agenda: 1, bonus: 0, productions: {}, megacredits: 20}], winner: 1, context: 'proposal', noRecipient: false},
  // 0 M€ held: nothing to take — a named skip of the levy; the payout and the production still come.
  {key: 'budget-nothing', family: 'counted-production', label: 'Nothing to pay — 0 M€', viewer: 0,
    seats: [{agenda: 3, bonus: 0, productions: {[Resource.TITANIUM]: 2}, megacredits: 0},
      {agenda: 1, bonus: 0, productions: {}, megacredits: 20}], winner: 1, context: 'applied', noRecipient: false},
  // No production and no influence: the levy is taken, the payout is a named skip, the +4 production comes.
  {key: 'budget-zero', family: 'counted-production', label: 'No production and no influence', viewer: 0,
    seats: [{agenda: 0, bonus: 0, productions: {}, megacredits: 20}, {agenda: 3, bonus: 0, productions: {[Resource.STEEL]: 2}, megacredits: 20}],
    winner: 1, context: 'applied', noRecipient: false},
  {key: 'budget-influence-only', family: 'counted-production', label: 'Influence alone', viewer: 0,
    seats: [{agenda: 5, bonus: 0, productions: {}, megacredits: 20}, {agenda: 1, bonus: 0, productions: {}, megacredits: 20}],
    winner: 1, context: 'proposal', noRecipient: false},
  {key: 'budget-production-only', family: 'counted-production', label: 'Production steps alone', viewer: 0,
    seats: [{agenda: 0, bonus: 0, productions: {[Resource.STEEL]: 3, [Resource.TITANIUM]: 2, [Resource.ENERGY]: 1}, megacredits: 20},
      {agenda: 1, bonus: 0, productions: {}, megacredits: 20}], winner: 1, context: 'proposal', noRecipient: false},
  {key: 'budget-seats', family: 'counted-production', label: 'Every player gets their own result', viewer: 0,
    seats: [{agenda: 1, bonus: 0, productions: {[Resource.STEEL]: 2, [Resource.ENERGY]: 1}, megacredits: 30},
      {agenda: 8, bonus: 0, productions: {[Resource.TITANIUM]: 4}, megacredits: 7}], winner: 0, context: 'applied', noRecipient: false},
  {key: 'budget-applied', family: 'counted-production', label: 'Recorded result', viewer: 0,
    seats: [{agenda: 5, bonus: 0, productions: {[Resource.STEEL]: 2, [Resource.TITANIUM]: 1, [Resource.ENERGY]: 2}, megacredits: 34},
      {agenda: 0, bonus: 0, productions: {[Resource.ENERGY]: 3}, megacredits: 12}], winner: 1, context: 'applied', noRecipient: false},
  {key: 'budget-spectator', family: 'counted-production', label: 'Spectator — the formula alone', viewer: SPECTATOR,
    seats: [{agenda: 3, bonus: 0, productions: {[Resource.STEEL]: 2}, megacredits: 34}, {agenda: 1, bonus: 0, productions: {}, megacredits: 20}],
    winner: 0, context: 'proposal', noRecipient: false},
  {key: 'budget-quest-0', family: 'counted-production', label: 'Chairman quest 0/1', viewer: 0,
    seats: [{agenda: 3, bonus: 0, productions: {[Resource.STEEL]: 2}, megacredits: 34}, {agenda: 1, bonus: 0, productions: {}, megacredits: 20}],
    winner: 0, context: 'applied', noRecipient: false, quest: {progress: [0, 0]}},
  {key: 'budget-quest-done', family: 'counted-production', label: 'Chairman quest completed', viewer: 0,
    seats: [{agenda: 3, bonus: 0, productions: {[Resource.STEEL]: 2}, megacredits: 34}, {agenda: 1, bonus: 0, productions: {}, megacredits: 20}],
    winner: 0, context: 'applied', noRecipient: false, quest: {progress: [1, 0], completedBy: 0}},
  // ── LIVE (Industrialist Budget): the engine-generated fixture — 5 steps and Agenda 4, a win adds one influence.
  {key: 'budget-live-vote', family: 'counted-production', label: 'Live: the vote', viewer: 0,
    seats: [{agenda: 4, bonus: 0, productions: {[Resource.STEEL]: 2, [Resource.TITANIUM]: 1, [Resource.ENERGY]: 2}, megacredits: 34},
      {agenda: 1, bonus: 0, productions: {}, megacredits: 20}], winner: 0, context: 'proposal', noRecipient: false,
    live: 'parliament-budget-vote', liveNote: 'Industrialist Budget up for the vote: 10 M€ first, then your 5 production steps and your influence 2 — net −3, and +1 more if you win'},
];
/** Each family's opening scenario. */
const DEFAULT_SCENARIO_OF: Readonly<Record<PgFamily, number>> = {
  'influence': SCENARIOS.findIndex((s) => s.key === 'influence-3'),
  'counted': SCENARIOS.findIndex((s) => s.key === 'counted-below-cap'),
  'counted-tags': SCENARIOS.findIndex((s) => s.key === 'grid-below-cap'),
  'counted-board': SCENARIOS.findIndex((s) => s.key === 'funding-exact-cap'),
  'counted-metric': SCENARIOS.findIndex((s) => s.key === 'generous-one-set'),
  'counted-production': SCENARIOS.findIndex((s) => s.key === 'budget-net'),
  'distributed': SCENARIOS.findIndex((s) => s.key === 'cloud-layout'),
  'winner-tile': SCENARIOS.findIndex((s) => s.key === 'tile-influence-3'),
  'sequel': SCENARIOS.findIndex((s) => s.key === 'seq-4-to-6'),
  'colony-bonuses': SCENARIOS.findIndex((s) => s.key === 'colonial-vote'),
  'world-move': SCENARIOS.findIndex((s) => s.key === 'world-room'),
};
const DEFAULT_SCENARIO = DEFAULT_SCENARIO_OF.influence;

/** The smallest Agenda position that reads as each influence level (the track's own steps). */
const AGENDA_FOR_INFLUENCE: ReadonlyArray<number> = [0, 1, 3, 5, 8, 12];
const MAX_INFLUENCE = 5;

/** The picker's synthetic candidates: real cards that hold animals, with a stored count each. */
const DEMO_HOLDERS: ReadonlyArray<{name: CardName, resources: number, per: number}> = [
  {name: CardName.FISH, resources: 2, per: 1},
  {name: CardName.PETS, resources: 1, per: 2},
  {name: CardName.BIRDS, resources: 0, per: 1},
  {name: CardName.ECOLOGICAL_ZONE, resources: 3, per: 2},
];

/**
 * THE FACE'S ACCEPTANCE FRAMES: the real cards a resolution must be told apart from at a glance (an automated
 * project, an active one, an event, a prelude — every colour family a hand can hold), and every zoom the game
 * paints the face at (`parliamentCardFit.ts`: the enacted card's floor … the vote row's cap).
 */
const LAB_PROJECTS: ReadonlyArray<CardName> = [CardName.ARTIFICIAL_LAKE, CardName.BIRDS, CardName.ASTEROID, CardName.DONATION];
const LAB_LADDER: ReadonlyArray<number> = [0.2, 0.3, 0.45, 0.62, 0.8, 1.12];

const SIZES = [
  {key: 'overview', label: 'Overview size', zoom: 0.55},
  {key: 'vote', label: 'Voting size', zoom: 0.8},
  {key: 'fullscreen', label: 'Fullscreen size', zoom: 1.1},
] as const;

/** One seat's payout at the enactment: what it is owed, at which influence (and count), and why it does not land (if it does not). */
type SeatPayout = {amount: number, influence: number, skipped?: string, count?: ResolutionCountModel, uncapped?: number, total?: {before: number, after: number}};

/** One card of a seat's synthetic tableau, with the shared predicate's verdict, what it contributed — and whether it can HOLD the payout (a distributed family's holder). */
type TableauCardRow = {name: CardName, counts: boolean, reason: string, units: number, holds: boolean};

/** A layout's plainest even spread (the stand's recorded result): round-robin over the holders, in their order. */
function spreadOver(holders: ReadonlyArray<CardName>, amount: number): Array<{card: CardName, amount: number}> {
  const laid = holders.map((card) => ({card, amount: 0}));
  for (let n = 0; n < amount && laid.length > 0; n++) {
    laid[n % laid.length].amount++;
  }
  return laid.filter((entry) => entry.amount > 0);
}
type TableauRow = {color: Color, label: string, viewer: boolean, count: number, cards: ReadonlyArray<TableauCardRow>};

/** One cell of a seat's synthetic board, with the shared cell predicate's verdict and the board layer's name for it. */
type CellRowCell = {id: SpaceId, name: string, city: boolean, counts: boolean, reason: string};
type CellRow = {color: Color, label: string, viewer: boolean, count: number, cells: ReadonlyArray<CellRowCell>};
/** One boundary of a threshold count's ladder (the threshold itself, then every full set), reached or not by the seat's value. */
type LadderMark = {at: number, reached: boolean, threshold: boolean};
type MetricRow = {color: Color, label: string, viewer: boolean, count: number, metric: ResolutionCountMetricModel, ladder: ReadonlyArray<LadderMark>, words: string};
/** The production-counted family: a seat's synthetic TRACK term by term, the sum, and the supply the levy reads. */
type ProductionRow = {color: Color, label: string, viewer: boolean, count: number, terms: ReadonlyArray<ResolutionCountByResource>, heldText: string | undefined};

type SeatRow = {
  color: Color,
  label: string,
  viewer: boolean,
  winner: boolean,
  yields: ReadonlyArray<InfluenceYield>,
  advance: string | undefined,
  /** The context has reached the winner-only part of the enactment, and this seat is the winner. */
  winnerPart: boolean,
};

function scenarioState(index: number) {
  const s = SCENARIOS[index];
  return {
    scenario: index,
    modified: false,
    viewer: s.viewer,
    seats: s.seats.map((seat): PgSeat => ({...seat, cards: seat.cards === undefined ? undefined : [...seat.cards]})),
    winner: s.winner,
    context: s.context,
    noRecipient: s.noRecipient,
    table: {...DEFAULT_TABLE, ...(s.table ?? {})},
    noCell: s.noCell === true,
  };
}

export default defineComponent({
  name: 'ConsoleResolutionsPlayground',
  components: {
    PremiumCard, GamepadGlyph, PlayerCube, ConsoleInfluenceYield, ConsoleColonyLedger, ConsoleResolutionStatus, ConsoleResolutionAside, ConsoleCardRulesPanel,
    ConsoleSourceDock, ConsolePlayedTargetStep, PremiumMechanicsPanel, PremiumCountGlyph, ConsoleWinnerReward, ConsolePartyReaction,
  },
  props: {
    /** Inside the playground stand (the stand owns the chrome and the scroll). */
    embedded: {type: Boolean, default: false},
  },
  data() {
    return {
      SIZES,
      SCENARIOS,
      LAB_PROJECTS,
      LAB_LADDER,
      cursor: 0,
      ...scenarioState(DEFAULT_SCENARIO),
      pickerIndex: 0,
      lockedCard: '',
      liveState: 'idle' as 'idle' | 'starting' | 'error',
      liveError: '',
    };
  },
  computed: {
    all(): ReadonlyArray<IClientResolution> {
      return allResolutions();
    },
    real(): ReadonlyArray<IClientResolution> {
      return this.all.filter((r) => r.code !== undefined);
    },
    others(): ReadonlyArray<IClientResolution> {
      return this.all.filter((r) => r.code === undefined);
    },
    /** The real ones first (by code), then the never-dealt development examples. */
    catalog(): ReadonlyArray<IClientResolution> {
      return [...[...this.real].sort((a, b) => (a.code ?? '').localeCompare(b.code ?? '')), ...this.others];
    },
    selected(): IClientResolution | undefined {
      return this.catalog[this.cursor];
    },
    /** The resolutions standing BETWEEN the project cards of the peripheral-vision row: the selected one first, then the other real ones. */
    labResolutions(): ReadonlyArray<IClientResolution> {
      const selected = this.selected;
      return selected === undefined ? [] : [selected, ...this.real.filter((r) => r.id !== selected.id)].slice(0, LAB_PROJECTS.length);
    },
    selectedVm(): PremiumCardVM | undefined {
      return this.selected === undefined ? undefined : resolutionPremiumVm(this.selected);
    },
    annotations(): ReadonlyArray<CardAnnotation> {
      return this.selected === undefined ? [] :
        resolutionAnnotations(this.selected.id, this.yields, {reading: this.winnerReading, viewer: this.viewerColor, nameOf: this.seatName},
          {table: this.winnerTable});
    },
    /** The scenario family the selected resolution reads — from its DECLARATION (`resolutionFamily.ts`), never a table by id. */
    family(): PgFamily {
      return this.selected === undefined ? 'influence' : familyOf(this.selected);
    },
    /** The table the winner's tile reads (the scenario's parameters). */
    winnerTable(): WinnerRewardTable {
      return {oxygenLevel: this.table.oxygen, temperature: this.table.temperature, oceans: this.table.oceans, venusScaleLevel: this.table.venus};
    },
    /** The winner's part of the selected resolution, read for this context by the ONE model. */
    winnerReading(): WinnerRewardReading | undefined {
      const r = this.selected;
      if (r?.winnerReward === undefined) {
        return undefined;
      }
      return winnerRewardReadingOf(r, this.model, this.context === 'reference' ? undefined : this.winnerTable);
    },
    /** The ACTIVE scenario when it boots a real game. */
    liveScenario(): PgScenario | undefined {
      const s = SCENARIOS[this.scenario];
      return s !== undefined && s.live !== undefined && s.family === this.family ? s : undefined;
    },
    /** The ACTIVE family's scenarios, with their global index — a parameter-limit scenario only for a law that moves that parameter. */
    scenarioList(): Array<{s: PgScenario, i: number}> {
      const moved = new Set((this.selected?.worldMoves ?? []).map((move) => move.parameter));
      return SCENARIOS.map((s, i) => ({s, i})).filter((entry) => entry.s.family === this.family &&
        (entry.s.parameter === undefined || moved.has(entry.s.parameter)));
    },
    /** The first scaled part that COUNTS the tableau — what the tableau rows explain. */
    countEffect(): InfluenceScaledEffect | undefined {
      return this.selected?.scaled?.find((e) => e.count !== undefined);
    },
    /** The counted object's glyph — the card silhouette, the printed tag or the city tile, as the count's kind decides. */
    countGlyph(): YieldCountGlyph | undefined {
      const count = this.countEffect?.count;
      return count === undefined ? undefined : yieldCountPresentation(count.id).glyph;
    },
    /** WHAT the counted term walks — cards, tags, or the CELLS of the board. */
    countKind(): ResolutionCountKind['kind'] | undefined {
      const count = this.countEffect?.count;
      return count === undefined ? undefined : resolutionCountKind(count.id).kind;
    },
    /** The city pictogram a counted cell draws — the mechanics' own asset (the same one the count glyph prints). */
    cityTileUrl(): string {
      return countedTileIconUrl('spaceCity');
    },
    /** The section's heading names WHAT the result is built from. */
    resultHeading(): string {
      switch (this.family) {
      case 'counted': return 'Result by cards and influence';
      case 'counted-tags': return 'Result by tags and influence';
      case 'counted-board': return 'Result by space cities and influence';
      case 'counted-metric': return 'Result by terraform rating and influence';
      case 'counted-production': return 'Result by production steps and influence, after the levy';
      case 'distributed': return 'Result by tags and influence, laid out over your holders';
      case 'sequel': return 'Result by influence, then by production';
      case 'colony-bonuses': return 'Result by influence, over your colony bonuses';
      default: return 'Influence-scaled payout';
      }
    },
    /** THE COLONY LEDGER of the selected resolution for the viewer and the context — the one client reading. */
    ledger(): ColonyLedgerReading | undefined {
      if (this.context === 'reference') {
        return undefined;
      }
      return colonyLedgerOf(this.selected, this.model, this.viewerColor, {enacted: this.context !== 'proposal', live: this.context === 'resolving'});
    },
    /** Every seat's tableau with each card's verdict (the SHARED predicate over the client card manifest). */
    tableauRows(): Array<TableauRow> {
      const effect = this.countEffect;
      if (effect?.count === undefined) {
        return [];
      }
      const id = effect.count.id;
      return SEATS.map((i) => {
        const names = this.seats[i].cards ?? [];
        const ctx = this.countContextOf(names);
        const holdsResource = this.spreadResource;
        const cards: Array<TableauCardRow> = names.map((name) => {
          const card = getCard(name);
          if (card === undefined) {
            return {name, counts: false, reason: 'Unknown card', units: 0, holds: false};
          }
          const verdict = cardCountVerdict(id, card, ctx);
          // A DISTRIBUTED payout lands on the cards that can HOLD it — a fact apart from the count.
          const holds = holdsResource !== undefined && card.resourceType === holdsResource;
          // The units are the SHARED rule's too: one per card for a card
          // count, every printed occurrence for a tag count.
          return verdict.counts ?
            {name, counts: true, reason: '', units: cardCountUnits(id, card, ctx), holds} :
            {name, counts: false, reason: verdict.reason, units: 0, holds};
        });
        return {
          color: TEST_PLAYERS[i].color,
          label: TEST_PLAYERS[i].label,
          viewer: this.viewerSeatIndex === i,
          count: cards.reduce((sum, c) => sum + c.units, 0),
          cards,
        };
      });
    },
    /**
     * Every seat's synthetic CELLS with each one's verdict — the SHARED cell
     * predicate (the engine's own rule, pinned to it by spec), never a typed-in
     * number. A reserved area is named by the board's information layer; a cell
     * that layer does not name keeps its number.
     */
    cellRows(): Array<CellRow> {
      const effect = this.countEffect;
      if (effect?.count === undefined || this.countKind !== 'board') {
        return [];
      }
      const id = effect.count.id;
      return SEATS.map((i) => {
        const cells = (this.seats[i].cells ?? []).map((cell): CellRowCell => {
          const verdict = spaceCountVerdict(id, cell);
          const info = getSpecialCellInfo(cell.id);
          return {
            id: cell.id,
            name: info === undefined ? '#' + cell.id : translateText(info.title),
            city: cell.tile !== undefined && CITY_TILES.has(cell.tile.tileType),
            counts: verdict.counts,
            reason: verdict.counts ? '' : verdict.reason,
          };
        });
        return {
          color: TEST_PLAYERS[i].color,
          label: TEST_PLAYERS[i].label,
          viewer: this.viewerSeatIndex === i,
          count: cells.filter((cell) => cell.counts).length,
          cells,
        };
      });
    },
    /**
     * Every seat's synthetic RATING with the SHARED threshold rule's reading of
     * it — the ladder of set boundaries (the threshold, then every full set up to
     * the one the value has not reached yet) and the breakdown in words. The
     * number is `countMetricToward`'s, never typed into the scenario.
     */
    /**
     * Every seat's synthetic production TRACK with the SHARED reader's sum of it — each listed resource's steps
     * (a zero listed, not dropped), the total the payout stands on, and the supply the levy reads. The number is
     * `countProductionToward`'s, never typed into the scenario.
     */
    productionRows(): Array<ProductionRow> {
      const term = this.countEffect?.count;
      if (term === undefined || this.countKind !== 'production') {
        return [];
      }
      return SEATS.map((i) => {
        const count = countProductionToward(term.id, this.seats[i].productions ?? {});
        return {
          color: TEST_PLAYERS[i].color,
          label: TEST_PLAYERS[i].label,
          viewer: this.viewerSeatIndex === i,
          count: count.count,
          terms: count.byResource ?? [],
          heldText: this.selected?.levy === undefined ? undefined : translateTextWithParams('M€ held: ${0}', [String(this.seats[i].megacredits ?? 20)]),
        };
      });
    },
    metricRows(): Array<MetricRow> {
      const term = this.countEffect?.count;
      if (term === undefined || this.countKind !== 'threshold') {
        return [];
      }
      const rows: Array<MetricRow> = [];
      for (const i of SEATS) {
        const count = countMetricToward(term.id, this.seats[i].tr ?? 20);
        const metric = count.metric;
        if (metric === undefined) {
          continue;
        }
        // The threshold itself, then each boundary a full set stands on, up to the first one NOT reached — at least
        // three marks, so a low rating still shows where the sets begin.
        const marks = Math.max(3, metric.sets + 2);
        const ladder: Array<LadderMark> = [];
        for (let n = 0; n < marks; n++) {
          const at = metric.over + n * metric.step;
          ladder.push({at, reached: metric.value >= at, threshold: n === 0});
        }
        rows.push({
          color: TEST_PLAYERS[i].color,
          label: TEST_PLAYERS[i].label,
          viewer: this.viewerSeatIndex === i,
          count: count.count,
          metric,
          ladder,
          words: countedMetricParts(metric).map((part) => translateTextWithParams(part.key, [...part.params])).join(' · '),
        });
      }
      return rows;
    },
    questMechanics(): MechanicsVM {
      return buildMechanics(this.selected?.questRenderData, PARLIAMENT_GRAPHIC);
    },
    /** The chairman quest's race as the scenario sets it (the counted family). */
    questView(): {rows: Array<{color: Color, value: number}>, completedBy: Color | undefined, completedLabel: string} | undefined {
      const quest = SCENARIOS[this.scenario]?.quest;
      if (quest === undefined || this.selected === undefined || this.family !== SCENARIOS[this.scenario]?.family) {
        return undefined;
      }
      const completed = quest.completedBy;
      return {
        rows: SEATS.map((i) => ({color: TEST_PLAYERS[i].color, value: quest.progress[i]})),
        completedBy: completed === undefined ? undefined : TEST_PLAYERS[completed].color,
        completedLabel: completed === undefined ? '' : TEST_PLAYERS[completed].label,
      };
    },
    contextLabel(): string {
      return CONTEXT_LABEL[this.context];
    },
    /** The SEQUENTIAL part of the selected resolution (Climate Research's draw), if any. */
    sequelEffect(): InfluenceScaledEffect | undefined {
      return this.selected?.scaled?.find((e) => e.sequel !== undefined);
    },
    /** The ruling party's ANSWER to the viewer's readings — the second law of the same enactment. */
    reactions(): Array<PartyReactionReading> {
      return this.viewerSeatIndex === undefined ? [] : partyReactionsOf(this.selected, this.yields);
    },
    /** The first influence-scaled part paid onto a card — what the picker demonstrates. */
    pickerEffect(): InfluenceScaledEffect | undefined {
      return this.selected?.scaled?.find((e) => e.unit.kind === 'cardResource');
    },
    // ── who looks, who won ─────────────────────────────────────────────
    viewerSeatIndex(): SeatIndex | undefined {
      return this.viewer === SPECTATOR ? undefined : this.viewer as SeatIndex;
    },
    viewerColor(): Color | undefined {
      const i = this.viewerSeatIndex;
      return i === undefined ? undefined : TEST_PLAYERS[i].color;
    },
    viewerLabel(): string {
      const i = this.viewerSeatIndex;
      return i === undefined ? 'Spectator' : TEST_PLAYERS[i].label;
    },
    winnerColor(): Color | undefined {
      return this.winner === 'neutral' ? undefined : TEST_PLAYERS[this.winner].color;
    },
    winnerLabel(): string {
      return translateText(this.winner === 'neutral' ? 'Neutral' : TEST_PLAYERS[this.winner].label);
    },
    viewerIsWinner(): boolean {
      return this.viewerSeatIndex !== undefined && this.winner === this.viewerSeatIndex;
    },
    /** The context has reached the winner's Agenda step (the phase's step 1 precedes the effect). */
    pastWinnerStep(): boolean {
      return this.context === 'resolving' || this.context === 'applied';
    },
    viewerInfluence(): number {
      const i = this.viewerSeatIndex;
      return i === undefined ? 0 : this.influenceAt(i);
    },
    agendaAdvanced(): boolean {
      const i = this.viewerSeatIndex;
      return i !== undefined && this.advancedAt(i);
    },
    /** «Повестка 4» / «Повестка 4 → 5» (+ «+1 вне трека»). */
    agendaLine(): string {
      const i = this.viewerSeatIndex;
      if (i === undefined) {
        return '';
      }
      const seat = this.seats[i];
      const agenda = this.advancedAt(i) ?
        translateTextWithParams('Agenda ${0} → ${1}', [String(seat.agenda), String(this.agendaAt(i))]) :
        translateTextWithParams('Agenda ${0}', [String(seat.agenda)]);
      return seat.bonus > 0 ? agenda + ' · ' + translateTextWithParams('+${0} beyond the track', [String(seat.bonus)]) : agenda;
    },
    // ── the synthetic table ────────────────────────────────────────────
    /**
     * The parliament a real surface would receive for this context: the
     * resolution up for the vote (proposal), being enacted (the phase at its
     * effects step, the viewer asked), or enacted with the server-shaped
     * outcome record the applied readings draw from.
     */
    model(): ParliamentModel | undefined {
      const r = this.selected;
      if (r === undefined || this.context === 'reference') {
        return undefined;
      }
      const instance = resolutionInstanceId(r.id, 0);
      const base: ParliamentModel = {
        slots: [], rulingParty: PartyName.GREENS, popularSupport: {}, players: SEATS.map((i) => this.seatModel(i)),
        deckSize: 9, discardSize: 0, neutralSupply: 14, botMode: 'none',
      };
      const owner: Color | 'neutral' = this.winnerColor ?? 'neutral';
      if (this.context === 'proposal') {
        const viewer = this.viewerColor;
        return {
          ...base,
          slots: [{
            instance, resolution: r.id, party: r.party, votes: [{owner, seq: 1}, {owner, seq: 2}], totalVotes: 2,
            isWinning: true, tiePriority: 1, viewerVotes: viewer !== undefined && viewer === owner ? 2 : 0, leader: owner,
          }],
        };
      }
      const enacted = {instance, resolution: r.id, party: r.party};
      const scenarioQuest = SCENARIOS[this.scenario]?.family === this.family ? SCENARIOS[this.scenario]?.quest : undefined;
      if (scenarioQuest !== undefined) {
        const progress: Record<string, number> = {};
        SEATS.forEach((i) => {
          progress[TEST_PLAYERS[i].color] = scenarioQuest.progress[i];
        });
        const done = scenarioQuest.completedBy;
        base.quest = {definition: r.quest, source: r.id, generation: 4, progress, completedBy: done === undefined ? undefined : TEST_PLAYERS[done].color};
        if (done !== undefined) {
          base.chairman = TEST_PLAYERS[done].color;
        }
      }
      if (this.context === 'resolving') {
        const asked = this.viewerColor;
        if (this.family === 'winner-tile') {
          // THE WINNER'S PLACEMENT STANDS: every seat up to the winner (generation order) already has its plants.
          const winnerSeat = this.winner === 'neutral' ? undefined : this.winner;
          // The winner's ask: a tile's cell (`space`), or the colony pick (`colony`) — the step key the driver would name.
          const winnerAsk: {key: string, input: 'space' | 'colony'} = r.winnerReward?.kind === 'colony' ?
            {key: 'colony', input: 'colony'} : {key: r.winnerReward?.kind === 'tile' ? r.winnerReward.tile : 'greenery', input: 'space'};
          return {
            ...base, rulingParty: r.party, enacted,
            phase: {
              generation: 3, final: false, step: 'effects', winner: {instance, player: owner},
              pending: winnerSeat === undefined ? undefined : {player: TEST_PLAYERS[winnerSeat].color, ...winnerAsk},
              outcomes: this.supplyOutcomes.filter((o) => winnerSeat === undefined || SEATS.findIndex((i) => TEST_PLAYERS[i].color === o.player) <= winnerSeat),
            },
          };
        }
        return {
          ...base, rulingParty: r.party, enacted,
          phase: {
            generation: 3, final: false, step: 'effects', winner: {instance, player: owner},
            pending: asked === undefined ? undefined : {player: asked, key: this.pickerEffect?.id ?? 'effect', input: 'card'},
            outcomes: [],
          },
        };
      }
      const winnerSeat = this.winner === 'neutral' ? undefined : this.winner;
      return {
        ...base, rulingParty: r.party, enacted,
        lastPhase: {
          generation: 3, final: false,
          winner: {instance, resolution: r.id, party: r.party, votes: 2, player: owner},
          agenda: winnerSeat === undefined ? undefined : {player: TEST_PLAYERS[winnerSeat].color, from: this.seats[winnerSeat].agenda, to: this.agendaAt(winnerSeat)},
          outcomes: this.appliedOutcomes, support: [], enacted, refreshed: [], lobbyRefilled: [],
        },
      };
    },
    /**
     * THE LEVY's records (a budget): what the shared step takes FIRST from every seat — the supply bounded take
     * as a negative `stock` amount with `owed` beside it (a short seat's reason on the record), or the named
     * skip of a seat that held nothing. The server's order: before every payout.
     */
    levyOutcomes(): Array<ParliamentEnactOutcomeModel> {
      const levy = this.selected?.levy;
      const out: Array<ParliamentEnactOutcomeModel> = [];
      if (levy === undefined) {
        return out;
      }
      for (const i of SEATS) {
        const held = this.seats[i].megacredits ?? 20;
        const paid = levyPaid(levy, held);
        const common = {player: TEST_PLAYERS[i].color, step: LEVY_STEP_KEY, part: 'effect' as const, stock: levy.resource, owed: levy.amount};
        if (paid <= 0) {
          out.push({...common, kind: 'skipped', amount: 0, reason: levyNothingReasonKey(levy.resource)});
        } else if (paid < levy.amount) {
          out.push({...common, kind: 'stock', amount: -paid, before: held, after: held - paid, reason: levyShortReasonKey(levy.resource)});
        } else {
          out.push({...common, kind: 'stock', amount: -paid, before: held, after: held - paid});
        }
      }
      return out;
    },
    /** The SUPPLY payouts (a `stock` unit) the server records — every seat's amount with the supply before and after, or its named skip. */
    supplyOutcomes(): Array<ParliamentEnactOutcomeModel> {
      const out: Array<ParliamentEnactOutcomeModel> = [];
      const levy = this.selected?.levy;
      for (const effect of this.selected?.scaled ?? []) {
        if (effect.unit.kind !== 'stock') {
          continue;
        }
        const resource: Resource = effect.unit.resource;
        for (const i of SEATS) {
          const payout = this.payoutAt(effect, i);
          if (payout === undefined) {
            continue;
          }
          // Behind a LEVY of the same currency the payout lands on what the levy LEFT — the records chain.
          const held = this.seats[i].megacredits ?? 20;
          const before = levy !== undefined && levy.resource === resource ? held - levyPaid(levy, held) : 3 * (i + 1);
          const common = {
            player: TEST_PLAYERS[i].color, step: effect.id, part: 'effect' as const, effect: effect.id, stock: resource, amount: payout.amount, influence: payout.influence,
            // A supply payout with a COUNT term (Generous Funding, the budgets): the record carries the count and what explains it.
            ...(payout.count === undefined ? {} : {
              count: payout.count.count, counted: payout.count.cards, countedMetric: payout.count.metric, countedByResource: payout.count.byResource,
              uncapped: payout.uncapped,
            }),
          };
          out.push(payout.skipped === undefined ?
            {...common, kind: 'stock', before, after: before + payout.amount} :
            {...common, kind: 'skipped', reason: payout.skipped});
        }
      }
      return out;
    },
    /**
     * The winner's part as the server records it: a TILE placed (its parameter before → after) or the named skip;
     * a COLONY built on a tile (Colony Contest) or the empty table's skip; nothing for a neutral winner.
     */
    winnerOutcome(): ParliamentEnactOutcomeModel | undefined {
      const reward = this.selected?.winnerReward;
      if (reward === undefined || this.winner === 'neutral') {
        return undefined;
      }
      const player = TEST_PLAYERS[this.winner].color;
      if (reward.kind === 'colony') {
        return this.noCell ?
          {player, step: 'colony', part: 'winner', kind: 'skipped', reason: 'No colony is available'} :
          {player, step: 'colony', part: 'winner', kind: 'colony', colony: ColonyName.LUNA};
      }
      if (this.noCell) {
        return {player, step: reward.tile, part: 'winner', kind: 'skipped', reason: reward.tile === 'greenery' ? 'No space can take a greenery' : 'No space can take an ocean'};
      }
      if (reward.tile === 'greenery') {
        const before = this.table.oxygen;
        return {player, step: 'greenery', part: 'winner', kind: 'greenery', space: '35', parameter: {id: 'oxygen', before, after: Math.min(14, before + 1)}};
      }
      const before = this.table.oceans;
      return before >= 9 ?
        {player, step: 'ocean', part: 'winner', kind: 'skipped', reason: 'No ocean tile is left'} :
        {player, step: 'ocean', part: 'winner', kind: 'ocean', space: '35', parameter: {id: 'oceans', before, after: before + 1}};
    },
    /** The record the server would keep for this enactment's scaled part — every seat's payout, or its named skip. */
    appliedOutcomes(): Array<ParliamentEnactOutcomeModel> {
      const r = this.selected;
      const out: Array<ParliamentEnactOutcomeModel> = [];
      if (r === undefined) {
        return out;
      }
      // THE LEVY FIRST — the printed order is the recorded order.
      out.push(...this.levyOutcomes);
      out.push(...this.supplyOutcomes);
      const tile = this.winnerOutcome;
      if (tile !== undefined) {
        out.push(tile);
      }
      for (const effect of r.scaled ?? []) {
        if (effect.sequel !== undefined) {
          // THE DRAW's record: the amount, the total it was divided from
          // (before -> after) and what actually left the deck.
          for (const i of SEATS) {
            const payout = this.payoutAt(effect, i);
            if (payout === undefined) {
              continue;
            }
            const common = {
              player: TEST_PLAYERS[i].color, step: effect.id, part: 'effect' as const, effect: effect.id,
              amount: payout.amount, influence: payout.influence, total: payout.total,
            };
            out.push(payout.skipped === undefined ?
              {...common, kind: 'cards' as const, drawn: payout.amount} :
              {...common, kind: 'skipped' as const, reason: payout.skipped});
          }
          continue;
        }
        if (effect.unit.kind === 'production') {
          // THE PRODUCTION RECORD the server keeps: the amount, every input
          // (B, the counted cards, I, the sum before the cap) and before → after.
          const resource = effect.unit.resource;
          for (const i of SEATS) {
            const payout = this.payoutAt(effect, i);
            if (payout === undefined) {
              continue;
            }
            const before = this.seats[i].production ?? 0;
            const common = {
              player: TEST_PLAYERS[i].color, step: effect.id, part: 'effect' as const, effect: effect.id, production: resource, amount: payout.amount, influence: payout.influence,
              count: payout.count?.count, counted: payout.count?.cards, countedUnits: payout.count?.units, countedSpaces: payout.count?.spaces,
              countedMetric: payout.count?.metric, uncapped: payout.uncapped,
            };
            out.push(payout.skipped === undefined ?
              {...common, kind: 'production', before, after: before + payout.amount} :
              {...common, kind: 'skipped', reason: payout.skipped});
          }
          continue;
        }
        if (effect.unit.kind !== 'cardResource') {
          continue;
        }
        for (const i of SEATS) {
          const payout = this.payoutAt(effect, i);
          if (payout === undefined) {
            continue;
          }
          const common = {player: TEST_PLAYERS[i].color, step: effect.id, effect: effect.id, resource: effect.unit.resource, amount: payout.amount, influence: payout.influence};
          if (payout.skipped !== undefined) {
            out.push({...common, kind: 'skipped', reason: payout.skipped});
            continue;
          }
          if (effect.unit.spread === true) {
            // THE DISTRIBUTION's record: the whole list of recipients (the stand lays the payout out evenly), the
            // count's inputs beside it — a list of ONE names its card too, exactly as the server records it.
            const laid = spreadOver(this.holdersAt(effect.unit.resource, i), payout.amount);
            out.push({
              ...common, kind: 'cardResource', cards: laid, ...(laid.length === 1 ? {card: laid[0].card} : {}),
              count: payout.count?.count, counted: payout.count?.cards, countedUnits: payout.count?.units, countedByTag: payout.count?.byTag,
            });
            continue;
          }
          out.push({...common, kind: 'cardResource', card: i === 0 ? CardName.FISH : CardName.BIRDS});
        }
      }
      return out;
    },
    /** The viewer's readings for the chosen context — the ONE model the game reads. */
    yields(): ReadonlyArray<InfluenceYield> {
      const r = this.selected;
      if (r === undefined || (r.scaled ?? []).length === 0) {
        return [];
      }
      switch (this.context) {
      case 'reference': return (r.scaled ?? []).map(referenceYield);
      case 'proposal': return voteYieldsOf(r, this.model, this.viewerColor);
      case 'resolving': return (r.scaled ?? []).map((e) => this.resolvingReading(e, this.viewerSeatIndex));
      case 'applied': return enactedYieldsOf(r, this.model, this.viewerColor);
      }
    },
    /** The forecast's honest note (the vote surface's) — a live or recorded reading names its own skip. */
    yieldNote(): string | undefined {
      const effect = this.pickerEffect;
      return effect !== undefined && effect.unit.kind === 'cardResource' && this.noRecipient && this.context === 'proposal' && this.viewerSeatIndex !== undefined ?
        noRecipientForecastKey(effect.unit.resource) : undefined;
    },
    status(): ResolutionStatusVm | undefined {
      return this.selected === undefined ? undefined : resolutionStatusOf(this.selected.id, this.model, this.viewerColor);
    },
    seatRows(): Array<SeatRow> {
      const r = this.selected;
      if (r === undefined || (r.scaled ?? []).length === 0 || this.context === 'reference') {
        return [];
      }
      return SEATS.map((i) => {
        const color = TEST_PLAYERS[i].color;
        let yields: ReadonlyArray<InfluenceYield>;
        switch (this.context) {
        case 'proposal': yields = voteYieldsOf(r, this.model, color); break;
        case 'resolving': yields = (r.scaled ?? []).map((e) => this.resolvingReading(e, i)); break;
        default: yields = enactedYieldsOf(r, this.model, color);
        }
        return {
          color,
          label: TEST_PLAYERS[i].label,
          viewer: this.viewerSeatIndex === i,
          winner: this.winner === i,
          yields,
          advance: this.advancedAt(i) ? translateTextWithParams('Agenda ${0} → ${1}', [String(this.seats[i].agenda), String(this.agendaAt(i))]) : undefined,
          winnerPart: r.hasWinnerEffect && this.winner === i && this.pastWinnerStep,
        };
      });
    },
    // ── the picker ─────────────────────────────────────────────────────
    /** The viewer's payout at the enactment (the winner's step counted), or undefined for a spectator. */
    pickerPayout(): SeatPayout | undefined {
      const effect = this.pickerEffect;
      const i = this.viewerSeatIndex;
      return effect === undefined || i === undefined ? undefined : this.payoutAt(effect, i);
    },
    pickerYieldAmount(): number {
      return this.pickerPayout?.amount ?? 0;
    },
    /** Why the picker would never be asked (an English key) — the same reasons the enactment records. */
    pickerSkip(): string | undefined {
      if (this.viewerSeatIndex === undefined) {
        return 'A spectator receives nothing';
      }
      return this.pickerPayout?.skipped;
    },
    pickerYield(): InfluenceYield | undefined {
      const effect = this.pickerEffect;
      return effect === undefined ? undefined : this.resolvingReading(effect, this.viewerSeatIndex);
    },
    sourceView(): PromptSourceView {
      return choiceSourceView({kind: 'resolution', resolution: this.selected?.id}) ?? {kindKey: 'Resolution', inspectable: false};
    },
    resourceIcon(): string {
      const effect = this.pickerEffect;
      return effect !== undefined && effect.unit.kind === 'cardResource' ? String(effect.unit.resource).toLowerCase().replace(/\s+/g, '-') : 'animal';
    },
    /** The resource a DISTRIBUTED payout lands on (the picker effect's, when it is laid out), else undefined. */
    spreadResource(): CardResource | undefined {
      const effect = this.pickerEffect;
      return effect !== undefined && effect.unit.kind === 'cardResource' && effect.unit.spread === true ? effect.unit.resource : undefined;
    },
    /**
     * The picker's candidates: for a DISTRIBUTED payout the viewer's OWN holders from the scenario's tableau
     * (stored counts 0, 1, 2… so the readings differ per card); for the animal families the demo holders.
     */
    pickerHolders(): ReadonlyArray<{name: CardName, resources: number, per?: number}> {
      const resource = this.spreadResource;
      const viewer = this.viewerSeatIndex;
      if (resource === undefined || viewer === undefined) {
        return DEMO_HOLDERS;
      }
      return this.holdersAt(resource, viewer).map((name, n) => ({name, resources: n}));
    },
    /**
     * THE LAYOUT the shared step would ask for — N ≥ 2 over ≥ 2 holders (below that the family's ordinary pick
     * stands, and the stand shows exactly that). The real surface is the game's own (`ConsoleTaskHost` in its
     * layout mode); the stand states the facts and hands over to the LIVE scenario for the surface.
     */
    pickerLayout(): {amount: number, holders: ReadonlyArray<{name: CardName, resources: number}>} | undefined {
      if (this.spreadResource === undefined || this.pickerSkip !== undefined) {
        return undefined;
      }
      const amount = this.pickerYieldAmount;
      const holders = this.pickerHolders;
      return amount >= 2 && holders.length >= 2 ? {amount, holders} : undefined;
    },
    pickerLayoutLine(): string {
      const layout = this.pickerLayout;
      return layout === undefined ? '' :
        translateTextWithParams('Lay out ${0} over ${1} cards — 0 to ${0} on each; the live scenario opens the real layout', [String(layout.amount), String(layout.holders.length)]);
    },
    /** The SelectCard the server would send: candidates with live counts, the amount, the per-card VP reading. */
    selectModel(): SelectCardModel {
      const amount = this.pickerYieldAmount;
      const holders = this.pickerHolders;
      const cards = holders.map((h) => ({name: h.name, resources: h.resources} as CardModel));
      const vpBox: Partial<Record<CardName, {from: number, to: number}>> = {};
      for (const h of holders) {
        if (h.per !== undefined) {
          vpBox[h.name] = {from: Math.floor(h.resources / h.per), to: Math.floor((h.resources + amount) / h.per)};
        }
      }
      // The server's own ask (the family's pick title), numbered by the payout.
      const effect = this.pickerEffect;
      const title: Message | string = effect?.unit.kind === 'cardResource' && effect.unit.resource === CardResource.ANIMAL ?
        {message: 'Add ${0} animal(s) to one of your cards', data: [{type: LogMessageDataType.RAW_STRING, value: String(amount)}]} :
        effect?.unit.kind === 'cardResource' && effect.unit.resource === CardResource.FLOATER ?
          {message: 'Add ${0} floater(s) to one of your cards', data: [{type: LogMessageDataType.RAW_STRING, value: String(amount)}]} :
          translateText('Add resource to this card');
      return {
        type: 'card', title, buttonLabel: 'Add', cards, max: 1, min: 1,
        showOnlyInLearnerMode: false, selectBlueCardAction: false, showOwner: false, showSelectAll: false,
        resourceGainPrompt: {amount, cardResource: this.resourceIcon, vpBox},
        choiceContext: {source: {kind: 'resolution', resolution: this.selected?.id}, mode: 'reward'},
      } as SelectCardModel;
    },
    targetModel(): PlayedTargetModel | undefined {
      const color = this.viewerColor;
      if (this.pickerEffect === undefined || color === undefined) {
        return undefined;
      }
      const input = this.selectModel;
      const amount = input.resourceGainPrompt?.amount;
      return buildPlayedTargetModel({
        candidates: input.cards,
        players: [{name: translateText(this.viewerLabel), color, tableau: input.cards}],
        viewerColor: color,
        ask: typeof input.title === 'string' ? translateText(input.title) : translateMessage(input.title),
        direction: 'add',
        typeOf: (name) => getCard(name)?.type,
        preview: (name) => playedTargetPreviewFor(undefined, input, name),
        resourceContext: (_name, model) => playedTargetResourceFor(amount, input.resourceGainPrompt?.cardResource, model),
      });
    },
    targetLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.targetModel?.owners ?? [],
        availW: 960 * conUiScale(),
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    targetFocus(): PlayedTargetFocus {
      return {ownerId: this.viewerColor ?? '', index: this.pickerIndex};
    },
    pickerBandHeight(): number {
      return Math.round(420 * conUiScale());
    },
  },
  watch: {
    /** Paging to a resolution of the OTHER family opens that family's own opening scenario. */
    family(next: PgFamily): void {
      if (SCENARIOS[this.scenario]?.family !== next) {
        this.applyScenario(DEFAULT_SCENARIO_OF[next]);
      }
    },
  },
  methods: {
    partyNameKey(party: string): string {
      return partyNameKey(party);
    },
    /** A production term's icon — the console's own sprite family (the production plate is the term's CSS). */
    productionUnitClass(resource: Resource): string {
      return iconClassFor(resource);
    },
    vmOf(entry: IClientResolution): PremiumCardVM {
      return resolutionPremiumVm(entry);
    },
    /** The face's key — a resolution id never collides with a CardName (the premium face's own convention). */
    cardNameOf(entry: IClientResolution): CardName {
      return entry.id as CardName;
    },
    /** A card's verdict: counted (with its own contribution where it is more than one), or why not. */
    verdictOf(card: TableauCardRow): string {
      if (!card.counts) {
        return '✕ ' + translateText(card.reason);
      }
      return card.units > 1 ?
        '✓ ' + translateTextWithParams('Counted ×${0}', [String(card.units)]) :
        '✓ ' + translateText('Counted');
    },
    /** A cell's verdict: counted, or why not (the shared cell predicate's own reason). */
    cellVerdictOf(cell: CellRowCell): string {
      return cell.counts ? '✓ ' + translateText('Counted') : '✕ ' + translateText(cell.reason);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    /** A test seat's display name (the winner's recipient caption). */
    seatName(color: Color): string {
      const i = SEATS.find((k) => TEST_PLAYERS[k].color === color);
      return translateText(i === undefined ? color : TEST_PLAYERS[i].label);
    },
    /**
     * A LIVE scenario: boot its engine-generated fixture as a real game and
     * open the seat it arranges as the viewer. A build without the fixtures
     * (or a refused door) names why and stays on the stand.
     */
    async startLive(): Promise<void> {
      const live = this.liveScenario;
      if (live?.live === undefined || this.liveState === 'starting') {
        return;
      }
      this.liveState = 'starting';
      this.liveError = '';
      try {
        const resp = await fetch(apiUrl(paths.API_DEV_PLAYGROUND_SCENARIO + '?scenario=' + encodeURIComponent(live.live)), {method: 'POST'});
        if (!resp.ok) {
          this.liveState = 'error';
          this.liveError = resp.status === 404 ? 'This scenario is not available in this build' : resp.status === 403 ? 'Live scenarios need a local server' : 'The scenario could not be started';
          return;
        }
        const boot = await resp.json() as PlaygroundScenarioBoot;
        navigateWithCurtain(paths.PLAYER + '?id=' + encodeURIComponent(boot.playerId), 'sync');
      } catch {
        this.liveState = 'error';
        this.liveError = 'The scenario could not be started';
      }
    },
    // ── the seats ──────────────────────────────────────────────────────
    /** Did this seat's marker take the winner's step in this context? */
    advancedAt(i: SeatIndex): boolean {
      return this.winner === i && this.pastWinnerStep && this.seats[i].agenda < AGENDA_TRACK.length;
    },
    agendaAt(i: SeatIndex): number {
      const agenda = this.seats[i].agenda;
      return this.advancedAt(i) ? Math.min(AGENDA_TRACK.length, agenda + 1) : agenda;
    },
    /** The seat's influence as the context reads it (the track position + what it holds beyond the track). */
    influenceAt(i: SeatIndex): number {
      return influenceAtAgenda(this.agendaAt(i)) + this.seats[i].bonus;
    },
    seatModel(i: SeatIndex): ParliamentPlayerModel {
      const model: ParliamentPlayerModel = {
        color: TEST_PLAYERS[i].color, participates: true, lobby: true, reserve: 5, onResolutions: this.winner === i ? 2 : 0, chairman: false,
        agenda: this.agendaAt(i), influence: this.influenceAt(i), access: [], partyActionUses: {}, resolutionActionUses: 0,
      };
      // The seat's COUNTS, the way the server model carries them — through the shared predicate.
      const count = this.countAt(i);
      if (count !== undefined) {
        model.counts = [count];
      }
      // …and the PRODUCTION a sequential part divides, exactly as the server
      // model carries it (only the resource some declaration names).
      const total = this.sequelEffect?.sequel?.total;
      if (total !== undefined && total.kind === 'production') {
        model.production = {[total.resource]: this.seats[i].production ?? 0};
      }
      // …and the SUPPLY a LEVY takes from (a budget's M€), the way the server model carries it: the seat's
      // synthetic supply under the levy's own resource — what the shortfall warning and the net line read.
      const levy = this.selected?.levy;
      if (levy !== undefined) {
        model.stock = {[levy.resource]: this.seats[i].megacredits ?? 20};
      }
      // …and the COLONY LEDGER a «colony bonuses» part multiplies — the registry the server ships, built from
      // the colony manifest's printed bonuses (the same descriptors `IColony.colonyBonusGrant` reads).
      if (colonyBonusesEffectOf(this.selected ?? {}) !== undefined) {
        model.colonyBonuses = (this.seats[i].colonies ?? []).map((name) => {
          const colony = getColony(name).colony;
          const grant: ColonyTradeGrantModel = {benefit: colony.type, quantity: colony.quantity};
          if (colony.resource !== undefined) {
            grant.resource = colony.resource;
          }
          const cardResource = getColony(name).cardResource;
          if (cardResource !== undefined && (colony.type === ColonyBenefit.ADD_RESOURCES_TO_CARD || colony.type === ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD)) {
            grant.cardResource = cardResource;
          }
          return {colony: name, grant, description: colony.description};
        });
      }
      return model;
    },
    /** The owner's side of the tag-activity rule for a synthetic tableau (Odyssey keeps events face up). */
    countContextOf(names: ReadonlyArray<CardName>): CardCountContext {
      return {eventTagsInPlay: names.includes(CardName.ODYSSEY)};
    },
    /** Seat `i`'s cards that can HOLD `resource` (the layout's candidates), in tableau order. */
    holdersAt(resource: CardResource, i: SeatIndex): Array<CardName> {
      return (this.seats[i].cards ?? []).filter((name) => getCard(name)?.resourceType === resource);
    },
    /** Seat `i`'s count for the selected resolution's counted term (undefined when nothing is counted). */
    countAt(i: SeatIndex): ResolutionCountModel | undefined {
      const effect = this.countEffect;
      if (effect?.count === undefined) {
        return undefined;
      }
      // A BOARD count walks the seat's CELLS through the shared cell predicate — the same rule the
      // engine's reading is pinned to, never a number typed into the scenario.
      const kind = resolutionCountKind(effect.count.id).kind;
      if (kind === 'board') {
        return countSpacesToward(effect.count.id, this.seats[i].cells ?? []);
      }
      // A THRESHOLD count divides the seat's synthetic VALUE by the ONE shared function — the number of sets is
      // never typed into the scenario either; the scenario states the rating and the rule does the rest.
      if (kind === 'threshold') {
        return countMetricToward(effect.count.id, this.seats[i].tr ?? 20);
      }
      // A PRODUCTION count adds the seat's synthetic TRACK up through the ONE shared reader — the sum and its
      // per-resource breakdown are the reader's, never typed into the scenario.
      if (kind === 'production') {
        return countProductionToward(effect.count.id, this.seats[i].productions ?? {});
      }
      const names = this.seats[i].cards ?? [];
      const cards = names.map((name) => getCard(name)).filter((card): card is NonNullable<typeof card> => card !== undefined);
      return countCardsToward(effect.count.id, cards, this.countContextOf(names));
    },
    /**
     * What `effect` pays seat `i` AT THE ENACTMENT — the winner's Agenda step
     * already taken (whatever the context shows) — through the ONE formula,
     * with the enactment's own skip reasons: nothing owed, or no card of the
     * test player's that can hold the resource.
     */
    payoutAt(effect: InfluenceScaledEffect, i: SeatIndex): SeatPayout | undefined {
      if (effect.recipient === 'winner' && this.winner !== i) {
        return undefined;
      }
      const seat = this.seats[i];
      const agenda = this.winner === i ? Math.min(AGENDA_TRACK.length, seat.agenda + 1) : seat.agenda;
      const influence = influenceAtAgenda(agenda) + seat.bonus;
      const term = effect.sequel;
      if (term !== undefined) {
        // A SEQUENTIAL part: the total this resolution's earlier part leaves
        // behind, then the ONE division. Influence is already inside the total.
        const before = seat.production ?? 0;
        const source = sequelSourceOf(this.selected, effect);
        const after = Math.max(0, before + (source === undefined ? 0 : scaledAmount(source, influence)));
        const amount = sequelAmount(effect, after);
        const total = {before, after};
        return amount <= 0 ?
          {amount: 0, influence, total, skipped: sequelPresentation(term).skipReasonKey} :
          {amount, influence, total};
      }
      if (effect.count !== undefined) {
        // A COUNTED term: the seat's own count through the shared predicate, then the ONE formula.
        const count = this.countAt(i);
        const counted = count?.count ?? 0;
        const amount = scaledAmount(effect, influence, counted);
        const uncapped = uncappedAmount(effect, influence, counted);
        // The skip reason is the SERVER's own for this count id — the stand
        // never invents a sentence the game would not record.
        if (amount <= 0) {
          return {amount: 0, influence, count, uncapped, skipped: yieldCountPresentation(effect.count.id).skipReasonKey};
        }
        // A DISTRIBUTED payout with no holder is OWED and forfeited — named with its size (the server's own reason).
        if (effect.unit.kind === 'cardResource' && ((this.noRecipient && this.viewerSeatIndex === i) || this.holdersAt(effect.unit.resource, i).length === 0)) {
          return {amount, influence, count, uncapped, skipped: noRecipientReasonKey(effect.unit.resource)};
        }
        return {amount, influence, count, uncapped};
      }
      const amount = scaledAmount(effect, influence);
      if (amount <= 0) {
        return {amount: 0, influence, skipped: 'No influence'};
      }
      if (effect.unit.kind === 'cardResource' && this.noRecipient && this.viewerSeatIndex === i) {
        return {amount, influence, skipped: noRecipientReasonKey(effect.unit.resource)};
      }
      return {amount, influence};
    },
    /** A live payout's reading for seat `i` (the server's amount, its skip named), the formula without a seat. */
    resolvingReading(effect: InfluenceScaledEffect, i: SeatIndex | undefined): InfluenceYield {
      const payout = i === undefined ? undefined : this.payoutAt(effect, i);
      if (i === undefined || payout === undefined) {
        return referenceYield(effect);
      }
      const reading = payout.total !== undefined ?
        fixedSequelYield(effect, 'resolving', payout.amount, payout.total, {influence: payout.influence}) :
        payout.count !== undefined ?
          fixedYield(effect, 'resolving', payout.amount, payout.influence,
            {
              count: payout.count.count, counted: payout.count.cards, countedUnits: payout.count.units, countedSpaces: payout.count.spaces,
              countedMetric: payout.count.metric, countedByResource: payout.count.byResource, uncapped: payout.uncapped,
            }) :
          resolvingYieldOf(effect, payout.amount, this.model, TEST_PLAYERS[i].color);
      return payout.skipped === undefined ? reading : {...reading, skipped: payout.skipped};
    },
    // ── the pad ────────────────────────────────────────────────────────
    applyScenario(index: number): void {
      Object.assign(this, scenarioState(index));
      this.pickerIndex = 0;
      this.lockedCard = '';
      this.liveState = 'idle';
      this.liveError = '';
    },
    /** A: the test player's influence +1 (wraps), set by the Agenda position that reads as it. */
    bumpInfluence(): void {
      const i = this.viewerSeatIndex;
      if (i === undefined) {
        return;
      }
      const seat = this.seats[i];
      const next = (influenceAtAgenda(seat.agenda) + seat.bonus + 1) % (MAX_INFLUENCE + 1);
      // Only the influence moves: the seat keeps its tableau and its production.
      this.seats = this.seats.map((s, k) => k === i ? {...s, agenda: AGENDA_FOR_INFLUENCE[next], bonus: 0} : s);
      this.modified = true;
    },
    /** X: the REAL fullscreen viewer over the catalog, reading this stand's table and test player. */
    openFullscreen(): void {
      if (this.catalog.length === 0) {
        return;
      }
      openConsoleCardZoom(this.catalog.map((r) => resolutionZoomEntry(r.id)), this.cursor, undefined, undefined, {
        origin: slotZoomOrigin(
          () => this.$el as HTMLElement | undefined,
          (index) => 'resolution:' + (this.catalog[index]?.id ?? ''),
          (index) => {
            this.cursor = index;
          }),
        parliament: {model: () => this.model, viewer: () => this.viewerColor, table: () => this.winnerTable, nameOf: (color: Color) => this.seatName(color)},
        // The position rides the FOOTER, as in the Parliament («LB ◀ 1/11 ▶ RB») — never a counter plate over
        // the card plus a «ЛИСТАТЬ» pager below it (registry R-08 / R-22).
        counterInFooter: this.catalog.length > 1,
      });
    },
    /** The stand forwards every intent here first; `false` hands it back (scroll, sections, B). */
    handleIntent(intent: GamepadIntent): boolean {
      if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
        this.cursor = stepIndex(this.cursor, intent.dir === 'right' ? 1 : -1, this.catalog.length);
        this.pickerIndex = 0;
        this.lockedCard = '';
        return true;
      }
      if (intent.kind !== 'press') {
        return false;
      }
      if (intent.button === 'stickL') {
        this.winner = this.winner === 'neutral' ? 0 : this.winner === 0 ? 1 : 'neutral';
        this.modified = true;
        return true;
      }
      switch (consoleActionOf(intent)) {
      case 'inspect':
        this.openFullscreen();
        return true;
      case 'nextTab': {
        const list = this.scenarioList;
        const at = list.findIndex((entry) => entry.i === this.scenario);
        this.applyScenario(list[(at + 1) % list.length].i);
        return true;
      }
      case 'reset':
        this.viewer = ((this.viewer + 1) % 3) as ViewerIndex;
        this.pickerIndex = 0;
        this.lockedCard = '';
        this.modified = true;
        return true;
      case 'primary':
        if (this.liveScenario !== undefined) {
          void this.startLive();
          return true;
        }
        this.bumpInfluence();
        return true;
      case 'fullscreen':
        this.context = CONTEXTS[(CONTEXTS.indexOf(this.context) + 1) % CONTEXTS.length];
        return true;
      case 'prevTab': {
        const count = this.targetModel?.owners[0]?.candidates.length ?? 0;
        if (count > 0) {
          this.pickerIndex = (this.pickerIndex + 1) % count;
          this.lockedCard = this.targetModel?.owners[0]?.candidates[this.pickerIndex]?.cardName ?? '';
        }
        return true;
      }
      default:
        return false;
      }
    },
  },
});
</script>
