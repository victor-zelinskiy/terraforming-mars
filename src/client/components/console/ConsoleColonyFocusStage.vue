<template>
  <!--
    COLONY FOCUS STAGE (iteration 3 — the premium detail scene). The
    workspace's DEEPER state for ONE colony; the crumb above already says
    «КОЛОНИИ › <colony> › <этап>», so the stage never titles itself.

    COMPOSITION — ONE surface, three columns, read left → right:

      HERO      the colony as a physical object: the big planet with its
                orbital berth (the fleet's live landing anchor), the active
                state, what the colony IS, who is parked here, and the honest
                verdict beside the identity it judges.

      MAIN      the GAME OBJECT, top to bottom:
                · the EXPANDED TRADE TRACK — one big cell per position with
                  its reward, and a real marker SEAT on a rail underneath
                  (the seat is what the glide proxy lands on, so the flying
                  marker is the same size as the resting one);
                · the RETURN BASE — the rule made visible: a bracket from
                  position 1 to the built-colony count with the ⟲ anchor
                  under the exact cell the track falls back to, the built
                  cubes inline, and (in build mode) the +1 ghost one cell
                  further right;
                · the COLONY BERTHS — three real places, each carrying the
                  return step it would buy («⟲ 2/3/4»), so «building raises
                  my trade floor» is read, never deduced;
                · the ACTION CONFIGURATION (payment paths + decisions for
                  trade; the confirm brief for build/pick; the colony's own
                  rules for inspect — never an empty payment skeleton).

      RESULT    the outcome grouped BY SOURCE, one card per source: the trade
                reward / the owners' bonus / extras / payment — or the build
                grant / the new colony / the future owner bonus.

      (The command verbs live ONLY in the shell's bottom bar.)

    RESOLUTION HAPPENS HERE: the hero planet carries the live
    `data-fleet-berth`, every track cell's SEAT carries
    `data-colony-track-cell`, the tight reward values carry
    `data-colony-trade-source` / `data-colony-bonus-source` and each berth's
    cube seat carries `data-colony-build-slot` + `data-colony-build-seat` —
    so the fleet, the reward chips, the marker glide and the build cube all
    land on THIS stage at THIS stage's real geometry.

    MOTION: `data-unfold-item` marks the structural groups (they surface from
    inside the opened panel) and `data-unfold-late` the FINE PRINT — text and
    numbers arrive only once the geometry has settled (consoleColonyFocusMotion).
  -->
  <div class="con-colfocus"
       ref="rootEl"
       :class="['con-colfocus--' + presentMode, {
         'con-colfocus--resolving': resolving,
         'con-colfocus--gliding': trackGliding,
         /* OWNERSHIP — the stage is a follow-up's host, so it holds its
            geometry (the action height) from submit time. It paints NOTHING:
            a claim that turns out to have nothing to present must leave no
            trace, and a zone that dressed itself on ownership alone is what
            stood as an empty dimmed box over Луна's finished trade. */
         'con-colfocus--claimed': outcomeZone,
         /* READINESS — a payout is genuinely STANDING in the zone, so the
            working area is handed over. It comes BACK the moment the payout
            leaves (see `workingAreaYielded`): the closing beat — the track
            reset — plays on the track this pose hides.
            In the BONUS composition there is no working area to hand over —
            the zone IS the stage's body — so readiness is simply «the zone
            exists»: it must paint its volume and take input from the first
            frame, with nothing to fade out first. */
         'con-colfocus--handing': workingAreaYielded || (bonusMode && outcomeZone),
         /* THE TARGET STEP — the trade's working area yields to the embedded
            played-card selector (one level deeper, reversible: B returns and
            everything under the pose is untouched). The hero planet stays. */
         'con-colfocus--targeting': sub === 'targets',
         /* THE PRESENTED TARGETS — the chosen host card(s) stand while the
            reward physically lands on them. A TRADE yields its working area
            (the track and the configuration are spent); a BUILD may NOT —
            its cube is landing in the berth row right there — so the card
            takes the summary rail's column instead and both physical events
            stay visible at once. */
         'con-colfocus--carding': cardlandVisible && intent !== 'build',
         'con-colfocus--carding-rail': cardlandVisible && intent === 'build',
         /* THE ROSTER ACT (a tile replaced / added / removed): the build's or the
            pick's composition plus the roster's own reading. Before the dock the
            entering planet stands in its PROJECTION pose. */
         'con-colfocus--roster': roster !== undefined,
         'con-colfocus--roster-projected': rosterProjected,
         /* THE CITY ACT (a city laid on this colony tile — TR22): the pick's composition, the working half
            standing as it is, plus the city's own reading in the result rail. */
         'con-colfocus--city': city !== undefined,
       }]"
       :data-colony-intent="city !== undefined ? 'city' : intent"
       :data-colony-roster="roster !== undefined ? roster.kind : undefined"
       :data-colony-track-degraded="intent === 'track' && trackMoveFlow.degraded !== '' ? trackMoveFlow.degraded : undefined"
       :style="fitNeedPx > 0 ? {'--colfocus-need': fitNeedPx + 'px'} : undefined">
    <div class="con-colfocus__surface" data-unfold-surface>
      <!-- THE EDGE IS NOT THE SUBJECT. The stage's boundary is a separate,
           inert layer so it can be brought up AFTER the surface has finished
           opening and the colony's own objects have taken their places —
           «the frame forms around what unfolded», never «a finished bordered
           rectangle grew out of a tile». Being its own element is also what
           lets the light be DIRECTIONAL (lit seam at the head, almost nothing
           at the foot) instead of one equally loud rule all the way round,
           which is what read as a panel-inside-a-panel. -->
      <span class="con-colfocus__edge" data-unfold-edge aria-hidden="true"></span>
      <!-- ═══ HERO — the colony as a physical object ═══ -->
      <section class="con-colfocus__hero">
        <div class="con-colfocus__planetwrap">
          <!-- THE CARD SOURCE. A card payout is BORN AT THE COLONY: physical
               causality says the cards leave the planet the fleet just traded
               with, not the number in the summary rail that happens to count
               them. (Resource rewards still leave their own printed value —
               those ARE the value moving; a card is a thing the colony hands
               over.) -->
          <ConsolePlanetDisc class="con-colfocus__planet"
                             :colony="colony.name"
                             :lit="true"
                             data-colony-focus-planet
                             :data-colony-card-source="colony.name">
            <!-- The ORBITAL BERTH — the live landing anchor of the trade
                 fleet while the stage is up (same data key as the tile's
                 dock; the directors prefer the stage's match). -->
            <span class="con-colfocus__orbit"
                  :data-fleet-berth="colony.name"
                  :class="[
                    colony.visitor !== undefined ? ['con-colfocus__orbit--occupied', 'fleet-hue--' + colony.visitor] : [],
                    {'con-colfocus__orbit--just-docked': fleetJustDockedHere},
                  ]"
                  aria-hidden="true">
              <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" />
            </span>
            <!-- THE ORBIT of a planet that has not docked yet (the roster's projection pose) — a dashed ring
                 around the DISC itself (inside it: a circle, never the wrap's box), closed by the ceremony's
                 dock. Absolute: zero layout. -->
            <span v-if="roster !== undefined" class="con-colfocus__planet-orbit" aria-hidden="true"></span>
            <!-- THE CITY'S SEAT (TR22) — at the disc's lower LEFT (the fleet's orbit is its lower right), absolute:
                 zero layout, so the hero column's children are the same in every phase. It stands in EVERY act
                 (a trade, a build, a pick): a city on the tile is part of what the colony IS. In a «city» act it
                 wears the projection; the landing plays on it. -->
            <ConsoleColonyCitySeat :colony="colony" :projection="cityProjection" size="stage" />
          </ConsolePlanetDisc>
          <span class="con-colfocus__state" :class="colony.isActive ? 'con-colfocus__state--on' : 'con-colfocus__state--off'"
                data-unfold-late>
            {{ $t(heroStateKey) }}
          </span>
        </div>
        <!-- THE OUTGOING SEAT (a replacement): the tile that LEAVES, small, in the corner of the hero column —
             absolute, zero layout. The ceremony's first beat lets it go (`seatGone`). -->
        <div v-if="roster !== undefined && roster.kind === 'replace' && roster.leaves !== undefined && !rosterState.seatGone"
             class="con-colfocus__rosterseat" data-roster-outgoing-seat :data-roster-outgoing="roster.leaves">
          <ConsolePlanetDisc :colony="roster.leaves" />
          <span class="con-colfocus__rosterseat-caption" data-roster-seat-caption>
            <span class="con-colfocus__rosterseat-kicker">{{ $t('Leaves') }}</span>
            <span class="con-colfocus__rosterseat-name">{{ $t(roster.leaves) }}</span>
          </span>
        </div>
        <!-- WHAT THIS COLONY IS, in the vocabulary of what is happening. On a
             TRADE that is the trade income; on a BONUS the player is not
             trading at all, so the trade line would describe an action that
             is not theirs — the colony's OWN bonus is what they are being
             paid, and how many of their settlements are paying it. -->
        <div class="con-colfocus__idmeta" data-unfold-late>
          <div class="con-colfocus__desc" v-i18n>{{ bonusMode ? metadata.colony.description : metadata.trade.description }}</div>
          <!-- …and how many of the viewer's OWN settlements are paying it
               (`bonusMath` falls back to the largest holder when the viewer
               owns none — that number is not «yours» and must not be labelled
               so). -->
          <div v-if="bonusMode && bonusMath !== undefined && bonusMath.color === viewerColor"
               class="con-colfocus__bonusmult">
            <span class="con-colfocus__bonusmult-label">{{ $t('Your colonies here') }}</span>
            <b>×{{ bonusMath.count }}</b>
          </div>
          <div v-if="!bonusMode && visitorLine !== ''" class="con-colfocus__fleetline">
            <ColonyFleetIcon v-if="colony.visitor !== undefined" :color="colony.visitor" />
            <span>{{ visitorLine }}</span>
          </div>
        </div>
        <!-- The honest verdict, under the identity it judges — never a
             stranded red bar at the bottom of an empty page.
             It is a PRE-COMMIT judgement («can I do this?»), so it stops
             existing at the commit boundary — and once THIS stage session has
             crossed it, it never comes back (`commitLatched`): the resolution's
             final beats drop `pastCommit` one signal at a time (transaction
             ends → claim releases → workspace closes), and the live
             re-derivation flashed «✕ Здесь стоит ваш флот» in red for the
             last second before the close — the screen refusing an action it
             had already carried out. -->
        <!-- …and it never appears in the BONUS composition at all: «can I
             trade here?» is not the question the player was brought here to
             answer, and a red «✕ Здесь стоит ваш флот» over a reward they are
             owed is the screen refusing something nobody asked for. -->
        <!-- …and in the CITY act (TR22) its BOX outlives the commit, unpainted (`--reserved`): the hero column is
             centred, so a chip that vanished at the press dropped the planet — and the seat the piece is about to
             land on — by its own height. The place a thing lands on does not move under it. -->
        <div v-if="(!pastCommit && !commitLatched && !bonusMode) || cityVerdictReserved"
             class="con-colfocus__verdict"
             :class="[presentAvailable || cityVerdictReserved ? 'con-colfocus__verdict--ok' :
               (blockTone === 'warning' ? 'con-colfocus__verdict--notnow' : 'con-colfocus__verdict--no'),
                      {'con-colfocus__verdict--reserved': cityVerdictReserved}]"
             data-unfold-late>
          <template v-if="presentAvailable || cityVerdictReserved">
            <span class="con-coltile__status-dot" aria-hidden="true"></span>
            <span>{{ $t(city !== undefined ? 'Can place the city here' : roster !== undefined ? roster.verbKey : intent === 'build' ? 'Build here' : intent === 'track' ? 'Can select' : intent === 'pick' ? (pickLabel || 'Can select') : 'Trade available') }}</span>
          </template>
          <!-- The turn gate is not a refusal: every trade rule is satisfied and
               the colony would take the fleet — it is simply not this player's
               moment. Amber ⏳, never the red ✕ that reads as «эта колония вас
               не принимает». (AvailabilityBlocker: tone 'warning'.) -->
          <template v-else>
            <span aria-hidden="true">{{ blockTone === 'warning' ? '⏳' : '✕' }}</span>
            <span>{{ blockReason !== '' ? $t(blockReason) : $t('Trade unavailable') }}</span>
          </template>
        </div>
        <!-- ═══ THE RESOLUTION CONTEXT — past the commit the colony IS the
             SOURCE of what the player is receiving. A calm chip under the
             planet names the role the hero plays right now («Награда за
             торговлю» → «Бонус владельца» as the waves advance), and a bonus
             triggered by ANOTHER player's trade names that player — the whole
             entry story lives in the identity column, never a second panel,
             and the planet itself stays lit (the source must read as active). -->
        <!-- In the BONUS composition this is not a footnote to a screen about
             something else — it is the WHY of the whole surface, so it leads
             (`--lead`: the role reads as the title, the trigger as its
             subtitle, on their own plate). -->
        <div v-if="presentedContext !== undefined" class="con-colfocus__srcctx"
             :class="{'con-colfocus__srcctx--lead': bonusMode}">
          <span class="con-colfocus__srcchip">
            <span class="con-colfocus__srcchip-mark" aria-hidden="true">◈</span>
            <span>{{ $t('Source') }}</span>
          </span>
          <span class="con-colfocus__srcctx-role"
                :class="{'con-colfocus__srcctx-role--bonus': presentedContext.bonus}">
            {{ $t(presentedContext.roleKey) }}
          </span>
          <span v-if="presentedContext.traderLine !== ''" class="con-colfocus__srcctx-trader">
            <span v-if="presentedContext.traderColor !== ''"
                  :class="'con-status__dot player_bg_color_' + presentedContext.traderColor"
                  aria-hidden="true"></span>
            <span>{{ presentedContext.traderLine }}</span>
          </span>
        </div>
        <!-- (The «СБРОШЕНО» seat lives at SECTION level — one spot that
             survives the focus ⇄ full-stage-discard recompositions without a
             jump; see ConsoleColoniesSection.) -->
      </section>

      <!-- ═══ MAIN — the game object: track › guard rail › berths › setup ═══
           NOT RENDERED IN THE BONUS COMPOSITION. A player being paid by
           somebody else's trade has no track to read and nothing to configure;
           the payout zone below takes this whole area (see `bonusMode`). -->
      <div v-if="!bonusMode" class="con-colfocus__main" ref="mainEl">
        <!-- ── THE TRADE-TRACK INSTRUMENT — the expanded 7-cell track with its
             marker rail, the return stop, the three berths and the owner-bonus
             lane: ONE component, shared with the dossier (X = «Осмотреть»), so
             the object the action resolves on and the object the player reads
             are the same DOM (ConsoleColonyTrackInstrument). The stage passes
             what it PRESENTS (the frozen marker, the pinned offset) and its
             transient beats (the latch, the settle, the build preview). ── -->
        <ConsoleColonyTrackInstrument :colony="colony"
                                      :metadata="metadata"
                                      :markerPosition="markerPosition"
                                      :effectivePosition="effectivePosition"
                                      :ownerNames="ownerNames"
                                      :bonusMath="bonusMath"
                                      :viewerColor="viewerColor"
                                      :latchCell="latchCell"
                                      :settledCell="settledCell"
                                      :touchedCell="touchedCell"
                                      :offsetCaption="intent === 'track' ? 'The marker moves to the top' : 'Your trade advances the track first'"
                                      :buildPreview="buildPreview" />

        <!-- ── THE ACTION CONFIGURATION — adaptive by mode: never an empty
             «СПОСОБ ОПЛАТЫ» skeleton when there is nothing to choose. ── -->
        <section class="con-colfocus__config" data-unfold-item>
          <!-- SUB: the M€ lanes mix — the SHARED payment panel, expanded. -->
          <template v-if="sub === 'lanes' && paymentView !== undefined">
            <ConsolePaymentPanel :view="paymentView"
                                 mode="expanded"
                                 hint-mode="none"
                                 :focus-unit="payFocusUnit"
                                 :flash-nonce="payFlashNonce" />
          </template>

          <!-- SUB: the Delta Works COMPOSITION substep — the working area
               handed over to the premium payment selector. Everything the
               player already decided stays pinned as CONTEXT (the chosen
               target card, the reward — the right rail keeps the live
               summary); the bumpers dial the ONE draft; X is the same final
               trade confirm; B walks back to Configure with every selection
               and the draft intact. Never a modal, never a fourth method. -->
          <template v-else-if="sub === 'mix' && energyMixInfo !== undefined">
            <div class="con-colfocus__mixstep">
              <div v-if="cardTargetLines.length > 0" class="con-colfocus__mixstep-ctx">
                <span class="con-colfocus__mixstep-ctxlabel">{{ $t(cardTargetLines.length > 1 ? 'To these cards:' : 'To this card:') }}</span>
                <span v-for="line in cardTargetLines" :key="line.card" class="con-colfocus__mixstep-target">
                  <i v-if="line.iconClass !== ''" :class="line.iconClass" aria-hidden="true"></i>
                  <span>{{ $t(line.card) }}</span>
                  <em>{{ line.before }} → {{ line.after }}</em>
                </span>
              </div>
              <ConsolePaymentPanel :view="tradeMixView"
                                   mode="compact"
                                   hint-mode="none"
                                   title-key="Payment mix"
                                   :source-card="energyMixInfo.card"
                                   :flash-nonce="mixFlashNonce" />
            </div>
          </template>

          <!-- SUB: track advance choice (IncreaseColonyTrack). -->
          <template v-else-if="sub === 'track' && trackStep !== undefined">
            <div class="con-colfocus__sub-title">{{ $t('Increase colony track before trade') }}</div>
            <div v-for="(opt, i) in trackOptions" :key="'tr' + i"
                 class="con-task__option"
                 :class="{
                   'con-task__option--focused': subIdx === i,
                   'con-colfocus__option--chosen': captures['track'] === opt.steps,
                 }"
                 :ref="subIdx === i ? 'focusedEl' : undefined">
              <div class="con-task__option-main">
                <span class="con-task__opt-title">{{ opt.title }}</span>
                <span class="con-colfocus__track-reward">
                  <span v-if="opt.quantity > 1 || (opt.levy && opt.quantity > 0)" class="con-colfocus__track-rewardqty"
                        :class="{'con-colfocus__track-rewardqty--levy': opt.levy}">{{ opt.levy ? '−' : '' }}{{ opt.quantity }}</span>
                  <BenefitGlyph :benefit="tradeBenefitAt(opt.position)" :idx="opt.position" :cardResources="cardResourceKinds" />
                </span>
                <span v-if="captures['track'] === opt.steps" class="con-colfocus__opt-check" aria-hidden="true">✓</span>
              </div>
            </div>
          </template>

          <!-- (The card-target pick is NOT a config sub-list any more: it is
               the EMBEDDED TARGET STEP — a deeper level of this same flow over
               the whole working area, hosting the SHARED played-card selector.
               See `__targetstage` below the config section.) -->

          <!-- THE REVIEW — the payment paths (trade only) + the decisions this
               act must collect BEFORE the confirm. A BUILD composes here too
               whenever its placement bonus asks something (Titan: «положи 3
               аэростата на карту»): same rows, same picker, same batch — the
               prompt may never arrive after the cube has landed. A build with
               nothing to ask still renders NO panel (`stepRows` is empty and
               the payment block is trade-only). -->
          <template v-else-if="configLive && (tradeConfigLive || stepRows.length > 0)">
            <ConsoleScrollArea class="con-colfocus__configscroll" ref="scroll">
              <!-- The heading belongs to the ROWS, not to the mode: past the
                   commit the server takes the options away and a bare
                   «СПОСОБ ОПЛАТЫ» over nothing read as a broken panel. -->
              <!-- THE ROWS THEMSELVES are the shared component — the fleet-dock stage
                   (a trade whose fleet goes to a CARD) draws the very same ones
                   from the same model (`tradePayModel.ts`). -->
              <ConsoleTradePayRows ref="payRows"
                                   :heading="tradeConfigLive && visiblePayEntries.length + visibleDisabledEntries.length > 0"
                                   :rows="tradeConfigLive ? visiblePayEntries : []"
                                   :disabled="tradeConfigLive ? visibleDisabledEntries : []"
                                   :chosenIndex="payIdx"
                                   :lockedIndex="lockedPayIdx"
                                   :focusedIndex="focusedPayIndex"
                                   :energyIndex="energyEntryIdx"
                                   :energyMixLive="energyMixLive"
                                   :mix="payRowMix"
                                   :mixAdjustable="tradeMixAdjustable"
                                   :held="tradeConfigLive ? heldPayment : undefined" />

              <template v-if="stepRows.length > 0">
                <div class="con-colfocus__sec-title con-colfocus__sec-title--steps">{{ $t('Your choices') }}</div>
                <div v-for="(row, i) in stepRows" :key="row.key"
                     class="con-colfocus__steprow"
                     :class="{
                       'con-colfocus__steprow--focused': isFocused('step', i),
                       'con-colfocus__steprow--missing': rowMissing(row),
                     }"
                     :ref="isFocused('step', i) ? 'focusedEl' : undefined">
                  <div class="con-colfocus__steprow-label">{{ $t(row.label) }}</div>
                  <div class="con-colfocus__steprow-value">
                    <template v-if="row.kind === 'payment'">
                      <span v-if="paymentSummary !== ''">{{ paymentSummary }}</span>
                      <span v-else class="con-colfocus__steprow-empty">{{ $t('Configure payment') }}…</span>
                    </template>
                    <template v-else-if="row.kind === 'trackChoice'">
                      <span v-if="captures['track'] !== undefined">{{ trackSummary }}</span>
                      <span v-else class="con-colfocus__steprow-empty">{{ $t('Choose the track advance') }}…</span>
                    </template>
                    <template v-else-if="row.kind === 'cardTarget' && row.step !== undefined">
                      <i v-if="row.iconClass !== ''" class="con-colfocus__steprow-icon" :class="row.iconClass" aria-hidden="true"></i>
                      <span v-if="captures[row.key] !== undefined">{{ $t(String(captures[row.key])) }}</span>
                      <span v-else class="con-colfocus__steprow-empty">{{ $t('Choose a card') }}…</span>
                      <em v-if="captures[row.key] !== undefined">{{ targetImpact(row) }}</em>
                      <!-- The answered pick stays re-enterable: A on this row
                           re-opens the target step with the choice pre-locked
                           (B there keeps it — «Изменить», never «потерять»). -->
                      <span v-if="captures[row.key] !== undefined && isFocused('step', i)"
                            class="con-colfocus__steprow-change">{{ $t('Change selection') }}</span>
                    </template>
                  </div>
                </div>
              </template>
            </ConsoleScrollArea>
          </template>

          <!-- BUILD / PICK: NOTHING HERE EITHER — there is no configuration to
               make. The brief that used to stand here restated, word for word,
               what the summary rail says one column to the right («НАГРАДА ЗА
               ПОСТРОЙКУ +2», «НОВАЯ КОЛОНИЯ · Слот 1») while the destination
               berth was already lit on the row above and the verb was already
               under the planet and on the A chip: the same sentence in four
               places. It also cost the stage ~7rem of height it does not have
               inside a shorter host — a prelude's Build Colony step in the
               start workspace pushed it straight out of the frame. -->

          <!-- INSPECT / UNAVAILABLE: NOTHING. The dossier is the physical
               scene above — the track states every reward, the guard rail and
               the berths state the return rule, the result column states the
               colony's rate. A «how it works» panel here was a manual bolted
               onto a game surface: it appeared exactly when the player could
               NOT act, which made the screen change genre at the worst moment.
               The stage is simply SHORTER in this mode (see `--colfocus-h`). -->
          <template v-else />
        </section>
      </div>

      <!-- ═══ RESULT — «WHAT HAPPENS IF I CONFIRM NOW?», nothing else ═══
           ONE card per SOURCE of value, and ONLY sources this action moves:
           the trade income / the owners' cut / the payment — or the build
           grant / the new colony. Rules, the return point and the colony's
           standing rate are NOT restated here: the track and the guard rail
           above already carry them physically. The income's tight VALUE
           carries `data-colony-trade-source` — the reward chips and card
           covers leave that exact number. -->
      <!-- THE FOLLOW-UP'S OWN ZONE. It stands INSIDE the stage's frame, so a
           Pluto payout is not «cards flying over the old screen»: the
           configuration RELEASES in place, the zone UNFOLDS from the rect the
           configuration occupied, and the reveal's content surfaces from
           inside it (`consoleActionOutcomeMotion` — the same phrase the blue
           action flow speaks). The destination therefore exists, measured and
           on screen, before a single card moves. -->
      <section v-if="outcomeZone" class="con-colfocus__outcome"
               data-outcome-zone data-embed-slot="colonies-focus-reveal"></section>

      <!-- ═══ THE TARGET STEP — «куда положить награду» as a DEEPER LEVEL of
           this same flow. The planet stays the anchor (hero column untouched);
           the track, the configuration and the summary rail RELEASE in place
           (`--targeting`), and the SHARED played-card selector — the very
           surface the blue-action and play composers descend into — unfolds
           over the working area with physical candidate faces, ownership and
           the honest `current → resulting` on each. B folds back one level
           with every trade decision intact. -->
      <!-- (No ask line of our own: the selector's contract header already
           states the server's ask and the target scope — a second statement
           above it was the tripled-title screenshot.) -->
      <section v-if="sub === 'targets' && targetStepModel !== undefined && targetFocus !== undefined"
               class="con-colfocus__targetstage" ref="targetZone">
        <ConsolePlayedTargetStep ref="targetStep"
                                 :model="targetStepModel"
                                 :layout="targetLayout"
                                 :focus="targetFocus"
                                 :bandHeight="targetBandH"
                                 :lockedCard="targetLockedCard" />
      </section>

      <!-- ═══ THE PRESENTED TARGETS — the chosen host card(s), physically ON
           STAGE for the resolution. The reward chip is born at the income
           value in the summary rail (its launch anchor) and lands on the
           card's own stored-resource capsule; the counter is FROZEN at the
           pre-trade value and ticks — with a pop — at each touchdown:
           «было → прилетел → стало», never a number that silently changed.
           The scene recedes before the closing track glide (the conclusion
           waits for the working area through `stageBusy`). -->
      <section v-if="cardlandVisible" class="con-colfocus__cardland"
               :class="{
                 'con-colfocus__cardland--leaving': cardlandReleased,
                 'con-colfocus__cardland--rail': intent === 'build',
               }"
               :data-cardland-count="presentedTargets.length">
        <div v-for="t in presentedTargets" :key="t.card"
             class="con-colfocus__landcell"
             :class="{'con-colfocus__landcell--landed': landedOf(t) > 0}"
             :data-played-key="t.card">
          <div class="con-colfocus__landcard">
            <ConsoleCardFaceLite :name="t.card" :card="presentedModelOf(t)" />
            <!-- Re-keyed per touchdown: each landed chip replays the one-shot
                 contact flash over the card's own counter capsule. -->
            <span v-if="landedOf(t) > 0" :key="'flash' + landedOf(t)"
                  class="con-colfocus__landflash" aria-hidden="true"></span>
          </div>
          <div class="con-colfocus__landmeta">
            <i v-if="t.icon !== ''" :class="rewardIconClass(t.icon)" aria-hidden="true"></i>
            <em>{{ t.before }} → {{ t.before + t.amount }}</em>
          </div>
        </div>
      </section>

      <!-- (The reward package answers «what happens if I confirm now?» — a
           question the BONUS composition does not pose: nothing is being
           weighed, the payout itself is on stage.) -->
      <section v-if="!bonusMode" class="con-colfocus__result" data-unfold-item>
        <div class="con-colfocus__sec-title" data-unfold-late>{{ $t(resultTitle) }}</div>

        <!-- TRADE / INSPECT / PICK — THE REWARD PACKAGE. Three questions in
             the order a player asks them: what do I END UP with, what is that
             made of, and what does everyone else get. The middle block is the
             arithmetic made visible; the last one is deliberately OUTSIDE the
             total (it used to sit beside it, reading as part of the payout). -->
        <!-- A CHOSEN TRACK'S MOVE (TR07): «ТОРГОВЛЯ ЗДЕСЬ» — what a trade with this tile pays with the
             marker where it stands, and where it will stand. The owners' bonus does not depend on the track
             and is not printed; a tile's fixed income part stands at both ends. The readout above it is the
             tile's own («3/7 → 7/7»): it flips on the landing, and the «after» end answers once then. -->
        <!-- THE ROSTER ACT — what happens if the player confirms NOW: three facts, each once (the server's
             projection, `ColonyRosterPrompt`): who leaves, who arrives and how it enters, whether the colony
             stands. The berth row above already shows WHERE the cube lands; this states that it does. -->
        <!-- THE CITY ACT — «РАЗМЕЩЕНИЕ ГОРОДА»: what confirming does, read off the server's `tileSite` marker
             (the stage counts nothing): the city and whose it is, the player's space cities now → after, the
             card's VP with its formula, and ONE calm line — the city takes no berth and changes nothing about
             the trade. The count flips and the VP line lights ONCE, on the cube's touchdown. -->
        <template v-if="city !== undefined">
          <div class="con-colfocus__rsec con-colfocus__rsec--lead con-colfocus__cityfacts" data-colony-city-facts>
            <div class="con-colfocus__cityfact" data-city-fact="city">
              <span class="con-colfocus__cityfact-label" data-unfold-late>{{ $t('City') }}</span>
              <span class="con-colfocus__cityfact-value">
                <PremiumCountGlyph class="con-colfocus__cityfact-glyph" :glyph="spaceCityGlyph" />
                <span>{{ $t(city.reading.card) }}</span>
                <span v-if="city.reading.color === viewerColor" class="con-colfocus__cityfact-owner">· {{ $t('your city') }}</span>
              </span>
            </div>
            <div class="con-colfocus__cityfact" :class="{'con-colfocus__cityfact--lit': cityCounted}"
                 data-city-fact="cities" :data-city-counted="cityCounted ? '' : undefined">
              <span class="con-colfocus__cityfact-label" data-unfold-late>{{ $t('Space cities') }}</span>
              <span class="con-colfocus__cityfact-value">
                <ConsoleFlipValue :value="cityCitiesShown" :text="String(cityCitiesShown)" accent="cyan" />
                <template v-if="!cityCounted">
                  <span class="con-colfocus__cityfact-arrow" aria-hidden="true">→</span>
                  <b data-city-after>{{ city.reading.cities.after }}</b>
                </template>
              </span>
            </div>
            <div v-if="city.reading.victoryPoints !== undefined" class="con-colfocus__cityfact"
                 :class="{'con-colfocus__cityfact--lit': cityCounted}" data-city-fact="vp">
              <span class="con-colfocus__cityfact-label" data-unfold-late>{{ $t('Card VP') }}</span>
              <span class="con-colfocus__cityfact-value">
                <b data-city-vp>{{ city.reading.victoryPoints }}</b>
                <span v-if="cityVpFormula !== ''" class="con-colfocus__cityfact-formula">{{ cityVpFormula }}</span>
              </span>
            </div>
            <div class="con-colfocus__citynote" data-city-note data-unfold-late>{{ $t(city.reading.note) }}</div>
          </div>
        </template>
        <template v-else-if="roster !== undefined">
          <div class="con-colfocus__rsec con-colfocus__rsec--lead con-colfocus__rosterfacts" data-colony-roster-facts>
            <div v-if="roster.reading.leaves !== undefined" class="con-colfocus__rosterfact" data-roster-fact="leaves">
              <span class="con-colfocus__rosterfact-label">{{ $t('Leaves') }}</span>
              <span class="con-colfocus__rosterfact-value">{{ $t(roster.reading.leaves) }}</span>
            </div>
            <div v-if="roster.reading.arrives !== undefined" class="con-colfocus__rosterfact"
                 :class="roster.reading.arrives.entersActive ? 'con-colfocus__rosterfact--ok' : 'con-colfocus__rosterfact--lost'"
                 data-roster-fact="arrives" :data-roster-enters="roster.reading.arrives.entersActive ? 'active' : 'inactive'">
              <span class="con-colfocus__rosterfact-label">{{ $t('Arrives') }}</span>
              <span class="con-colfocus__rosterfact-value">
                {{ $t(roster.reading.arrives.colony) }}
                <span class="con-colfocus__rosterfact-note">{{ rosterEntryNote }}</span>
              </span>
            </div>
            <div v-if="roster.reading.build !== undefined" class="con-colfocus__rosterfact"
                 :class="roster.reading.build.lands ? 'con-colfocus__rosterfact--ok' : 'con-colfocus__rosterfact--lost'"
                 data-roster-fact="build" :data-roster-build="roster.reading.build.lands ? 'lands' : 'skipped'">
              <span class="con-colfocus__rosterfact-label">{{ $t('Colony') }}</span>
              <span v-if="roster.reading.build.lands" class="con-colfocus__rosterfact-value">
                {{ rosterBuildSlotText }}
                <span v-if="rosterGrantQty > 0" class="con-colfocus__rglyph">
                  <b v-if="rosterGrantQty > 1">{{ rosterGrantQty }}</b>
                  <BenefitGlyph :benefit="buildBenefit" :idx="roster.reading.build.slot" :cardResources="cardResourceKinds" />
                </span>
              </span>
              <span v-else class="con-colfocus__rosterfact-value">
                {{ $t('The colony will not be built') }}
                <span class="con-colfocus__rosterfact-note">{{ $t(roster.reading.build.reason) }}</span>
              </span>
            </div>
          </div>
        </template>
        <template v-else-if="intent === 'track' && trackReading !== undefined">
          <div class="con-colfocus__rsec con-colfocus__rsec--lead" data-colony-track-reading>
            <div class="con-colfocus__trackpos" data-colony-track-readout data-unfold-late>
              <ConsoleFlipValue :value="markerPosition" :text="markerDisplay" accent="cyan" />
              <template v-if="markerPosition < trackReading.after.position">
                <span class="con-colfocus__trackpos-arrow" aria-hidden="true">→</span>
                <b class="con-colfocus__trackpos-to">{{ trackReading.after.display }}</b>
                <span class="con-colfocus__trackpos-steps">+{{ trackReading.steps }}</span>
              </template>
            </div>
            <div class="con-colfocus__rsec-label" data-unfold-late>{{ $t('Trade here') }}</div>
            <div class="con-colfocus__trackread">
              <span v-for="end in trackReadingEnds" :key="end.key"
                    class="con-colfocus__trackread-end"
                    :class="['con-colfocus__trackread-end--' + end.key, {'con-colfocus__trackread-end--answer': end.key === 'after' && trackLanded}]"
                    :data-colony-track-end="end.key">
                <span v-if="trackFixedBenefit !== undefined" class="con-colfocus__trackread-fixed">
                  <BenefitGlyph :benefit="trackFixedBenefit" :idx="0" :cardResources="cardResourceKinds" />
                  <span aria-hidden="true">+</span>
                </span>
                <b v-if="end.end.quantity > 1 || (end.end.levy && end.end.quantity > 0)"
                   :class="{'con-colfocus__trackread-qty--levy': end.end.levy}">{{ end.end.levy ? '−' : '' }}{{ end.end.quantity }}</b>
                <span class="con-colfocus__rglyph con-colfocus__rglyph--lg">
                  <BenefitGlyph :benefit="end.end.benefit" :idx="end.end.position" :cardResources="cardResourceKinds" />
                </span>
                <span v-if="end.key === 'before'" class="con-colfocus__trackread-arrow" aria-hidden="true">→</span>
              </span>
            </div>
          </div>
        </template>
        <template v-else-if="intent !== 'build'">
          <div class="con-colfocus__rsec con-colfocus__rsec--lead">
            <div class="con-colfocus__rsec-label" data-unfold-late>{{ $t(presentAvailable && intent !== 'pick' ? 'Your total' : 'On the current level') }}</div>
            <template v-for="total in rewardPackage.totals" :key="total.key">
              <div class="con-colfocus__rrow con-colfocus__rrow--gain con-colfocus__rrow--big" :class="{'con-colfocus__rrow--unit': total.icons !== undefined}">
                <span class="con-colfocus__rvalue">
                  <b>+{{ total.amount }}</b>
                  <span class="con-colfocus__rglyph con-colfocus__rglyph--lg"
                        :class="{'con-colfocus__rglyph--prod': total.production}">
                    <!-- A unit of SEVERAL kinds (the Redux Vesta) is the icons «or»-joined — one unit, never one sprite for three. -->
                    <template v-if="total.icons !== undefined"><template v-for="(ic, k) in total.icons" :key="k"><small v-if="k > 0" class="con-colfocus__ror" aria-hidden="true">{{ $t('or') }}</small><i :class="rewardIconClass(ic)" aria-hidden="true"></i></template></template>
                    <i v-else-if="total.icon !== undefined" :class="rewardIconClass(total.icon)" aria-hidden="true"></i>
                    <span v-else class="con-colfocus__rlabel">{{ $t(total.label ?? '') }}</span>
                  </span>
                </span>
                <!-- The NUMBER when the viewer's stock has one, otherwise WHERE
                     it goes: «+2 животных» with no destination is an amount the
                     player cannot place. A CARD destination answers with the
                     card list right below instead of a phrase (see under). -->
                <em v-if="total.current !== undefined" data-unfold-late>{{ total.current }} → {{ total.resulting }}</em>
                <em v-else-if="total.cardDestination && cardTargetLines.length > 0" data-unfold-late>
                  {{ $t(cardTargetLines.length > 1 ? 'To these cards:' : 'To this card:') }}
                </em>
                <em v-else-if="total.destinationKey !== undefined" data-unfold-late>{{ $t(total.destinationKey) }}</em>
              </div>
              <!-- …AND THE CARDS THEMSELVES, under the total they explain. One
                   row per PHYSICAL CARD (an income and a bonus aimed at the
                   same card are one row whose amounts add up — two identical
                   «Карта ветров 0 → 1» lines were the report), read as the
                   same before → after the picker promised. They belong to «ВАШ
                   ИТОГ», not to «СОСТАВ НАГРАДЫ»: this is WHERE the total
                   lands, not what it is made of. -->
              <div v-if="total.cardDestination" class="con-colfocus__rcards" data-unfold-late>
                <div v-for="line in cardTargetLines" :key="line.card" class="con-colfocus__rcard">
                  <i v-if="line.iconClass !== ''" :class="line.iconClass" aria-hidden="true"></i>
                  <span class="con-colfocus__rcard-name">{{ $t(line.card) }}</span>
                  <em>{{ line.before }} → {{ line.after }}</em>
                </div>
              </div>
            </template>
            <div v-if="rewardPackage.totals.length === 0" class="con-colfocus__muted" data-unfold-late>{{ $t('No reward at this level') }}</div>
            <div v-if="resourceLost" class="con-colfocus__notice con-colfocus__notice--warn" data-unfold-late>
              <span aria-hidden="true">⚠</span>
              <span>{{ $t('Resource will be lost — no card') }}</span>
            </div>
          </div>

          <!-- THE COMPOSITION — where each part came from. The track's own
               value keeps `data-colony-trade-source`: the reward chips and
               card covers physically leave THAT number. -->
          <div v-if="rewardPackage.sources.length > 0" class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('Reward breakdown') }}</div>
            <div v-for="row in rewardPackage.sources" :key="row.key" class="con-colfocus__rrow con-colfocus__rrow--part" :class="{'con-colfocus__rrow--unit': row.icons !== undefined}">
              <span class="con-colfocus__rpart">{{ sourceRowLabel(row) }}</span>
              <span class="con-colfocus__rvalue"
                    :data-colony-trade-source="row.kind === 'track' || row.kind === 'trackFixed' ? colony.name : undefined">
                <b>+{{ row.amount }}</b>
                <span class="con-colfocus__rglyph" :class="{'con-colfocus__rglyph--prod': row.production}">
                  <template v-if="row.icons !== undefined"><template v-for="(ic, k) in row.icons" :key="k"><small v-if="k > 0" class="con-colfocus__ror" aria-hidden="true">{{ $t('or') }}</small><i :class="rewardIconClass(ic)" aria-hidden="true"></i></template></template>
                  <i v-else-if="row.icon !== undefined" :class="rewardIconClass(row.icon)" aria-hidden="true"></i>
                  <span v-else class="con-colfocus__rlabel">{{ $t(row.label ?? '') }}</span>
                </span>
              </span>
            </div>
            <!-- (The chosen host cards moved UP, under «ВАШ ИТОГ» — they are
                 the total's DESTINATION, not a term of its arithmetic, and
                 stating them here printed one line per STEP: the same card
                 twice when the income and the bonus both landed on it.) -->
          </div>

          <!-- THE OTHER OWNERS — what the trade pays everyone else. Their
               names, their amounts, and nothing of theirs in your total. -->
          <div class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('To other players') }}</div>
            <div v-for="row in otherOwnerRows" :key="row.color" class="con-colfocus__rrow con-colfocus__rrow--gain">
              <span class="con-colfocus__rowner">
                <span :class="'con-status__dot player_bg_color_' + row.color"></span>
                <span>{{ row.name }}</span>
                <em v-if="row.count > 1">×{{ row.count }}</em>
              </span>
              <span class="con-colfocus__rvalue">
                <b>+{{ row.amount }}</b>
                <span class="con-colfocus__rglyph" :class="{'con-colfocus__rglyph--prod': row.production}">
                  <template v-if="row.icons !== undefined"><template v-for="(ic, k) in row.icons" :key="k"><small v-if="k > 0" class="con-colfocus__ror" aria-hidden="true">{{ $t('or') }}</small><i :class="rewardIconClass(ic)" aria-hidden="true"></i></template></template>
                  <i v-else-if="row.icon !== undefined" :class="rewardIconClass(row.icon)" aria-hidden="true"></i>
                  <span v-else class="con-colfocus__rlabel">{{ $t(row.label ?? '') }}</span>
                </span>
              </span>
            </div>
            <div v-if="otherOwnerRows.length === 0" class="con-colfocus__muted">{{ $t('No other owners here') }}</div>
          </div>

          <div v-if="noticeRows.length > 0" class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('Extras') }}</div>
            <div v-for="(notice, i) in noticeRows" :key="'n' + i"
                 class="con-colfocus__notice" :class="'con-colfocus__notice--' + notice.tone">
              <span aria-hidden="true">{{ notice.tone === 'warn' ? '!' : '›' }}</span>
              <i v-if="notice.iconClass !== ''" :class="notice.iconClass" aria-hidden="true"></i>
              <span>{{ notice.text }}</span>
            </div>
          </div>

          <div v-if="intent === 'trade' && presentAvailable && outcome.cost.length > 0"
               class="con-colfocus__rsec con-colfocus__rsec--pay" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('Payment') }}</div>
            <div v-for="(chip, k) in outcome.cost" :key="'c' + k" class="con-colfocus__rrow con-colfocus__rrow--cost">
              <i v-if="chip.icon" :class="chipIconClass(chip)" aria-hidden="true"></i>
              <b>−{{ chip.amount }}</b>
              <em v-if="chip.current !== undefined">{{ chip.current }} → {{ chip.resulting }}</em>
            </div>
          </div>
        </template>

        <!-- BUILD: the placement grant, the new colony, the future bonus. -->
        <template v-else>
          <div class="con-colfocus__rsec con-colfocus__rsec--lead">
            <div class="con-colfocus__rsec-label" data-unfold-late>{{ $t('Build grant') }}</div>
            <div v-if="buildQty > 0" class="con-colfocus__rrow con-colfocus__rrow--gain con-colfocus__rrow--big">
              <span class="con-colfocus__rvalue" :data-colony-trade-source="colony.name">
                <b>+{{ buildQty }}</b>
                <span class="con-colfocus__rglyph con-colfocus__rglyph--lg">
                  <BenefitGlyph :benefit="buildBenefit" :idx="nextBuildSlot" :cardResources="cardResourceKinds" />
                </span>
              </span>
            </div>
            <div v-else class="con-colfocus__muted" data-unfold-late>{{ $t('No placement bonus') }}</div>
            <!-- …and WHERE it lands, the same reading the trade gives: the
                 card the player chose (or the only eligible one) with its
                 honest before → after. -->
            <template v-if="cardTargetLines.length > 0">
              <div class="con-colfocus__rrow con-colfocus__rrow--gain" data-unfold-late>
                <em>{{ $t(cardTargetLines.length > 1 ? 'To these cards:' : 'To this card:') }}</em>
              </div>
              <div class="con-colfocus__rcards" data-unfold-late>
                <div v-for="line in cardTargetLines" :key="line.card" class="con-colfocus__rcard">
                  <i v-if="line.iconClass !== ''" :class="line.iconClass" aria-hidden="true"></i>
                  <span class="con-colfocus__rcard-name">{{ $t(line.card) }}</span>
                  <em>{{ line.before }} → {{ line.after }}</em>
                </div>
              </div>
            </template>
            <div v-if="buildLost" class="con-colfocus__notice con-colfocus__notice--warn" data-unfold-late>
              <span aria-hidden="true">⚠</span>
              <span>{{ $t('Resource will be lost — no card') }}</span>
            </div>
          </div>
          <div class="con-colfocus__rsec" data-unfold-late>
            <div class="con-colfocus__rsec-label">{{ $t('New colony') }}</div>
            <div class="con-colfocus__rrow">
              <PlayerCube v-if="viewerColor !== undefined" class="con-colfocus__rcube" :color="viewerColor" :size="18" />
              <span>{{ $t('Slot') }} {{ nextBuildSlot + 1 }}</span>
            </div>
          </div>
        </template>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * The COLONY FOCUS STAGE — the ONE detail surface behind every overview verb
 * (A = act, X = inspect; intents `trade` / `build` / `pick` / `inspect`), and
 * — iteration 2 — the surface the action RESOLVES ON: the confirm keeps the
 * stage open, the fleet docks at the hero planet's orbital berth, the marker
 * glides along the expanded track, the rewards launch from their own result
 * groups and the build cube lands in the big destination slot.
 *
 * All numbers come from the same pure modules every colony surface reads
 * (`colonyTradePlan`, `paymentPlan`, the server `ColonyTradePreviewModel`) —
 * one source of truth; the presentation GROUPS them by source instead of
 * pouring them into one list.
 *
 * Input arrives via `handleIntent` (the shell routes the pad here while the
 * stage is open): d-pad walks payment/decision rows, A picks/opens (trade) or
 * CONFIRMS (build/pick — there is nothing else to choose), X = the one final
 * trade confirm, RT = max the focused lane, B = close a sub-editor / fold
 * back. The bar mirrors через consoleColoniesUi.
 */
import {defineComponent, PropType} from 'vue';
import {useResizeObserver} from '@vueuse/core';
import {CardModel} from '@/common/models/CardModel';
import {ColonyModel} from '@/common/models/ColonyModel';
import {buildBenefitAt, ColonyMetadata, colonyCardResources, tradeBenefitAt} from '@/common/colonies/ColonyMetadata';
import {CardResource} from '@/common/CardResource';
import {holdsAnyOf} from '@/client/console/parliament/influenceYieldModel';
import {ColonyBenefit} from '@/common/colonies/ColonyBenefit';
import {getCard} from '@/client/cards/ClientCardManifest';
import {ColonyName} from '@/common/colonies/ColonyName';
import {Color} from '@/common/Color';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {SelectOptionModel, OrOptionsModel} from '@/common/models/PlayerInputModel';
import {ColonyTradePreviewModel} from '@/common/models/ColonyTradePreviewModel';
import {Message} from '@/common/logs/Message';
import {SpendableResource} from '@/common/inputs/Spendable';
import {getColony} from '@/client/colonies/ClientColonyManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {translateMessage, translateText, translateTextWithParams, translateCardName} from '@/client/directives/i18n';
import {GamepadIntent, NavDirection} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf, ConsoleAction} from '@/client/console/composables/consoleActionModel';
import {consoleColoniesUi, setColonyFocusStage, ColonyFocusIntent} from '@/client/console/consoleColoniesModel';
import {
  paymentLanes,
  megacreditsAvailable,
  paymentFromCounts,
  initialCounts,
  dialLaneCount,
  buildPaymentView,
  buildEnergyMixView,
  clampEnergyMixSteel,
  editableRows,
  PaymentLane,
  PaymentView,
} from '@/client/console/paymentPlan';
import {
  ColonyRewardPackage,
  RewardOtherRow,
  RewardSourceRow,
  TradeStep,
  colonyOwnerCounts,
  colonyRewardPackage,
  effectiveTradePosition,
  rewardAtPosition,
  tradeNotices,
  tradeOutcome,
  TradeOutcomeChip,
  tradeSteps,
  buildSteps,
  buildNotices,
} from '@/client/components/colonies/colonyTradePlan';
import {
  presentedColonyModel, colonyTradeState, colonyTrackAdvancing, colonyTrackWaveState, setColonyStageYielded,
  colonyTradeReceiptBase, noteColonyTradeReceiptBase,
} from '@/client/console/colonyTrade/consoleColonyTrade';
import {TradeReceiptBase, tradeReceiptBaseOf} from '@/client/console/colonyTrade/colonyTradeReceipt';
import {
  ColonyTradePresentedTarget, buildColonyTradeTargetModel, colonyTradeCardDestinations,
  presentedTargetModel,
} from '@/client/console/colonyTrade/colonyTradeTargetStep';
import {ColonyTradeTargets} from '@/client/console/colonyTrade/colonyTradeModel';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir,
  findPlayedTargetFocus, planPlayedTargetLayout, playedTargetAt, playedTargetSourceCardName,
  reseatPlayedTargetFocus, stepPlayedTargetFocus, stepPlayedTargetFocusAt, stepPlayedTargetOwner,
} from '@/client/console/played/consolePlayedTargetModel';
import {playedTargetZoomOrigin} from '@/client/console/played/consolePlayedTargetZoom';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {playColonyTargetStepEnter, playColonyTargetStepLeave} from '@/client/console/consoleColonyFocusMotion';
import {cardResourceLandings, resourceTransferState} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import {motionMs} from '@/client/components/motion/motionTokens';
import {colonyBonusEntry, colonyResolutionUi, revealIsOwnerBonus} from '@/client/console/colonyTrade/colonyResolution';
import {cardColonyTradeCard, lockedTradePaymentIndex, partyColonyTradeParty} from '@/client/console/colonyTrade/colonyTradeEntry';
import {cardDiscardColonyBonus} from '@/client/console/cardDiscard/consoleCardDiscard';
import {currentRevealEvent} from '@/client/components/drawnCards/drawnCardsState';
import {tradeFleetState} from '@/client/console/colonyFleet/consoleTradeFleet';
import {colonyBuildState} from '@/client/console/colonyBuild/consoleColonyBuild';
import {workspaceOutcomeState} from '@/client/console/consoleWorkspaceOutcome';
import {
  armOutcomeOriginFrom, playConfigRelease, playOutcomePhase, playOutcomeContent,
} from '@/client/console/consoleActionOutcomeMotion';
import BenefitGlyph from '@/client/components/colonies/BenefitGlyph.vue';
import ConsoleColonyTrackInstrument from '@/client/components/console/ConsoleColonyTrackInstrument.vue';
import ConsoleFlipValue from '@/client/components/console/ConsoleFlipValue.vue';
import {ColonyTrackMove} from '@/common/parliament/colonyTrackAdvance';
import {ColonyTrackMoveReading, colonyTrackMoveReading, TrackMoveBenefit, TrackMoveEnd} from '@/client/console/colonyTrade/colonyTrackMoveModel';
import {colonyTrackMoveFlow} from '@/client/console/colonyTrade/colonyTrackMove';
import {colonyRosterState} from '@/client/console/colonyRoster/consoleColonyRoster';
import {ColonyRosterStageView} from '@/client/console/colonyRoster/colonyRosterModel';
import ConsolePlanetDisc from '@/client/components/console/ConsolePlanetDisc.vue';
import ConsoleColonyCitySeat from '@/client/components/console/colonyCity/ConsoleColonyCitySeat.vue';
import {colonyCityState} from '@/client/console/colonyCity/consoleColonyCity';
import {ColonyCityStageView} from '@/client/console/colonyCity/colonyCityModel';
import PremiumCountGlyph from '@/client/components/premiumCard/PremiumCountGlyph.vue';
import {CountedObjectGlyph} from '@/client/components/premiumCard/premiumCardIcons';
import {formulaOperandsText} from '@/client/console/scoreExplorerModel';
import ColonyFleetIcon from '@/client/components/colonies/ColonyFleetIcon.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import ConsoleTradePayRows from '@/client/components/console/ConsoleTradePayRows.vue';
import {
  TradePayEntry, tradePayDisabledEntries, tradePayEntries, visibleTradePayDisabled, visibleTradePayRows,
} from '@/client/console/colonyTrade/tradePayModel';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

/** One usable payment path as the shared row draws it (`tradePayModel.ts`). */
type PayEntry = TradePayEntry;
/** The row's icon: the shared option icon, sized like every sprite on this stage. */
function payIconClass(icon: string): string {
  return iconClassFor(icon) + ' con-task__opt-res';
}
type StepRow = {
  key: string,
  kind: 'payment' | 'trackChoice' | 'cardTarget',
  label: string,
  iconClass: string,
  step?: Extract<TradeStep, {kind: 'cardTarget'}>,
};
/**
 * How long the working area takes to come BACK once the payout leaves — the
 * `--handing` release transition in `console.less` (260 ms opacity / 320 ms
 * transform, the result rail 90 ms behind). The closing beat waits it out, so
 * the marker never launches into a fading track.
 */
const WORKING_AREA_BACK_MS = 340;
/** The landed reading's calm beat: the counter just ticked, the player sees
 *  the new number, THEN the presented scene gives the working area back. */
const CARDLAND_READ_MS = 680;
/**
 * The scene's own NET: how long a released transaction may keep the card on
 * screen waiting for a chip that never touches down (an unmeasurable
 * destination, a killed flight). Long enough for the slowest honest landing,
 * short enough never to read as a stuck screen.
 */
const CARDLAND_NET_MS = 2200;
/**
 * THE CARD'S DEPARTURE IS A BEAT, NOT A CROSSFADE. The presented scene used to
 * flip `cardlandReleased` and, in the SAME flush, drop `--carding` — so the
 * card's 280 ms fade-out and the working area's 280 ms fade-in ran over each
 * other, and the closing glide launched into that overlap: «карта продолжает
 * висеть посреди экрана в момент анимации трека». The stage now hands back in
 * ORDER — the card leaves, THEN the interface materializes, THEN the marker
 * moves — and this is how long the leave itself takes (paired with
 * `.con-colfocus__cardland--leaving`, never re-stated in LESS).
 */
const CARDLAND_LEAVE_MS = 300;

/** The stage's nested sub-screens. `mix` is the Delta Works COMPOSITION
 *  step — entered from the trade's own confirm, ONLY while the server model
 *  admits at least two valid energy/steel mixes (`minSteel < maxSteel`). */
type Sub = undefined | 'lanes' | 'track' | 'targets' | 'mix';
type NoticeRow = {tone: 'warn' | 'info', iconClass: string, text: string};
type Focusable = {zone: 'pay' | 'step', index: number};
/**
 * THE COMMIT-BOUNDARY SNAPSHOT — everything the working area PRESENTS while
 * the move it describes is still resolving on this stage.
 *
 * ⚠️ IT PINS THE SERVER'S OWN INPUTS, not just the derived mode. The stage
 * used to keep only `{mode, available, payment}` and re-derive the rest from
 * the LIVE props, on the assumption stated beside the held payment row: «past
 * the commit the server takes the options away». That assumption holds for the
 * «Колонии» door and is FALSE for every other one — a card-action trade
 * («Летающая платформа» → Ио) is answered while the player still owns the
 * action, so the very next response offers the NEXT trade: a fresh
 * `OrOptions` (with the spent card now carrying «уже использовано в этом
 * поколении»), a fresh preview, a fresh step list. The configuration then
 * RE-LIT under the reward it had just paid for — three live payment rows and a
 * new «ИТОГ ТОРГОВЛИ» standing over a marker still gliding home.
 *
 * So the boundary pins the OPTIONS and the PREVIEW too, and every derivation
 * of the working area reads the pinned pair (`presentedOptions` /
 * `presentedPreview`). Past the commit the stage describes exactly one trade:
 * the one that was made on it.
 */
type HeldView = {
  mode: string,
  available: boolean,
  payment?: PayEntry,
  options: ReadonlyArray<SelectOptionModel>,
  disabledOptions: NonNullable<OrOptionsModel['disabledOptions']>,
  preview: ColonyTradePreviewModel | undefined,
  /** The pre-trade track offset the committed move was read at. */
  tradeOffset: number,
  /**
   * What every `current → resulting` of the receipt is measured FROM — the
   * stocks, productions and card resources AS THE PLAYER PRESSED. The live
   * model already holds the paid fee and the credited income once the
   * answer lands, and a receipt read off it counts the trade twice.
   */
  receipt: TradeReceiptBase,
};

export default defineComponent({
  name: 'ConsoleColonyFocusStage',
  components: {
    BenefitGlyph, ColonyFleetIcon, PlayerCube, ConsoleScrollArea, ConsolePaymentPanel, ConsoleTradePayRows,
    ConsolePlayedTargetStep, ConsoleCardFaceLite, ConsoleColonyTrackInstrument, ConsolePlanetDisc, ConsoleFlipValue,
    ConsoleColonyCitySeat, PremiumCountGlyph,
  },
  props: {
    colony: {type: Object as PropType<ColonyModel>, required: true},
    /** What the player came to DO (`consoleColoniesModel.ColonyFocusIntent`). */
    intent: {type: String as PropType<ColonyFocusIntent>, default: 'inspect'},
    /** The action is genuinely offerable HERE (server truth, per intent). */
    actionAvailable: {type: Boolean, default: false},
    /** Honest reason when the action is impossible ('' when available). */
    blockReason: {type: String, default: ''},
    /** That reason's REGISTER (`AvailabilityBlocker.tone`): 'warning' = the
     *  trade is legal and merely out of the player's window right now. */
    blockTone: {type: String as PropType<'warning' | 'danger'>, default: 'danger'},
    /** The pick's server verb ('Build' / 'Remove colony' …, pick intent). */
    pickLabel: {type: String, default: ''},
    /**
     * The workspace holds an OUTCOME CLAIM and this stage is its host: the
     * stage gives the follow-up its own zone and steps back. The SECTION owns
     * the publication of the slot selector (one writer), so this prop is the
     * only thing the stage needs to know.
     */
    outcomeZone: {type: Boolean, default: false},
    /** The inner "Pay trade fee" OrOptions options (server-affordable). */
    options: {type: Array as PropType<ReadonlyArray<SelectOptionModel>>, default: () => []},
    disabledOptions: {type: Array as PropType<NonNullable<OrOptionsModel['disabledOptions']>>, default: () => []},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, default: () => []},
    preview: {type: Object as PropType<ColonyTradePreviewModel | undefined>, default: undefined},
    thisPlayer: {type: Object as PropType<PublicPlayerModel | undefined>, default: undefined},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    tradeOffset: {type: Number, default: 0},
    /** The chosen payment path's own advance the PREVIEW was fetched with (the section echoes `path-offset` back). */
    pathOffset: {type: Number, default: 0},
    /**
     * THE SERVER'S PROJECTION of this tile's marker (`track` intent — TR07:
     * `SelectColonyModel.trackMoves`): where it stands and where the pick puts
     * it. The instrument's ghost, the «+N» and the «торговля здесь» reading
     * are drawn from it; the stage computes none of it.
     */
    trackMove: {type: Object as PropType<ColonyTrackMove | undefined>, default: undefined},
    /**
     * THE ROSTER ACT (`intent` is then the build's or the pick's — the section maps it): this pick replaces,
     * adds or removes a colony tile. The SERVER's reading of what confirming does (`rosterStageReading`), the
     * tile that leaves, the verb and the crumb's stage; the stage computes none of it.
     */
    roster: {type: Object as PropType<ColonyRosterStageView | undefined>, default: undefined},
    /**
     * THE CITY ACT (`intent` is then the pick's — the section maps it): this pick lays a city on the colony tile
     * (TR22 Nova City). The SERVER's reading off its `tileSite` marker, the verb and the crumb's stage; the stage
     * computes none of it.
     */
    city: {type: Object as PropType<ColonyCityStageView | undefined>, default: undefined},
  },
  emits: ['confirm', 'build-confirm', 'pick-confirm', 'cancel', 'path-offset', 'inspect'],
  data() {
    return {
      payIdx: 0,
      /** The dialed Delta Works steel share (clamped live in `tradeSteelMix`);
       *  0 keeps the energy-first default — steel covers only the deficit. */
      steelMixPreference: 0,
      /** Re-keys the mix panel's one-shot pulse on each dial press. */
      mixFlashNonce: 0,
      /** Where the cursor stood when the composition substep opened — B
       *  restores it, so the walk back lands on the family row it left. */
      mixReturnFocusIdx: 0,
      focusIdx: 0,
      subIdx: 0,
      sub: undefined as Sub,
      captures: {} as Record<string, unknown>,
      /** The embedded target step's cursor (the shared selector's own shape). */
      targetFocus: undefined as PlayedTargetFocus | undefined,
      /** The target zone's measured box (the step's layout + height budget). */
      targetZoneW: 0,
      targetZoneH: 0,
      /** The MEASURED height the panel's columns want (see `measureFit`). */
      fitNeedPx: 0,
      fitRaf: undefined as number | undefined,
      stopFitObs: undefined as (() => void) | undefined,
      /**
       * THE PRESENTED TARGETS — the card-resource destinations of the
       * confirmed trade (picked + auto), snapshotted at the commit boundary
       * beside `heldView`. The resolution scene renders these as physical
       * faces; the transfer chips land on them; both read ONE list.
       */
      presentedTargets: [] as ReadonlyArray<ColonyTradePresentedTarget>,
      /** The presented scene has finished (all chips landed + a read beat, or
       *  a card payout took the area over) and is receding. */
      cardlandReleased: false,
      cardlandDwell: undefined as number | undefined,
      /** The departure's own timer — the card is unmounted when it lands. */
      cardlandLeave: undefined as number | undefined,
      paymentCounts: {} as Partial<Record<SpendableResource, number>>,
      payFlashNonce: 0,
      tradeFleetState,
      colonyTradeState,
      colonyBuildState,
      /** The ONE track mechanism's wave (a chosen track's move plays here — TR07) and its flow, mirrored for tracking. */
      colonyTrackWaveState,
      trackMoveFlow: colonyTrackMoveFlow,
      /** The roster ceremony's poses (the seat gone, the hero docked). */
      rosterState: colonyRosterState,
      /** A city's landing on this tile (TR22): the cube has touched — the count flips. */
      cityState: colonyCityState,
      workspaceOutcomeState,
      /** The remote-entry context (module reactive, mirrored for tracking). */
      bonusEntry: colonyBonusEntry,
      /** The resolution's presentation facts — the payout LIFT-OFF cue lives
       *  here (a module reactive must be mirrored in `data()` to be tracked). */
      resolutionUi: colonyResolutionUi,
      /** The transfer framework's card-resource touchdown tally (mirrored so
       *  Vue tracks it — the presented counters tick from it). */
      landings: cardResourceLandings,
      /** The transfer layer's live flights (mirrored so Vue tracks them). */
      transferState: resourceTransferState,
      /** ONE-SHOT: the outcome handoff (config release + zone unfold) has
       *  played for the current claim — drives the `--handing` pose too, so
       *  the CSS dissolve can never run ahead of the phrase. */
      outcomeHandoffPlayed: false,
      /** The «working area is back» dwell (see the `workingAreaYielded` watcher). */
      stageBackTimer: undefined as number | undefined,
      /**
       * THIS STAGE SESSION HAS CROSSED THE COMMIT. Latched on `pastCommit`'s
       * rising edge and never dropped (a new colony / a fresh mount resets):
       * the resolution's final beats release `pastCommit`'s terms one at a
       * time, and the pre-commit verdict re-deriving in that gap is the red
       * «Здесь стоит ваш флот» flash over a payout the fleet just earned.
       */
      commitLatched: false,
      /** The last non-empty resolution context — held through the close so
       *  the hero keeps naming the SOURCE role to the final frame. */
      heldContext: undefined as {roleKey: string, bonus: boolean, traderColor: string, traderLine: string} | undefined,
      /**
       * The COMMIT-BOUNDARY freeze: at the confirm the stage pins WHAT it was
       * showing ({mode, available}), because the server's answer flips the
       * props (the pick is gone, the trade is spent) while the resolution is
       * still physically playing on this stage — recomputing live re-titled
       * the crumb «Осмотр» and swapped the verdict under a flying cube.
       * Released by the transaction's own falling edge, never a timer.
       */
      heldView: undefined as HeldView | undefined,
      /**
       * …AND THE PART OF THAT SNAPSHOT THAT OUTLIVES IT.
       *
       * `heldView` is released on the transaction's FALLING edge — deliberately,
       * because the crumb and the mode should re-derive once the resolution is
       * over. The working area may NOT: the stage is still mounted for the
       * conclusion's own beat, and re-deriving its options there is the same
       * re-lit menu one frame later. What has been committed on this stage is
       * committed for the stage's whole life (the `commitLatched` law, applied
       * to the configuration), so this snapshot is cleared only by a new colony
       * or a fresh mount.
       */
      pinnedConfig: undefined as HeldView | undefined,
    };
  },
  computed: {
    /** The card resource(s) the tile's card benefits add — the ONE list every glyph on this surface draws (several for the Redux Vesta). */
    cardResourceKinds(): ReadonlyArray<CardResource> {
      return colonyCardResources(this.metadata);
    },
    colonyName(): ColonyName {
      return this.colony.name as ColonyName;
    },
    /** The flown proxy just handed off to the REAL docked ship on this
     *  stage's orbital berth — the one-shot arrival acknowledgment ring
     *  (the tile's `justDocked` seat glow, spoken on the stage). */
    fleetJustDockedHere(): boolean {
      return this.tradeFleetState.dockedColonyName === this.colony.name;
    },
    /** The action is RESOLVING on this stage (fleet flying / rewards landing
     *  / marker gliding / the BUILD cube seating) — chrome inert, anchors
     *  live, nothing folds. */
    resolving(): boolean {
      return (this.tradeFleetState.active && this.tradeFleetState.colonyName === this.colony.name) ||
        (this.colonyTradeState.active && this.colonyTradeState.colonyName === this.colony.name) ||
        (this.colonyBuildState.active && this.colonyBuildState.colonyName === this.colony.name) ||
        // …and a CHOSEN TRACK's move playing on this very stage (TR07).
        (this.colonyTrackWaveState.active && this.colonyTrackWaveState.anchors === 'stage' &&
          this.colonyTrackWaveState.moves.some((move) => move.colony === this.colony.name));
    },
    /**
     * THE SOURCE CONTEXT of the running resolution (the hero's chip). The
     * role advances with the waves — trade income first, then the owner
     * bonus (the batch's own `role` tag / the discard step both say so) —
     * and a REMOTE entry (another player's trade) names that player from
     * the fleet parked on the colony. `undefined` pre-commit: the verdict
     * owns that space.
     */
    resolutionContext(): {roleKey: string, bonus: boolean, traderColor: string, traderLine: string} | undefined {
      const claimed = this.workspaceOutcomeState.host === 'colonies' &&
        this.workspaceOutcomeState.sourceCard === this.colony.name;
      const own = this.colonyTradeState.active && this.colonyTradeState.colonyName === this.colony.name;
      // ⚠️ THE VIEWER'S OWN TRANSACTION OUTRANKS THE ENTRY CONTEXT. The entry is
      // a CLIENT-armed fact about a FOREIGN trade; the transaction is proof the
      // viewer is trading here right now. Asking the entry first is how «Бот
      // торговал с этой колонией» stood over the player's own fleet on their
      // own trade — the entry belonged to an earlier payout on the same colony.
      // A trader who IS the viewer is likewise never named: «you traded here»
      // is not context, it is the thing they just did.
      const isEntry = !own && this.bonusEntry.colonyName === this.colony.name;
      if (!isEntry && !claimed && !own) {
        return undefined;
      }
      if (isEntry) {
        const foreign = this.bonusEntry.traderColor !== '' && this.bonusEntry.traderColor !== this.viewerColor;
        const line = foreign && this.bonusEntry.traderName !== '' ?
          translateTextWithParams('${0} traded with this colony', [this.bonusEntry.traderName]) : '';
        return {
          roleKey: 'Owner bonus triggered', bonus: true,
          traderColor: foreign ? this.bonusEntry.traderColor : '', traderLine: line,
        };
      }
      // THE INCOME LANDS FIRST. The owner bonus's batch arrives in the SAME
      // response as the trade income (the Redux Venus), so its presence alone
      // named the bonus while the income's chip was still flying onto the
      // presented card — «ИСТОЧНИК · БОНУС ВЛАДЕЛЬЦА» over a trade reward in
      // the air. While a presented target of the INCOME stands, the chip in
      // flight is the trade reward; the bonus takes the name once it has left.
      const incomeLanding = this.presentedTargets.some((t) => t.role !== 'colonyBonus');
      const bonusWave = !incomeLanding && (revealIsOwnerBonus(currentRevealEvent()?.source) ||
        cardDiscardColonyBonus() !== undefined);
      if (bonusWave) {
        return {roleKey: 'Owner bonus', bonus: true, traderColor: '', traderLine: ''};
      }
      // A BUILD's payout is the PLACEMENT bonus, not trade income. Keyed on the
      // stage's own intent rather than on the build transaction, which ends at
      // the commit while its cards are still on the table — the label would
      // otherwise turn into «Торговая награда» halfway through a payout no
      // trade produced. (Only readable at all since the stage now stays up
      // through the flight, which is exactly when the player reads it.)
      const build = this.intent === 'build';
      return {
        roleKey: build ? 'Colony placement bonus' : 'Trade reward',
        bonus: false, traderColor: '', traderLine: '',
      };
    },
    /**
     * What the SOURCE chip actually shows: the live context, or — past the
     * commit — the LAST one, held to the final frame. The live derivation's
     * terms (transaction, claim, entry) release one signal at a time at the
     * resolution's end, and the chip vanishing a second before the workspace
     * closes read as the screen forgetting whose payout it just presented.
     */
    presentedContext(): {roleKey: string, bonus: boolean, traderColor: string, traderLine: string} | undefined {
      return this.resolutionContext ?? (this.commitLatched ? this.heldContext : undefined);
    },
    /**
     * THE HANDOFF CUE — when the configuration may let go. ⚠️ Deliberately NOT
     * the claim (the submit), and — iteration 4 — deliberately NOT the covers'
     * take-off either: the fan and the departures play OVER the still-standing
     * scene (the player must read the count and the source), and only the
     * layer's `ascend` beat — the first cover deep into its travel, almost
     * grown — starts the dissolve underneath. Releasing at `fly` was
     * «интерфейс уже исчез в момент отделения карт».
     *  · or — for a flow with no covers of its own (a build's board lift, a
     *    served remote batch, reduced motion, a degrade) — the content
     *    genuinely landing in the zone is the cue.
     */
    outcomeHandoffDue(): boolean {
      if (!this.outcomeZone) {
        return false;
      }
      // A CARD IS RECEIVING. The presented target stands until every chip has
      // touched it, is read for one calm beat and LEAVES on its own — only then
      // may the payout take the room. Measured without this: the owner
      // bonus's batch teleported into the zone in the very response that
      // paid the trade, `outcomeContentIn` called the handoff due, the card
      // was unmounted under the reward that had not even left its source,
      // and the chip flew onto nothing (`run:no-dest`). The cover scene waits
      // for the same fact from its side (`waitForCause` · `cardSceneLive`).
      if (this.presentedTargets.length > 0) {
        return false;
      }
      // THE TRACK IS STILL MOVING. The payout is a CONSEQUENCE of the marker
      // arriving at the cell it is read at, so nothing of it — least of all
      // this dissolve — may begin while the marker is still crossing the very
      // track it would take with it. (`outcomeContentIn` goes true as soon as
      // the batch teleports into the zone, which is exactly mid-glide: the
      // reveal was mounting, veiled, while the interface evaporated under a
      // marker still in flight.)
      if (colonyTrackAdvancing() && this.colonyTradeState.colonyName === this.colony.name) {
        return false;
      }
      // THE CARDS ARE ON THE MOVE — the one fact every cover scene raises
      // (`colonyResolutionUi.payoutLiftOff`): the trade's covers at their
      // separation, the build's cover-lift when its proxies take over. The
      // stage dissolves WITH them, over the whole rise-and-turn, which is what
      // makes the departure one phrase instead of a cut. Per-scene phase
      // reads are deliberately gone: the build path had none, so its stage
      // could only let go once the cards had already landed.
      if (this.resolutionUi.payoutLiftOff) {
        return true;
      }
      if (this.colonyTradeState.active &&
          this.colonyTradeState.colonyName === this.colony.name &&
          (this.colonyTradeState.cardScene === 'ascend' ||
            this.colonyTradeState.cardScene === 'frame' ||
            this.colonyTradeState.cardScene === 'handoff')) {
        return true;
      }
      return this.outcomeContentIn;
    },
    /** The availability the stage PRESENTS — pinned across the commit
     *  boundary (see `heldView`), live everywhere else. */
    presentAvailable(): boolean {
      return this.heldView !== undefined ? this.heldView.available : this.actionAvailable;
    },
    /** The payment path the player actually chose, pinned at the commit —
     *  what the config zone keeps showing while the trade resolves. */
    heldPayment(): PayEntry | undefined {
      return this.pinnedConfig?.payment;
    },
    /** The presentation mode the adaptive layout keys off. */
    presentMode(): string {
      if (this.heldView !== undefined) {
        return this.heldView.mode;
      }
      if (this.intent === 'build') {
        return this.actionAvailable ? 'build' : 'inspect';
      }
      if (this.intent === 'trade') {
        return this.actionAvailable ? 'trade' : 'inspect';
      }
      if (this.intent === 'pick') {
        return 'pick';
      }
      if (this.intent === 'track') {
        return 'track';
      }
      if (this.intent === 'bonus') {
        return 'bonus';
      }
      return 'inspect';
    },
    /**
     * THE BONUS COMPOSITION — somebody else's trade is paying us here.
     *
     * The stage keeps its identity column and its payout zone and drops
     * EVERYTHING that describes an action: the trade track, the guard rail,
     * the berths, the configuration and the reward package. None of it is a
     * decision the player has in front of them (they are not trading — they
     * are being paid), and standing it up made the actual choice look like a
     * detail of the trading screen.
     */
    bonusMode(): boolean {
      return this.intent === 'bonus';
    },
    /** The colour of the city this act would lay on the tile ('' outside a «city» act) — the seat draws the ghost. */
    cityProjection(): Color | '' {
      return this.city?.reading.color ?? '';
    },
    /** The counted object of the city's reading — the space city RX08's readings draw. */
    spaceCityGlyph(): CountedObjectGlyph {
      return {kind: 'tile', tile: 'spaceCity'};
    },
    /** The cube has touched down — the count has flipped and the VP line has lit (the scene's own signal). */
    cityCounted(): boolean {
      return this.city !== undefined && this.cityState.counted;
    },
    /** The player's space cities AS SHOWN: «before» until the cube lands, «after» from then on (one number that flips). */
    cityCitiesShown(): number {
      const cities = this.city?.reading.cities;
      return cities === undefined ? 0 : (this.cityCounted ? cities.after : cities.before);
    },
    /**
     * The VP's formula in the score's own words («2 × 2 ПО») — the card's PRINTED rate (its declaration) over the
     * server's count; the one formatter the score explorer and the play composer speak. '' when the card prints
     * no per-city rate.
     */
    cityVpFormula(): string {
      const reading = this.city?.reading;
      if (reading === undefined || reading.victoryPoints === undefined) {
        return '';
      }
      const declared = getCard(reading.card)?.victoryPoints;
      if (typeof declared !== 'object' || declared.cities === undefined) {
        return '';
      }
      return formulaOperandsText({
        kind: 'per', vp: reading.victoryPoints, counted: reading.cities.after,
        each: declared.each ?? 1, per: declared.per ?? 1, unit: 'cities',
      });
    },
    resultTitle(): string {
      if (this.city !== undefined) {
        return 'City placement';
      }
      // A ROSTER act states its own subject — the build's «Build outcome» would name half of it.
      if (this.roster !== undefined) {
        return 'Outcome';
      }
      if (this.intent === 'build') {
        return 'Build outcome';
      }
      // Pick / inspect: the first group inside is ALREADY labelled «On the
      // current level» — repeating it as the section title read as a stutter
      // (the 4K removal-pick frame). The section states its subject instead.
      if (this.intent === 'track') {
        return 'Colony track';
      }
      return this.intent === 'trade' && this.presentAvailable ? 'Trade outcome' : 'Colony rewards';
    },
    /** The server's projected move read the way the surfaces print it (`track` intent only). */
    trackReading(): ColonyTrackMoveReading | undefined {
      return this.intent === 'track' && this.trackMove !== undefined ? colonyTrackMoveReading(this.metadata, this.trackMove) : undefined;
    },
    trackReadingEnds(): Array<{key: 'before' | 'after', end: TrackMoveEnd}> {
      const r = this.trackReading;
      return r === undefined ? [] : [{key: 'before', end: r.before}, {key: 'after', end: r.after}];
    },
    trackFixedBenefit(): TrackMoveBenefit | undefined {
      const fixed = this.trackReading?.fixed;
      return fixed === undefined ? undefined : {type: fixed.type, quantity: [fixed.quantity], resource: fixed.resource};
    },
    /** The marker's readout — the tile's own «3/7». */
    markerDisplay(): string {
      return `${this.markerPosition + 1}/${this.trackMax + 1}`;
    },
    /** The chosen track's marker has LANDED at the top (the hold released under the settled proxy). */
    trackLanded(): boolean {
      return this.trackReading !== undefined && this.settledCell === this.trackReading.after.position;
    },
    /** The furthest cell a moving marker has touched on THIS tile — −1 when nothing moves. */
    touchedCell(): number {
      return this.colonyTrackWaveState.active ? (this.colonyTrackWaveState.touched[this.colony.name] ?? -1) : -1;
    },
    metadata(): ColonyMetadata {
      return getColony(this.colony.name);
    },
    presented(): ColonyModel {
      return presentedColonyModel(this.colony);
    },
    trackMax(): number {
      return this.metadata.trade.quantity.length - 1;
    },
    /**
     * THE CHOSEN PATH'S OWN REACH — the Unity action's «advance 1 step first»
     * (`OptionMetadata.tradeOffset`), read off the payment row the cursor
     * picked. It moves the marker on this very press: the effective cell, the
     * caption and the reward package all describe the trade THAT path makes,
     * and the section re-asks the preview with it (`path-offset`).
     */
    chosenPathOffset(): number {
      return this.presentedOptions[this.payIdx]?.metadata?.tradeOffset ?? 0;
    },
    /** The offset the stage PRESENTS — the standing one (Trading Colony) plus
     *  the chosen path's; pinned past the commit, so the spent «+N» of the
     *  move that was made is never replaced by the next one's. */
    presentedOffset(): number {
      return this.pinnedConfig !== undefined ? this.pinnedConfig.tradeOffset : this.tradeOffset + this.chosenPathOffset;
    },
    effectivePosition(): number {
      // A CHOSEN TRACK's move: the cell is the server's projection (the top), never a trade's offset.
      if (this.intent === 'track' && this.trackMove !== undefined) {
        return Math.min(this.trackMove.after, this.trackMax);
      }
      // A CITY laid on the tile (TR22) reads no trade: the track STANDS AS IT IS — a trade's standing offset is not
      // projected into an act that does not touch the track (no ghost cell, no «+N» caption).
      if (this.city !== undefined) {
        return Math.min(this.presented.trackPosition, this.trackMax);
      }
      const offset = this.colony.isActive ? this.presentedOffset : 0;
      return effectiveTradePosition(this.presented, this.metadata, offset);
    },
    /** The marker's DISPLAYED position — the presented one, so a committed
     *  reset stays frozen behind the transaction and only the glide moves it
     *  (the same `presentedColonyModel` the overview tile reads). */
    markerPosition(): number {
      return Math.min(this.presented.trackPosition, this.trackMax);
    },
    /** THE CITY ACT past its commit: the verdict's box stays (unpainted) so the hero column — the seat — stands still. */
    cityVerdictReserved(): boolean {
      return this.city !== undefined && !this.bonusMode && (this.pastCommit || this.commitLatched);
    },
    /** How many colonies stand here — the ONE number the reset rule reads. */
    builtCount(): number {
      return this.colony.colonies.length;
    },
    /** The build preview is LIVE (build intent, genuinely offerable). */
    buildPreview(): boolean {
      return this.intent === 'build' && this.presentAvailable && this.builtCount < 3;
    },
    /**
     * The cell/berth pair currently being LATCHED by a landing build — the
     * one-shot beat that makes «I just protected this position» a physical
     * event rather than a number that silently changed. Driven by the build
     * transaction's own phase, never a timer.
     */
    latchCell(): number {
      const b = this.colonyBuildState;
      if (!b.active || b.colonyName !== this.colony.name) {
        return -1;
      }
      return b.phase === 'landed' || b.phase === 'done' ? b.slotIndex : -1;
    },
    /** This colony's marker is mid-glide — the resting marker yields to the
     *  flying proxy (the overview tile's `--marker-gliding` contract, now
     *  honoured on the stage the trade actually resolves on). */
    trackGliding(): boolean {
      return (this.colonyTradeState.phase === 'glide' && this.colonyTradeState.colonyName === this.colony.name) ||
        // …or the ONE track mechanism moving this tile's marker (a chosen track set to its top — TR07).
        this.colonyTrackWaveState.gliding[this.colony.name] === true;
    },
    /** The teleported follow-up has actually landed in our zone. */
    outcomeContentIn(): boolean {
      return this.outcomeZone && this.workspaceOutcomeState.stage === 'presenting';
    },
    /**
     * IS THE PAYOUT STANDING ON OUR WORKING AREA RIGHT NOW?
     *
     * The handoff is one-shot (`outcomeHandoffPlayed` — the phrase plays once
     * per claim), but the POSE is not: `--handing` takes
     * `.con-colfocus__main` to `opacity: 0`, and the TRACK is drawn there. The
     * claim outlives the batch by design (the resolution owns the workspace
     * until the reset commits), so keeping the pose on the claim left the
     * colony blank for the closing beat — the white marker glided across an
     * invisible track. The pose therefore rides the payout ITSELF: while a
     * reveal batch is on the table (or on its way), and not a frame longer.
     */
    workingAreaYielded(): boolean {
      return this.outcomeZone && this.outcomeHandoffPlayed &&
        currentRevealEvent() !== undefined;
    },
    /**
     * THE COMMIT BOUNDARY, as this stage sees it: the move is being made or
     * has been made. Everything that answers «can I do this?» — the verdict
     * chip, the availability dot — belongs strictly BEFORE it; everything
     * after describes what happened.
     */
    pastCommit(): boolean {
      return this.resolving || this.outcomeZone || this.heldView !== undefined;
    },
    /** One-shot: the cell the reset marker just landed on (the settle glow). */
    settledCell(): number {
      if (this.colonyTradeState.colonyName === this.colony.name) {
        return this.colonyTradeState.settledCell;
      }
      return this.colonyTrackWaveState.settled[this.colony.name] ?? -1;
    },
    /** THE PROJECTION POSE: the entering planet has not docked yet (dropped by the ceremony's dock, and past the commit). */
    rosterProjected(): boolean {
      // (NOT `pastCommit`: the pose must stand from the press THROUGH the answer — the dock is what ends it.)
      return this.roster !== undefined && this.roster.kind !== 'remove' && !this.rosterState.docked;
    },
    /** The hero's state line: an ENTERING tile says how it will enter (the server's projection); any other, how it stands. */
    heroStateKey(): string {
      const arrives = this.roster?.reading.arrives;
      if (arrives !== undefined && !this.rosterState.docked) {
        return arrives.entersActive ? 'Enters active' : 'Enters inactive';
      }
      return this.colony.isActive ? 'Active colony' : 'Not active yet';
    },
    /** «войдёт активной» / «войдёт неактивной — нужна карта с [ресурс]» — the entry, in the server's projection. */
    rosterEntryNote(): string {
      const arrives = this.roster?.reading.arrives;
      if (arrives === undefined) {
        return '';
      }
      if (arrives.entersActive) {
        return translateText('Enters active');
      }
      const needs = arrives.needs.map((resource) => translateText(resource)).join(' / ');
      return needs === '' ? translateText('Enters inactive') : translateTextWithParams('Enters inactive — needs a card with ${0}', [needs]);
    },
    /** «слот 1» — the berth the colony lands in (1-based, as the berth row counts). */
    rosterBuildSlotText(): string {
      const build = this.roster?.reading.build;
      return build !== undefined && build.lands ? translateTextWithParams('Berth ${0}', [String(build.slot + 1)]) : '';
    },
    /** The build grant the landing colony pays (the tile's own printed reward for that berth). */
    rosterGrantQty(): number {
      const build = this.roster?.reading.build;
      return build !== undefined && build.lands ? buildBenefitAt(this.metadata, build.slot).quantity : 0;
    },
    buildBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const b = this.metadata.build;
      return {type: b.type, quantity: b.quantity, resource: Array.isArray(b.resource) ? b.resource[0] : b.resource};
    },
    colonyBenefit(): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const c = this.metadata.colony;
      return {type: c.type, quantity: [c.quantity ?? 1], resource: c.resource};
    },
    focusedBonusQty(): number {
      return this.metadata.colony.quantity ?? 1;
    },
    nextBuildSlot(): number {
      return Math.min(this.colony.colonies.length, 2);
    },
    buildQty(): number {
      return buildBenefitAt(this.metadata, this.nextBuildSlot).quantity;
    },
    buildLost(): boolean {
      return this.benefitResourceLost(this.metadata.build.type);
    },
    /** The names seated in the three berths — the instrument's prop. */
    ownerNames(): Array<string> {
      return [0, 1, 2].map((idx) => this.ownerNameAt(idx));
    },
    owners(): Array<{color: Color, count: number, name: string}> {
      return colonyOwnerCounts(this.colony).map((owner) => {
        const player = this.players.find((p) => p.color === owner.color);
        return {...owner, name: player !== undefined ? participantDisplayName(player) : owner.color};
      });
    },
    /**
     * THE ARITHMETIC WORTH DRAWING. A single seat needs none — the rate IS the
     * payout, and «1 ×» is noise. It appears only where the number genuinely
     * differs from the rate, and it belongs to ONE holder: the viewer when
     * they stand here (it is their bonus), otherwise the largest holder (the
     * one whose stake the scene has to explain).
     */
    bonusMath(): {color: Color, count: number, total: number} | undefined {
      const mine = this.viewerColor === undefined ?
        undefined :
        this.owners.find((o) => o.color === this.viewerColor);
      const subject = mine ?? [...this.owners].sort((a, b) => b.count - a.count)[0];
      if (subject === undefined || subject.count < 2 || this.focusedBonusQty <= 0) {
        return undefined;
      }
      return {color: subject.color, count: subject.count, total: subject.count * this.focusedBonusQty};
    },
    visitorLine(): string {
      const visitor = this.colony.visitor;
      if (visitor === undefined) {
        return '';
      }
      if (visitor === this.viewerColor) {
        return translateText('Your trade fleet is currently here');
      }
      const player = this.players.find((p) => p.color === visitor);
      if (player !== undefined) {
        return translateTextWithParams('Trade fleet of ${0} is currently here', [participantDisplayName(player)]);
      }
      return translateText('Trade fleet currently here');
    },
    /**
     * THE CONFIGURATION IS PINNED — this stage is past its own commit and the
     * working area is a RECEIPT, not a form. One flag, three sources (see
     * `HeldView`): after the boundary the options, the disabled paths and the
     * preview all come from the snapshot, so a NEXT trade offered in the very
     * response that answered this one can never re-light the panel.
     */
    configPinned(): boolean {
      return this.pinnedConfig !== undefined;
    },
    /** The «Pay trade fee» options the stage PRESENTS (pinned past commit). */
    presentedOptions(): ReadonlyArray<SelectOptionModel> {
      return this.pinnedConfig?.options ?? this.options;
    },
    /** …and the refused ones. */
    presentedDisabled(): NonNullable<OrOptionsModel['disabledOptions']> {
      return this.pinnedConfig?.disabledOptions ?? this.disabledOptions;
    },
    /**
     * The trade/build preview the stage PRESENTS. Pinned past the commit, so
     * the reward package, the step list and every «current → resulting» keep
     * describing the move that was made here — never the next one the server
     * has already offered.
     */
    presentedPreview(): ColonyTradePreviewModel | undefined {
      return this.pinnedConfig !== undefined ? this.pinnedConfig.preview : this.preview;
    },
    // THE ROW MODEL IS SHARED (`tradePayModel.ts`) — the fleet-dock stage reads
    // the same one, so a payment path can never be drawn two ways.
    payEntries(): Array<PayEntry> {
      return tradePayEntries(this.presentedOptions, textOf, payIconClass);
    },
    disabledEntries(): Array<{title: string, iconClass: string, reason: string}> {
      return tradePayDisabledEntries(this.presentedDisabled, textOf, payIconClass);
    },
    /** The pay row under the cursor (the server's option index), `-1` while the cursor is elsewhere. */
    focusedPayIndex(): number {
      return this.sub === undefined && this.focused?.zone === 'pay' ? this.focused.index : -1;
    },
    /** The chosen flexible family's draft as the row prints it («⚡2 + 🔩1»). */
    payRowMix(): {energy: number, steel: number} | undefined {
      const mix = this.energyMixInfo;
      return mix === undefined ? undefined : {energy: (mix.cost ?? 0) - this.tradeSteelMix, steel: this.tradeSteelMix};
    },
    /**
     * THE PATHS THE PLAYER CAN ACTUALLY TAKE.
     *
     * With the fee fixed by the entry there is exactly one, and the rest are
     * not choices at all — a card action walked in through THIS path and
     * cannot switch. A dimmed list of four would be a menu whose every other
     * item refuses the press; the header already says where the trade came
     * from, and that is the whole explanation the player needs.
     *
     * The original index rides along: `payIdx`, the focus ring and the submit
     * all speak the SERVER's option order, and a filtered list must never
     * renumber it.
     */
    visiblePayEntries(): Array<PayEntry & {index: number}> {
      // PAST THE COMMIT there is no list at all — the chosen path alone stands
      // as the receipt (the held row below the loop). A menu of alternatives
      // over a move that has already been made is an offer the player cannot
      // take, and — when the server has already re-offered the trade — one
      // whose numbers describe a DIFFERENT transaction.
      return visibleTradePayRows(this.payEntries, this.lockedPayIdx, this.configPinned);
    },
    /** …and a REFUSED path is equally irrelevant once the fee is fixed. */
    visibleDisabledEntries(): Array<{title: string, iconClass: string, reason: string}> {
      return [...visibleTradePayDisabled(this.disabledEntries, this.lockedPayIdx, this.configPinned)];
    },
    /**
     * THE FEE IS FIXED — this trade was entered from a card's own action, so
     * its payment path is the entry, not a decision. `-1` = the ordinary
     * «Колонии» entry, where every path is the player's to pick.
     *
     * Resolved from the option's `metadata.card` (a card's door) or
     * `metadata.party` (the Unity party action's door), never its label.
     */
    lockedPayIdx(): number {
      return lockedTradePaymentIndex(this.presentedOptions, cardColonyTradeCard(), partyColonyTradeParty());
    },
    isMcSelected(): boolean {
      return this.presentedOptions[this.payIdx]?.metadata?.icon === 'megacredits';
    },
    /** The energy payment family is the chosen path (Delta Works mix applies). */
    isEnergySelected(): boolean {
      return this.presentedOptions[this.payIdx]?.metadata?.icon === 'energy';
    },
    /** The live Delta Works mix of the energy fee, or undefined without one. */
    energyMixInfo(): ColonyTradePreviewModel['energyMix'] {
      const mix = this.presentedPreview?.energyMix;
      if (mix === undefined || !this.isEnergySelected || !this.tradeConfigLive) {
        return undefined;
      }
      return mix;
    },
    /** The substitution is live in THIS trade (server capability — present iff
     *  Delta Works widens the family), regardless of which row is chosen:
     *  what puts the ⚡/🔩 pair on the family row BEFORE any selection. */
    energyMixLive(): boolean {
      return this.tradeConfigLive && this.presentedPreview?.energyMix !== undefined;
    },
    /** The energy family's own option index (metadata-keyed, never a title). */
    energyEntryIdx(): number {
      return this.presentedOptions.findIndex((o) => o.metadata?.icon === 'energy');
    },
    /** The EFFECTIVE steel share — THE canonical draft value: the dialed
     *  preference clamped by the ONE shared rule to the SERVER's own bounds
     *  (energy-first by default — preference 0 is the bare deficit). The
     *  family row, the composition panel, the right «ОПЛАТА» summary and the
     *  submitted batch all read THIS number. */
    tradeSteelMix(): number {
      const mix = this.energyMixInfo;
      if (mix === undefined) {
        return 0;
      }
      return clampEnergyMixSteel(this.steelMixPreference, mix);
    },
    tradeMixAdjustable(): boolean {
      const mix = this.energyMixInfo;
      return mix !== undefined && mix.maxSteel > mix.minSteel;
    },
    /** The whole energy-family fee as the SHARED PaymentView — the same rows /
     *  captions / verdict grammar the card-play selector renders. */
    tradeMixView(): PaymentView {
      const mix = this.energyMixInfo;
      if (mix === undefined) {
        return buildEnergyMixView({cost: 0, energyAvailable: 0, steelAvailable: 0, minSteel: 0, maxSteel: 0, steelUsed: 0});
      }
      return buildEnergyMixView({
        cost: mix.cost,
        energyAvailable: mix.energyAvailable,
        steelAvailable: mix.steelAvailable,
        minSteel: mix.minSteel,
        maxSteel: mix.maxSteel,
        steelUsed: this.tradeSteelMix,
      });
    },
    tradeConfigLive(): boolean {
      return this.intent === 'trade' && this.presentAvailable;
    },
    /** A BUILD whose placement bonus asks something (Titan: «положи 3
     *  аэростата на карту») composes on this stage too — same rows, same
     *  picker, same batch: the prompt must never arrive after the cube. */
    buildConfigLive(): boolean {
      return this.intent === 'build' && this.presentAvailable;
    },
    /** Either act is composing decisions on this stage right now. */
    configLive(): boolean {
      return this.tradeConfigLive || this.buildConfigLive;
    },
    /** This act asks the player something before it can be committed. */
    hasDecisions(): boolean {
      return this.stepRows.length > 0;
    },
    steps(): Array<TradeStep> {
      if (this.tradeConfigLive) {
        return tradeSteps(this.presentedPreview, this.isMcSelected, this.isEnergySelected);
      }
      return this.buildConfigLive ? buildSteps(this.presentedPreview) : [];
    },
    stepKeys(): Array<string> {
      let target = 0;
      return this.steps.map((step) => {
        if (step.kind === 'payment') {
          return 'payment';
        }
        if (step.kind === 'energyMix') {
          return 'energyMix';
        }
        if (step.kind === 'trackChoice') {
          return 'track';
        }
        return `target:${target++}`;
      });
    },
    stepRows(): Array<StepRow> {
      return this.steps.flatMap((step, i): Array<StepRow> => {
        const key = this.stepKeys[i];
        if (step.kind === 'payment') {
          return [{key, kind: 'payment' as const, label: 'Payment', iconClass: ''}];
        }
        // The Delta Works mix is answered IN the energy pay row (its dial +
        // summary live there) — never a second decision row, so an always-valid
        // default costs the player no extra focus stop.
        if (step.kind === 'energyMix') {
          return [];
        }
        if (step.kind === 'trackChoice') {
          return [{key, kind: 'trackChoice' as const, label: 'Colony track', iconClass: ''}];
        }
        return [{
          key,
          kind: 'cardTarget' as const,
          label: step.role === 'tradeReward' ?
            'Trade reward target' :
            (step.role === 'buildBonus' ? 'Build bonus target' : 'Colony bonus target'),
          iconClass: this.resourceIconClass(step.resource),
          step,
        }];
      });
    },
    focusables(): Array<Focusable> {
      // A RECEIPT HAS NO CURSOR STOPS. Past the commit the rows still render
      // (the decision stays readable) but nothing on them can be pressed —
      // the move is made, and a focus ring travelling over it would advertise
      // an edit that does not exist.
      if (!this.configLive || this.configPinned) {
        return [];
      }
      // A BUILD has no payment paths — only its decisions are cursor stops.
      if (this.buildConfigLive) {
        return this.stepRows.map((_, index) => ({zone: 'step' as const, index}));
      }
      // A LOCKED fee is not a choice, so it is not a cursor stop: the entry
      // came through the card that pays, and «выбрать другой способ» would be
      // a control that refuses every press. The rows still RENDER (the player
      // sees the whole structure of the trade) — they just cannot be reached.
      const out: Array<Focusable> = this.lockedPayIdx >= 0 ?
        [] : this.payEntries.map((_, i) => ({zone: 'pay' as const, index: i}));
      this.stepRows.forEach((_, i) => out.push({zone: 'step', index: i}));
      return out;
    },
    focused(): Focusable | undefined {
      return this.focusables[this.focusIdx];
    },
    trackStep(): Extract<TradeStep, {kind: 'trackChoice'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'trackChoice');
      return step?.kind === 'trackChoice' ? step : undefined;
    },
    trackOptions(): Array<{steps: number, position: number, quantity: number, levy: boolean, title: string}> {
      const step = this.trackStep;
      const current = this.presentedPreview?.track.current ?? 0;
      if (step === undefined) {
        return [];
      }
      const options: Array<{steps: number, position: number, quantity: number, levy: boolean, title: string}> = [];
      // Down to the plan's FLOOR: below it the colony refuses this player its
      // income (the Redux Pluto's data with no holder) — the server lists those
      // steps disabled, and «don't increase» exists only when 0 is legal.
      for (let n = step.steps; n >= step.minSteps; n--) {
        const position = Math.min(current + n, this.metadata.trade.quantity.length - 1);
        options.push({
          steps: n,
          position,
          quantity: rewardAtPosition(this.metadata, position).quantity,
          levy: rewardAtPosition(this.metadata, position).type === ColonyBenefit.LOSE_RESOURCES,
          title: n > 0 ?
            translateTextWithParams('Increase colony track ${0} step(s)', [String(n)]) :
            translateText('Don\'t increase colony track'),
        });
      }
      return options;
    },
    trackSummary(): string {
      const chosen = this.captures['track'];
      if (typeof chosen !== 'number') {
        return '';
      }
      return chosen > 0 ?
        translateTextWithParams('Advance ${0} step(s)', [String(chosen)]) :
        translateText('Don\'t increase colony track');
    },
    activeTargetStep(): Extract<TradeStep, {kind: 'cardTarget'}> | undefined {
      const focused = this.focused;
      if (focused?.zone !== 'step') {
        return undefined;
      }
      const row = this.stepRows[focused.index];
      return row?.kind === 'cardTarget' ? row.step : undefined;
    },
    activeTargetKey(): string {
      const focused = this.focused;
      return focused?.zone === 'step' ? (this.stepRows[focused.index]?.key ?? '') : '';
    },
    targetSubTitle(): string {
      const step = this.activeTargetStep;
      if (step === undefined) {
        return '';
      }
      return textOf(step.pick.title) || translateText('Choose a card');
    },
    /**
     * THE SHARED SELECTOR'S MODEL for the focused card-target step — the same
     * pure model the blue-action and play composers build, translated from the
     * trade preview's own shapes (`buildColonyTradeTargetModel`). No
     * `sourceCardName`: the hero of this stage is the PLANET, so every
     * candidate renders as its own physical face and the «ЭТА КАРТА» proxy
     * never appears here.
     */
    targetStepModel(): PlayedTargetModel | undefined {
      const step = this.activeTargetStep;
      if (step === undefined || this.viewerColor === undefined) {
        return undefined;
      }
      return buildColonyTradeTargetModel({
        step,
        ask: this.targetSubTitle,
        players: this.players,
        viewerColor: this.viewerColor,
        typeOf: (name) => getCard(name)?.type,
        resourceOf: (name) => getCard(name)?.resourceType,
      });
    },
    targetLayout(): PlayedTargetLayout {
      return planPlayedTargetLayout({
        owners: this.targetStepModel?.owners ?? [],
        availW: this.targetZoneW > 0 ? this.targetZoneW : 900,
        ui: conUiScale(),
        handheld: consoleLayoutState.profile === 'handheld',
      });
    },
    /** The step's vertical budget — the zone IS the room (its own contract
     *  header and rail are part of the step and already in its budget). */
    targetBandH(): number {
      return Math.max(0, this.targetZoneH);
    },
    targetLockedCard(): string {
      const captured = this.captures[this.activeTargetKey];
      return typeof captured === 'string' ? captured : '';
    },
    /**
     * THE PRESENTED SCENE IS UP — the chosen host card(s) own the working
     * area while the reward physically arrives. It stands from the commit
     * (the fleet is still flying — the player reads WHERE the reward will
     * land) and yields the moment a CARD payout takes the area over
     * (`workingAreaYielded` — the covers' scene outranks it).
     */
    cardlandVisible(): boolean {
      // The snapshot IS the proof of «past the commit» (it is taken at the
      // boundary and cleared at the release), so this must NOT re-ask
      // `pastCommit`: that term drops when the transaction ends, which for a
      // BUILD is several hundred ms before its floaters land — the card
      // vanished from under its own reward.
      return this.presentedTargets.length > 0 && !this.workingAreaYielded;
    },
    /**
     * …and while it is ON STAGE AT ALL it BLOCKS the closing beat: the track is
     * drawn under it, and a marker gliding under a standing scene is the same
     * fault the payout pose already guards (`stageBusy`).
     *
     * ⚠️ THE DEPARTURE COUNTS. This used to drop on `cardlandReleased`, i.e.
     * on the frame the card only BEGAN to leave — so the working area faded
     * back through the departing card and the glide started inside that
     * crossfade. The hold ends when the card is GONE (its leave clears
     * `presentedTargets`), which is what makes the hand-back a sequence.
     */
    cardlandHolds(): boolean {
      return this.cardlandVisible;
    },
    /**
     * THE ONE «working area is busy» fact the conclusion waits on — the card
     * payout standing in the outcome zone OR the presented-target scene. The
     * closing track glide may start only once BOTH have receded (published
     * through `setColonyStageYielded`, with the pose's own return dwell).
     */
    stageBusy(): boolean {
      return this.workingAreaYielded || this.cardlandHolds;
    },
    /**
     * The card-resource DESTINATIONS of this configuration — the picked
     * targets AND the single-candidate AUTO ones the server applies without a
     * prompt, merged per physical card.
     *
     * ONE derivation feeds THREE consumers (the summary rail's «На карту(ы):»
     * list, the transfer flight's `targets`, and the presented resolution
     * scene), so what the player is shown, what the chip flies onto and what
     * the batch answers can never be three different answers.
     */
    cardDestinations(): {targets: ColonyTradeTargets, presented: ReadonlyArray<ColonyTradePresentedTarget>} {
      return colonyTradeCardDestinations({
        steps: this.steps,
        stepKeys: this.stepKeys,
        captures: this.captures,
        notices: this.tradeConfigLive ?
          tradeNotices(this.presentedPreview) :
          (this.buildConfigLive ? buildNotices(this.presentedPreview) : []),
        resourceOf: (name) => getCard(name)?.resourceType,
        beforeOf: (name) => this.receiptBase.cardResources[name] ?? 0,
      });
    },
    /** A reward chip of this payout is still in the air. */
    chipsInFlight(): boolean {
      return this.transferState.flights.length > 0 || this.transferState.runActive;
    },
    /** Every presented card has received its full landing tally. */
    cardlandAllLanded(): boolean {
      return this.presentedTargets.length > 0 &&
        this.presentedTargets.every((t) => this.landedOf(t) >= t.amount);
    },
    paymentStep(): Extract<TradeStep, {kind: 'payment'}> | undefined {
      const step = this.steps.find((s) => s.kind === 'payment');
      return step?.kind === 'payment' ? step : undefined;
    },
    payLanes(): ReadonlyArray<PaymentLane> {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      return step === undefined || player === undefined ? [] : paymentLanes(step.model, player);
    },
    paymentView(): PaymentView | undefined {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      if (step === undefined || player === undefined) {
        return undefined;
      }
      return buildPaymentView({
        cost: step.model.amount,
        lanes: this.payLanes,
        counts: this.paymentCounts,
        mcAvailable: megacreditsAvailable(player),
      });
    },
    payFocusUnit(): string | undefined {
      const v = this.paymentView;
      return v === undefined || this.sub !== 'lanes' ? undefined : editableRows(v)[this.subIdx]?.unit;
    },
    paymentSummary(): string {
      const view = this.paymentView;
      if (view === undefined) {
        return '';
      }
      const parts: Array<string> = [];
      for (const row of view.rows) {
        if (row.auto) {
          continue;
        }
        if (row.used > 0) {
          parts.push(`${row.used} ${translateText(row.labelKey)}`);
        }
      }
      const mc = view.rows.find((r) => r.auto)?.used ?? 0;
      if (mc > 0 || parts.length === 0) {
        parts.push(`${mc} M€`);
      }
      return parts.join(' + ');
    },
    rewardPosition(): number {
      const track = this.presentedPreview?.track;
      const chosen = this.captures['track'];
      if (typeof chosen === 'number') {
        const current = track?.current ?? this.colony.trackPosition;
        return Math.min(current + chosen, this.metadata.trade.quantity.length - 1);
      }
      // A preview asked for ANOTHER path's reach is not this one's: the stage's
      // own mirror of the plan stands in until the re-ask lands.
      if (track !== undefined && (this.pinnedConfig !== undefined || this.pathOffset === this.chosenPathOffset)) {
        return track.effective;
      }
      return this.effectivePosition;
    },
    ownColonyCount(): number {
      if (this.viewerColor === undefined) {
        return 0;
      }
      return this.colony.colonies.filter((c) => c === this.viewerColor).length;
    },
    /**
     * The ACTUAL payment parts of the chosen path — THE one place the right
     * «ОПЛАТА» summary, its `current → resulting` pairs and the running-stock
     * sequence read the fee from. For the energy family under Delta Works the
     * parts come from the CANONICAL mix draft (`tradeSteelMix`), so a dial
     * press updates the row, the composition panel and this summary in the
     * same reactive flush — an energy-first «−3» over a dialed mix was the
     * stale-summary bug this computed exists to kill.
     */
    outcomePayments(): Array<{icon: string, amount: number, resource?: {current: number, resulting: number}}> {
      if (!this.tradeConfigLive) {
        return [];
      }
      const mix = this.energyMixInfo;
      if (mix !== undefined) {
        const steel = this.tradeSteelMix;
        const energy = Math.max(0, mix.cost - steel);
        const parts: Array<{icon: string, amount: number}> = [];
        if (energy > 0) {
          parts.push({icon: 'energy', amount: energy});
        }
        if (steel > 0) {
          parts.push({icon: 'steel', amount: steel});
        }
        return parts;
      }
      const meta = this.presentedOptions[this.payIdx]?.metadata;
      return meta?.icon !== undefined && meta.amount !== undefined ?
        // `resource` rides along: for a CARD-paid fee it is the ONLY source of
        // the before → after (the viewer's rail has no floaters on it).
        [{icon: meta.icon, amount: meta.amount, resource: meta.resource}] :
        [];
    },
    /**
     * The base every `current → resulting` of the outcome reads — the live
     * models before the commit, the boundary snapshot after it (see
     * `HeldView.receipt`).
     */
    receiptBase(): TradeReceiptBase {
      return this.pinnedConfig?.receipt ?? tradeReceiptBaseOf(this.thisPlayer, this.players);
    },
    outcome(): {cost: Array<TradeOutcomeChip>, gains: Array<TradeOutcomeChip>} {
      return tradeOutcome({
        metadata: this.metadata,
        rewardPosition: this.rewardPosition,
        payments: this.outcomePayments,
        ownColonyCount: this.ownColonyCount,
        flatBonuses: this.presentedPreview?.flatBonuses,
        stocks: this.receiptBase.stocks,
        production: this.receiptBase.production,
      });
    },
    /**
     * THE REWARD PACKAGE the summary rail renders — «ВАШ ИТОГ» / «СОСТАВ
     * НАГРАДЫ» / «ДРУГИМ ИГРОКАМ», all three from the ONE pure derivation
     * every colony surface shares (`colonyRewardPackage`).
     */
    rewardPackage(): ColonyRewardPackage {
      return colonyRewardPackage({
        gains: this.outcome.gains,
        metadata: this.metadata,
        colony: this.colony,
        viewer: this.viewerColor,
      });
    },
    /** The other owners' rows with their display names resolved. */
    otherOwnerRows(): Array<RewardOtherRow & {name: string}> {
      return this.rewardPackage.others.map((row) => {
        const player = this.players.find((p) => p.color === row.color);
        return {...row, name: player !== undefined ? participantDisplayName(player) : row.color};
      });
    },
    /**
     * WHERE THE CARD-RESOURCE TOTAL LANDS — one row per PHYSICAL CARD.
     *
     * The SAME derivation the flight and the landing scene read
     * (`cardDestinations`): merged per card (an income and a bonus aimed at
     * one card add up instead of printing it twice) and including the
     * single-candidate AUTO targets the server applies without asking. A
     * second, step-by-step derivation here is exactly what printed «Карта
     * ветров 0 → 1» twice under one «+2».
     */
    cardTargetLines(): Array<{card: string, before: number, after: number, iconClass: string}> {
      return this.cardDestinations.presented.map((t) => ({
        card: t.card,
        before: t.before,
        after: t.before + t.amount,
        iconClass: t.icon !== '' ? this.rewardIconClass(t.icon) : '',
      }));
    },
    resourceLost(): boolean {
      // Read at the position the trade will PAY — the Redux Pluto's data
      // positions can be lost, its card positions cannot.
      return this.benefitResourceLost(rewardAtPosition(this.metadata, this.rewardPosition).type);
    },
    noticeRows(): Array<NoticeRow> {
      if (!this.configLive) {
        return [];
      }
      const rows: Array<NoticeRow> = [];
      const notices = this.tradeConfigLive ? tradeNotices(this.presentedPreview) : buildNotices(this.presentedPreview);
      for (const notice of notices) {
        if (notice.kind === 'autoTarget') {
          rows.push({
            tone: 'info',
            iconClass: this.resourceIconClass(notice.resource),
            text: translateTextWithParams('+${0} to ${1} (the only eligible card)', [String(notice.amount), translateText(notice.card)]),
          });
        } else if (notice.kind === 'lostResource') {
          rows.push({
            tone: 'warn',
            iconClass: this.resourceIconClass(notice.resource),
            text: translateText('No eligible card — this resource is not added.'),
          });
        } else {
          rows.push({tone: 'info', iconClass: '', text: translateText(notice.note)});
        }
      }
      return rows;
    },
    canConfirm(): boolean {
      // A COMMITTED MOVE IS NOT CONFIRMABLE. `actionAvailable` is the LIVE
      // prop, and a door that keeps the player's action (a card-action trade)
      // is re-offered the trade in the very response that answered it — the
      // command bar then advertised «Подтвердить» over a marker still gliding
      // home, for a press `handleIntent` absorbs anyway.
      if (this.configPinned) {
        return false;
      }
      if (!this.actionAvailable) {
        return false;
      }
      if (this.intent === 'pick' || this.intent === 'track') {
        return true;
      }
      if (this.intent === 'build') {
        // A build with a decision (its placement bonus needs a card) is not
        // confirmable until that decision is made — the whole point of
        // pre-collecting it. A build with none confirms as it always did.
        return this.steps.every((_step, i) => this.captures[this.stepKeys[i]] !== undefined);
      }
      if (this.intent !== 'trade') {
        return false;
      }
      if (this.paymentView !== undefined && !this.paymentView.status.ok) {
        return false;
      }
      return this.steps.every((step, i) => {
        // The M€ payment answers from the live lane counts and the Delta
        // Works mix from the canonical draft — both are captured AT SUBMIT
        // (emitConfirm) and always hold a valid value, so neither is a
        // missing answer. Requiring a capture for the mix kept the trade's
        // confirm dead for as long as the composition choice existed.
        if (step.kind === 'payment' || step.kind === 'energyMix') {
          return true;
        }
        return this.captures[this.stepKeys[i]] !== undefined;
      });
    },
    focusedRowEditable(): boolean {
      const focused = this.focused;
      if (focused === undefined) {
        return false;
      }
      if (focused.zone === 'pay') {
        return true;
      }
      const row = this.stepRows[focused.index];
      if (row === undefined) {
        return false;
      }
      if (row.kind === 'payment') {
        return this.payLanes.length > 0;
      }
      return true;
    },
  },
  watch: {
    isMcSelected() {
      this.seedPaymentDefault();
    },
    preview() {
      this.measureFit();
      this.seedPaymentDefault();
      // THE GAME STATE MOVED UNDER A CAPTURE. The preview is the candidates'
      // source of truth, so a fresh one INVALIDATES anything it no longer
      // offers: a captured target whose card left the eligible set is dropped
      // (the row returns to «Выберите карту…», the confirm re-locks), and a
      // vanished track choice goes with its step. Silently submitting a stale
      // pick — or showing it as still chosen — is the one forbidden outcome.
      this.pruneStaleCaptures();
      this.syncUiMirror();
    },
    sub() {
      this.publishStageName();
      this.syncUiMirror();
      this.measureFit();
    },
    // Every composition change re-asks how much room the columns want.
    stepRows() {
      this.measureFit();
    },
    presentMode() {
      this.measureFit();
    },
    cardTargetLines() {
      this.measureFit();
    },
    canConfirm() {
      this.syncUiMirror();
    },
    // The chosen family gates the confirm's gateway label — a switch to
    // M€/titanium must drop it in the same flush (the value the mirror
    // publishes is derived, so only this edge re-publishes it).
    payIdx() {
      this.syncUiMirror();
    },
    // The chosen path's reach is the section's to re-ask the preview with
    // (`immediate`: a stage mounting straight onto a locked path — the Unity
    // door — names it before the first preview is fetched).
    chosenPathOffset: {
      immediate: true,
      handler(offset: number) {
        this.$emit('path-offset', offset);
      },
    },
    // The WORLD moved under the composition substep (undo, a refreshed
    // preview, the card leaving the tableau) and the choice is gone — the
    // step folds honestly back to Configure; a single valid allocation needs
    // no step, and a dead one must not stand.
    tradeMixAdjustable(adjustable: boolean) {
      if (!adjustable && this.sub === 'mix') {
        this.closeMixStep();
      }
      this.syncUiMirror();
    },
    // The fee options arrive with the prompt, which can land a frame after the
    // stage mounts (and re-lands on every response) — re-pin, never re-seed.
    lockedPayIdx: {
      immediate: true,
      handler() {
        this.syncLockedPayment();
      },
    },
    focusedRowEditable() {
      this.syncUiMirror();
    },
    intent() {
      this.publishStageName();
      this.syncUiMirror();
    },
    /** The city act arrives / is pinned with the prompt — the crumb's stage follows it. */
    city() {
      this.publishStageName();
    },
    'colony.name'() {
      this.captures = {};
      this.sub = undefined;
      this.subIdx = 0;
      this.payIdx = 0;
      this.focusIdx = 0;
      this.heldView = undefined;
      this.pinnedConfig = undefined;
      this.commitLatched = false;
      this.heldContext = undefined;
      this.targetFocus = undefined;
      this.presentedTargets = [];
      this.cardlandReleased = false;
      this.clearCardlandDwell();
      this.clearCardlandLeave();
      this.seedPaymentDefault();
      this.syncLockedPayment();
      this.publishStageName();
      this.syncUiMirror();
    },
    // The commit latch: once this stage session crossed the boundary, the
    // pre-commit verdict never returns (see `commitLatched`). `immediate`:
    // a stage that MOUNTS mid-resolution (the post-discard restore, a remote
    // entry) is past the commit from its first frame.
    pastCommit: {
      immediate: true,
      handler(now: boolean) {
        if (now) {
          this.commitLatched = true;
          // ⚠️ WHOEVER NOTICES THE BOUNDARY FIRST TAKES THE SNAPSHOT. The
          // ordinary pin runs at the shell's accept, through an OPTIONAL-CHAINED
          // ref (`coloniesSection.$refs.focusStage?.holdPresentation()`), so a
          // frame in which that ref is not resolved yet silently pins NOTHING —
          // and the working area then re-derives from the live props for the
          // whole resolution, which is the exact defect the pin exists for
          // (measured: 62 of 273 post-commit samples showing a three-row payment
          // menu). This is the same fact from the stage's own side, so it cannot
          // be missed. Deliberately only the CONFIG half: the presented targets
          // are a decision-time snapshot and re-taking them here would read the
          // server's answer instead.
          if (this.pinnedConfig === undefined) {
            this.pinConfig();
          }
        }
      },
    },
    // Hold the last SOURCE context through the close (see `presentedContext`).
    resolutionContext: {
      immediate: true,
      handler(ctx: {roleKey: string, bonus: boolean, traderColor: string, traderLine: string} | undefined) {
        if (ctx !== undefined) {
          this.heldContext = {...ctx};
        }
      },
    },
    actionAvailable() {
      this.publishStageName();
      this.syncUiMirror();
    },
    // THE CONFIGURATION LETS GO only when the flow's physical bridge is on
    // stage (covers airborne / content landing) — never at the bare claim.
    // One-shot per outcome; re-arms when the zone folds (the next cycle's
    // batch opens its own phrase).
    // ⚠️ IMMEDIATE, because a stage that MOUNTS mid-resolution (the
    // post-discard restore, a remote entry, a reload) is handed over from its
    // FIRST FRAME — there is no rising edge left to wait for. Without it the
    // pose never armed for such a mount and the payout stood ON TOP of a fully
    // lit track and summary rail: two surfaces in one zone (the reported
    // «reveal отрендерился поверх интерфейса колоний»). The animation cannot
    // fire during setup (`playOutcomeHandoff` has no `$el` yet), which is
    // exactly right: there is nothing to release, only a pose to be in.
    outcomeHandoffDue: {
      immediate: true,
      handler(due: boolean) {
        this.armOutcomeHandoff(due);
      },
    },
    outcomeZone(on: boolean) {
      if (!on) {
        this.outcomeHandoffPlayed = false;
        return;
      }
      // …AND THE NEXT CYCLE RE-ARMS IT. The cue is RESOLUTION-scoped
      // (`payoutLiftOff` is raised once per payout, and the content can already
      // be in the zone), so when the zone re-opens for the second colony's
      // bonus the watcher above has nothing to change — true→true fires
      // nothing, and the one-shot would stay unplayed for the rest of the flow.
      this.armOutcomeHandoff(this.outcomeHandoffDue);
    },
    /**
     * THE CLOSING BEAT WAITS FOR THIS STAGE. The trade's conclusion (the track
     * reset) may not start while the track is hidden under the payout — and
     * not on the frame the pose drops either: the working area fades back over
     * its own transition, and a marker launched into that fade is the same
     * «белая точка по пустому интерфейсу», just shorter. The RISE is published
     * at once (nothing may slip in behind it); the FALL is published after the
     * pose has settled — a dwell, not a gate (the section's own
     * COMPLETION_SETTLE precedent), scaled by the speed preset.
     */
    stageBusy: {
      immediate: true,
      handler(busy: boolean) {
        if (this.stageBackTimer !== undefined) {
          window.clearTimeout(this.stageBackTimer);
          this.stageBackTimer = undefined;
        }
        if (busy) {
          setColonyStageYielded(true);
          return;
        }
        this.stageBackTimer = window.setTimeout(() => {
          this.stageBackTimer = undefined;
          setColonyStageYielded(false);
        }, motionMs(WORKING_AREA_BACK_MS));
      },
    },
    /**
     * EVERY CHIP HAS TOUCHED ITS CARD — hold the landed reading for one calm
     * beat (the counter just ticked; the player must see the new number), then
     * recede and give the working area back. A read beat, not a gate: nothing
     * is being waited for.
     */
    /**
     * THE DEPARTURE. `cardlandReleased` starts the leave pose; when it has
     * played the card is UNMOUNTED, and only that drops `--carding` (the
     * working area returns to an empty room) and `stageBusy` (the marker may
     * finally move). One writer for the whole hand-back order.
     */
    cardlandReleased(released: boolean) {
      this.clearCardlandLeave();
      if (!released || this.presentedTargets.length === 0) {
        return;
      }
      this.cardlandLeave = window.setTimeout(() => {
        this.cardlandLeave = undefined;
        this.presentedTargets = [];
        this.cardlandReleased = false;
      }, motionMs(CARDLAND_LEAVE_MS));
    },
    cardlandAllLanded(landed: boolean) {
      if (!landed || !this.cardlandVisible || this.cardlandReleased) {
        return;
      }
      this.clearCardlandDwell();
      this.cardlandDwell = window.setTimeout(() => {
        this.cardlandDwell = undefined;
        this.cardlandReleased = true;
      }, motionMs(CARDLAND_READ_MS));
    },
    /** A CARD payout took the working area over (Miranda: animals landed,
     *  now the drawn card's covers own the room) — the presented scene must
     *  not stand under it, and its counters must not stay frozen. */
    outcomeHandoffPlayed(played: boolean) {
      if (played && this.presentedTargets.length > 0) {
        this.clearCardlandDwell();
        this.cardlandReleased = true;
      }
    },
    /**
     * THE SCENE'S OWN NET. `onArrive` fires on every transfer path (flight,
     * reduced motion, degrade, safety), so the landings normally release the
     * scene — but a presented target whose chip the MANIFEST never produced
     * (a plan/actual divergence) would hold the working area forever. Once
     * the transaction's chip phase is over, whatever has not landed is not
     * coming: release after the same read beat, honestly.
     */
    'colonyTradeState.phase'(phase: string) {
      const chipsOver = phase === 'awaiting' || phase === 'glide' || phase === 'settle' || phase === 'idle';
      if (!chipsOver || !this.cardlandVisible || this.cardlandReleased ||
          this.cardlandAllLanded || this.cardlandDwell !== undefined) {
        return;
      }
      this.cardlandDwell = window.setTimeout(() => {
        this.cardlandDwell = undefined;
        this.cardlandReleased = true;
      }, motionMs(CARDLAND_READ_MS));
    },
    outcomeContentIn(landed: boolean) {
      if (landed) {
        void this.$nextTick(() => playOutcomeContent(this.$el as HTMLElement));
      }
    },
    resolving(now: boolean, was: boolean) {
      if (!now && was) {
        // The transaction ended — SUCCESS or a clean rollback. The pinned
        // presentation lets go, UNLESS the payout is still physically
        // arriving on a card: the panel would re-derive to `inspect` and
        // shrink by a third under the very scene it is hosting.
        if (this.heldView !== undefined && !this.cardlandHolds) {
          this.heldView = undefined;
          this.publishStageName();
          this.syncUiMirror();
        }
        // …but the PRESENTED CARD does NOT: a colony BUILD's own transaction
        // ends when the cube lands, several hundred ms before its floaters
        // touch down, and tearing the card out here left the reward flying at
        // a scene that no longer existed. Nothing owed → clear at once (a
        // refusal must leave no success scene); something owed → the landing
        // watcher releases it, with a bounded net so a chip that never
        // arrives can never strand the card on screen.
        if (this.presentedTargets.length === 0) {
          return;
        }
        if (this.cardlandAllLanded || this.cardlandReleased) {
          return; // the landed watcher (or the departure) owns the beat
        }
        if (!this.presentedTargets.some((t) => this.landedOf(t) > 0) && !this.chipsInFlight) {
          this.clearCardlandDwell();
          this.presentedTargets = [];
          this.cardlandReleased = false;
          return;
        }
        this.clearCardlandDwell();
        this.cardlandDwell = window.setTimeout(() => {
          this.cardlandDwell = undefined;
          this.cardlandReleased = true;
        }, motionMs(CARDLAND_NET_MS));
      }
    },
    /** The scene's own presence, published for the SECTION's completion: the
     *  colony may not route home while a reward is still arriving on a card. */
    cardlandVisible: {
      immediate: true,
      handler(live: boolean) {
        colonyResolutionUi.cardSceneLive = live;
        // The scene was the last thing holding the pinned presentation (see
        // the `resolving` falling edge) — release it now that it is done.
        if (!live && this.heldView !== undefined && !this.resolving) {
          this.heldView = undefined;
          this.publishStageName();
          this.syncUiMirror();
        }
      },
    },
  },
  methods: {
    cardLabel(name: string): string {
      return translateCardName(name);
    },
    ownerNameAt(idx: number): string {
      const color = this.colony.colonies[idx];
      if (color === undefined) {
        return '';
      }
      const player = this.players.find((p) => p.color === color);
      return player !== undefined ? participantDisplayName(player) : color;
    },
    benefitResourceLost(type: ColonyBenefit): boolean {
      // The holders of ANY of the tile's kinds (the WARE wildcard included) —
      // the same reading the parliament's «no recipient» note takes.
      const kinds = this.cardResourceKinds;
      if (kinds.length === 0) {
        return false;
      }
      if (type !== ColonyBenefit.ADD_RESOURCES_TO_CARD && type !== ColonyBenefit.ADD_RESOURCES_TO_VENUS_CARD) {
        return false;
      }
      const viewer = this.players.find((p) => p.color === this.viewerColor);
      return !holdsAnyOf(viewer?.tableau ?? [], kinds);
    },
    isFocused(zone: 'pay' | 'step', index: number): boolean {
      return this.sub === undefined && this.focused?.zone === zone && this.focused.index === index;
    },
    chipIconClass(chip: TradeOutcomeChip): string {
      // `con-task__opt-res` is what SIZES the sprite. A standard-resource class
      // carries a box of its own and happened to survive without it; a
      // card-resource class is only a background-image, so the floater's icon
      // was a 0×0 element — present in the DOM, invisible on screen. Every
      // other icon on this stage goes through `resourceIconClass`; this was the
      // one exception, and it is why the fee row lost its icon.
      return chip.icon !== undefined ? iconClassFor(chip.icon) + ' con-task__opt-res' : '';
    },
    /** A reward line's sprite — the SAME sizing every icon on this stage gets
     *  (a bare card-resource class is only a background-image: a 0×0 element
     *  without `con-task__opt-res`, which is how the fee row lost its icon). */
    rewardIconClass(icon: string): string {
      return iconClassFor(icon) + ' con-task__opt-res';
    },
    /**
     * WHO PAYS this part, in words: the colony's own track, the viewer's
     * settlements (with the multiplier that makes «2 колонии × 1 карта» read
     * as one line), or a card that pays on every trade.
     */
    sourceRowLabel(row: RewardSourceRow): string {
      if (row.kind === 'card') {
        return translateText(row.card ?? 'Card effect');
      }
      if (row.kind === 'ownColony') {
        return translateTextWithParams('Your colony ×${0}', [String(row.count)]);
      }
      // A COMPOSITE income has two track rows — the part paid on every trade and
      // the part the marker's position decides — and «Торговый трек» twice said
      // nothing about which was which. The pair is named only where both exist;
      // a plain colony keeps the one established label.
      const composite = this.rewardPackage.sources.some((s) => s.kind === 'trackFixed');
      if (row.kind === 'trackFixed') {
        return translateText('Every trade');
      }
      return translateText(composite ? 'Under the marker' : 'Trade track');
    },
    resourceKey(resource: string | undefined): string | undefined {
      return resource?.toString().toLowerCase().replace(/ /g, '-');
    },
    resourceIconClass(resource: string | undefined): string {
      const key = this.resourceKey(resource);
      return key !== undefined ? iconClassFor(key) + ' con-task__opt-res' : '';
    },
    tradeBenefitAt(position: number): {type: ColonyBenefit, quantity: ReadonlyArray<number>, resource?: unknown} {
      const income = tradeBenefitAt(this.metadata, position);
      return {type: income.type, quantity: this.metadata.trade.quantity, resource: income.resource};
    },
    targetImpact(row: StepRow): string {
      const step = row.step;
      if (step === undefined) {
        return '';
      }
      const captured = this.captures[row.key];
      const name = typeof captured === 'string' ? captured : undefined;
      const card = step.pick.cards.find((c) => c.name === name);
      if (card === undefined) {
        return '';
      }
      const before = card.resources ?? 0;
      return `${before} → ${before + step.amount}`;
    },
    /**
     * PIN THE FEE to the entry's own path. Called wherever `payIdx` could
     * otherwise drift (mount, a new colony, a fresh option list): the entry
     * IS the payment, so the selection is not seeded — it is fixed.
     */
    syncLockedPayment(): void {
      if (this.lockedPayIdx >= 0) {
        this.payIdx = this.lockedPayIdx;
      }
    },
    seedPaymentDefault(): void {
      const step = this.paymentStep;
      const player = this.thisPlayer;
      if (step === undefined || player === undefined) {
        this.paymentCounts = {};
        return;
      }
      const lanes = paymentLanes(step.model, player);
      this.paymentCounts = initialCounts(step.model.amount, lanes, megacreditsAvailable(player));
    },
    /** The stage names its crumb tail (rule 5 — never a header of its own).
     *  Reads the PRESENTED availability, so the tail cannot re-title itself
     *  «Осмотр» while a committed action is still resolving on the stage. */
    publishStageName(): void {
      // The target step is one level DEEPER in the same flow — only the tail
      // advances («…› ТОРГОВЛЯ» → «…› ЦЕЛЬ НАГРАДЫ»), and B walks it back.
      if (this.sub === 'targets') {
        setColonyFocusStage('Reward target');
        return;
      }
      // THE CITY ACT names its own stage («… › ЛУНА · ГОРОД»).
      if (this.city !== undefined) {
        setColonyFocusStage(this.city.stageKey);
        return;
      }
      // THE ROSTER ACT names its own stage («ЗАМЕНА» / «ДОБАВЛЕНИЕ» / «СНЯТИЕ») — whichever composition it wears.
      if (this.roster !== undefined) {
        setColonyFocusStage(this.roster.stageKey);
        return;
      }
      if (this.intent === 'build') {
        setColonyFocusStage(this.presentAvailable ? 'Construction' : 'Inspection');
        return;
      }
      if (this.intent === 'pick') {
        setColonyFocusStage('Selection');
        return;
      }
      // A CHOSEN TRACK's stage — «… › ЛУНА · ТРЕК» (the host folds the colony and the stage into one tail).
      if (this.intent === 'track') {
        setColonyFocusStage('Track');
        return;
      }
      if (this.intent === 'bonus') {
        // The stage the player is on is the BONUS itself; the payout's own
        // surface renames the tail as it advances («ДОБОР КАРТ», «СБРОС КАРТЫ»)
        // exactly as it does inside a trade.
        setColonyFocusStage('Owner bonus');
        return;
      }
      setColonyFocusStage(this.intent === 'trade' && this.presentAvailable ? 'Trading' : 'Inspection');
    },
    syncUiMirror(): void {
      consoleColoniesUi.composerSub = this.sub === undefined ?
        '' :
        (this.sub === 'lanes' ? 'lanes' :
          (this.sub === 'targets' ? 'targets' :
            (this.sub === 'mix' ? 'mix' : 'list')));
      consoleColoniesUi.composerReady = this.canConfirm;
      consoleColoniesUi.composerEditable = this.configLive && this.focusedRowEditable;
      // The BAR follows the act's real grammar: a build that composes gets the
      // trade's two verbs (A opens the decision, X builds) instead of the bare
      // «A Построить», which would silently commit an unanswered decision.
      consoleColoniesUi.composerDecisions = this.hasDecisions;
      // «X will open the composition step, not commit» — what relabels the
      // Configure bar's confirm to «Продолжить к оплате». True exactly while
      // the server model admits several mixes and no commit is in flight.
      consoleColoniesUi.composerMixAdjustable =
        this.tradeMixAdjustable && this.heldView === undefined;
    },
    /** The shell routes every intent here while the stage is open. */
    handleIntent(intent: GamepadIntent): void {
      // The resolution — or a commit still on the wire (`heldView`) — owns
      // the moment: input is ABSORBED, so a double submit is impossible by
      // construction (the workspace-flow 'none' verb).
      if (this.resolving || this.heldView !== undefined) {
        return;
      }
      if (intent.kind === 'nav') {
        this.onNav(intent.dir);
        return;
      }
      const action = consoleActionOf(intent);
      if (action !== undefined) {
        this.onPress(action);
      }
    },
    onNav(dir: NavDirection): void {
      if (this.sub === 'lanes') {
        this.onLanesNav(dir);
        return;
      }
      if (this.sub === 'targets') {
        this.targetNav(dir);
        return;
      }
      if (this.sub !== undefined) {
        if (dir === 'up' || dir === 'down') {
          const n = this.subListLength();
          this.subIdx = Math.min(n - 1, Math.max(0, this.subIdx + (dir === 'down' ? 1 : -1)));
        }
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.focusIdx = Math.min(this.focusables.length - 1, Math.max(0, this.focusIdx + (dir === 'down' ? 1 : -1)));
        this.scrollFocusedIntoView();
      }
    },
    onLanesNav(dir: NavDirection): void {
      const view = this.paymentView;
      if (view === undefined) {
        return;
      }
      if (dir === 'up' || dir === 'down') {
        this.subIdx = Math.min(this.payLanes.length - 1, Math.max(0, this.subIdx + (dir === 'down' ? 1 : -1)));
        return;
      }
      this.adjustPayLane(this.subIdx, dir === 'right' ? 1 : -1);
    },
    adjustPayLane(idx: number, step: number, toMax = false): void {
      const view = this.paymentView;
      const lane = this.payLanes[idx];
      if (view === undefined || lane === undefined) {
        return;
      }
      const before = this.paymentCounts[lane.unit] ?? 0;
      // AGGREGATE anti-overpay limit (the pure `dialLaneCount`) — «+» and
      // «МАКС.» both count what the other alternatives already pay.
      const next = dialLaneCount(view.cost, lane, this.payLanes, this.paymentCounts, toMax ? 'max' : step);
      if (next === before) {
        return;
      }
      this.paymentCounts = {...this.paymentCounts, [lane.unit]: next};
      this.payFlashNonce += 1;
    },
    subListLength(): number {
      if (this.sub === 'track') {
        return this.trackOptions.length;
      }
      return 0;
    },
    /** One bumper press = one unit of the energy fee moved between energy and
     *  Delta Works steel. The dial lives ONLY on the composition substep —
     *  on Configure the selector is not active, so LB/RB must be inert (a
     *  hidden control is the forbidden shape). */
    adjustTradeMix(delta: number): void {
      if (this.sub !== 'mix' || !this.tradeMixAdjustable) {
        return;
      }
      const mix = this.energyMixInfo;
      if (mix === undefined) {
        return;
      }
      const next = clampEnergyMixSteel(this.tradeSteelMix + delta, mix);
      if (next === this.tradeSteelMix) {
        return;
      }
      this.steelMixPreference = next;
      // Re-keys the one-shot pulse on the steel row — the shared payment
      // acknowledgement, so the panel and the summary move as one beat.
      this.mixFlashNonce += 1;
    },
    /**
     * CONFIGURE → PAYMENT: every obligatory decision is captured (the same
     * `canConfirm` gate the direct confirm passes) and the server model
     * admits at least two mixes. Nothing is submitted; the focus seat is
     * remembered so B lands back on the family row.
     */
    openMixStep(): void {
      this.mixReturnFocusIdx = this.focusIdx;
      this.sub = 'mix';
    },
    /** PAYMENT → CONFIGURE: B — colony, track, targets, family and the
     *  dialed draft all intact; the cursor returns where it left. */
    closeMixStep(): void {
      this.sub = undefined;
      this.focusIdx = Math.min(this.mixReturnFocusIdx, Math.max(0, this.focusables.length - 1));
      this.scrollFocusedIntoView();
    },
    onPress(action: ConsoleAction): void {
      // THE TARGET STEP SPEAKS THE SHARED SELECTOR'S GRAMMAR — A chooses,
      // X inspects the focused candidate fullscreen (never a second confirm
      // verb), LB/RB the owner axis, B one level back with the previous
      // pre-select intact. Routed before the generic sub handling: the
      // generic branch reads X as «confirm», which is exactly the collision
      // the console-wide «X = осмотреть» grammar forbids here.
      if (this.sub === 'targets') {
        switch (action) {
        case 'primary': this.targetConfirm(); return;
        case 'inspect': this.targetInspect(); return;
        case 'prevSection': this.cycleTargetOwner(-1); return;
        case 'nextSection': this.cycleTargetOwner(1); return;
        case 'back': this.closeTargetStep(); return;
        default: return;
        }
      }
      // THE COMPOSITION SUBSTEP owns its own three verbs: the dial, the same
      // final trade confirm, and B back to Configure (draft intact).
      if (this.sub === 'mix') {
        switch (action) {
        case 'prevSection':
          this.adjustTradeMix(-1);
          return;
        case 'nextSection':
          this.adjustTradeMix(1);
          return;
        case 'inspect':
          if (this.canConfirm) {
            this.emitConfirm();
          }
          return;
        case 'back':
          this.closeMixStep();
          return;
        default:
          return;
        }
      }
      switch (action) {
      // (No LB/RB on Configure: the dial belongs to the payment substep —
      // a hidden control the screen never advertised is the forbidden shape.)
      case 'primary':
        // BUILD / PICK with nothing to choose: A IS the confirm (the
        // destination slot and the grant are already shown). A build that DOES
        // ask something (its placement bonus needs a card) speaks the trade's
        // grammar instead — A opens the focused decision, X commits — so one
        // press can never mean «выбрать» and «построить» on the same screen.
        if (this.sub === undefined && (this.intent === 'pick' || this.intent === 'track' || (this.intent === 'build' && !this.hasDecisions))) {
          if (this.canConfirm) {
            this.$emit(this.intent === 'build' ? 'build-confirm' : 'pick-confirm');
          }
          return;
        }
        this.onConfirmPress();
        return;
      case 'inspect':
        // A CHOSEN TRACK's stage (TR07) and a CITY's (TR22): X is the console's ordinary «Осмотреть» — the colony's
        // dossier. The confirm here is A; there is nothing composed for X to commit.
        if ((this.intent === 'track' || this.city !== undefined) && this.sub === undefined) {
          if (!this.pastCommit) {
            this.$emit('inspect');
          }
          return;
        }
        // X = the one final confirm of a composed act (only when every
        // decision is in) — the trade, and a build that had decisions.
        if (this.sub === undefined && this.canConfirm &&
            (this.intent === 'trade' || (this.intent === 'build' && this.hasDecisions))) {
          // CONFIGURE → PAYMENT, only while the server model admits at least
          // two valid mixes of the chosen energy family; a single valid
          // allocation (and every other family) goes straight to Resolve.
          if (this.intent === 'trade' && this.tradeMixAdjustable) {
            this.openMixStep();
            return;
          }
          this.emitConfirm();
        } else if (this.sub !== undefined) {
          this.onConfirmPress();
        }
        return;
      case 'nextTab':
        if (this.sub === 'lanes') {
          this.adjustPayLane(this.subIdx, 0, true);
        }
        return;
      case 'back':
        if (this.sub !== undefined) {
          this.sub = undefined;
          return;
        }
        this.$emit('cancel');
        return;
      default:
        return;
      }
    },
    onConfirmPress(): void {
      if (this.sub === 'lanes') {
        if (this.paymentView?.status.ok === true) {
          this.sub = undefined;
        }
        return;
      }
      if (this.sub === 'track') {
        const option = this.trackOptions[this.subIdx];
        if (option !== undefined) {
          this.captures = {...this.captures, track: option.steps};
          this.sub = undefined;
        }
        return;
      }
      const focused = this.focused;
      if (focused === undefined) {
        return;
      }
      if (focused.zone === 'pay') {
        if (this.lockedPayIdx < 0) {
          this.payIdx = focused.index;
        }
        return;
      }
      const row = this.stepRows[focused.index];
      if (row === undefined) {
        return;
      }
      if (row.kind === 'payment') {
        this.sub = 'lanes';
        this.subIdx = 0;
        return;
      }
      if (row.kind === 'trackChoice') {
        this.sub = 'track';
        this.subIdx = 0;
        return;
      }
      if (row.kind === 'cardTarget') {
        this.openTargetStep();
        return;
      }
    },
    // ── the embedded TARGET STEP (the shared played-card selector) ─────────
    /**
     * DESCEND into the target step — one level deeper in the same flow. The
     * cursor lands on the previously chosen card when there is one (a
     * re-entry through «Изменить выбор» — already target-locked), else on the
     * model's own first seat. The zone is measured a tick later, when it
     * stands; the step re-solves its cards on that budget by contract.
     */
    openTargetStep(): void {
      const model = this.targetStepModel;
      const owners = model?.owners ?? [];
      if (owners.length === 0) {
        return;
      }
      this.targetFocus = findPlayedTargetFocus(this.targetLockedCard, owners) ??
        reseatPlayedTargetFocus(undefined, owners);
      if (this.targetFocus === undefined) {
        return;
      }
      this.sub = 'targets';
      void this.$nextTick(() => {
        this.measureTargetZone();
        const zone = this.$refs.targetZone as HTMLElement | undefined;
        if (zone !== undefined && zone !== null) {
          playColonyTargetStepEnter(zone);
        }
      });
    },
    /**
     * THE PANEL TAKES THE ROOM IT NEEDS — measured, because CSS cannot see it.
     *
     * The configuration lives inside a `ConsoleScrollArea` whose viewport is
     * `flex: 1` (basis 0), so its content height is invisible to every
     * ancestor: the panel stayed at its token, drew a scroll rail, and left a
     * third of the band empty above and below it (the report).
     *
     * The number published is CONTENT-DERIVED, never a delta — `panel − box +
     * content` is a FIXPOINT (applying it makes the box exactly the content,
     * and re-measuring yields the same number), so the panel neither
     * oscillates nor stays inflated once the content shrinks. `max-height:
     * 100%` still caps it: on a genuinely short host (the Deck) the scroll
     * comes back as the honest last resort.
     */
    measureFit(): void {
      if (this.fitRaf !== undefined) {
        return;
      }
      this.fitRaf = window.requestAnimationFrame(() => {
        this.fitRaf = undefined;
        const root = this.$refs.rootEl as HTMLElement | undefined;
        const surface = root?.querySelector<HTMLElement>('.con-colfocus__surface');
        if (root === undefined || root === null || surface === null || surface === undefined) {
          return;
        }
        const panelH = surface.clientHeight;
        if (panelH <= 0) {
          return;
        }
        let need = 0;
        // The configuration's own scroll area (the deep one).
        const viewport = root.querySelector<HTMLElement>('.con-colfocus__configscroll .con-scroll-area__viewport');
        const content = viewport?.querySelector<HTMLElement>('.con-scroll-area__content');
        if (viewport !== null && viewport !== undefined && content !== null && content !== undefined) {
          need = Math.max(need, panelH - viewport.clientHeight + content.scrollHeight);
        }
        // …and the SUMMARY RAIL, which has no scroller and would simply clip.
        const rail = root.querySelector<HTMLElement>('.con-colfocus__result');
        if (rail !== null && rail !== undefined) {
          need = Math.max(need, panelH - rail.clientHeight + rail.scrollHeight);
        }
        const rounded = Math.ceil(need);
        // A tolerance, so sub-pixel layout noise can never re-write the token
        // every frame (each write is a layout the next measure reads back).
        if (Math.abs(rounded - this.fitNeedPx) > 2) {
          this.fitNeedPx = rounded;
        }
      });
    },
    measureTargetZone(): void {
      const zone = this.$refs.targetZone as HTMLElement | undefined;
      if (zone === undefined || zone === null) {
        return;
      }
      // CONTENT box, not client box: `clientHeight` includes the zone's own
      // padding, and a budget fed the padding solves cards for room that does
      // not exist — a hairline scroll rail and a cropped bottom row at 4K.
      const cs = getComputedStyle(zone);
      this.targetZoneW = Math.max(0, zone.clientWidth -
        (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
      this.targetZoneH = Math.max(0, zone.clientHeight -
        (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
    },
    /**
     * B — fold ONE level back. The previous pre-select is deliberately kept:
     * closing the step is «передумал смотреть», never «передумал выбирать» —
     * a confirmed target survives every visit that ends with B.
     */
    closeTargetStep(): void {
      const zone = this.$refs.targetZone as HTMLElement | undefined;
      const drop = (): void => {
        if (this.sub === 'targets') {
          this.sub = undefined;
        }
        this.scrollFocusedIntoView();
      };
      if (zone !== undefined && zone !== null) {
        playColonyTargetStepLeave(zone, drop);
      } else {
        drop();
      }
    },
    targetNav(dir: NavDirection): void {
      const owners = this.targetStepModel?.owners ?? [];
      const focus = this.targetFocus;
      if (focus === undefined || owners.length === 0) {
        return;
      }
      const map: Record<string, PlayedTargetNavDir | undefined> =
        {left: 'left', right: 'right', up: 'up', down: 'down'};
      const d = map[dir as string];
      if (d === undefined) {
        return;
      }
      const step = this.$refs.targetStep as {cells?: () => ReadonlyArray<PlayedTargetCell>} | undefined;
      const cells = step?.cells?.() ?? [];
      const next = cells.length > 0 ?
        stepPlayedTargetFocusAt(focus, d, cells) :
        stepPlayedTargetFocus(focus, d, owners, this.targetLayout);
      if (next === undefined) {
        return; // an edge HOLDS — never a wrap, never a silent owner change
      }
      this.targetFocus = next;
      (this.$refs.targetStep as {ensureFocusVisible?: () => void} | undefined)?.ensureFocusVisible?.();
    },
    /** LB/RB — the owner axis, tabbed mode only (the shared grammar; colony
     *  targets are normally the viewer's own single group, so this is quiet). */
    cycleTargetOwner(delta: number): void {
      const owners = this.targetStepModel?.owners ?? [];
      const focus = this.targetFocus;
      if (focus === undefined || this.targetLayout.mode !== 'tabs' || owners.length < 2) {
        return;
      }
      const ownerId = stepPlayedTargetOwner(focus.ownerId, delta, owners);
      if (ownerId !== focus.ownerId) {
        this.targetFocus = reseatPlayedTargetFocus({ownerId, index: 0}, owners) ?? focus;
      }
    },
    /** A — lock the focused candidate in as this step's target and return to
     *  the trade review. The capture is the SAME shape the batch always sent
     *  (`{type:'card', cards:[name]}` downstream) — the selector is
     *  presentation, never a second source of truth. */
    targetConfirm(): void {
      const owners = this.targetStepModel?.owners ?? [];
      const candidate = playedTargetAt(this.targetFocus, owners);
      const key = this.activeTargetKey;
      if (candidate === undefined || key === '') {
        return;
      }
      this.captures = {...this.captures, [key]: candidate.cardName};
      this.closeTargetStep();
    },
    /** X — the focused candidate fullscreen, lifting from its own slot (the
     *  console-wide «X inspects the current object»). */
    targetInspect(): void {
      const owners = this.targetStepModel?.owners ?? [];
      const candidate = playedTargetAt(this.targetFocus, owners);
      if (candidate === undefined) {
        return;
      }
      const cards = owners.flatMap((o) => o.candidates.map((c) => c.model));
      const at = Math.max(0, cards.findIndex((c) => c.name === candidate.cardName));
      openConsoleCardZoom(cards, at, undefined, undefined, {
        // The explicit root ref, never `this.$el`: a root-level template
        // comment makes the dev build a fragment whose $el is a Comment node.
        origin: playedTargetZoomOrigin(
          () => this.$refs.rootEl as HTMLElement | undefined,
          (i) => cards[i]?.name ?? '',
          playedTargetSourceCardName(owners)),
      });
    },
    /**
     * THE CONFIG HALF of the boundary snapshot — what the working area
     * PRESENTS from here on. Two callers: the shell's accept (the ordinary
     * path) and the stage's own commit latch (the one that cannot be missed).
     */
    /**
     * The receipt's base for the snapshot. Before the server's answer the live
     * models ARE the pre-trade state — read them and leave them with the trade
     * transaction, which outlives this instance. Past the answer (a stage
     * MOUNTING mid-resolution) the live models already hold the payout, so the
     * transaction's remembered base is the truth; with nothing remembered the
     * live read is the honest degrade.
     */
    boundaryReceipt(): TradeReceiptBase {
      const remembered = colonyTradeReceiptBase(this.colony.name);
      if (remembered !== undefined) {
        return remembered;
      }
      const live = tradeReceiptBaseOf(this.thisPlayer, this.players);
      noteColonyTradeReceiptBase(this.colony.name, live);
      return live;
    },
    pinConfig(): void {
      const held: PayEntry | undefined = this.payEntries[this.payIdx];
      const mix = this.energyMixInfo;
      this.heldView = {
        mode: this.presentMode,
        available: this.presentAvailable,
        payment: held === undefined ? undefined : {
          ...held,
          ...(mix !== undefined ?
            {mix: {energy: Math.max(0, mix.cost - this.tradeSteelMix), steel: this.tradeSteelMix}} :
            {}),
        },
        // …AND THE SERVER'S OWN INPUTS. Everything the working area derives
        // comes from these two, so pinning them is what makes the whole zone
        // stop describing the NEXT trade the moment this one is answered
        // (see `HeldView`).
        options: this.options.slice(),
        disabledOptions: this.disabledOptions.slice(),
        preview: this.preview,
        tradeOffset: this.tradeOffset + this.chosenPathOffset,
        receipt: this.boundaryReceipt(),
      };
      this.pinnedConfig = this.heldView;
    },
    /** The presented-target helpers (the resolution scene). */
    landedOf(t: ColonyTradePresentedTarget): number {
      // ONE tally for every payout shape — the transfer framework's own
      // contact record, so a TRADE reward and a BUILD bonus tick identically.
      return this.landings.by[t.card] ?? 0;
    },
    presentedModelOf(t: ColonyTradePresentedTarget): CardModel {
      const live = this.players
        .flatMap((p) => p.tableau)
        .find((c) => c.name === t.card);
      return presentedTargetModel(t, live, this.landedOf(t));
    },
    clearCardlandDwell(): void {
      if (this.cardlandDwell !== undefined) {
        window.clearTimeout(this.cardlandDwell);
        this.cardlandDwell = undefined;
      }
    },
    /** ⚠️ Separate from the dwell on purpose: several paths clear the dwell and
     *  re-arm it without touching `cardlandReleased`, and killing a DEPARTURE
     *  there would strand the card on stage with no edge left to restart it. */
    clearCardlandLeave(): void {
      if (this.cardlandLeave !== undefined) {
        window.clearTimeout(this.cardlandLeave);
        this.cardlandLeave = undefined;
      }
    },
    /**
     * A fresh preview re-judges every capture (the invalidation half of the
     * pre-select contract): a target no longer offered is dropped, a track
     * step that vanished releases its choice, and a target sub whose step
     * disappeared folds back to the review.
     */
    pruneStaleCaptures(): void {
      const next: Record<string, unknown> = {...this.captures};
      let changed = false;
      const keys = this.stepKeys;
      this.steps.forEach((step, i) => {
        const key = keys[i];
        if (step.kind !== 'cardTarget') {
          return;
        }
        const captured = next[key];
        if (typeof captured === 'string' && !step.pick.cards.some((c) => c.name === captured)) {
          delete next[key];
          changed = true;
        }
      });
      // Captures whose STEP is gone entirely (a re-shaped preview).
      const live = new Set(keys);
      for (const key of Object.keys(next)) {
        if ((key.startsWith('target:') || key === 'track') && !live.has(key)) {
          delete next[key];
          changed = true;
        }
      }
      if (changed) {
        this.captures = next;
      }
      if (this.sub === 'targets' && this.activeTargetStep === undefined) {
        this.sub = undefined;
      }
    },
    rowMissing(row: StepRow): boolean {
      if (row.kind === 'trackChoice') {
        return this.captures['track'] === undefined;
      }
      if (row.kind === 'cardTarget') {
        return this.captures[row.key] === undefined;
      }
      if (row.kind === 'payment') {
        return this.paymentView !== undefined && !this.paymentView.status.ok;
      }
      return false;
    },
    scrollFocusedIntoView(): void {
      void this.$nextTick(() => {
        const el = this.$refs.focusedEl as HTMLElement | Array<HTMLElement> | undefined;
        // A focused PAY row lives in the shared rows component — it hands its own element over.
        const payRow = (this.$refs.payRows as {focusedEl?: () => HTMLElement | undefined} | undefined)?.focusedEl?.();
        const node = payRow ?? (Array.isArray(el) ? el[0] : el);
        (this.$refs.scroll as {ensureVisible?: (el: Element | null | undefined) => void} | undefined)?.ensureVisible?.(node);
      });
    },
    emitConfirm(): void {
      const capturesByIndex: Record<number, unknown> = {};
      this.steps.forEach((step, i) => {
        const key = this.stepKeys[i];
        if (step.kind === 'payment') {
          const view = this.paymentView;
          const player = this.thisPlayer;
          if (view !== undefined && player !== undefined) {
            capturesByIndex[i] = paymentFromCounts(view.cost, this.payLanes, this.paymentCounts, megacreditsAvailable(player));
          }
        } else if (step.kind === 'energyMix') {
          // The linked Delta Works dial always holds a valid answer (the
          // clamped steel share; energy is the remainder) — captured like the
          // M€ payment, so the mix prompt never surfaces standalone.
          capturesByIndex[i] = this.tradeSteelMix;
        } else if (this.captures[key] !== undefined) {
          capturesByIndex[i] = this.captures[key];
        }
      });
      const payload = {
        paymentIndex: this.payIdx,
        steps: this.steps,
        captures: capturesByIndex,
        targets: this.cardDestinations.targets,
      };
      // ONE payload shape, two acts: the build's own confirm carries the very
      // same pre-collected steps, so the shell answers both with one batch
      // builder and both land their reward on the card the player chose.
      this.$emit(this.intent === 'build' ? 'build-confirm' : 'confirm', payload);
    },
    /**
     * The follow-up's stage handoff, in the shared grammar: the configuration
     * lets go ON THE SPOT, the outcome zone opens FROM ITS RECT, and the
     * teleported content surfaces from inside once it actually lands. The
     * origin is armed at the commit, while the configuration still stands.
     */
    /** ARM the handoff once per zone session: the POSE (`--handing`, which is
     *  what takes the track out from under the payout) plus — when there is a
     *  surface to release — the release phrase. One writer, three callers (the
     *  cue's edge, the mount, the next cycle's zone). */
    armOutcomeHandoff(due: boolean): void {
      if (!due || this.outcomeHandoffPlayed) {
        return;
      }
      this.outcomeHandoffPlayed = true;
      this.playOutcomeHandoff();
    },
    playOutcomeHandoff(): void {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || root === null) {
        return;
      }
      playConfigRelease(root);
      void this.$nextTick(() => playOutcomePhase(root, () => undefined));
    },
    /** THE COMMIT BOUNDARY: pin what the stage shows before the props flip
     *  (the answer removes the pick / spends the trade while the resolution
     *  still plays HERE). Called by the SHELL only after ITS guards accepted
     *  the confirm (a hold with no submit behind it would gate input forever
     *  — the transaction that releases it would never start). Released by
     *  the transaction's falling edge. */
    /**
     * THE COMMIT DID NOT HOLD (a refused answer; the server re-asked the
     * pick live): the pinned presentation lets go, so the stage is a door
     * again — its verdict, its confirm and its configuration re-derive from
     * the live props. Nothing of a move was shown, so nothing is undone.
     */
    releasePresentation(): void {
      this.heldView = undefined;
      this.pinnedConfig = undefined;
      this.commitLatched = false;
      this.publishStageName();
      this.syncUiMirror();
    },
    holdPresentation(): void {
      // Arm the outcome origin while the configuration surface still stands —
      // its rect is what the follow-up's zone will unfold from.
      // The WORKING AREA is what hands over — the identity column stays, so
      // the follow-up opens from the track/config box, not from the whole
      // panel (an origin larger than the zone clips to nothing and the unfold
      // silently degrades into a fade).
      armOutcomeOriginFrom(this.$refs.mainEl as HTMLElement | undefined);
      // A mix fee pins the ACTUAL dialed composition into the held row — the
      // entry's own preview is the energy-first default and would misreport
      // a commit that spends steel.
      this.pinConfig();
      // THE PRESENTED TARGETS — snapshotted AT the boundary, like everything
      // else in the held view: the server's answer will rewrite the preview
      // and the tableau under the resolution, and the scene must keep showing
      // the decision as it was made («было → прилетело → стало»).
      this.presentedTargets = this.cardDestinations.presented;
      this.cardlandReleased = false;
      this.clearCardlandDwell();
      this.clearCardlandLeave();
    },
  },
  mounted() {
    this.measureFit();
    // The RESPONSIVE path: the band itself changing (a profile switch, the
    // rail lifting, a font settling) — never a manual window listener.
    const root = this.$refs.rootEl as HTMLElement | undefined;
    if (root !== undefined && root !== null) {
      this.stopFitObs = useResizeObserver(root, () => this.measureFit()).stop;
    }
    this.seedPaymentDefault();
    this.syncLockedPayment();
    this.publishStageName();
    this.syncUiMirror();
  },
  beforeUnmount() {
    this.stopFitObs?.();
    this.stopFitObs = undefined;
    if (this.fitRaf !== undefined) {
      window.cancelAnimationFrame(this.fitRaf);
      this.fitRaf = undefined;
    }
    consoleColoniesUi.composerSub = '';
    consoleColoniesUi.composerReady = false;
    consoleColoniesUi.composerEditable = false;
    consoleColoniesUi.composerDecisions = false;
    consoleColoniesUi.composerMixAdjustable = false;
    // A stage that is GONE hides nothing: the closing beat must never wait on
    // a screen that no longer exists (the discard closes this stage mid-flow,
    // and the reset then plays on the restored one — or on the overview tile).
    if (this.stageBackTimer !== undefined) {
      window.clearTimeout(this.stageBackTimer);
      this.stageBackTimer = undefined;
    }
    this.clearCardlandDwell();
    this.clearCardlandLeave();
    colonyResolutionUi.cardSceneLive = false;
    setColonyStageYielded(false);
  },
});
</script>
