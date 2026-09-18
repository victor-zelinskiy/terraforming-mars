<template>
  <!-- «ПАРЛАМЕНТ» — the Mars Parliament workspace (Turmoil Redux).

       ONE FLOW, one screen, and a GAME SCREEN — not a rulebook. The overview
       is THREE INSTRUMENTS under one fixed head line: the GOVERNMENT (the
       enacted resolution as the main object, the ruling party's printed
       effect readable beside it, the chairman quest), the VOTING AREA (ONE
       zone: three resolution cards in the order that breaks ties — the
       closest to the government first — with the delegates on each, who
       leads, which one wins now) and the six PARTIES as one row of plaques
       whose centre is their printed mechanic. The HEAD LINE carries the
       crumb («Парламент › Осмотр» / «› Голосование») in a reserved width and,
       at fixed coordinates in EVERY mode, the DELEGATES ZONE — every
       player's lobby place and reserve (the ONE place the delegates are
       counted), the neutral supply and the deck. The AGENDA track is a
       read-only instrument. Nothing here explains a general rule — the
       fullscreen inspector (X) does, on the object asked.

       THE VOTE MODE is a PHASE DESCENT of this frame: A on the voting area
       opens it INSIDE the same screen. The three cards are the continuity —
       the very same slot elements are TELEPORTED into the vote row and FLIP
       there from their overview rects (one DOM instance each, so a second
       copy cannot exist); the head line and the delegates zone do not move;
       an info surface unfolds under the row explaining the SELECTED card —
       its OWN effect as the main block, its party's effect and the quest it
       sets beside it — and, kept apart, what THIS VOTE changes right now
       with the delegate's source and price on the confirm. ◀ ▶ switch the
       card, X inspects it, A sends the delegate (its cube leaves the zone's
       real place and lands on the card's ribbon; the counters tick on the
       touchdown), B folds the same phrase back with every object returning
       home.

       A PARTY ACTION is not a stage of this screen: A on a party nests the
       action workspace (`parliament ⊃ card-actions`) — the ONE execution
       point every party action has, whichever door opened it.

       Nothing here re-derives a rule: availability is the PRESENCE of the
       server's own option in the action menu (found by its structural marker),
       the numbers are the server's projections, and a submit is the
       byte-identical response the live prompt expects. -->
  <section class="con-parl con-ws"
           :class="{
             'con-parl--handed-over': sceneHandedOver,
             'con-parl--stage': stageUp,
             'con-parl--vote': voteUp,
             'con-parl--vote-leaving': voteLeaving,
             'con-parl--flying': flights.length > 0 || cardFlights.length > 0,
             ['con-parl--zone-' + zone]: true,
             ['con-parl--recap-' + recapHighlight]: stage === 'recap' && recapHighlight !== '',
           }"
           ref="rootEl"
           role="region"
           :aria-label="$t('Parliament')"
           :data-zone="zone"
           :data-stage="stage">
    <ConsoleWsHead class="con-parl__head"
                   root="Parliament"
                   emblem="parliament"
                   wheelAnchor="parliament"
                   :subject="crumbSubject"
                   :subjectRaw="crumbSubjectRaw"
                   :stage="crumbStage"
                   :committed="crumbCommitted">
      <!-- THE DELEGATES ZONE — the ONE ledger of every player's places: the
           lobby's single socket (the free delegate waits there, or it is
           spent) and the reserve as a stack with its count; the NEUTRAL supply
           beside them (no lobby of its own); the deck last. It lives in the
           head's TRAILING region, whose left edge is the crumb's RESERVED
           width — so the groups stand at the same screen coordinates in the
           overview and in the vote mode, left-aligned, and never re-centre
           when a count or a word changes. Every delegate's flight leaves from
           these very places in both modes. -->
      <template #trailing>
        <div class="con-parl__seats" data-parl-seats data-parl-zone>
          <div v-for="seat in seats" :key="seat.color" class="con-parl__seat"
               :class="{'con-parl__seat--me': seat.color === viewerColor}"
               :data-parl-seat="seat.color">
            <span class="con-parl__seat-ident">
              <PlayerCube :color="seat.color" :size="cubePx(11)" :glow="false" />
              <span class="con-parl__seat-name">{{ seat.name }}</span>
            </span>
            <span class="con-parl__seat-place" :class="{'con-parl__seat-place--source': seatSourceOf(seat) === 'lobby'}" data-parl-seat-place="lobby">
              <span class="con-parl__seat-key">{{ $t('Lobby') }}</span>
              <span class="con-parl__seat-obj">
                <span class="con-parl__socket con-parl__socket--seat" :class="{'con-parl__socket--empty': !seat.lobby}" :data-parl-seat-lobby="seat.color">
                  <PlayerCube v-if="seat.lobby" :color="seat.color" :size="cubePx(RIBBON_CUBE)" :glow="false" />
                </span>
              </span>
            </span>
            <span class="con-parl__seat-place" :class="{'con-parl__seat-place--source': seatSourceOf(seat) === 'reserve'}" data-parl-seat-place="reserve">
              <span class="con-parl__seat-key">{{ $t('Reserve') }}</span>
              <span class="con-parl__seat-obj">
                <span class="con-parl__stack con-parl__stack--seat" :class="{'con-parl__stack--empty': seat.reserveCubes === 0}" :data-parl-seat-reserve="seat.color" :data-count="seat.reserveCubes">
                  <span v-for="n in Math.min(seat.reserveCubes, 3)" :key="n" class="con-parl__stack-cube" :data-stack="n">
                    <PlayerCube :color="seat.color" :size="cubePx(RIBBON_CUBE)" :glow="false" />
                  </span>
                </span>
                <b :key="'sr' + seat.reserve" class="con-parl__seat-count con-parl__tick">×{{ seat.reserve }}</b>
              </span>
            </span>
          </div>
          <div class="con-parl__seat con-parl__seat--neutral" data-parl-neutral-pool>
            <span class="con-parl__seat-ident">
              <PlayerCube color="neutral" steel :size="cubePx(11)" :glow="false" />
              <span class="con-parl__seat-name">{{ $t('Neutral') }}</span>
            </span>
            <span class="con-parl__seat-place" data-parl-seat-place="neutral">
              <span class="con-parl__seat-key">{{ $t('Reserve') }}</span>
              <span class="con-parl__seat-obj">
                <span class="con-parl__stack con-parl__stack--seat" :class="{'con-parl__stack--empty': neutralSupplyShown === 0}" data-parl-neutral-cube :data-count="neutralSupplyShown">
                  <span v-for="n in Math.min(neutralSupplyShown, 3)" :key="n" class="con-parl__stack-cube" :data-stack="n">
                    <PlayerCube color="neutral" steel :size="cubePx(RIBBON_CUBE)" :glow="false" />
                  </span>
                </span>
                <b :key="'n' + neutralSupplyShown" class="con-parl__seat-count con-parl__tick">×{{ neutralSupplyShown }}</b>
              </span>
            </span>
          </div>
          <!-- THE DECK — a PHYSICAL pile at the zone's end: the top back (the
               card.webp every console back wears), slim edges of the cards
               beneath (tiered by the count — one card shows no edge, an empty
               deck a ghost) and the count beside it. The results scene deals
               the fresh resolutions FROM this top card, so the pile and its
               count keep the pre-deal reading until each card has left. -->
          <div class="con-parl__seat con-parl__seat--deck" data-parl-deck>
            <span class="con-parl__seat-place">
              <span class="con-parl__seat-key">{{ $t('Resolution deck') }}</span>
              <span class="con-parl__seat-obj">
                <span class="con-parl__deck" :class="{'con-parl__deck--empty': deckShown === 0}" :data-count="deckShown" data-parl-deck-pile aria-hidden="true">
                  <span v-if="deckLayers >= 2" class="con-parl__deck-layer con-parl__deck-layer--2"></span>
                  <span v-if="deckLayers >= 1" class="con-parl__deck-layer con-parl__deck-layer--1"></span>
                  <span class="con-parl__deck-top" data-parl-deck-top></span>
                </span>
                <b :key="'d' + deckShown" class="con-parl__seat-count con-parl__tick">×{{ deckShown }}</b>
              </span>
            </span>
          </div>
        </div>
      </template>
    </ConsoleWsHead>

    <!-- THE FIELD — the overview's body and, over it, the vote mode's layer. -->
    <div class="con-parl__field">
    <div class="con-parl__body" ref="bodyEl">
      <!-- ══ TOP TIER: the GOVERNMENT · the VOTING AREA ══ -->
      <div class="con-parl__top">
        <!-- ── THE GOVERNMENT — the enacted resolution is the MAIN OBJECT;
             beside it the RULING PARTY with its printed effect LARGE (one
             caption: it is every player's), and — apart from it — the enacted
             resolution's OWN standing effect when it has one; under both, the
             chairman quest. ── -->
        <div class="con-parl__gov"
             :class="{
               'con-parl__gov--focus': zone === 'government' && stage === 'browse',
               'con-parl__gov--recap': stage === 'recap' && (recapHighlight === 'enacted' || recapHighlight === 'winner'),
               'con-parl__gov--enacted': view.enacted !== undefined,
             }"
             :style="{'--parl-accent': partyAccent(view.rulingParty)}"
             data-parl-gov
             data-parl-recede>
          <div class="con-parl__gov-head">
            <span class="con-parl__kicker">{{ $t('Government') }}</span>
            <!-- While the enactment's effect waits on ANOTHER seat, the basis
                 line says who and what for (the asked seat's own input kind —
                 a card pick, a placement, a decision); otherwise the basis. -->
            <span v-if="phaseWaitText !== ''" class="con-parl__gov-basis con-parl__gov-basis--waiting" data-parl-phase-wait>{{ phaseWaitText }}</span>
            <span v-else class="con-parl__gov-basis" :class="{'con-parl__gov-basis--default': view.enacted === undefined}">
              {{ $t(view.enacted === undefined ? 'Starting rule' : 'Enacted resolution') }}
            </span>
          </div>
          <div class="con-parl__ruling">
            <!-- The enacted card is ONE instance: while the resolution pays out it
                 is TELEPORTED onto the enactment stage's hero slot (and FLIPs
                 there and back) — never a copy beside the government. -->
            <Teleport v-if="enactedVm !== undefined" defer to="[data-parl-enact-hero]" :disabled="!enactCarried">
              <div class="con-parl__gov-carry" data-parl-gov-carry>
                <div class="con-parl__gov-card"
                     :class="{'con-parl__gov-card--awaiting': recapPending.govAwaits !== undefined && recapPending.govAwaits === view.enacted?.instance}"
                     :data-zoom-slot="'resolution:' + view.enacted?.resolutionId">
                  <premium-card-face :vmOverride="enactedVm" :lightweight="!enactCarried" :inert="true" />
                </div>
              </div>
            </Teleport>
            <!-- The ENACTED slot stands empty until the first political phase:
                 an honest empty seat, never a placeholder card. -->
            <div v-else class="con-parl__gov-empty" data-parl-gov-empty>
              <span class="con-parl__gov-empty-mark" aria-hidden="true">◇</span>
              <span class="con-parl__gov-empty-text">{{ $t('No resolution enacted yet') }}</span>
            </div>
            <!-- THE RULER — the identity line, then the effect everyone holds
                 while the party rules: its printed formula LARGE, one caption.
                 The resolution's OWN standing effect (when it has one) is a
                 separate row under its own mark — two sources, told apart. -->
            <div class="con-parl__ruler" :data-zoom-slot="partyKeyOf(view.rulingParty)" data-parl-ruler ref="rulerEl">
              <div class="con-parl__ruler-ident">
                <img class="con-parl__ruler-emblem" :src="emblemUrl(view.rulingParty)" alt="" />
                <div class="con-parl__ruler-text">
                  <span class="con-parl__ruler-kicker">{{ $t('Ruling party') }}</span>
                  <span class="con-parl__ruler-title">
                    <b class="con-parl__ruler-name">{{ $t(view.rulingParty) }}</b>
                    <!-- Whose the effect is — beside the name, never a caption a panel away. -->
                    <span class="con-parl__ruler-scope">{{ $t('Available to every player') }}</span>
                  </span>
                </div>
              </div>
              <!-- The mechanic: its printed graphic, and under it the ONE short
                   reading the catalog carries for it (the full sentences are
                   the inspector's). Centred together in the plate's height. -->
              <div class="con-parl__ruler-body">
                <ConsolePartyFormula class="con-parl__ruler-formula" :party="view.rulingParty" size="wide" />
                <p v-if="rulingSummary !== undefined" class="con-parl__ruler-summary" data-parl-ruler-summary>{{ $t(rulingSummary) }}</p>
              </div>
              <div v-if="enactedOwnMechanics !== undefined" class="con-parl__ruler-own" data-parl-enacted-effect>
                <span class="con-parl__ruler-own-kicker"><i class="con-parl__card-mark resource_icon resource_icon--cards" aria-hidden="true"></i>{{ $t('Resolution effect') }}</span>
                <PremiumMechanicsPanel class="con-parl__ruler-own-mech" :mechanics="enactedOwnMechanics" />
              </div>
            </div>
          </div>

          <!-- THE CHAIRMAN QUEST: the printed condition (a graphic + its short
               words), the race per seat, the reward as two things — the SEAT
               and ONE STEP of the Agenda (with what the viewer's next step
               pays) — and the chairman. -->
          <div v-if="view.quest !== undefined" class="con-parl__quest"
               :class="{'con-parl__quest--done': view.quest.completedBy !== undefined, 'con-parl__quest--pulse': questPulse}"
               data-parl-quest>
            <div class="con-parl__quest-head">
              <span class="con-parl__kicker">{{ $t('Chairman quest') }}</span>
              <span v-if="view.quest.completedBy !== undefined" class="con-parl__quest-state">✓ {{ $t('Completed') }}</span>
            </div>
            <div class="con-parl__quest-cond">
              <PremiumMechanicsPanel v-if="questMechanics !== undefined && !questMechanics.textOnly" class="con-parl__quest-graphic" :mechanics="questMechanics" />
              <span class="con-parl__quest-text">{{ $t(view.quest.text) }}</span>
            </div>
            <div v-if="view.quest.completedBy === undefined" class="con-parl__quest-progress" data-parl-quest-progress>
              <span v-for="row in questRows" :key="row.color" class="con-parl__quest-row"
                    :class="{'con-parl__quest-row--me': row.color === viewerColor, 'con-parl__quest-row--close': row.value > 0 && row.value >= view.quest.definition.count - 1}">
                <PlayerCube :color="row.color" :size="cubePx(12)" />
                <b :key="row.value" class="con-parl__tick">{{ row.value }}</b><span class="con-parl__quest-of">/{{ view.quest.definition.count }}</span>
              </span>
            </div>
            <div class="con-parl__quest-foot">
              <span class="con-parl__quest-reward" data-parl-quest-reward>
                <span class="con-parl__quest-reward-kicker">{{ $t(view.quest.completedBy !== undefined ? 'Won by' : 'Reward') }}</span>
                <template v-if="view.quest.completedBy !== undefined">
                  <PlayerCube :color="view.quest.completedBy" :size="cubePx(12)" />
                  <b>{{ nameOf(view.quest.completedBy) }}</b>
                </template>
                <template v-else>
                  <span class="con-parl__reward-seat" :class="{'con-parl__reward-seat--kept': viewerIsChairman}">
                    <span class="con-parl__seat-glyph" aria-hidden="true"></span>{{ $t(viewerIsChairman ? 'Seat (kept)' : 'Seat') }}
                  </span>
                  <span class="con-parl__reward-plus" aria-hidden="true">+</span>
                  <span class="con-parl__reward-move">{{ $t('1 step') }}</span>
                  <template v-if="agendaVm.nextStep !== undefined">
                    <span class="con-parl__reward-arrow" aria-hidden="true">→</span>
                    <span class="con-parl__reward-step" :class="'con-parl__reward-step--' + agendaVm.nextStep.kind" data-parl-reward-step>
                      <template v-if="agendaVm.nextStep.kind === 'influence'"><span class="con-parl__step-level">{{ agendaVm.nextStep.influence }}</span></template>
                      <template v-else-if="agendaVm.nextStep.kind === 'tr'"><i class="con-parl__step-res resource_icon resource_icon--rating" aria-hidden="true"></i></template>
                      <template v-else><i class="con-parl__step-res resource_icon resource_icon--cards" aria-hidden="true"></i></template>
                    </span>
                  </template>
                </template>
              </span>
              <span class="con-parl__chair" :class="{'con-parl__chair--won': view.quest.completedBy !== undefined && view.quest.completedBy === view.chairman, 'con-parl__chair--pulse': chairPulse}" data-parl-chair>
                <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
                <template v-if="view.chairman !== undefined">
                  <!-- The SEAT's cube — the place the chairman's delegate flies to. -->
                  <span class="con-parl__chair-cube" :data-parl-seat-chair="view.chairman"><PlayerCube :color="view.chairman" :size="cubePx(12)" /></span>
                  <b>{{ nameOf(view.chairman) }}</b>
                </template>
                <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
              </span>
            </div>
          </div>
          <div v-else class="con-parl__chair con-parl__chair--alone" :class="{'con-parl__chair--pulse': chairPulse}" data-parl-chair>
            <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
            <template v-if="view.chairman !== undefined">
              <span class="con-parl__chair-cube" :data-parl-seat-chair="view.chairman"><PlayerCube :color="view.chairman" :size="cubePx(12)" /></span>
              <b>{{ nameOf(view.chairman) }}</b>
            </template>
            <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
          </div>
        </div>

        <!-- ── THE VOTING AREA — ONE focus zone: three resolutions in the order
             that breaks ties (the first stands closest to the government), the
             delegates on each in placement order, the leader, the winning card
             (ONE accent: its badge and its gold seam — never a second line).
             Its slots are the vote mode's cards too: each is one DOM instance,
             teleported into the vote row while the mode stands. ── -->
        <div class="con-parl__voting"
             :class="{
               'con-parl__voting--focus': zone === 'voting' && stage === 'browse',
               'con-parl__voting--carried': voteUp || voteLeaving,
               'con-parl__voting--recap': stage === 'recap' && recapHighlight === 'refresh',
             }"
             data-parl-voting>
          <div class="con-parl__voting-head" data-parl-recede>
            <span class="con-parl__kicker">{{ $t('Voting') }}</span>
          </div>
          <div class="con-parl__slots">
            <div v-for="(slot, i) in view.slots" :key="slot.instance" class="con-parl__slot-home" :data-home="slot.instance">
              <Teleport defer to="[data-parl-vrow]" :disabled="!slotsCarried">
                <div class="con-parl__slot"
                     :class="{
                       'con-parl__slot--selected': slotsCarried && slotIndex === i,
                       'con-parl__slot--winning': winningShownOf(slot),
                       'con-parl__slot--target': (stage === 'seat' || (stage === 'submitting' && stageBeforeSubmit === 'seat')) && slotIndex === i,
                       'con-parl__slot--candidate': stage === 'seat' && seatCandidates.includes(i),
                       'con-parl__slot--mine': tallyOf(slot, i).leader !== undefined && tallyOf(slot, i).leader === viewerColor,
                       'con-parl__slot--landed': landedSeq !== undefined && slot.votes.some((v) => v.seq === landedSeq),
                     }"
                     :style="{'--parl-accent': partyAccent(slot.party)}"
                     :data-instance="slot.instance"
                     :data-party="slot.party"
                     :data-order="slot.tiePriority"
                     :data-votes="slot.totalVotes">
                  <div class="con-parl__slot-label">
                    <img class="con-parl__slot-emblem" :src="emblemUrl(slot.party)" alt="" />
                    <span class="con-parl__slot-party">{{ $t(slot.party) }}</span>
                    <span v-if="winningShownOf(slot)" class="con-parl__slot-win" :class="{'con-parl__slot-win--glyph': partyNameLong(slot.party)}"><span class="con-parl__slot-win-text">{{ $t('Winning') }}</span></span>
                  </div>
                  <div class="con-parl__card"
                       :class="{'con-parl__card--dealing': dealingFaces.has(slot.instance)}"
                       :data-zoom-slot="'resolution:' + slot.resolutionId"
                       :data-zoom-handoff="slotsCarried && slotIndex === i ? 'parliament-vote' : undefined"
                       :data-parl-vote-card="slotsCarried && slotIndex === i ? '' : undefined">
                    <premium-card-face v-if="slotVms[i] !== undefined" :vmOverride="slotVms[i]" :lightweight="true" :inert="true" />
                  </div>
                  <!-- THE DELEGATE RIBBON — every delegate on the card, in placement
                       order (the order that breaks a tie among players), and — in
                       the vote mode, on the selected card — the PLACE the next
                       delegate takes (hollow until it lands: a forecast, never a
                       placement). -->
                  <div class="con-parl__ribbon" :class="{'con-parl__ribbon--dense': slot.votes.length > DENSE_RIBBON}" :data-votes="slot.totalVotes" :data-parl-vote-ribbon="slotsCarried && slotIndex === i ? '' : undefined">
                    <template v-if="slot.votes.length <= DENSE_RIBBON">
                      <span v-for="vote in slot.votes" :key="vote.seq" class="con-parl__vote-cube"
                            :class="{'con-parl__vote-cube--landed': vote.seq === landedSeq, 'con-parl__vote-cube--hidden': vote.seq === flightSeq || recapHiddenCubes.has(slot.instance + '#' + vote.seq)}"
                            :data-seq="vote.seq"
                            :data-landed="vote.seq === landedSeq ? '' : undefined">
                        <PlayerCube v-if="vote.owner !== 'neutral'" :color="vote.owner" :size="cubePx(RIBBON_CUBE)" />
                        <PlayerCube v-else color="neutral" steel :size="cubePx(RIBBON_CUBE)" />
                      </span>
                    </template>
                    <template v-else>
                      <span v-for="group in ribbonGroups(slot)" :key="group.owner" class="con-parl__vote-stack"
                            :class="{'con-parl__vote-stack--landed': group.hasSeq(landedSeq)}"
                            :data-seq="group.seqs[group.seqs.length - 1]">
                        <PlayerCube v-if="group.owner !== 'neutral'" :color="group.owner" :size="cubePx(RIBBON_CUBE)" />
                        <PlayerCube v-else color="neutral" steel :size="cubePx(RIBBON_CUBE)" />
                        <b>×{{ group.count }}</b>
                      </span>
                    </template>
                    <span v-if="placeShownOn(i)" class="con-parl__vote-cube con-parl__vote-cube--place" data-parl-vote-place aria-hidden="true"></span>
                    <span v-if="slot.votes.length === 0 && !placeShownOn(i)" class="con-parl__ribbon-empty">{{ $t('No delegates yet') }}</span>
                  </div>
                  <!-- THE TALLY — TWO FIXED LINES for every slot: «N delegates ·
                       leader», then «yours ○○ n» with the two places of the
                       party-effect threshold — the same rows at the same heights
                       whatever the count, so no card ever moves because its
                       neighbour's line wrapped. In flight, the selected card's
                       numbers wait for the touchdown. -->
                  <div class="con-parl__tally" data-parl-tally>
                    <span class="con-parl__tally-line">
                      <span class="con-parl__tally-total">
                        <b :key="'t' + tallyOf(slot, i).votes" class="con-parl__tally-num con-parl__tick">{{ tallyOf(slot, i).votes }}</b>
                        <span class="con-parl__tally-unit">{{ delegatesWord(tallyOf(slot, i).votes) }}</span>
                      </span>
                      <span v-if="tallyOf(slot, i).leader !== undefined" class="con-parl__tally-row con-parl__tally-row--leader" data-parl-leader>
                        <span class="con-parl__tally-key">{{ $t('Leader') }}</span>
                        <PlayerCube v-if="tallyOf(slot, i).leader !== 'neutral'" :color="tallyOf(slot, i).leader" :size="cubePx(12)" :glow="false" />
                        <PlayerCube v-else color="neutral" steel :size="cubePx(12)" :glow="false" />
                      </span>
                      <span v-else class="con-parl__tally-row con-parl__tally-row--none">{{ $t('No leader yet') }}</span>
                    </span>
                    <span class="con-parl__tally-line con-parl__tally-line--mine">
                      <span v-if="viewerParticipates && viewerColor !== undefined" class="con-parl__tally-row con-parl__tally-row--mine"
                            :class="{'con-parl__tally-row--held': tallyOf(slot, i).mine >= PARTY_EFFECT_THRESHOLD}" data-parl-mine>
                        <span class="con-parl__tally-key">{{ $t('Yours') }}</span>
                        <span class="con-parl__places" aria-hidden="true">
                          <span v-for="n in PARTY_EFFECT_THRESHOLD" :key="n" class="con-parl__place" :class="{'con-parl__place--on': n <= tallyOf(slot, i).mine}">
                            <PlayerCube v-if="n <= tallyOf(slot, i).mine" :color="viewerColor" :size="cubePx(10)" :glow="false" />
                          </span>
                        </span>
                        <b :key="'m' + tallyOf(slot, i).mine" class="con-parl__tick">{{ tallyOf(slot, i).mine }}</b>
                        <span v-if="tallyOf(slot, i).mine >= PARTY_EFFECT_THRESHOLD" class="con-parl__tally-held">{{ $t('effect is yours') }}</span>
                      </span>
                    </span>
                  </div>
                </div>
              </Teleport>
            </div>
            <!-- AN EMPTY SLOT NAMES ITSELF. While few parties have real
                 resolutions the refresh finds nothing for a slot (distinct
                 parties, never the ruling one's) and leaves it EMPTY: the same
                 anatomy as a slot, a card-shaped outline where a card would
                 stand and one line that says why — never an unexplained hole.
                 A card enacted from this position still leaves from HERE. -->
            <div v-for="n in emptySlotCount" :key="'empty-' + n" class="con-parl__slot-home con-parl__slot-home--empty" data-parl-slot-empty>
              <div class="con-parl__slot-empty">
                <div class="con-parl__slot-label">
                  <span class="con-parl__slot-party">{{ $t('Empty slot') }}</span>
                </div>
                <div class="con-parl__slot-empty-card" data-parl-slot-empty-card aria-hidden="true"></div>
                <span class="con-parl__slot-empty-reason">{{ $t(emptySlotReason) }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ MIDDLE TIER — the PARTIES (browse) or a STAGE (the seat pick, the
           results) — ONE zone, one rect. ══ -->
      <div class="con-parl__mid" ref="midEl" data-parl-mid data-parl-recede>
        <div class="con-parl__parties-tier" ref="partiesTierEl" :class="{'con-parl__parties-tier--parked': stageUp}" v-show="!stageUp || stageLeaving">
          <div class="con-parl__parties" data-parl-parties>
            <div v-for="(p, i) in view.parties" :key="p.party"
                 class="con-parl__party"
                 :class="[
                   'con-parl__party--' + partyStates[i].kind,
                   {
                     'con-parl__party--focus': zone === 'parties' && partyIndex === i && stage === 'browse',
                     'con-parl__party--held': partyStates[i].held,
                     'con-parl__party--recap': stage === 'recap' && recapHighlight === 'support' && (recapCurrent?.parties ?? []).includes(p.party),
                     'con-parl__party--pulse': accessPulse === p.party || usedPulse === p.party,
                     'con-parl__party--lost': accessLost === p.party,
                   },
                 ]"
                 :data-party="p.party"
                 :data-party-state="partyStates[i].kind"
                 :data-action-state="partyActionStates[i].kind">
              <ConsolePartyPlaque :party="p.party"
                                  size="tile"
                                  :state="partyStates[i]"
                                  :actionState="partyActionStates[i]"
                                  :support="supportShown(p)"
                                  :viewerColor="viewerColor"
                                  :formula="true"
                                  :focused="zone === 'parties' && partyIndex === i && stage === 'browse'"
                                  :reason="zone === 'parties' && partyIndex === i && stage === 'browse' ? partyLine : ''"
                                  :reasonTone="partyLineTone" />
            </div>
          </div>
        </div>

        <!-- ── THE STAGE ZONE — the chairman SEAT pick and the RESULTS scene
             unfold in place of the parties tier. ── -->
        <transition :css="false" @enter="onStageEnter" @leave="onStageLeave" @enter-cancelled="onStageEnterCancelled" @leave-cancelled="onStageLeaveCancelled">
          <div v-if="stageUp" class="con-parl__stage" :class="'con-parl__stage--' + stage" :data-parl-stage="stage" ref="stageEl">
            <!-- CHAIRMAN SEAT -->
            <template v-if="stageKind === 'seat' && focusedSlot !== undefined">
              <div class="con-parl__stage-head">
                <div>
                  <b class="con-parl__stage-title">{{ $t('You completed the chairman quest') }}</b>
                  <span class="con-parl__stage-sub">{{ $t('Every delegate of yours is on a resolution — choose which one gives a delegate up for the seat.') }}</span>
                </div>
                <span class="con-parl__stage-nav" aria-hidden="true">◀ ▶</span>
              </div>
              <div class="con-parl__stage-body">
                <div class="con-parl__txn">
                  <div class="con-parl__txn-row">
                    <span class="con-parl__chip-dim">{{ $t('Resolution') }}</span>
                    <b>{{ $t(resolutionTitle(focusedSlot.resolutionId)) }}</b>
                  </div>
                  <div class="con-parl__txn-row">
                    <span class="con-parl__chip-dim">{{ $t('Your delegates there') }}</span>
                    <b>{{ focusedSlot.viewerVotes }} → {{ focusedSlot.viewerVotes - 1 }}</b>
                  </div>
                  <div class="con-parl__txn-row">
                    <span class="con-parl__chip-dim">{{ $t('Chairman seat') }}</span>
                    <span class="con-parl__txn-val"><PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="cubePx(12)" /><b>{{ $t('yours') }}</b></span>
                  </div>
                </div>
              </div>
              <div class="con-parl__cta" :class="{'con-parl__cta--ready': stage === 'seat', 'con-parl__cta--busy': stage === 'submitting'}" data-parl-cta @click="submitSeat()">
                <GamepadGlyph control="confirm" class="con-parl__cta-glyph" />
                <span class="con-parl__cta-label">{{ $t(stage === 'submitting' ? 'Performing…' : 'Take the delegate') }}</span>
              </div>
            </template>

            <!-- RESULTS — the previous generation's political phase, one beat per
                 line; each line lights the object it changed and MOVES the
                 delegates it moved. -->
            <template v-else-if="stage === 'recap'">
              <div class="con-parl__stage-head con-parl__stage-head--recap">
                <div>
                  <b class="con-parl__stage-title">{{ recapKicker }}</b>
                  <span class="con-parl__stage-sub">{{ $t('What the Parliament decided at the end of the generation') }}</span>
                </div>
                <div class="con-parl__cta con-parl__cta--ready con-parl__cta--inline" data-parl-cta @click="finishRecap()">
                  <GamepadGlyph control="confirm" class="con-parl__cta-glyph" />
                  <span class="con-parl__cta-label">{{ $t('Continue') }}</span>
                </div>
              </div>
              <ol class="con-parl__recap-list" data-parl-recap-list>
                <li v-for="(item, i) in recapItems" :key="item.key"
                    class="con-parl__recap-item"
                    :class="{'con-parl__recap-item--shown': i <= recapBeat, 'con-parl__recap-item--now': i === recapBeat}"
                    :data-focus="item.focus">{{ item.text }}</li>
              </ol>
            </template>

            <!-- SUBMITTING (the seat) — the executing beat: sent, nothing to undo. -->
            <template v-else-if="stage === 'submitting'">
              <div class="con-parl__stage-head">
                <div><b class="con-parl__stage-title">{{ $t('Recording your decision…') }}</b></div>
              </div>
            </template>
            <div class="con-parl__embed" data-embed-slot="parliament"></div>
          </div>
        </transition>
      </div>

      <!-- ══ THE AGENDA — a read-only graphic track: the markers, the influence
           LEVELS, the TR and card rewards, the viewer's next step. Never a
           focus stop; it moves when a marker moves. ══ -->
      <div class="con-parl__agenda" data-parl-agenda data-parl-recede>
        <div class="con-parl__agenda-head">
          <span class="con-parl__kicker">{{ $t('Agenda') }}</span>
          <span v-if="view.viewer !== undefined" class="con-parl__agenda-me">
            <PlayerCube :color="view.viewer.color" :size="cubePx(12)" :glow="false" />
            <span class="con-parl__chip-dim">{{ $t('Influence') }}</span>
            <!-- The influence BADGE — the same asset the resolution faces print
                 in their formulas, so «влияние» reads as one symbol everywhere. -->
            <i class="con-parl__inf-icon" aria-hidden="true"></i>
            <b :key="'ai' + agendaVm.viewerInfluence" class="con-parl__tick">{{ agendaVm.viewerInfluence }}</b>
            <span class="con-parl__agenda-next">
              <span class="con-parl__chip-dim">{{ $t(agendaVm.nextStep === undefined ? 'end of the track' : 'next step') }}</span>
              <span v-if="agendaVm.nextStep !== undefined" class="con-parl__reward-step" :class="'con-parl__reward-step--' + agendaVm.nextStep.kind">
                <template v-if="agendaVm.nextStep.kind === 'influence'"><span class="con-parl__step-level">{{ agendaVm.nextStep.influence }}</span></template>
                <template v-else-if="agendaVm.nextStep.kind === 'tr'"><i class="con-parl__step-res resource_icon resource_icon--rating" aria-hidden="true"></i></template>
                <template v-else><i class="con-parl__step-res resource_icon resource_icon--cards" aria-hidden="true"></i></template>
              </span>
            </span>
          </span>
        </div>
        <!-- THE SCALE — every step is TWO fixed rows: the NODE (the symbol,
             optically centred on the rail) and the MARKER row beneath it
             (reserved whether or not a cube stands there, so a marker's
             arrival moves no symbol). The rail is drawn by the steps' own
             half-segments, so the viewer's PASSED part is tinted exactly up to
             their node; the CURRENT node reads by its marker and its reached
             fill, the NEXT one wears a light gold ring — never a focus ring. -->
        <div class="con-parl__track">
          <div class="con-parl__step con-parl__step--start" :class="{'con-parl__step--here': viewerParticipates && agendaVm.viewerPosition === 0, 'con-parl__step--passed': viewerParticipates && agendaVm.viewerPosition > 0}" data-step="0">
            <span class="con-parl__step-node"><span class="con-parl__step-label">{{ $t('Agenda start') }}</span></span>
            <span class="con-parl__step-cubes" data-agenda-markers="0">
              <span v-for="color in agendaVm.start" :key="color" class="con-parl__agenda-cube"
                    :class="{'con-parl__agenda-cube--hidden': agendaHidden !== undefined && agendaHidden.step === 0 && agendaHidden.color === color}"
                    :data-agenda-cube="color">
                <PlayerCube :color="color" :size="cubePx(12)" :glow="false" />
              </span>
            </span>
          </div>
          <div v-for="step in agendaVm.steps" :key="step.index" class="con-parl__step"
               :class="['con-parl__step--' + step.step.kind, {
                 'con-parl__step--recap': stage === 'recap' && recapHighlight === 'agenda' && recapCurrent?.step === step.index,
                 'con-parl__step--next': step.viewerNext,
                 'con-parl__step--here': step.viewerHere,
                 'con-parl__step--passed': viewerParticipates && step.index < agendaVm.viewerPosition,
                 'con-parl__step--pulse': agendaPulseStep === step.index,
               }]"
               :data-step="step.index">
              <span class="con-parl__step-node">
                <template v-if="step.step.kind === 'influence'"><span class="con-parl__step-level">{{ step.step.influence }}</span></template>
                <template v-else-if="step.step.kind === 'tr'"><i class="con-parl__step-res con-parl__step-res--tr resource_icon resource_icon--rating" aria-hidden="true"></i></template>
                <template v-else><i class="con-parl__step-res con-parl__step-res--card resource_icon resource_icon--cards" aria-hidden="true"></i></template>
              </span>
              <span class="con-parl__step-cubes" :data-agenda-markers="step.index">
                <span v-for="color in step.cubes" :key="color" class="con-parl__agenda-cube"
                      :class="{'con-parl__agenda-cube--hidden': agendaHidden !== undefined && agendaHidden.step === step.index && agendaHidden.color === color}"
                      :data-agenda-cube="color">
                  <PlayerCube :color="color" :size="cubePx(12)" :glow="false" />
                </span>
              </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ THE VOTE MODE — the frame's PHASE DESCENT, as a layer over the body.
         Always mounted (it is the teleport target of the three slots — a target
         that exists before the slots do); visible while the mode stands. The
         head line above (crumb + delegates zone) does not move. ══ -->
    <div class="con-parl__vote"
         :class="{
           'con-parl__vote--up': voteUp || voteLeaving,
           'con-parl__vote--committed': voteCommitted,
           'con-parl__vote--landed': stage === 'landed',
           'con-parl__vote--paying': stage === 'paying',
           'con-parl__vote--bill': billGeometry,
           'con-parl__vote--concluded': concluded,
           'con-parl__vote--entering': voteEntering,
         }"
         :style="{'--parl-accent': voteSlot !== undefined ? partyAccent(voteSlot.party) : undefined}"
         :aria-hidden="voteUp ? undefined : 'true'"
         :data-parl-vote-source-kind="voteSource"
         data-parl-vote
         ref="voteEl">
      <!-- THE CARD ROW — the slots stand here while the mode is up (fewer
           than three stand centred at their usual size). -->
      <div class="con-parl__vrow" data-parl-vrow ref="vrowEl" :style="{'--con-parl-slot-count': String(Math.max(1, view.slots.length))}"></div>

      <!-- THE INFO SURFACE — ONE NUMBER (`voteInfoModel.ts`): what the
           SELECTED card gives the viewer if enacted (left) and what THIS vote
           changes (right). Fixed geometry: the bodies crossfade in place when
           the selection moves; nothing above them ever reflows. Every sentence
           and every «if» lives in the fullscreen inspector (X), never here. -->
      <div class="con-parl__info" data-parl-vote-surface>
        <div class="con-parl__info-res">
          <transition name="con-parl-xfade">
            <!-- Always MOUNTED (the layer hides it): the press that opens the mode
                 then moves the cards and lifts the surface — it builds nothing. -->
            <div v-if="voteInfo !== undefined" :key="voteInfo.instance" class="con-parl__info-body" data-parl-vote-body>
              <div class="con-parl__info-head" data-parl-vote-item>
                <img class="con-parl__info-emblem" :src="emblemUrl(voteInfo.party)" alt="" />
                <b class="con-parl__info-name">{{ $t(voteInfo.name) }}</b>
                <span v-if="voteInfo.winning" class="con-parl__slot-win">{{ $t('Winning') }}</span>
              </div>
              <!-- THE READING — the card's printed graphic as the formula, the
                   viewer's ONE number beside it (the estimate by the current
                   influence; what the win adds rides it as a suffix), and the
                   ruling party's answer to that number. A viewer without a
                   seat reads the graphic alone. -->
              <div class="con-parl__info-own" :class="{'con-parl__info-own--yields': voteInfo.reading.yields.length > 0}" data-parl-vote-item data-parl-info="own">
                <span class="con-parl__info-kicker" data-parl-kicker="reading" data-parl-vote-late>{{ $t(voteInfo.reading.kicker) }}</span>
                <div class="con-parl__info-own-body">
                  <PremiumMechanicsPanel v-if="ownMechanics !== undefined" class="con-parl__info-mech" :mechanics="ownMechanics" />
                  <div v-if="voteInfo.reading.yields.length > 0" class="con-parl__info-readings" data-parl-vote-late>
                    <ConsoleInfluenceYield class="con-parl__info-yield"
                                           :yields="voteInfo.reading.yields"
                                           :suffixes="voteInfo.reading.suffixes"
                                           :formula="false"
                                           :captions="false"
                                           :oneNumber="true"
                                           :note="voteInfo.reading.note"
                                           size="compact"
                                           data-parl-vote-yield
                                           data-parl-vote-reading />
                    <ConsolePartyReaction v-for="r in voteInfo.reading.reactions" :key="r.reaction.id"
                                          class="con-parl__info-reaction"
                                          :reading="r"
                                          :withCaption="false"
                                          size="compact"
                                          data-parl-vote-reaction />
                  </div>
                </div>
              </div>
            </div>
          </transition>
        </div>
        <div class="con-parl__info-vote">
          <div class="con-parl__info-vote-main" v-show="stage !== 'paying'">
            <transition name="con-parl-xfade">
              <div v-if="voteInfo !== undefined" :key="voteInfo.instance" class="con-parl__info-body con-parl__info-body--vote">
                <!-- YOUR VOTE — ONE block: the delegate at its place with its
                     source and price (only when there is one to send — a
                     missing delegate is the confirm's one reason, never said
                     twice), then this vote's consequences as current →
                     projected (a fact that does not change is ONE value): the
                     leader, the winning state, and the party effect only on
                     the edge this delegate crosses. The count is the ribbon
                     under the card; every note is the inspector's. -->
                <div class="con-parl__info-block con-parl__info-block--after" :class="{'con-parl__info-block--done': stage === 'landed'}" data-parl-vote-item data-parl-vote-forecast>
                  <div class="con-parl__info-src" :class="{'con-parl__info-src--none': voteInfo.vote.source === 'none'}" data-parl-vote-source>
                    <span class="con-parl__info-kicker con-parl__info-kicker--inline" data-parl-kicker="vote" data-parl-vote-late>{{ $t(voteInfo.vote.kicker) }}</span>
                    <template v-if="voteInfo.vote.source !== 'none'">
                      <span class="con-parl__socket con-parl__socket--small">
                        <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="cubePx(12)" :glow="false" />
                      </span>
                      <span class="con-parl__info-src-text" data-parl-vote-late>
                        <template v-if="voteInfo.vote.source === 'lobby'">{{ $t('from the lobby · free') }}</template>
                        <template v-else>
                          <span>{{ $t('from the reserve') }}</span>
                          <span class="con-parl__info-src-sep" aria-hidden="true">·</span>
                          <b class="con-parl__info-src-num">{{ voteInfo.vote.cost }}</b>
                          <i class="con-parl__info-src-mc resource_icon resource_icon--megacredits" aria-hidden="true"></i>
                        </template>
                      </span>
                    </template>
                  </div>
                  <div class="con-parl__facts">
                    <div v-for="fact in voteInfo.vote.facts" :key="fact.id"
                         class="con-parl__fact"
                         :class="{'con-parl__fact--gain': fact.tone === 'gain', 'con-parl__fact--dim': fact.tone === 'none'}"
                         :data-parl-fact="fact.id"
                         :data-parl-fact-tone="fact.tone"
                         data-parl-vote-late>
                      <span class="con-parl__fact-key">{{ $t(fact.label) }}</span>
                      <!-- A fact that does not change is ONE value — an arrow to the same reading is noise on a decision line.
                           The leader's «before» is its cube alone (a dash without one). -->
                      <span class="con-parl__fact-val">
                        <template v-if="!fact.unchanged">
                          <template v-if="fact.id === 'lead'">
                            <PlayerCube v-if="fact.before.cube !== undefined && fact.before.cube !== 'neutral'" :color="fact.before.cube" :size="cubePx(11)" :glow="false" />
                            <PlayerCube v-else-if="fact.before.cube === 'neutral'" color="neutral" steel :size="cubePx(11)" :glow="false" />
                            <span v-else class="con-parl__fact-none">—</span>
                          </template>
                          <b v-else>{{ factText(fact.before) }}</b>
                          <span class="con-parl__fact-arrow" aria-hidden="true">→</span>
                        </template>
                        <template v-if="fact.after.cube !== undefined">
                          <PlayerCube v-if="fact.after.cube !== 'neutral'" :color="fact.after.cube" :size="cubePx(11)" :glow="false" />
                          <PlayerCube v-else color="neutral" steel :size="cubePx(11)" :glow="false" />
                        </template>
                        <b :class="{'con-parl__fact-after': !fact.unchanged}">{{ factText(fact.after) }}</b>
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>
          <!-- A paid vote's PAYMENT stands here, inside the mode. -->
          <div class="con-parl__embed" data-embed-slot="parliament-vote"></div>
          <!-- THE CONFIRM — the verb and, beside it, the delegate's SOURCE and
               PRICE (the lobby's is free; the reserve's costs the server's own
               M€), read from the same vote option the submit answers. Blocked,
               the plate carries the ONE reason. -->
          <div class="con-parl__cta"
               :class="{
                 'con-parl__cta--ready': canVoteNow && stage === 'vote',
                 'con-parl__cta--blocked': !canVoteNow && stage === 'vote',
                 'con-parl__cta--busy': stage === 'submitting' || stage === 'paying' || (stage === 'landed' && voteInFlight),
                 'con-parl__cta--done': stage === 'landed' && !voteInFlight,
               }"
               data-parl-vote-item data-parl-cta @click="submitVote()">
            <GamepadGlyph v-if="stage === 'vote' && canVoteNow" control="confirm" class="con-parl__cta-glyph" />
            <span class="con-parl__cta-label">{{ ctaText }}</span>
            <span v-if="stage === 'vote' && canVoteNow && ctaCost.kind !== 'none'" class="con-parl__cta-cost" :class="'con-parl__cta-cost--' + ctaCost.kind" data-parl-cta-cost :data-cost-kind="ctaCost.kind">
              <template v-if="ctaCost.kind === 'free'">{{ $t('from the lobby · free') }}</template>
              <template v-else>
                <span class="con-parl__cta-cost-src">{{ $t('from the reserve') }}</span>
                <span class="con-parl__cta-cost-sep" aria-hidden="true">·</span>
                <b class="con-parl__cta-cost-num">{{ ctaCost.amount }}</b>
                <i class="con-parl__cta-cost-mc resource_icon resource_icon--megacredits" aria-hidden="true"></i>
              </template>
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ THE ENACTMENT (Turmoil Redux) — the political phase pays the enacted
         resolution's effect and asks THIS seat where its share goes. ALWAYS
         MOUNTED (the vote layer's law): the press builds nothing, and the
         teleport targets exist from the first frame. One scene over the field:
         the ENACTED CARD itself (carried from the government) with the payout
         reading under it — influence → the server's own amount — and the
         SHARED recipient picker in its own zone (the very `ConsoleTaskHost`
         every add-resource prompt uses, teleported by the shell). The crumb
         names the stage; nothing here titles itself. B minimizes the whole
         workspace (the hosted picker's own verb). ══ -->
    <div class="con-parl__enact"
         :class="{'con-parl__enact--up': enactUp}"
         :style="{'--parl-accent': view.enacted !== undefined ? partyAccent(view.enacted.party) : undefined}"
         :aria-hidden="enactUp ? undefined : 'true'"
         data-parl-enact
         ref="enactEl">
      <div class="con-parl__enact-hero">
        <div class="con-parl__enact-card" data-parl-enact-hero></div>
        <ConsoleInfluenceYield v-if="enactYields.length > 0" class="con-parl__enact-yield" :yields="enactYields" size="hero" data-parl-enact-yield data-parl-enact-item />
        <ConsolePartyReaction v-for="r in enactReactions" :key="r.reaction.id"
                              class="con-parl__enact-reaction"
                              :reading="r"
                              size="normal"
                              data-parl-enact-reaction
                              data-parl-enact-item />
      </div>
      <div class="con-parl__enact-zone" data-parl-enact-item>
        <div class="con-parl__embed con-parl__embed--enact" data-embed-slot="parliament-enact"></div>
      </div>
    </div>
    </div>

    <!-- THE DELEGATE FLIGHTS — cubes on their way from a real place to a real
         place (a shell-level fixed layer, measured rects, one proxy per cube). -->
    <Teleport to="body">
      <div v-for="f in flights" :key="f.id" class="con-parl__flight" :ref="(el) => setFlightEl(f.id, el as HTMLElement | null)" :data-parl-flight="f.id" aria-hidden="true">
        <PlayerCube v-if="f.color !== 'neutral'" :color="f.color" :size="f.size" />
        <PlayerCube v-else color="neutral" steel :size="f.size" />
      </div>
      <!-- A RESOLUTION being dealt: the deck's back, born on the pile's top
           card and grown into its slot (the face reveals on the touchdown). -->
      <div v-for="f in cardFlights" :key="f.id" class="con-parl__flight con-parl__flight--card" :class="{'con-parl__flight--face': f.face !== undefined}" :style="{width: f.width + 'px', height: f.height + 'px'}" :ref="(el) => setFlightEl(f.id, el as HTMLElement | null)" :data-parl-flight="f.id" :data-parl-flight-face="f.face?.name" aria-hidden="true">
        <span v-if="f.face === undefined" class="con-parl__cardback"></span>
        <!-- THE ENACTED CARD on its way from the voting area to the government:
             the ONE visible instance while it moves (its slot is empty, the
             government's face waits hidden until the touchdown). -->
        <div v-else class="con-parl__flight-face" :style="{zoom: f.width / 320}">
          <premium-card-face :vmOverride="f.face" :lightweight="true" :inert="true" />
        </div>
      </div>
    </Teleport>
    <!-- THE AGENDA MARKER in motion — the Hydronetwork's marker director on the
         Parliament's track: from the step it left to the step it reached. -->
    <Teleport to="body">
      <div v-if="agendaFlight !== undefined" class="con-parl__flight con-parl__flight--agenda" ref="agendaFlightEl" aria-hidden="true">
        <PlayerCube :color="agendaFlight.color" :size="cubePx(12)" :glow="false" />
      </div>
    </Teleport>
  </section>
</template>
<script lang="ts">
import {defineComponent, markRaw, PropType} from 'vue';
import {gsap} from 'gsap';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {PartyName} from '@/common/turmoil/PartyName';
import {Resource} from '@/common/Resource';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectCardModel, SelectPaymentModel, VotePaymentMeta} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ParliamentEnactOutcomeModel, ParliamentModel} from '@/common/models/ParliamentModel';
import {PARLIAMENT_VOTE_COST, PARLIAMENT_VOTING_SLOTS, PARTY_EFFECT_DELEGATES as PARTY_EFFECT_THRESHOLD, PartyActionId, ReduxParty} from '@/common/parliament/ParliamentTypes';
import {IClientResolution} from '@/common/parliament/IClientResolution';
import {InfluenceYield} from '@/common/parliament/influenceScaling';
import {
  cardResourcePluralKey, enactedYieldsOf, productionResourceLabelKey, resolvingYieldOf, scaledEffectForCardResource, scaledEffectOf,
  yieldCountPresentation,
} from '@/client/console/parliament/influenceYieldModel';
import {FactValue, voteFactsOf, VoteFactsVm, voteInfoOf, VoteInfoVm} from '@/client/console/parliament/voteInfoModel';
import {runResourceTransfers} from '@/client/console/resourceTransfer/consoleResourceTransfer';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsolePartyReaction from '@/client/components/console/parliament/ConsolePartyReaction.vue';
import {externalDrawTakeOf} from '@/client/console/externalDraw/consoleExternalDraw';
import {PartyReactionReading, partyReactionsOf, viewerHasSeat} from '@/client/console/parliament/partyReactionModel';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {consoleParliamentUi, markParliamentRecapSeen, parliamentRecapSeen} from '@/client/console/consoleParliamentState';
import {isMandatoryGateHeld} from '@/client/console/consoleMandatoryGate';
import {
  agendaViewOf, AgendaVm, buildParliamentView, ParliamentPartyVm, ParliamentPromptBridge,
  ParliamentSlotVm, ParliamentTileVm, ParliamentViewVm, parliamentPromptBridge, partyActionStateOf, PartyActionStateVm,
  partyStateOf, PartyStateVm, seatResponse, voteForecastOf, VoteForecastVm, voteResponse, voteVerbOf, VoteVerbVm,
} from '@/client/console/parliament/consoleParliamentModel';
import {partyTileKey} from '@/client/console/parliament/partyActionKey';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {
  descendWorkspaceFrame, foldWorkspaceFrame, setWorkspaceFramePhase, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameHasNested,
  workspaceFrameKnown,
} from '@/client/console/consoleWorkspaceStack';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {useResizeObserver} from '@vueuse/core';
import {consoleLayoutState, conUiScale} from '@/client/console/consoleLayoutProfile';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';
import {offTurnReason} from '@/client/console/offTurnReason';
import {motionMs} from '@/client/components/motion/motionTokens';
import {armDescendOrigin, armDescendRect, descendSurfaceInset, guardedDescend} from '@/client/console/surfaceMotion/workspaceDescend';
import {armActionFocusOrigin} from '@/client/console/consoleActionFocusMotion';
import {
  CubeFlightHandle, killParliamentVoteMotion, measureVoteRects, parkParliamentBody, playParliamentVoteEnter, playParliamentVoteLeave, playParliamentVoteRefit,
  Rect, restoreParliamentBody, runCardDealFlight, runDelegateCubeFlight,
} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {HydroMarkerDirectorHandle, runHydroMarkerGlide} from '@/client/console/hydroMarker/hydroMarkerDirector';
import {
  enactCarryRect, killParliamentEnactMotion, parkParliamentForEnact, playParliamentEnactEnter, playParliamentEnactFold,
} from '@/client/console/parliament/consoleParliamentEnactMotion';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

type Zone = 'voting' | 'government' | 'parties';
/**
 * `vote` — the decision mode (a phase descent); `submitting` — sent;
 * `paying` — a paid vote's payment stands inside the mode; `landed` — the
 * answer arrived: the delegate settles on the card before the flow leaves.
 * `seat` — the chairman's mandatory pick; `recap` — the RESULTS scene.
 */
type Stage = 'browse' | 'vote' | 'seat' | 'submitting' | 'paying' | 'landed' | 'recap' | 'enact';

/** The delegate's landing beat (the cube settles, the counters tick). */
const VOTE_LANDING_MS = 700;
/** THE CONCLUSION — the landed scene lets go as one picture (a class fade) before the workspace leaves. */
const VOTE_CONCLUDE_MS = 220;
/** The delegate's flight from its bench place to the card. */
const VOTE_FLIGHT_MS = 540;
/** A results-scene cube's flight. */
const RECAP_FLIGHT_MS = 480;
/** One results beat: the next line lights and the object it names flashes / moves. */
const RECAP_BEAT_MS = 1000;
/** The seat / recap stage's unfold / fold. */
const STAGE_UNFOLD_MS = 300;
const STAGE_FOLD_MS = 220;
/** A ribbon past this many delegates collapses into per-owner stacks. */
const DENSE_RIBBON = 12;
/** ONE cube size for every delegate on a card and on the bench (logical px) — the flight scales by 1. */
const RIBBON_CUBE = 15;

/** A marker's move along the Agenda track: whose, from which step, to which. */
type AgendaMove = {player: Color, from: number, to: number};

/** A results beat: what the sentence says, and which object on the board it points at. */
type RecapItem = {
  key: string;
  text: string;
  focus: 'winner' | 'enacted' | 'agenda' | 'support' | 'refresh' | 'lobby';
  step?: number;
  parties?: ReadonlyArray<ReduxParty>;
  /** The Agenda beat PLAYS the winner's marker along the track. */
  move?: AgendaMove;
  /** An effect beat: the server's record it reads (a production / stock gain of the viewer flies). */
  outcome?: ParliamentEnactOutcomeModel;
};

/** How long a submit may stay unanswered before the stage gives the player back their hands. */
const SUBMIT_SAFETY_MS = 6000;

/* THE CARD FIT. The premium face is px-designed (`--pcard-w/h`) and integrates
   through `zoom`; the zones it stands in are sized by the FRAME, never by the
   cards — so the fit budgets from the zone minus its MEASURED chrome and
   never reads its own output. */
const PCARD_W = 320;
const PCARD_H = 460;
/** The overview's cards stop here so the vote mode can GROW them (never shrink the object the player picked up). */
const MAX_CARD_ZOOM = 0.8;
/** …and a step lower on the couch: the 4K mode's card is HEIGHT-bound (its band and tally rows are taller in rem), so the size step the mode owes is bought on the overview's side. */
const MAX_CARD_ZOOM_TV = 0.75;
const MIN_CARD_ZOOM = 0.3;
/** The enacted face — the government's MAIN object. */
const MAX_GOV_ZOOM = 0.72;
const MIN_GOV_ZOOM = 0.2;
/** The payout stage's carried card — the scene's hero, beside the recipient zone. */
const MAX_ENACT_ZOOM = 1.05;
/** …and at most this share of the layer's width (the recipient zone is the decision). */
const ENACT_HERO_SHARE = 0.3;
/** The vote row's cards. */
const MAX_VOTE_ZOOM = 1.05;
const MIN_VOTE_ZOOM = 0.35;

/**
 * The inspector's request: WHAT to open (a list the viewer pages through, in
 * the order the cards physically stand), WHERE each card physically stands
 * (it lifts out of that element and returns into it), who follows the paging
 * (`onBrowse` — the vote mode's selection), and — from the vote mode — the A
 * verb: the vote mode's OWN reading of «send the delegate» for the card on
 * screen and the vote mode's own submit (one operation, two doors).
 */
export type ParliamentInspectRequest =
  | {
    kind: 'resolution',
    ids: ReadonlyArray<string>,
    index: number,
    origin?: (index: number) => HTMLElement | null,
    onBrowse?: (index: number) => void,
    vote?: {verbAt: (index: number) => VoteVerbVm | undefined, execute: (index: number) => void},
  }
  | {kind: 'party', party: ReduxParty, origin?: () => HTMLElement | null};

type RibbonGroup = {owner: Color | 'neutral', count: number, seqs: ReadonlyArray<number>, hasSeq: (seq: number | undefined) => boolean};

/** A player's group on the delegates zone: the lobby socket, the reserve's cubes (shown) and its count (said). */
type SeatRow = {color: Color, name: string, lobby: boolean, reserve: number, reserveCubes: number, chairman: boolean};

/** The vote's numbers at the SUBMIT — the mode reads these until the delegate has landed (and the source the delegate leaves from). */
type VoteSnapshot = {votes: number, mine: number, leader: Color | 'neutral' | undefined, winning: boolean, winner: string | undefined, source: 'lobby' | 'reserve'};

type FlightSpec = {id: string, color: Color | 'neutral', size: number};
/** A card back on its way from the deck to a slot — sized to the slot's face (the proxy scales up into it). */
type CardFlightSpec = {id: string, width: number, height: number, face?: PremiumCardVM};
/** One dealt card's flight (the deck's top → its slot). */
const DEAL_FLIGHT_MS = 560;
const DEAL_STAGGER_MS = 150;

/** The confirm's price line: the lobby's delegate is free, the reserve's costs the server's own M€. */
type CtaCost = {kind: 'free' | 'cost' | 'none', amount: number};

/** The results scene's DISPLAY HOLDS — what the ledger, the plaques, the ribbons and the supply still show until each cube has physically moved. */
type RecapPending = {
  /** Delegates that left the enacted card and have not reached their reserve / the supply yet. */
  returns: Map<Color | 'neutral', number>;
  /** Popular-support cubes that have not left their party's places yet (party → count). */
  support: Map<ReduxParty, number>;
  /** Neutral cubes on a fresh card that have not arrived yet (`instance#seq`). */
  hiddenCubes: Set<string>;
  /** Players whose free delegate has not reached the lobby yet. */
  lobby: Set<Color>;
  /** Fresh resolutions whose card has not been dealt from the deck yet (their faces stay hidden). */
  freshFaces: Set<string>;
  /** Cards the deck still SHOWS on its pile (dealt in the model, not yet flown). */
  deckPending: number;
  /** The ENACTED card whose government face waits until it has moved in from its voting slot (its instance). */
  govAwaits: string | undefined;
  /** The proxy (flight id) of that card, parked over its former voting slot until the enactment beat. */
  parked: string | undefined;
};

function emptyRecapPending(): RecapPending {
  return {returns: new Map(), support: new Map(), hiddenCubes: new Set(), lobby: new Set(), freshFaces: new Set(), deckPending: 0, govAwaits: undefined, parked: undefined};
}

/** The enacted card's move from its voting slot to the government. */
const ENACT_MOVE_MS = 620;

export default defineComponent({
  name: 'ConsoleParliamentSection',
  components: {ConsoleWsHead, PlayerCube, GamepadGlyph, PremiumMechanicsPanel, ConsolePartyPlaque, ConsolePartyFormula, ConsoleInfluenceYield, ConsolePartyReaction},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    myTurn: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
  },
  emits: ['close', 'submit', 'notice', 'inspect', 'open-action', 'flow-complete', 'collapse'],
  data() {
    return {
      DENSE_RIBBON,
      PARTY_EFFECT_THRESHOLD,
      RIBBON_CUBE,
      zone: 'voting' as Zone,
      stage: 'browse' as Stage,
      /** The seat / recap stage is folding back — its DOM stays for the leave beat. */
      stageLeaving: false,
      /** The cursor inside the voting area: the vote mode's SELECTED card, the seat pick's candidate, the viewer's start. */
      slotIndex: 0,
      partyIndex: 0,
      /** The stage the submit left — restored if the server refuses. */
      stageBeforeSubmit: 'browse' as Stage,
      submitTimer: undefined as number | undefined,
      /** The server's answer key at the submit — the answer is whatever changes it. */
      submittedKey: '',
      stopFitObs: undefined as (() => void) | undefined,
      /** The vote mode's entrance is playing — A is not a confirm yet. */
      voteEntering: false,
      /** The vote mode is folding back — its layer stays visible for the phrase. */
      voteLeaving: false,
      /** The vote's numbers at the submit (undefined = not sent yet). */
      voteSnapshot: undefined as VoteSnapshot | undefined,
      /** The bench keeps painting the source cube until its proxy stands over it. */
      sourceHold: undefined as 'lobby' | 'reserve' | undefined,
      /** …and the bench's WORDS (the lobby's note, the reserve's count) follow the cube only once it has visibly left its place. */
      sourceLeaving: undefined as 'lobby' | 'reserve' | undefined,
      /** The vote that just landed (its `seq`) — the cube the landing beat animates. */
      landedSeq: undefined as number | undefined,
      /** The vote whose cube is IN FLIGHT (hidden on the ribbon until the handoff). */
      flightSeq: undefined as number | undefined,
      flights: [] as Array<FlightSpec>,
      cardFlights: [] as Array<CardFlightSpec>,
      flightEls: {} as Record<string, HTMLElement | null>,
      flightHandles: {} as Record<string, CubeFlightHandle>,
      flightSerial: 0,
      landingTimer: undefined as number | undefined,
      concludeTimer: undefined as number | undefined,
      /** The landed scene is dissolving — the flow's last beat before the workspace leaves. */
      concluded: false,
      landingHold: undefined as AnimationHold | undefined,
      flightHold: undefined as AnimationHold | undefined,
      /** The chairman-seat pick: the cube's rect on the card at the submit (the flight's source). */
      seatFrom: undefined as Rect | undefined,
      chairPulse: false,
      chairTimer: undefined as number | undefined,
      /** The results scene's current beat (−1 = not playing). */
      recapBeat: -1,
      recapTimers: [] as Array<number>,
      recapPending: emptyRecapPending() as RecapPending,
      accessPulse: undefined as ReduxParty | undefined,
      accessLost: undefined as ReduxParty | undefined,
      accessTimer: undefined as number | undefined,
      usedPulse: undefined as ReduxParty | undefined,
      usedTimer: undefined as number | undefined,
      agendaPulseStep: undefined as number | undefined,
      agendaTimer: undefined as number | undefined,
      /** The marker in motion along the Agenda track (a body-level proxy). */
      agendaFlight: undefined as {color: Color} | undefined,
      /** The real cube the gliding proxy stands in for — hidden until the lock. */
      agendaHidden: undefined as {color: Color, step: number} | undefined,
      agendaGlide: undefined as HydroMarkerDirectorHandle | undefined,
      agendaGlideHold: undefined as AnimationHold | undefined,
      questPulse: false,
      questTimer: undefined as number | undefined,
      /** The parties tier's rect at the press — the seat / recap stage unfolds from it. */
      stageFromRect: undefined as Rect | undefined,
    };
  },
  computed: {
    model(): ParliamentModel | undefined {
      return this.playerView.game.parliament;
    },
    viewerColor(): Color | undefined {
      return this.playerView.thisPlayer?.color;
    },
    viewerParticipates(): boolean {
      return this.view.viewer?.participates === true;
    },
    viewerIsChairman(): boolean {
      return this.viewerColor !== undefined && this.view.chairman === this.viewerColor;
    },
    view(): ParliamentViewVm {
      const model = this.model;
      if (model === undefined) {
        return {
          slots: [], enacted: undefined, rulingParty: PartyName.GREENS, rulingEffect: undefined, quest: undefined, chairman: undefined,
          parties: [], agenda: [], agendaStart: [], players: [], viewer: undefined, tiles: [], deckSize: 0, discardSize: 0, neutralSupply: 0, botMode: 'none',
        };
      }
      return buildParliamentView(model, this.viewerColor, this.playerView.players);
    },
    bridge(): ParliamentPromptBridge {
      return parliamentPromptBridge(this.playerView.waitingFor);
    },
    /** A nested frame (the action workspace) took the scene — this screen yields and waits. */
    sceneHandedOver(): boolean {
      return workspaceFrameHasNested('parliament');
    },
    /** The seat / recap stage stands in the middle tier. */
    stageUp(): boolean {
      return this.stage === 'seat' || this.stage === 'recap' || (this.stage === 'submitting' && this.stageBeforeSubmit === 'seat');
    },
    /** The ENACTMENT layer stands over the field (the payout). */
    enactUp(): boolean {
      return this.stage === 'enact';
    },
    /** The enacted card is on the payout stage (the one instance, teleported). */
    enactCarried(): boolean {
      return this.enactUp && this.view.enacted !== undefined;
    },
    /**
     * THE ENACTED RESOLUTION'S LIVE ASK for this seat — its payout's recipient
     * pick, by the server's own markers (a `resolution` source on a card
     * pick while the political phase pays its effects), never a title.
     */
    enactPrompt(): PlayerInputModel | undefined {
      const wf = this.playerView.waitingFor;
      if (wf === undefined || wf.type !== 'card' || this.model?.phase?.step !== 'effects') {
        return undefined;
      }
      // An ANNOUNCED prompt: while its plate still waits for the player's A
      // (the mandatory gate holds it), the stage stays down — a Parliament the
      // player walked into on their own shows its overview, never a payout
      // stage whose picker is not allowed to stand yet.
      if (isMandatoryGateHeld()) {
        return undefined;
      }
      return wf.choiceContext?.source?.kind === 'resolution' ? wf : undefined;
    },
    enactStanding(): boolean {
      return this.enactPrompt !== undefined;
    },
    /**
     * The live ask is the mandatory TAKE of the cards the resolution drew
     * (Turmoil Redux — Climate Research): the premium take surface is hosted
     * in this stage's own zone, so the stage names itself «Получение» and
     * draws no picker of its own. The server's `externalDrawPrompt` marker
     * decides — never a resolution name, never a title.
     */
    enactDrawStanding(): boolean {
      return externalDrawTakeOf(this.enactPrompt) !== undefined;
    },
    /**
     * THE HONEST WAIT of every OTHER seat while the enacted resolution's effect
     * asks someone: who, and what kind of answer (the asked seat's live input
     * type, read by the server) — never a step name, never a resolution name
     * check. Empty when nothing waits or the viewer is the one asked.
     */
    phaseWaitText(): string {
      const phase = this.model?.phase;
      const pending = phase?.pending;
      if (phase?.step !== 'effects' || pending === undefined || pending.player === this.viewerColor) {
        return '';
      }
      const who = this.nameOf(pending.player);
      switch (pending.input) {
      case 'card': return translateTextWithParams('Waiting for ${0} to choose a card', [who]);
      case 'space': return translateTextWithParams('Waiting for ${0} to place a tile', [who]);
      default: return translateTextWithParams('Waiting for ${0} to decide', [who]);
      }
    },
    /**
     * THE PAYOUT ON THE STAGE. A card-resource pick states the SERVER's own
     * amount (the pick's own marker); every other ask — a chained effect whose
     * halves are already recorded (Climate Research's raise and its draw) —
     * reads the phase's OWN outcomes for this seat, so the stage shows the
     * fixed parameters of the chain being resolved and never re-adds the
     * influence to a production the server has already raised.
     */
    enactYields(): Array<InfluenceYield> {
      const wf = this.enactPrompt as SelectCardModel | undefined;
      const id = wf?.choiceContext?.source?.resolution;
      if (id === undefined) {
        return [];
      }
      const resolution = getResolution(id);
      const meta = wf?.resourceGainPrompt;
      if (meta !== undefined) {
        const effect = scaledEffectForCardResource(resolution, meta.cardResource);
        if (effect !== undefined) {
          return [resolvingYieldOf(effect, meta.amount, this.model, this.viewerColor)];
        }
      }
      return resolution === undefined ? [] : enactedYieldsOf(resolution, this.model, this.viewerColor, {live: true});
    },
    /** …and the ruling party's answer to it, on the same stage. */
    enactReactions(): Array<PartyReactionReading> {
      const id = (this.enactPrompt as SelectCardModel | undefined)?.choiceContext?.source?.resolution;
      return id === undefined ? [] : this.reactionsFor(getResolution(id), this.enactYields);
    },
    /** The vote mode stands over the overview. */
    voteUp(): boolean {
      return this.stage === 'vote' || this.stage === 'paying' || this.stage === 'landed' ||
        (this.stage === 'submitting' && this.stageBeforeSubmit === 'vote');
    },
    /** The three slots are in the vote row (up, or folding back — the leave animates them home first). */
    slotsCarried(): boolean {
      return this.voteUp;
    },
    /** Voting slots the refresh could not fill (distinct parties, never the ruling one's) — each shown as an EMPTY slot. */
    emptySlotCount(): number {
      return Math.max(0, PARLIAMENT_VOTING_SLOTS - this.view.slots.length);
    },
    /** WHY a slot stands empty: the final vote deals nothing after it; otherwise nothing of another party was left to deal. */
    emptySlotReason(): string {
      return this.model?.phase === undefined && this.model?.lastPhase?.final === true ?
        'No new resolution after the final vote' :
        'The deck has no resolution of another party';
    },
    voteCommitted(): boolean {
      return this.voteUp && this.stage !== 'vote';
    },
    /** The stage's CONTENT identity — a submit keeps the stage it left on screen (busy). */
    stageKind(): Stage {
      return this.stage === 'submitting' ? this.stageBeforeSubmit : this.stage;
    },
    slotVms(): Array<PremiumCardVM | undefined> {
      return this.view.slots.map((slot) => resolutionPremiumVmById(slot.resolutionId));
    },
    enactedVm(): PremiumCardVM | undefined {
      return this.view.enacted === undefined ? undefined : resolutionPremiumVmById(this.view.enacted.resolutionId);
    },
    /**
     * The ENACTED resolution's OWN standing effect / action (its printed
     * graphic) — a second source beside the ruling party's, told apart in
     * the government. Undefined for a resolution whose only effect was the
     * enactment itself (already paid, nothing stands).
     */
    enactedOwnMechanics(): MechanicsVM | undefined {
      const resolution = this.view.enacted?.resolution;
      if (resolution === undefined || !(resolution.hasPassive || resolution.hasAction)) {
        return undefined;
      }
      const mechanics = buildMechanics(resolution.renderData);
      return mechanics.textOnly ? undefined : mechanics;
    },
    winningSlot(): ParliamentSlotVm | undefined {
      return this.view.slots.find((s) => s.isWinning);
    },
    focusedSlot(): ParliamentSlotVm | undefined {
      return this.view.slots[this.slotIndex];
    },
    /** The card the vote mode is on — the cursor's slot. */
    voteSlot(): ParliamentSlotVm | undefined {
      return this.focusedSlot;
    },
    focusedParty(): ParliamentPartyVm | undefined {
      return this.view.parties[this.partyIndex];
    },
    voteTile(): ParliamentTileVm | undefined {
      return this.view.tiles.find((t) => t.id === 'vote');
    },
    /** WHERE the delegate leaves from — the server's own source; past the submit the snapshot's (the menu option is gone by then). */
    voteSource(): 'lobby' | 'reserve' | 'none' {
      if (this.voteSnapshot !== undefined) {
        return this.voteSnapshot.source;
      }
      const source = this.voteTile?.source;
      if (source === 'reserve' || source === 'lobby') {
        return source;
      }
      if (this.view.viewer?.lobby) {
        return 'lobby';
      }
      return (this.view.viewer?.reserve ?? 0) > 0 ? 'reserve' : 'none';
    },
    /** The bench's marked source: the place the next delegate leaves, or none when there is nothing to send. */
    benchSource(): 'lobby' | 'reserve' | 'none' {
      if (this.voteSnapshot !== undefined) {
        return this.voteSnapshot.source;
      }
      const viewer = this.view.viewer;
      if (viewer === undefined || !viewer.participates) {
        return 'none';
      }
      if (viewer.lobby) {
        return 'lobby';
      }
      return viewer.reserve > 0 ? 'reserve' : 'none';
    },
    /**
     * THE VOTE IS IN THE AIR: from the submit to the cube's touchdown every
     * consequence the server already answered (the tally, the leader, the
     * winner badge on every card) keeps reading the pre-vote state — the
     * counters tick when the cube lands, not when the packet does.
     */
    voteInFlight(): boolean {
      return this.voteSnapshot !== undefined &&
        (this.stage === 'submitting' || this.stage === 'paying' || (this.stage === 'landed' && this.landedSeq === undefined));
    },
    /**
     * THE BENCH'S WARNING — the sources cannot deliver a delegate: nothing is
     * left, or the next one is a reserve delegate the viewer cannot pay for
     * (the server's verdict is the gate; the M€ comparison only says WHICH
     * words the bench uses — never a rule of its own).
     */
    benchWarn(): boolean {
      if (this.benchSource === 'none') {
        return true;
      }
      if (this.benchSource === 'reserve') {
        const tile = this.voteTile;
        return tile !== undefined && !tile.available && (this.playerView.thisPlayer?.megacredits ?? 0) < (tile.cost ?? PARLIAMENT_VOTE_COST);
      }
      return false;
    },
    /** The execution gate — the viewer's own action window (never a reason of its own). */
    canActNow(): boolean {
      return this.myTurn && this.awaitingInput;
    },
    canVoteNow(): boolean {
      return this.bridge.vote !== undefined && this.canActNow;
    },
    partyStates(): Array<PartyStateVm> {
      const enactedEmpty = this.view.enacted === undefined;
      return this.view.parties.map((p) => partyStateOf(p, enactedEmpty));
    },
    partyActionStates(): Array<PartyActionStateVm> {
      return this.view.parties.map((p) => partyActionStateOf(p, this.canActNow));
    },
    partyColumns(): number {
      return consoleLayoutState.profile === 'handheld' ? 6 : 6;
    },
    /** THE SEATS — every participating player's places, with the results scene's display holds applied. */
    seats(): Array<SeatRow> {
      const me = this.viewerColor;
      return this.view.players.filter((p) => p.participates).map((p) => {
        const pendingLobby = this.recapPending.lobby.has(p.color);
        const pendingReturns = this.recapPending.returns.get(p.color) ?? 0;
        const base = Math.max(0, p.reserve - pendingReturns + (pendingLobby ? 1 : 0));
        // The viewer's places keep PAINTING the delegate that is leaving until
        // its proxy stands over it (`sourceHold`), and keep SAYING its count
        // until it has visibly left (`sourceLeaving`).
        const mine = p.color === me;
        return {
          color: p.color, name: p.name,
          lobby: (p.lobby && !pendingLobby) || (mine && this.sourceHold === 'lobby'),
          reserve: base + (mine && this.sourceLeaving === 'reserve' ? 1 : 0),
          reserveCubes: base + (mine && this.sourceHold === 'reserve' ? 1 : 0),
          chairman: p.chairman,
        };
      });
    },
    neutralSupplyShown(): number {
      return Math.max(0, this.view.neutralSupply - (this.recapPending.returns.get('neutral') ?? 0));
    },
    /** The deck as SHOWN — the results scene keeps the dealt cards on the pile until each has visibly left it. */
    deckShown(): number {
      return this.view.deckSize + this.recapPending.deckPending;
    },
    /** The pile's edges beneath the top back: none for one card, one for a few, two for a stack. */
    deckLayers(): number {
      const n = this.deckShown;
      return n <= 1 ? 0 : (n <= 3 ? 1 : 2);
    },
    /** Slots whose card is still on its way from the deck (the face waits under its proxy). */
    dealingFaces(): Set<string> {
      return this.recapPending.freshFaces;
    },
    /** The ruling party's ONE short reading (the catalog's summary; its sentence when a party carries none). */
    rulingSummary(): string | undefined {
      const text = this.view.rulingEffect?.text;
      return text?.summary ?? text?.passive ?? text?.action ?? text?.rule;
    },
    recapHiddenCubes(): Set<string> {
      return this.recapPending.hiddenCubes;
    },
    partyLine(): string {
      if (this.zone !== 'parties') {
        return '';
      }
      const state = this.partyActionStates[this.partyIndex];
      if (state === undefined) {
        return '';
      }
      switch (state.kind) {
      case 'used': return translateText('Action used this generation');
      case 'blocked': return state.reason !== undefined ? this.reasonText(state.reason) : translateText('Unavailable right now');
      case 'not-now': return translateText(this.awaitingInput ? 'Finish your current action first' : 'Not your turn — you can read the Parliament');
      // No access: a party IN the vote says it by its places (0/2) — a party
      // outside the vote has no places, so its foot says the server's reason.
      case 'no-access': return this.partyStates[this.partyIndex]?.kind === 'absent' && state.reason !== undefined ? this.reasonText(state.reason) : '';
      default: return '';
      }
    },
    partyLineTone(): 'dim' | 'warn' {
      const state = this.partyActionStates[this.partyIndex];
      return state?.kind === 'blocked' ? 'warn' : 'dim';
    },
    questMechanics(): MechanicsVM | undefined {
      const root = this.view.quest?.renderData;
      return root === undefined ? undefined : buildMechanics(root);
    },
    questRows(): ReadonlyArray<{color: Color, value: number}> {
      return (this.view.quest?.progress ?? []).filter((row) => row.participates);
    },
    agendaVm(): AgendaVm {
      return agendaViewOf(this.view);
    },
    voteForecast(): VoteForecastVm | undefined {
      const slot = this.voteSlot;
      return slot === undefined ? undefined : voteForecastOf(slot, this.viewerColor, this.model?.viewer?.vote);
    },
    /** The SELECTED card's reading — the info surface (`voteInfoModel` decides; this renders). */
    voteInfo(): VoteInfoVm | undefined {
      const slot = this.voteSlot;
      if (slot === undefined) {
        return undefined;
      }
      return voteInfoOf({
        slot,
        resolution: slot.resolution ?? getResolution(slot.resolutionId),
        model: this.model,
        viewer: this.viewerColor,
        tableau: this.playerView.thisPlayer.tableau,
        name: this.resolutionTitle(slot.resolutionId),
        winning: this.winningShownOf(slot),
        source: this.benchSource,
        cost: this.ctaCost.amount,
        facts: this.voteFacts,
        numbers: this.voteNumbers,
      });
    },
    /** The selected card's printed graphic — the reading's formula, beside the number. */
    ownMechanics(): MechanicsVM | undefined {
      const slot = this.voteSlot;
      const resolution = slot === undefined ? undefined : (slot.resolution ?? getResolution(slot.resolutionId));
      const own = resolution === undefined ? undefined : buildMechanics(resolution.renderData);
      return own === undefined || own.textOnly ? undefined : own;
    },
    /**
     * THE VOTE'S NUMBERS: before the submit, the live model and its
     * projection; from the submit to the landing, the SNAPSHOT (the counters
     * tick when the cube lands, not when the packet does); after the landing,
     * the live model on both sides.
     */
    voteNumbers(): {votesBefore: number, votesAfter: number, mineBefore: number, mineAfter: number} {
      const slot = this.voteSlot;
      const snap = this.voteSnapshot;
      if (slot === undefined) {
        return {votesBefore: 0, votesAfter: 0, mineBefore: 0, mineAfter: 0};
      }
      if (this.stage === 'landed' && snap !== undefined) {
        return {votesBefore: snap.votes, votesAfter: slot.totalVotes, mineBefore: snap.mine, mineAfter: slot.viewerVotes};
      }
      if (snap !== undefined) {
        return {votesBefore: snap.votes, votesAfter: snap.votes + 1, mineBefore: snap.mine, mineAfter: snap.mine + 1};
      }
      const f = this.voteForecast;
      return {
        votesBefore: slot.totalVotes, votesAfter: f?.votesAfter ?? slot.totalVotes + 1,
        mineBefore: slot.viewerVotes, mineAfter: slot.viewerVotes + 1,
      };
    },
    /** THIS VOTE's consequences — every fact as current → projected (`voteFactsOf`; the panel prints two, the inspector all). */
    voteFacts(): VoteFactsVm {
      const slot = this.voteSlot;
      const snap = this.voteSnapshot;
      const landed = this.stage === 'landed';
      return voteFactsOf({
        slot,
        party: this.view.parties.find((p) => p.party === slot?.party),
        viewer: this.viewerColor,
        forecast: this.voteForecast,
        snapshot: snap === undefined ? undefined : {leader: snap.leader, winning: snap.winning},
        landed,
        mineBefore: this.voteNumbers.mineBefore,
        mineAfter: landed ? (slot?.viewerVotes ?? this.voteNumbers.mineAfter) : this.voteNumbers.mineAfter,
        nameOf: (color: Color) => this.nameOf(color),
      });
    },
    ctaText(): string {
      switch (this.stage) {
      case 'submitting': return translateText('Performing…');
      case 'paying': return translateText('Pay for the delegate');
      // «placed» only once the cube has landed — the answer's arrival is not the delegate's.
      case 'landed': return translateText(this.voteInFlight ? 'Performing…' : 'Delegate placed');
      default:
        return this.canVoteNow ? translateText('Send the delegate') : this.voteBlockedText;
      }
    },
    voteBlockedText(): string {
      const tile = this.voteTile;
      if (tile === undefined) {
        return translateText(this.viewerParticipates ? 'Not your turn — you can read the Parliament' : 'Not in this game');
      }
      if (!tile.available) {
        return this.reasonText(tile.reason);
      }
      return translateText(this.awaitingInput ? 'Finish your current action first' : 'Not your turn — you can read the Parliament');
    },
    /**
     * THE PRICE ON THE CONFIRM — from the SAME vote option the submit answers
     * (the server's source and cost; a standing bill's own cost outranks the
     * tile's): the lobby's delegate is free, the reserve's costs M€. Nothing
     * to send → no price line (the confirm carries the one reason).
     */
    ctaCost(): CtaCost {
      const source = this.benchSource;
      if (source === 'none') {
        return {kind: 'none', amount: 0};
      }
      if (source === 'lobby') {
        return {kind: 'free', amount: 0};
      }
      return {kind: 'cost', amount: this.votePayment?.cost ?? this.voteTile?.cost ?? PARLIAMENT_VOTE_COST};
    },
    seatCandidates(): Array<number> {
      const parties = (this.bridge.seat as {parties?: Array<PartyName>} | undefined)?.parties ?? [];
      return this.view.slots.map((slot, i) => ({slot, i})).filter(({slot}) => parties.includes(slot.party)).map(({i}) => i);
    },
    recapKicker(): string {
      const last = this.model?.lastPhase;
      return last === undefined ? '' : translateTextWithParams('Results of generation ${0}', [String(last.generation)]);
    },
    recapItems(): Array<RecapItem> {
      const last = this.model?.lastPhase;
      if (last === undefined || last.generation !== this.playerView.game.generation - 1) {
        return [];
      }
      const resolutionName = (id: string): string => translateText(this.resolutionTitle(id));
      const items: Array<RecapItem> = [];
      items.push({key: 'winner', focus: 'winner', text: translateTextWithParams('${0} (${1}) won the vote — delegates: ${2}, winning player: ${3}', [
        resolutionName(last.winner.resolution), translateText(last.winner.party), String(last.winner.votes), this.nameOf(last.winner.player)])});
      if (last.agenda !== undefined) {
        const bonus = last.agenda.bonus === 'tr' ? translateText('+1 TR') : last.agenda.bonus === 'card' ? translateText('+1 card') : '';
        items.push({key: 'agenda', focus: 'agenda', step: last.agenda.to,
          move: {player: last.agenda.player, from: last.agenda.from, to: last.agenda.to},
          text: translateTextWithParams('${0} advanced on the Agenda track to step ${1} ${2}', [this.nameOf(last.agenda.player), String(last.agenda.to), bonus]).trim()});
      }
      items.push({key: 'enacted', focus: 'enacted', text: translateTextWithParams('${0} is enacted — ${1} now rule; its delegates return to their reserves', [resolutionName(last.enacted.resolution), translateText(last.enacted.party)])});
      // THE EFFECT AS IT WAS APPLIED — the server's own record per player and
      // step (amounts as paid, skips with their reason): one beat per outcome,
      // the viewer's own first. The SAME skip for several seats (the same part,
      // the same reason — a table with nothing to count) is ONE beat that names
      // every one of them: nothing goes silent, and a crowded table's results
      // still fit on one screen.
      const outcomes = [...(last.outcomes ?? [])].sort((a, b) => Number(b.player === this.viewerColor) - Number(a.player === this.viewerColor));
      const skips = new Map<string, {item: RecapItem, players: Array<ParliamentEnactOutcomeModel['player']>}>();
      for (const outcome of outcomes) {
        const item: RecapItem = {key: `outcome:${outcome.player}:${outcome.step}`, focus: 'enacted', text: this.outcomeText(outcome), outcome};
        if (outcome.kind === 'skipped') {
          const signature = `${this.skippedPartOf(outcome)}|${outcome.reason ?? ''}`;
          const group = skips.get(signature);
          if (group !== undefined) {
            if (!group.players.includes(outcome.player)) {
              group.players.push(outcome.player);
              group.item.text = this.outcomeText(outcome, group.players.map((player) => this.nameOf(player)).join(', '));
            }
            continue;
          }
          skips.set(signature, {item, players: [outcome.player]});
        }
        items.push(item);
      }
      const gained = last.support.filter((s) => s.gained > 0);
      if (gained.length > 0) {
        items.push({key: 'support', focus: 'support', parties: gained.map((s) => s.party),
          text: translateTextWithParams('Popular support: ${0}', [gained.map((s) => `${translateText(s.party)} +${s.gained}`).join(' · ')])});
      }
      if (last.refreshed.length > 0) {
        items.push({key: 'refresh', focus: 'refresh', text: translateTextWithParams('${0} new resolutions entered the voting area; popular support votes for them', [String(last.refreshed.length)])});
      }
      if (last.lobbyRefilled.length > 0) {
        items.push({key: 'lobby', focus: 'lobby', text: translateText('Every player\'s free delegate returns to the lobby')});
      }
      return items;
    },
    recapCurrent(): RecapItem | undefined {
      return this.stage === 'recap' ? this.recapItems[this.recapBeat] : undefined;
    },
    recapHighlight(): RecapItem['focus'] | '' {
      return this.recapCurrent?.focus ?? '';
    },
    crumbSubject(): string {
      // ONE fixed line, two names: «Парламент › Осмотр» on the overview,
      // «Парламент › Голосование» in the vote mode — the MODE is the subject,
      // never a card (a crumb that re-set itself on every ◀ ▶ read as
      // arriving somewhere else; a card name of any length would move the
      // zone beside it). The seat pick and the results are stages of the
      // overview and of the phase: short, fixed words.
      switch (this.stage) {
      case 'vote':
      case 'paying':
      case 'landed':
        return 'Voting';
      case 'submitting':
        return this.stageBeforeSubmit === 'vote' ? 'Voting' : 'Parliament overview';
      case 'recap': return 'Results';
      case 'enact': return 'Enactment';
      default: return 'Parliament overview';
      }
    },
    crumbSubjectRaw(): boolean {
      return false;
    },
    crumbStage(): string {
      // A submit is a transient beat, never a stage of its own: the tail keeps
      // the name of the stage it left (the phase turns it amber) — relabelling
      // it «Sending» for the round-trip blinked the crumb three times.
      return this.crumbStageOf(this.stage === 'submitting' ? this.stageBeforeSubmit : this.stage);
    },
    crumbCommitted(): boolean {
      return this.stage === 'submitting' || this.stage === 'landed' || this.stage === 'paying';
    },
    /** THE ONE COMMAND CONTRACT — published to the shell's bar. */
    commands(): Array<ConsoleCommand> {
      const back: ConsoleCommand = {control: 'back', label: this.stage === 'browse' ? 'To the board' : 'Back'};
      switch (this.stage) {
      case 'browse':
        return this.browseCommands(back);
      case 'vote':
        return [{control: 'confirm', label: 'Send the delegate', enabled: this.canVoteNow, highlight: this.canVoteNow}, {control: 'secondary', label: 'Inspect'}, back];
      case 'seat':
        return [{control: 'confirm', label: 'Take the delegate', highlight: true}, {control: 'secondary', label: 'Inspect'}, {control: 'back', label: 'Minimize'}];
      case 'recap':
        return [{control: 'confirm', label: 'Continue', highlight: true}];
      case 'enact':
        // The hosted picker owns the bar while it stands in the stage's zone.
        return [];
      case 'submitting':
        return [{control: 'confirm', label: 'Performing…', enabled: false}];
      case 'paying':
        // The bill's own panel owns the bar while it stands in the mode's zone.
        return [];
      case 'landed':
        // The landing beat is a STATUS, not a verb: the bar echoes the CTA (busy until the cube lands) and offers nothing until the flow leaves.
        return [{control: 'confirm', label: this.voteInFlight ? 'Performing…' : 'Delegate placed', enabled: false}];
      }
    },
    accessKey(): string {
      return (this.view.viewer?.access ?? []).filter((a) => a.hasEffect).map((a) => a.party).join('|');
    },
    usedKey(): string {
      return this.view.parties.filter((_, i) => this.partyActionStates[i]?.kind === 'used').map((p) => p.party).join('|');
    },
    /** The server's record of the LAST Agenda advance (its serial) — a live change plays the marker's move. */
    lastAdvanceSeq(): number {
      return this.model?.lastAdvance?.seq ?? 0;
    },
    questCompletedBy(): Color | undefined {
      return this.view.quest?.completedBy;
    },
    /**
     * THE SERVER'S ANSWER KEY. A submit is answered by a state change (the
     * game age moves) OR by a new prompt with the state untouched — a paid
     * vote's bill is raised before anything is paid, so the age alone would
     * miss it. The identity is structural (`promptIdentityKey`), never a raw title.
     */
    answerKey(): string {
      return `${this.playerView.game.gameAge}|${promptIdentityKey(this.playerView.waitingFor)}`;
    },
    /** A paid vote's BILL stands — the server's own marker, never a title (the vote mode hosts it). */
    votePayment(): VotePaymentMeta | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'payment' ? (wf as SelectPaymentModel).votePayment : undefined;
    },
    /**
     * THE BILL GEOMETRY — the vote column at the shared payment panel's width
     * and the band at its height, from the payment through the paid delegate's
     * landing (a re-fit under a flight would jump the scene it measures).
     */
    billGeometry(): boolean {
      return this.stage === 'paying' || (this.stage === 'landed' && this.voteSnapshot?.source === 'reserve');
    },
    paymentStands(): boolean {
      return this.votePayment !== undefined;
    },
  },
  watch: {
    'commands': {
      immediate: true,
      handler(cmds: ReadonlyArray<ConsoleCommand>): void {
        consoleParliamentUi.commands = [...cmds];
      },
    },
    'crumbSubject': {
      immediate: true,
      handler(subject: string): void {
        setWorkspaceFrameSubject('parliament', subject);
      },
    },
    'crumbStage': {
      immediate: true,
      handler(stage: string): void {
        setWorkspaceFrameStage('parliament', stage);
      },
    },
    /** The vote mode's PAYMENT zone — published once the mode's DOM stands (post-flush: a teleport into a zone not yet rendered drops its content). */
    'voteUp': {
      immediate: true,
      flush: 'post',
      handler(on: boolean): void {
        consoleParliamentUi.voteStanding = on;
      },
    },
    /** The ENACTMENT stage's zone — published on the same terms (the picker teleports into it only once it is in the DOM). */
    'stage': {
      immediate: true,
      flush: 'post',
      handler(stage: Stage): void {
        consoleParliamentUi.enactStanding = stage === 'enact';
      },
    },
    /**
     * THE ENACTMENT: the enacted resolution asks this seat where its payout
     * goes — the stage unfolds around the shared picker; the answer (the
     * prompt moves on) ends the flow, which LEAVES: the winner's ocean, if
     * any, is the board's own scene, and the rest of the phase is the
     * others' business.
     */
    'enactStanding': {
      immediate: true,
      handler(on: boolean): void {
        if (on && this.stage === 'browse') {
          this.openEnact();
        } else if (!on && this.stage === 'enact') {
          this.concludeEnact();
        }
      },
    },
    /**
     * A paid vote's BILL stands on a fresh mount (a reload, a restore from
     * the board home): the vote mode re-forms around it — the cards carried,
     * the counters at their pre-vote values, the payment in the mode's own
     * zone — with no press to animate from. Keyed on the server's marker.
     */
    'votePayment': {
      immediate: true,
      handler(meta: VotePaymentMeta | undefined): void {
        if (meta === undefined || this.voteUp) {
          return;
        }
        const idx = this.view.slots.findIndex((s) => s.party === meta.party);
        if (idx === -1) {
          return;
        }
        const slot = this.view.slots[idx];
        this.slotIndex = idx;
        this.zone = 'voting';
        this.voteSnapshot = {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, winner: this.winningSlot?.instance, source: 'reserve'};
        this.stageBeforeSubmit = 'vote';
        this.stage = 'paying';
        descendWorkspaceFrame('parliament', 'Voting', 'Payment');
        setWorkspaceFramePhase('parliament', 'committed');
        void this.$nextTick(() => {
          this.fitCards();
          const root = this.$refs.rootEl as HTMLElement | undefined;
          if (root !== undefined) {
            parkParliamentBody(root);
          }
        });
      },
    },
    /**
     * The bill geometry changes under a STANDING mode: measure before the
     * layout moves (pre-flush), re-fit the cards after it, and FLIP every
     * carried object from where it stood — never a jump under the bill. A mode
     * that opens straight into the payment (a reload) has nothing to carry.
     */
    billGeometry(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const up = root?.querySelector<HTMLElement>('.con-parl__vote--up') ?? null;
      if (root === undefined || up === null || this.voteEntering || this.voteLeaving) {
        return;
      }
      const before = measureVoteRects(root, {mode: 'vote'});
      void this.$nextTick(() => {
        this.fitCards();
        playParliamentVoteRefit({root, before});
      });
    },
    sceneHandedOver(on: boolean): void {
      if (!on && this.stage === 'browse') {
        setWorkspaceFrameSubject('parliament', this.crumbSubject);
        setWorkspaceFrameStage('parliament', this.crumbStage);
        setWorkspaceFramePhase('parliament', 'browse');
        void this.$nextTick(() => this.fitCards());
      }
    },
    'view'(): void {
      void this.$nextTick(() => this.fitCards());
    },
    /** The server answered: the stage it committed is over — a vote LANDS first, a paid vote PAYS first. */
    answerKey(key: string): void {
      if (this.stage === 'paying') {
        if (this.landVote()) {
          return;
        }
        if (!this.paymentStands) {
          // The payment was refused / the prompt moved on without a delegate.
          this.closeVote();
          this.$emit('flow-complete', 'vote');
        }
        return;
      }
      if (this.stage === 'submitting' && key !== this.submittedKey) {
        this.clearSubmitTimer();
        if (this.stageBeforeSubmit === 'vote') {
          if (this.landVote()) {
            return;
          }
          if (this.paymentStands) {
            this.stage = 'paying';
            setWorkspaceFramePhase('parliament', 'committed');
            return;
          }
          this.closeVote();
          this.$emit('flow-complete', 'vote');
          return;
        }
        // The chairman's delegate leaves the card for the seat.
        const wasSeat = this.stageBeforeSubmit === 'seat';
        this.stage = 'browse';
        setWorkspaceFramePhase('parliament', 'browse');
        if (wasSeat) {
          void this.$nextTick(() => this.flySeatDelegate());
        }
        this.$emit('flow-complete', this.stageBeforeSubmit);
      }
    },
    /** A stand-alone chairman-seat pick is MANDATORY: it takes the stage as soon as it stands. */
    'bridge.seat': {
      immediate: true,
      handler(seat: PlayerInputModel | undefined): void {
        if (seat !== undefined && this.stage === 'browse') {
          const parties = (seat as {parties: Array<PartyName>}).parties;
          const idx = this.view.slots.findIndex((slot) => parties.includes(slot.party));
          this.slotIndex = idx >= 0 ? idx : 0;
          this.zone = 'voting';
          this.openStage('seat');
        }
      },
    },
    accessKey(now: string, was: string): void {
      const before = new Set(was.split('|').filter((s) => s !== ''));
      const after = new Set(now.split('|').filter((s) => s !== ''));
      const gained = [...after].find((p) => !before.has(p)) as ReduxParty | undefined;
      const lost = [...before].find((p) => !after.has(p)) as ReduxParty | undefined;
      this.accessPulse = gained;
      this.accessLost = lost;
      if (this.accessTimer !== undefined) {
        window.clearTimeout(this.accessTimer);
      }
      this.accessTimer = window.setTimeout(() => {
        this.accessPulse = undefined;
        this.accessLost = undefined;
        this.accessTimer = undefined;
      }, consoleMotionMs(1400));
    },
    usedKey(now: string, was: string): void {
      const before = new Set(was.split('|').filter((s) => s !== ''));
      const used = now.split('|').find((p) => p !== '' && !before.has(p)) as ReduxParty | undefined;
      if (used === undefined) {
        return;
      }
      this.usedPulse = used;
      if (this.usedTimer !== undefined) {
        window.clearTimeout(this.usedTimer);
      }
      this.usedTimer = window.setTimeout(() => {
        this.usedPulse = undefined;
        this.usedTimer = undefined;
      }, consoleMotionMs(1400));
    },
    /**
     * AN AGENDA ADVANCE, LIVE: the marker glides from the step it left to the
     * step it reached, the step pulses, the reward follows (the influence
     * tick, the TR chip, a card cover lifting off the step — the board
     * card-bonus scene, which waits for the marker to settle). A mount or a
     * reload never replays it: only a change seen while on screen moves.
     */
    lastAdvanceSeq(now: number, was: number): void {
      const advance = this.model?.lastAdvance;
      if (now <= was || advance === undefined || this.sceneHandedOver) {
        return;
      }
      void this.playAgendaGlide({player: advance.player, from: advance.from, to: advance.to});
    },
    /** The results scene's beats MOVE the objects their sentences name. */
    recapBeat(beat: number): void {
      const item = this.stage === 'recap' ? this.recapItems[beat] : undefined;
      if (item === undefined) {
        return;
      }
      if (item.move !== undefined) {
        void this.playAgendaGlide(item.move);
      }
      void this.$nextTick(() => this.playRecapFlights(item));
    },
    questCompletedBy(now: Color | undefined, was: Color | undefined): void {
      if (now !== undefined && was === undefined) {
        this.questPulse = true;
        if (this.questTimer !== undefined) {
          window.clearTimeout(this.questTimer);
        }
        this.questTimer = window.setTimeout(() => {
          this.questPulse = false;
          this.questTimer = undefined;
        }, consoleMotionMs(1600));
      }
    },
  },
  mounted() {
    if (this.stage === 'enact') {
      parkParliamentForEnact(this.$refs.rootEl as HTMLElement | undefined);
    }
    this.fitCards();
    const field = (this.$refs.rootEl as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-parl__field');
    if (field !== null && field !== undefined) {
      this.stopFitObs = useResizeObserver(field, () => this.fitCards()).stop;
    }
    this.maybeOpenRecap();
  },
  beforeUnmount() {
    this.stopFitObs?.();
    this.clearSubmitTimer();
    this.clearLanding();
    this.clearConclude();
    this.clearRecapTimers();
    this.killFlights();
    for (const timer of [this.accessTimer, this.agendaTimer, this.questTimer, this.usedTimer, this.chairTimer]) {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    }
    this.stopAgendaGlide();
    killParliamentVoteMotion(this.$refs.rootEl as HTMLElement | undefined);
    killParliamentEnactMotion(this.$refs.rootEl as HTMLElement | undefined);
    consoleParliamentUi.commands = [];
    consoleParliamentUi.voteStanding = false;
    setWorkspaceFrameSubject('parliament', '');
    setWorkspaceFrameStage('parliament', '');
  },
  methods: {
    cubePx(logical: number): number {
      return Math.round(logical * conUiScale());
    },
    /** «N delegates» with the language's own plural forms. */
    delegatesWord(n: number): string {
      return translateTextWithParams('${0} delegates', [String(n)]).replace(/^\d+\s*/, '');
    },
    partyKeyOf(party: ReduxParty): string {
      return partyTileKey(party);
    },
    setFlightEl(id: string, el: HTMLElement | null): void {
      this.flightEls[id] = el;
    },
    /** A party's popular support as SHOWN — the results scene keeps the cubes on their places until they have physically left. */
    supportShown(p: ParliamentPartyVm): number {
      return Math.min(3, p.support + (this.recapPending.support.get(p.party) ?? 0));
    },
    /** The hollow PLACE the next delegate takes: on the selected card, before the answer. */
    placeShownOn(index: number): boolean {
      return this.slotsCarried && this.slotIndex === index && !this.benchWarn &&
        (this.stage === 'vote' || this.stage === 'submitting' || this.stage === 'paying');
    },
    /** A slot's tally as SHOWN: the selected card waits for the touchdown before its numbers move. */
    tallyOf(slot: ParliamentSlotVm, index: number): {votes: number, mine: number, leader: Color | 'neutral' | undefined} {
      const snap = this.voteSnapshot;
      if (snap !== undefined && index === this.slotIndex && this.voteInFlight) {
        return {votes: snap.votes, mine: snap.mine, leader: snap.leader};
      }
      return {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader};
    },
    /** WHICH of the viewer's places the next delegate leaves — marked on the zone while the mode stands, never on another player's group. */
    seatSourceOf(seat: SeatRow): 'lobby' | 'reserve' | undefined {
      if (!this.slotsCarried || seat.color !== this.viewerColor || this.benchWarn) {
        return undefined;
      }
      const source = this.benchSource;
      return source === 'none' ? undefined : source;
    },
    /**
     * A cube-sized rect ON a place of the delegates zone: the top cube of a
     * stack when one stands there, else the place's centre at the zone's cube
     * size — so a landing proxy is always the size of the cube that will
     * materialize under it, never the size of the socket around it.
     */
    placeCubeRect(root: HTMLElement, selector: string): Rect | undefined {
      const place = root.querySelector<HTMLElement>(selector);
      if (place === null) {
        return undefined;
      }
      const cube = place.querySelector<HTMLElement>('.con-parl__stack-cube:last-child .player-cube') ?? place.querySelector<HTMLElement>('.player-cube');
      const r = (cube ?? place).getBoundingClientRect();
      if (r.width < 2) {
        return undefined;
      }
      if (cube !== null) {
        return {left: r.left, top: r.top, width: r.width, height: r.height};
      }
      const size = this.cubePx(RIBBON_CUBE);
      return {left: r.left + r.width / 2 - size / 2, top: r.top + r.height / 2 - size / 2, width: size, height: size};
    },
    /**
     * A party name too long to share the slot's label row with the «winning»
     * WORD on a narrow slot (calibrated on the Deck: «МАРС ВПЕРЕД», 11, fits
     * beside it; «ИНДУСТРИАЛИСТЫ», 14, does not) — its badge says it with the
     * vote's winner glyph instead, never by cutting the name.
     */
    partyNameLong(party: PartyName): boolean {
      return translateText(party).length > 12;
    },
    /** Whether a card reads «winning» as SHOWN: while the cube is in the air every card keeps the pre-vote verdict (the badge moves on the touchdown). */
    winningShownOf(slot: ParliamentSlotVm): boolean {
      const snap = this.voteSnapshot;
      if (snap !== undefined && this.voteInFlight) {
        return slot.instance === snap.winner;
      }
      return slot.isWinning;
    },
    /** The crumb's tail for a stage (the name of the place the player is in — never of a beat). */
    crumbStageOf(stage: Stage): string {
      switch (stage) {
      case 'paying': return 'Payment';
      case 'seat': return 'Seat';
      // The enactment's tail names the STAGE the seat is actually in: a
      // payout pick, or the mandatory take of the cards the resolution drew
      // (Climate Research). Read from the live prompt's own marker, never a
      // resolution name — one word, and only the tail moves.
      case 'enact': return this.enactDrawStanding ? 'Intake' : 'Payout';
      default: return '';
      }
    },
    /** Solve the card zooms (voting slots · the enacted face · the vote row) from the measured frame. */
    fitCards(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined) {
        return;
      }
      const scale = conUiScale();
      const px = (v: string): number => parseFloat(v) || 0;
      // Layout heights (`offsetHeight`), never painted boxes: a FLIP in flight
      // scales these very elements, and a rect read then under-fits the card.
      const heightOf = (host: Element, sel: string): number => host.querySelector<HTMLElement>(sel)?.offsetHeight ?? 0;
      const snap = (zoom: number, min: number): number => Math.max(min * scale, Math.floor(zoom * 1000) / 1000);
      const slots = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot'));
      const chromeOf = (slot: HTMLElement): number =>
        heightOf(slot, '.con-parl__slot-label') + heightOf(slot, '.con-parl__ribbon') + heightOf(slot, '.con-parl__tally');

      if (this.slotsCarried) {
        // THE VOTE ROW: each card takes its column's height minus the slot's
        // measured chrome (label · ribbon · tally) and its column's width.
        const vrow = root.querySelector<HTMLElement>('.con-parl__vrow');
        if (vrow !== null && slots.length > 0) {
          const slot = slots[0];
          const cs = getComputedStyle(slot);
          const chrome = Math.max(...slots.map(chromeOf));
          const availH = slot.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - chrome - px(cs.rowGap) * 3;
          const availW = slot.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
          const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_VOTE_ZOOM * scale);
          root.style.setProperty('--con-parl-vote-zoom', String(snap(zoom, MIN_VOTE_ZOOM)));
        }
      } else if (slots.length > 0) {
        const slot = slots[0];
        const cs = getComputedStyle(slot);
        const chrome = Math.max(...slots.map(chromeOf));
        const availH = slot.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - chrome - px(cs.rowGap) * 3;
        const availW = slot.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
        const cap = consoleLayoutState.profile === 'tv' ? MAX_CARD_ZOOM_TV : MAX_CARD_ZOOM;
        const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, cap * scale);
        root.style.setProperty('--con-parl-card-zoom', String(snap(zoom, MIN_CARD_ZOOM)));
      }

      // THE ENACTED FACE is the government's main object: it takes the ruling
      // row's height (the column minus its other blocks) and up to 52 % of
      // the row's width — the ruler's effect stands beside it.
      const gov = root.querySelector<HTMLElement>('.con-parl__gov');
      const ruling = root.querySelector<HTMLElement>('.con-parl__ruling');
      let govZoom = MAX_GOV_ZOOM * scale;
      if (gov !== null && ruling !== null) {
        const gcs = getComputedStyle(gov);
        const innerH = gov.clientHeight - px(gcs.paddingTop) - px(gcs.paddingBottom);
        const blocks = Array.from(gov.children).filter((child) => child !== ruling);
        const taken = blocks.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0) + px(gcs.rowGap) * blocks.length;
        const rcs = getComputedStyle(ruling);
        const innerW = ruling.clientWidth - px(rcs.paddingLeft) - px(rcs.paddingRight);
        govZoom = Math.min(govZoom, (innerH - taken - px(rcs.paddingTop) - px(rcs.paddingBottom)) / PCARD_H, (innerW * 0.52) / PCARD_W);
      }
      root.style.setProperty('--con-parl-gov-zoom', String(snap(govZoom, MIN_GOV_ZOOM)));

      // THE PAYOUT STAGE'S HERO — the carried enacted card takes the hero
      // column's height minus the payout reading under it, and at most a
      // share of the layer's width (the recipient zone is the decision).
      if (this.enactUp) {
        const layer = root.querySelector<HTMLElement>('.con-parl__enact');
        const hero = root.querySelector<HTMLElement>('.con-parl__enact-hero');
        if (layer !== null && hero !== null) {
          const hcs = getComputedStyle(hero);
          const readingH = heightOf(hero, '.con-parl__enact-yield');
          const availH = hero.clientHeight - px(hcs.paddingTop) - px(hcs.paddingBottom) - readingH - (readingH > 0 ? px(hcs.rowGap) : 0);
          const availW = layer.clientWidth * ENACT_HERO_SHARE;
          const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_ENACT_ZOOM * scale);
          root.style.setProperty('--con-parl-enact-zoom', String(snap(zoom, MIN_GOV_ZOOM)));
        }
      }
    },
    /** The browse layer's verbs depend on the focused ZONE (one bar, one contract). */
    browseCommands(back: ConsoleCommand): Array<ConsoleCommand> {
      switch (this.zone) {
      case 'voting': {
        const cmds: Array<ConsoleCommand> = [];
        if (this.view.slots.length > 0) {
          cmds.push({control: 'confirm', label: 'Open the vote', enabled: true, highlight: this.canVoteNow});
        }
        // No X here: the voting area is ONE zone with no card of its own
        // selected — the inspector belongs to the mode's selected card.
        cmds.push(back);
        return cmds;
      }
      case 'government':
        return [{control: 'secondary', label: 'Inspect'}, back];
      case 'parties': {
        const state = this.partyActionStates[this.partyIndex];
        const cmds: Array<ConsoleCommand> = [];
        if (state !== undefined && state.kind !== 'none' && state.kind !== 'no-access') {
          cmds.push({control: 'confirm', label: 'Party action', enabled: state.kind === 'available', highlight: state.kind === 'available'});
        }
        cmds.push({control: 'secondary', label: 'Party effect'}, back);
        return cmds;
      }
      }
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    partyAccent(party: ReduxParty): string {
      return partyAccent(party);
    },
    nameOf(color: Color | 'neutral' | undefined): string {
      if (color === undefined || color === 'neutral') {
        return translateText('the neutral player');
      }
      return this.playerView.players.find((p) => p.color === color)?.name ?? color;
    },
    reasonText(reason: string | Message): string {
      return typeof reason === 'string' ? translateText(reason) : translateMessage(reason);
    },
    resolutionTitle(id: string): string {
      return this.view.slots.find((s) => s.resolutionId === id)?.resolution?.text.name ??
        (this.view.enacted?.resolutionId === id ? this.view.enacted.resolution?.text.name : undefined) ??
        getResolution(id)?.text.name ?? id;
    },
    ribbonGroups(slot: ParliamentSlotVm): Array<RibbonGroup> {
      const groups: Array<{owner: Color | 'neutral', seqs: Array<number>}> = [];
      for (const vote of slot.votes) {
        const group = groups.find((g) => g.owner === vote.owner);
        if (group === undefined) {
          groups.push({owner: vote.owner, seqs: [vote.seq]});
        } else {
          group.seqs.push(vote.seq);
        }
      }
      return groups.map((g) => ({owner: g.owner, count: g.seqs.length, seqs: g.seqs, hasSeq: (seq) => seq !== undefined && g.seqs.includes(seq)}));
    },
    // ── input ──────────────────────────────────────────────────────────
    handleIntent(intent: GamepadIntent): void {
      // The hosted picker owns the pad in the enactment stage (the shell routes to it first).
      if (this.stage === 'submitting' || this.stage === 'landed' || this.stage === 'paying' || this.stage === 'enact') {
        return;
      }
      if (this.stage === 'recap') {
        const action = consoleActionOf(intent);
        if (action === 'primary' || action === 'back') {
          this.finishRecap();
        }
        return;
      }
      if (this.stage === 'browse') {
        this.handleBrowseIntent(intent);
        return;
      }
      this.handleStageIntent(intent);
    },
    handleBrowseIntent(intent: GamepadIntent): void {
      if (intent.kind === 'nav') {
        this.navigate(intent.dir);
        return;
      }
      switch (consoleActionOf(intent)) {
      case 'primary':
        this.primary();
        return;
      case 'inspect':
        this.inspect();
        return;
      case 'back':
        this.$emit('close');
        return;
      default:
        return;
      }
    },
    navigate(dir: 'up' | 'down' | 'left' | 'right'): void {
      const columns = this.partyColumns;
      switch (this.zone) {
      case 'voting':
        if (dir === 'left') {
          this.zone = 'government';
        } else if (dir === 'down') {
          this.zone = 'parties';
          const idx = this.view.parties.findIndex((p) => p.party === this.focusedSlot?.party);
          this.partyIndex = idx >= 0 ? idx : Math.min(this.partyIndex, this.view.parties.length - 1);
        }
        return;
      case 'government':
        if (dir === 'right') {
          this.zone = 'voting';
        } else if (dir === 'down') {
          this.zone = 'parties';
          const idx = this.view.parties.findIndex((p) => p.party === this.view.rulingParty);
          this.partyIndex = idx >= 0 ? idx : 0;
        }
        return;
      case 'parties':
        if (dir === 'left') {
          this.partyIndex = Math.max(0, this.partyIndex - 1);
        } else if (dir === 'right') {
          this.partyIndex = Math.min(this.view.parties.length - 1, this.partyIndex + 1);
        } else if (dir === 'up') {
          if (this.partyIndex >= columns) {
            this.partyIndex -= columns;
          } else {
            this.zone = this.partyIndex < 2 ? 'government' : 'voting';
          }
        } else if (dir === 'down') {
          if (this.partyIndex + columns < this.view.parties.length) {
            this.partyIndex += columns;
          }
        }
        return;
      }
    },
    primary(): void {
      switch (this.zone) {
      case 'voting':
        this.openVote();
        return;
      case 'parties': {
        const party = this.focusedParty;
        const state = this.partyActionStates[this.partyIndex];
        if (party?.actionId === undefined || state === undefined || state.kind === 'none') {
          this.$emit('notice', translateText('This party has no action'));
          return;
        }
        this.openAction(party.party, party.actionId, state);
        return;
      }
      case 'government':
        this.$emit('notice', translateText(this.view.enacted === undefined ?
          'No resolution is enacted yet — the Greens rule by the starting rule' :
          'The enacted resolution has no action of its own'));
        return;
      default:
        return;
      }
    },
    // ── THE VOTE MODE ────────────────────────────────────────────────────
    /**
     * A on the voting area: the frame DESCENDS into the vote mode (a phase,
     * not a frame — the overview is parked, its focus survives). The three
     * slots are measured where they stand, teleported into the vote row, and
     * the entrance FLIPs every carried object from the rect it just had.
     * The mode opens whether or not a vote is possible right now — comparing
     * the three proposals is its job too; the confirm carries the reason.
     */
    openVote(opts?: {fromViewer?: boolean, index?: number}): void {
      this.clearConclude();
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (this.view.slots.length === 0 || root === undefined) {
        this.$emit('notice', translateText('Not in this game'));
        return;
      }
      if (this.voteUp || this.voteLeaving) {
        return;
      }
      if (opts?.index !== undefined) {
        this.slotIndex = opts.index;
      }
      this.slotIndex = Math.max(0, Math.min(this.view.slots.length - 1, this.slotIndex));
      const selected = this.view.slots[this.slotIndex];
      const plate = root.querySelector<HTMLElement>('.con-parl__voting');
      const pr = plate?.getBoundingClientRect();
      const press = pr === undefined || pr.width < 2 ? undefined : {x: pr.left + pr.width / 2, y: pr.top + pr.height / 2};
      // Measure BEFORE the layout changes — the overview's rects are the FLIPs' departures.
      const before = measureVoteRects(root, {press, viewer: this.viewerColor, mode: 'browse'});
      killParliamentVoteMotion(root);
      this.voteSnapshot = undefined;
      this.sourceHold = undefined;
      this.sourceLeaving = undefined;
      this.zone = 'voting';
      this.stage = 'vote';
      this.voteEntering = true;
      descendWorkspaceFrame('parliament', 'Voting', '');
      void this.$nextTick(() => {
        // The slots are in the vote row now: fit them, then play from the old rects.
        this.fitCards();
        playParliamentVoteEnter({
          root,
          before,
          selected: selected.instance,
          fromViewer: opts?.fromViewer === true,
          instant: false,
          done: () => {
            this.voteEntering = false;
          },
        });
      });
    },
    /** B before the commit: the same phrase folded back — every object returns home, the focus is where it was. */
    closeVote(): void {
      if (!this.voteUp) {
        return;
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      this.clearConclude();
      this.clearLanding();
      this.voteSnapshot = undefined;
      this.sourceHold = undefined;
      this.sourceLeaving = undefined;
      this.voteEntering = false;
      foldWorkspaceFrame();
      setWorkspaceFramePhase('parliament', 'browse');
      if (root === undefined || this.sceneHandedOver) {
        this.stage = 'browse';
        restoreParliamentBody(root);
        return;
      }
      // Measure the VOTE layout before the teleport home, then let the slots
      // go home and animate them from where they were.
      killParliamentVoteMotion(root);
      const before = measureVoteRects(root, {viewer: this.viewerColor, mode: 'vote'});
      this.voteLeaving = true;
      this.stage = 'browse';
      void this.$nextTick(() => {
        this.fitCards();
        playParliamentVoteLeave({
          root,
          viewer: this.viewerColor,
          before,
          done: () => {
            this.voteLeaving = false;
          },
        });
      });
    },
    /** The vote mode's own verbs: ◀ ▶ select, A sends, X inspects the selected card, B folds back. */
    handleStageIntent(intent: GamepadIntent): void {
      const action = consoleActionOf(intent);
      if (action === 'back') {
        if (this.stage === 'seat') {
          this.$emit('collapse');
          return;
        }
        if (this.stage === 'vote') {
          this.closeVote();
          return;
        }
        this.closeStage();
        return;
      }
      switch (this.stage) {
      case 'vote':
        if (intent.kind === 'nav') {
          if (intent.dir === 'left') {
            this.selectVoteSlot(this.slotIndex - 1);
          } else if (intent.dir === 'right') {
            this.selectVoteSlot(this.slotIndex + 1);
          }
          return;
        }
        if (action === 'inspect') {
          this.inspect();
        } else if (action === 'primary') {
          // The press that opened the mode is never its confirm.
          if (this.voteEntering) {
            return;
          }
          this.submitVote();
        }
        return;
      case 'seat':
        if (intent.kind === 'nav') {
          const candidates = this.seatCandidates;
          if (candidates.length > 0) {
            const at = candidates.indexOf(this.slotIndex);
            const next = intent.dir === 'left' ? Math.max(0, at - 1) : intent.dir === 'right' ? Math.min(candidates.length - 1, at + 1) : at;
            this.slotIndex = candidates[next < 0 ? 0 : next];
          }
          return;
        }
        if (action === 'inspect') {
          this.inspect();
        } else if (action === 'primary') {
          this.submitSeat();
        }
        return;
      default:
        return;
      }
    },
    /**
     * THE INSPECTOR — X on the object under the cursor. The request names the
     * PHYSICAL element the card lifts out of (and returns into). On the voting
     * area it opens the viewer over ALL THREE cards (LB/RB browse them, the
     * cursor follows) and offers the A verb that opens the vote mode on the
     * card shown; inside the vote mode it opens the selected card alone.
     */
    inspect(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const slotFace = (instance: string) => root?.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${instance}"] .con-parl__card .pcard`) ??
        root?.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${instance}"] .con-parl__card`) ?? null;
      if (this.voteUp) {
        const slots = this.view.slots;
        const selected = this.voteSlot;
        if (selected === undefined) {
          return;
        }
        if (this.stage !== 'vote') {
          // A bill standing or a delegate in flight belongs to ONE card: the
          // viewer reads that card alone, and nothing in it can move the
          // selection the transaction is bound to.
          this.$emit('inspect', {kind: 'resolution', ids: [selected.resolutionId], index: 0, origin: () => slotFace(selected.instance)} as ParliamentInspectRequest);
          return;
        }
        // THE THREE PROPOSALS, in the order they stand in the row: LB/RB page
        // them inside the viewer and the mode's selection follows (B lands on
        // the last card looked at); A sends the delegate to the card on screen
        // through this mode's own submit.
        const request: ParliamentInspectRequest = {
          kind: 'resolution',
          ids: slots.map((slot) => slot.resolutionId),
          index: this.slotIndex,
          origin: (index) => {
            const slot = slots[index];
            return slot === undefined ? null : slotFace(slot.instance);
          },
          onBrowse: (index) => this.selectVoteSlot(index),
          vote: {
            verbAt: (index) => this.voteVerbAt(index),
            execute: (index) => this.sendVoteFromInspector(index),
          },
        };
        this.$emit('inspect', request);
        return;
      }
      if (this.stage === 'seat') {
        const slot = this.focusedSlot;
        if (slot !== undefined) {
          this.$emit('inspect', {kind: 'resolution', ids: [slot.resolutionId], index: 0, origin: () => slotFace(slot.instance)} as ParliamentInspectRequest);
        }
        return;
      }
      if (this.zone === 'voting') {
        // ONE zone, no card of its own selected: nothing to inspect from the
        // overview — the vote mode's X inspects the card it stands on.
        return;
      }
      if (this.zone === 'government') {
        if (this.view.enacted !== undefined) {
          const id = this.view.enacted.resolutionId;
          this.$emit('inspect', {kind: 'resolution', ids: [id], index: 0, origin: () => root?.querySelector<HTMLElement>('.con-parl__gov-card .pcard') ?? root?.querySelector<HTMLElement>('.con-parl__gov-card') ?? null} as ParliamentInspectRequest);
        } else {
          this.$emit('inspect', {kind: 'party', party: this.view.rulingParty, origin: () => root?.querySelector<HTMLElement>('[data-parl-ruler]') ?? null} as ParliamentInspectRequest);
        }
        return;
      }
      if (this.zone === 'parties' && this.focusedParty !== undefined) {
        const party = this.focusedParty.party;
        this.$emit('inspect', {kind: 'party', party, origin: () => root?.querySelector<HTMLElement>(`.con-parl__party[data-party="${party}"] .con-pseal`) ?? null} as ParliamentInspectRequest);
      }
    },
    /**
     * A PARTY ACTION from its plaque — the Parliament's door into the ONE
     * execution point (the action workspace, nested inside this screen). The
     * pressed plaque is the descent's origin.
     */
    openAction(party: ReduxParty, id: PartyActionId, state: PartyActionStateVm): void {
      if (state.kind !== 'available') {
        const reason = state.reason !== undefined ? this.reasonText(state.reason) :
          translateText(state.kind === 'used' ? 'This party action was already used this generation' :
            (state.kind === 'not-now' ? (this.awaitingInput ? 'Finish your current action first' : 'Not your turn') : 'You do not have this party\'s effect'));
        this.$emit('notice', reason);
        return;
      }
      if (id !== 'unity-trade' && this.bridge.actions[id] === undefined) {
        this.$emit('notice', translateText('This option is no longer offered'));
        return;
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const plaque = root?.querySelector<HTMLElement>(`.con-parl__party[data-party="${party}"] .con-pseal`);
      const rect = plaque?.getBoundingClientRect();
      if (rect !== undefined && rect.width > 0) {
        armDescendOrigin('action-browse', {x: rect.left + rect.width / 2, y: rect.top + rect.height / 2});
        armDescendRect('action-slot', rect);
        armActionFocusOrigin(rect);
      }
      this.$emit('open-action', party);
    },
    // ── the seat / recap stage phrase ──────────────────────────────────
    openStage(stage: Stage): void {
      const tier = this.$refs.partiesTierEl as HTMLElement | undefined;
      const rect = tier?.getBoundingClientRect();
      this.stageFromRect = rect !== undefined && rect.width > 0 ? {left: rect.left, top: rect.top, width: rect.width, height: rect.height} : undefined;
      this.stage = stage;
      setWorkspaceFramePhase('parliament', 'configure');
    },
    /**
     * OPEN THE PAYOUT — the enacted resolution asks this seat where its share
     * goes. The card's government rect is read BEFORE the teleport moves it
     * (the FLIP's origin); at setup time (a reload, a restore) there is no DOM
     * yet and `mounted()` parks the overview instead — no entrance to play.
     */
    openEnact(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const cardFrom = enactCarryRect(root);
      this.zone = 'government';
      this.stage = 'enact';
      setWorkspaceFramePhase('parliament', 'committed');
      if (root === undefined) {
        return;
      }
      void this.$nextTick(() => {
        this.fitCards();
        playParliamentEnactEnter({root, cardFrom});
      });
    },
    /**
     * THE ANSWER IS IN. A finished payout LEAVES with its stage standing (one
     * motion with the workspace); only a flow that could not conclude — the
     * Parliament frame still known a tick later — folds back to the overview,
     * the card FLIPping home from the hero slot.
     */
    concludeEnact(): void {
      this.$emit('flow-complete', 'enact');
      void this.$nextTick(() => {
        if (this.stage !== 'enact' || this.enactStanding || !workspaceFrameKnown('parliament')) {
          return;
        }
        const root = this.$refs.rootEl as HTMLElement | undefined;
        const cardFrom = enactCarryRect(root);
        this.closeStage();
        if (root === undefined) {
          return;
        }
        void this.$nextTick(() => {
          this.fitCards();
          playParliamentEnactFold({root, cardFrom});
        });
      });
    },
    closeStage(): void {
      this.stage = 'browse';
      setWorkspaceFramePhase('parliament', 'browse');
    },
    onStageEnter(el: Element, done: () => void): void {
      const surface = el as HTMLElement;
      const from = this.stageFromRect;
      const inset = from === undefined ? undefined : descendSurfaceInset(surface, from);
      if (inset === undefined) {
        done();
        return;
      }
      guardedDescend(surface, STAGE_UNFOLD_MS, done, (finish) => {
        const tl = gsap.timeline({onComplete: finish});
        tl.fromTo(surface, {clipPath: inset, opacity: 0.4}, {clipPath: 'inset(0px 0px 0px 0px round 12px)', opacity: 1, duration: motionMs(STAGE_UNFOLD_MS) / 1000, ease: 'expo.out', clearProps: 'clipPath,opacity'});
        return tl;
      });
    },
    onStageLeave(el: Element, done: () => void): void {
      const surface = el as HTMLElement;
      this.stageLeaving = true;
      guardedDescend(surface, STAGE_FOLD_MS, () => {
        this.stageLeaving = false;
        done();
      }, (finish) => gsap.to(surface, {opacity: 0, y: 8, duration: motionMs(STAGE_FOLD_MS) / 1000, ease: 'power2.in', onComplete: finish}));
    },
    onStageEnterCancelled(el: Element): void {
      (el as HTMLElement).style.clipPath = '';
    },
    onStageLeaveCancelled(): void {
      this.stageLeaving = false;
    },
    /** Select the vote mode's card (the d-pad inside the mode, the viewer's paging). */
    selectVoteSlot(index: number): void {
      // The crumb stays «Голосование»: the selection is named by the surface, never by the head line.
      this.slotIndex = Math.max(0, Math.min(this.view.slots.length - 1, index));
    },
    /**
     * «Send the delegate» for the card at `index`, as THIS mode reads it — the
     * same option, source, price and blocked text its own confirm uses.
     */
    voteVerbAt(index: number): VoteVerbVm | undefined {
      const slot = this.view.slots[index];
      if (slot === undefined || this.stage !== 'vote') {
        return undefined;
      }
      const tile = this.voteTile;
      return voteVerbOf({
        participates: this.viewerParticipates,
        tile,
        refusalText: tile === undefined || tile.available ? '' : this.reasonText(tile.reason),
        offered: this.bridge.vote !== undefined,
        canActNow: this.canActNow,
        offeredParties: this.bridge.vote?.model.parties,
        party: slot.party,
        turnText: translateText(offTurnReason(this.awaitingInput)),
        notOfferedText: translateText('This option is no longer offered'),
      });
    },
    /**
     * The inspector's A, after the viewer has flown back into the card's slot:
     * the card it showed becomes the mode's selection and the mode's own
     * submit runs — the same snapshot, the same answer handling, the same
     * delegate flight. A refusal speaks through the same notice.
     */
    sendVoteFromInspector(index: number): void {
      if (this.stage !== 'vote') {
        return;
      }
      this.selectVoteSlot(index);
      this.submitVote();
    },
    /**
     * ONE results line for a recorded outcome: a payout names the amount, the
     * resource and the card it landed on; a skip names its reason; an ocean
     * names the winner. Sentences from i18n keys, the card by its own name.
     */
    /** One recap line for a recorded outcome; `names` overrides its seat (a shared skip names several). */
    outcomeText(outcome: ParliamentEnactOutcomeModel, names?: string): string {
      const who = names ?? this.nameOf(outcome.player);
      switch (outcome.kind) {
      case 'cardResource':
        return translateTextWithParams('${0} received ${1} ${2} on ${3}', [
          who, String(outcome.amount ?? 0), translateText(cardResourcePluralKey(outcome.resource)), outcome.card === undefined ? '' : translateText(outcome.card),
        ]).trim();
      case 'production': {
        // «player1: M€ production +4 (10 → 14) — 2 building cards with a VP
        // icon + influence 2»: the result first, then what it was computed
        // from — the recorded inputs, never today's tableau.
        const amount = String(outcome.amount ?? 0);
        const before = String(outcome.before ?? '');
        const after = String(outcome.after ?? '');
        const unit = translateText(productionResourceLabelKey(outcome.production));
        const capped = outcome.uncapped !== undefined && outcome.amount !== undefined && outcome.uncapped > outcome.amount;
        const main = capped ?
          translateTextWithParams('${0}: ${1} production +${2}, the maximum (${3} → ${4})', [who, unit, amount, before, after]) :
          translateTextWithParams('${0}: ${1} production +${2} (${3} → ${4})', [who, unit, amount, before, after]);
        const inputs: Array<string> = [];
        const last = this.model?.lastPhase;
        const effect = last === undefined || outcome.effect === undefined ? undefined : scaledEffectOf(getResolution(last.enacted.resolution), outcome.effect);
        if (effect?.count !== undefined && outcome.count !== undefined) {
          inputs.push(translateTextWithParams(yieldCountPresentation(effect.count.id).pluralKey, [String(outcome.count)]));
        }
        if (outcome.influence !== undefined) {
          inputs.push(translateTextWithParams('influence ${0}', [String(outcome.influence)]));
        }
        return inputs.length === 0 ? main : `${main} — ${inputs.join(' + ')}`;
      }
      case 'stock': {
        // «player1: +6 plants (2 → 8) — influence 3»: the result, the supply
        // before and after, then what it was computed from (as recorded).
        const unit = translateText(productionResourceLabelKey(outcome.stock));
        const main = translateTextWithParams('${0}: ${1} +${2} (${3} → ${4})', [
          who, unit, String(outcome.amount ?? 0), String(outcome.before ?? ''), String(outcome.after ?? ''),
        ]);
        return outcome.influence === undefined ? main : `${main} — ${translateTextWithParams('influence ${0}', [String(outcome.influence)])}`;
      }
      case 'cards': {
        // «player1: 2 карты (производство тепла 4 → 6)» — the result, then the
        // total it was divided from, as the SERVER read it. A deck that could
        // not supply the whole draw names both numbers; nothing is silent.
        const amount = outcome.amount ?? 0;
        const drawn = outcome.drawn ?? amount;
        const total = outcome.total;
        const unit = translateText(productionResourceLabelKey(Resource.HEAT));
        const main = drawn < amount ?
          translateTextWithParams('${0}: ${1} of ${2} card(s) — the deck ran out', [who, String(drawn), String(amount)]) :
          translateTextWithParams('${0}: ${1} card(s)', [who, String(amount)]);
        return total === undefined ? main :
          `${main} — ${translateTextWithParams('${0} production ${1} → ${2}', [unit, String(total.before), String(total.after)])}`;
      }
      case 'ocean':
        return translateTextWithParams('${0} placed an ocean as the winner of the vote', [who]);
      case 'greenery': {
        // The tile's own oxygen step as the server read it: a step, or «at the maximum» (the tile still landed).
        const parameter = outcome.parameter;
        if (parameter === undefined) {
          return translateTextWithParams('${0} placed a greenery as the winner of the vote', [who]);
        }
        return parameter.after > parameter.before ?
          translateTextWithParams('${0} placed a greenery as the winner of the vote — oxygen ${1} → ${2} %', [who, String(parameter.before), String(parameter.after)]) :
          translateTextWithParams('${0} placed a greenery as the winner of the vote — oxygen was already at its maximum', [who]);
      }
      case 'skipped':
      default:
        return translateTextWithParams('${0}: ${1} — skipped: ${2}', [
          who, translateText(this.skippedPartOf(outcome) === 'winner' ? 'Winner of the vote' : 'Resolution effect'), translateText(outcome.reason ?? '')]);
      }
    },
    /** WHICH part a skip belongs to — the driver's own stamp (older records: the ocean step's key). */
    skippedPartOf(outcome: ParliamentEnactOutcomeModel): 'winner' | 'effect' {
      return outcome.part === 'winner' || (outcome.part === undefined && outcome.step === 'ocean') ? 'winner' : 'effect';
    },
    /**
     * The ruling party's answer to a resolution's readings — only for a seat
     * that takes part (a spectator is told nothing about a table they are not
     * at), and only where the party's DECLARED reaction says there is one.
     */
    reactionsFor(resolution: IClientResolution | undefined, yields: ReadonlyArray<InfluenceYield>): Array<PartyReactionReading> {
      return viewerHasSeat(this.model, this.viewerColor) ? partyReactionsOf(resolution, yields) : [];
    },
    /** One side of a fact as the panel prints it (a seat's name stays raw; a key renders through i18n). */
    factText(value: FactValue): string {
      if (value.raw === true) {
        return value.key;
      }
      return value.params === undefined ? translateText(value.key) : translateTextWithParams(value.key, [...value.params]);
    },
    // ── submits (byte-identical to the live prompt) ─────────────────────
    submitVote(): void {
      const slot = this.voteSlot;
      if (slot === undefined || this.stage !== 'vote') {
        return;
      }
      if (!this.canVoteNow) {
        this.$emit('notice', this.voteBlockedText);
        return;
      }
      const source = this.benchSource === 'none' ? 'lobby' : this.benchSource;
      this.voteSnapshot = {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, winner: this.winningSlot?.instance, source};
      this.send(voteResponse(this.bridge, slot.party), 'vote');
    },
    submitSeat(): void {
      const slot = this.focusedSlot;
      if (slot === undefined) {
        return;
      }
      // The cube that leaves the card for the seat: the viewer's newest one on it.
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const me = this.viewerColor;
      const mine = slot.votes.filter((v) => v.owner === me).map((v) => v.seq);
      const seq = mine.length > 0 ? Math.max(...mine) : undefined;
      const cube = seq === undefined ? null : root?.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${slot.instance}"] [data-seq="${seq}"]`) ?? null;
      const r = cube?.getBoundingClientRect();
      this.seatFrom = r === undefined || r.width < 2 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      this.send(seatResponse(this.bridge, slot.party), 'seat');
    },
    send(response: InputResponse | undefined, from: Stage): void {
      if (response === undefined) {
        this.$emit('notice', translateText('This option is no longer offered'));
        if (from === 'vote') {
          this.voteSnapshot = undefined;
        } else {
          this.closeStage();
        }
        return;
      }
      this.stageBeforeSubmit = from;
      this.submittedKey = this.answerKey;
      this.stage = 'submitting';
      setWorkspaceFramePhase('parliament', 'committed');
      this.$emit('submit', response);
      this.clearSubmitTimer();
      this.submitTimer = window.setTimeout(() => this.resetSubmitting(), SUBMIT_SAFETY_MS);
    },
    maybeOpenRecap(): void {
      const last = this.model?.lastPhase;
      const items = this.recapItems;
      if (last === undefined || items.length === 0 || this.stage !== 'browse' || this.bridge.seat !== undefined) {
        return;
      }
      const key = `${this.playerView.id}:${last.generation}`;
      if (parliamentRecapSeen(key)) {
        return;
      }
      markParliamentRecapSeen(key);
      this.recapPending = this.buildRecapPending();
      this.recapBeat = -1;
      this.openStage('recap');
      void this.$nextTick(() => {
        this.recapBeat = 0;
      });
      if (this.recapPending.govAwaits !== undefined) {
        this.recapTimers.push(window.setTimeout(() => this.parkEnactedCard(), consoleMotionMs(STAGE_UNFOLD_MS)));
      }
      for (let i = 1; i < items.length; i++) {
        this.recapTimers.push(window.setTimeout(() => {
          this.recapBeat = i;
        }, consoleMotionMs(RECAP_BEAT_MS) * i));
      }
    },
    /** What the results scene still has to MOVE: every cube stays where it was until its beat flies it. */
    buildRecapPending(): RecapPending {
      const pending = emptyRecapPending();
      const last = this.model?.lastPhase;
      if (last === undefined || consoleReducedMotionActive()) {
        return pending;
      }
      for (const entry of last.returned ?? []) {
        pending.returns.set(entry.owner, entry.count);
      }
      for (const fresh of last.refreshed) {
        if (fresh.neutralVotes <= 0) {
          continue;
        }
        const slot = this.view.slots.find((s) => s.instance === fresh.instance);
        if (slot === undefined) {
          continue;
        }
        const neutralSeqs = slot.votes.filter((v) => v.owner === 'neutral').map((v) => v.seq).sort((a, b) => a - b).slice(0, fresh.neutralVotes);
        for (const seq of neutralSeqs) {
          pending.hiddenCubes.add(`${slot.instance}#${seq}`);
        }
        pending.support.set(fresh.party, (pending.support.get(fresh.party) ?? 0) + neutralSeqs.length);
      }
      for (const color of last.lobbyRefilled) {
        pending.lobby.add(color);
      }
      // The fresh resolutions are still ON the deck: their faces wait, the pile keeps them.
      for (const fresh of last.refreshed) {
        pending.freshFaces.add(fresh.instance);
      }
      pending.deckPending = last.refreshed.length;
      // THE ENACTED CARD moves in from the slot it won in: its government face
      // waits until the touchdown (an older save without the slot keeps it in place).
      if (last.winner.slot !== undefined && this.view.enacted?.instance === last.enacted.instance) {
        pending.govAwaits = last.enacted.instance;
      }
      return pending;
    },
    finishRecap(): void {
      this.clearRecapTimers();
      this.killFlights();
      this.recapPending = emptyRecapPending();
      if (this.stage === 'recap') {
        this.recapBeat = -1;
        this.closeStage();
      }
    },
    clearRecapTimers(): void {
      for (const timer of this.recapTimers) {
        window.clearTimeout(timer);
      }
      this.recapTimers = [];
    },
    /** A results beat MOVES the delegates its sentence names, from where they were to where they went. */
    playRecapFlights(item: RecapItem): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined || this.stage !== 'recap') {
        return;
      }
      const last = this.model?.lastPhase;
      if (last === undefined) {
        return;
      }
      const rect = (el: Element | null | undefined): Rect | undefined => {
        const r = el?.getBoundingClientRect();
        return r === undefined || r.width < 2 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      if (item.outcome !== undefined) {
        this.playOutcomeFlight(item.outcome);
        return;
      }
      if (item.focus === 'enacted' && this.recapPending.govAwaits !== undefined) {
        // THE CARD MOVES FIRST: from the voting slot it won in to the
        // government; its delegates leave it once it has landed there.
        this.moveEnactedCard(root, () => this.playRecapFlights(item));
        return;
      }
      switch (item.focus) {
      case 'enacted': {
        // The enacted card's delegates go home: players' to their reserves, neutral to the supply.
        // Each leaves the card as the CUBE it is — born over the card's centre at the size of the
        // cube it lands as. The flight scales by the ratio of its two rects, so the card's own rect
        // as the source drew a card-sized block shrinking all the way home.
        const card = rect(root.querySelector('.con-parl__gov-card .pcard') ?? root.querySelector('.con-parl__gov-card'));
        let i = 0;
        for (const [owner, count] of Array.from(this.recapPending.returns.entries())) {
          const to = this.placeCubeRect(root, owner === 'neutral' ? '[data-parl-neutral-cube]' : `[data-parl-seat-reserve="${owner}"]`);
          const from = card === undefined || to === undefined ? undefined :
            {left: card.left + card.width / 2 - to.width / 2, top: card.top + card.height / 2 - to.height / 2, width: to.width, height: to.height};
          for (let n = 0; n < count; n++) {
            const delay = i * 70;
            i++;
            this.flyCube(owner, from, to, delay, () => {
              const left = (this.recapPending.returns.get(owner) ?? 0) - 1;
              if (left <= 0) {
                this.recapPending.returns.delete(owner);
              } else {
                this.recapPending.returns.set(owner, left);
              }
            });
          }
        }
        if (i === 0) {
          this.recapPending.returns.clear();
        }
        return;
      }
      case 'refresh': {
        // THE DEAL first: each fresh resolution leaves the deck's TOP card
        // (the head line's pile), grows into its slot and shows its face on
        // the touchdown; the pile's count ticks per card. Then popular
        // support becomes votes: each party's steel cubes leave their places
        // for the fresh card.
        const deckTop = rect(root.querySelector('[data-parl-deck-top]'));
        let dealt = 0;
        for (const fresh of last.refreshed) {
          if (!this.recapPending.freshFaces.has(fresh.instance)) {
            continue;
          }
          const face = root.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${fresh.instance}"] .con-parl__card .pcard`) ??
            root.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${fresh.instance}"] .con-parl__card`);
          // The pile is one card thinner the moment the card SEPARATES from
          // it (the count ticks at the launch — the project deck's language);
          // the face beneath the proxy shows on the touchdown.
          const launched = () => {
            this.recapPending.deckPending = Math.max(0, this.recapPending.deckPending - 1);
          };
          const landed = () => {
            this.recapPending.freshFaces.delete(fresh.instance);
          };
          if (!this.flyCard(deckTop, rect(face), dealt * DEAL_STAGGER_MS, landed, launched)) {
            launched();
            landed();
          } else {
            dealt++;
          }
        }
        const cubesAt = dealt > 0 ? DEAL_FLIGHT_MS + (dealt - 1) * DEAL_STAGGER_MS - 120 : 0;
        let i = 0;
        for (const fresh of last.refreshed) {
          const slot = this.view.slots.find((s) => s.instance === fresh.instance);
          if (slot === undefined) {
            continue;
          }
          const places = Array.from(root.querySelectorAll<HTMLElement>(`.con-parl__party[data-party="${fresh.party}"] .con-pseal__support-place`));
          const hidden = Array.from(this.recapPending.hiddenCubes).filter((key) => key.startsWith(`${slot.instance}#`));
          hidden.forEach((key, n) => {
            // The key is `<instance>#<seq>` and an instance id itself carries a '#' (`RDX_…#0`) — split on the LAST one.
            const seq = key.substring(key.lastIndexOf('#') + 1);
            // The plaque's own place when it is on screen; the results scene
            // stands where the parties tier does, so there the cubes leave
            // the neutral supply's stack in the head line — a real, measured place.
            const from = rect(places[Math.min(n, places.length - 1)]) ?? this.placeCubeRect(root, '[data-parl-neutral-cube]');
            const to = rect(root.querySelector(`.con-parl__slot[data-instance="${slot.instance}"] [data-seq="${seq}"]`));
            const delay = cubesAt + i * 80;
            i++;
            this.flyCube('neutral', from, to, delay, () => {
              this.recapPending.hiddenCubes.delete(key);
              const left = (this.recapPending.support.get(fresh.party) ?? 0) - 1;
              if (left <= 0) {
                this.recapPending.support.delete(fresh.party);
              } else {
                this.recapPending.support.set(fresh.party, left);
              }
            });
          });
        }
        if (i === 0) {
          this.recapPending.hiddenCubes.clear();
          this.recapPending.support.clear();
        }
        return;
      }
      case 'lobby': {
        // Every free delegate returns from the reserve to the lobby's socket.
        let i = 0;
        for (const color of Array.from(this.recapPending.lobby)) {
          const from = this.placeCubeRect(root, `[data-parl-seat-reserve="${color}"]`);
          const to = this.placeCubeRect(root, `[data-parl-seat-lobby="${color}"]`);
          const delay = i * 90;
          i++;
          this.flyCube(color, from, to, delay, () => {
            this.recapPending.lobby.delete(color);
          });
        }
        if (i === 0) {
          this.recapPending.lobby.clear();
        }
        return;
      }
      default:
        return;
      }
    },
    /** Where the enacted card physically stood: its former voting slot's face — or that slot's EMPTY outline when the refresh dealt nothing there (the voting area when the slot is gone). */
    formerSlotRect(root: HTMLElement): Rect | undefined {
      const last = this.model?.lastPhase;
      const index = last?.winner.slot;
      const rect = (el: Element | null | undefined): Rect | undefined => {
        const r = el?.getBoundingClientRect();
        return r === undefined || r.width < 2 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      const homes = root.querySelectorAll<HTMLElement>('.con-parl__slots .con-parl__slot-home');
      const home = index === undefined ? undefined : homes[index];
      return rect(home?.querySelector('.con-parl__card .pcard') ?? home?.querySelector('.con-parl__card') ?? home?.querySelector('[data-parl-slot-empty-card]')) ??
        rect(root.querySelector('[data-parl-voting] .con-parl__slots'));
    },
    /**
     * The results scene opens with the ENACTED card still where it won: a
     * face-up proxy parked over its former voting slot (the government's face
     * waits hidden), so the enactment beat can MOVE it — one visible card,
     * never a copy in the government and another in the vote.
     */
    parkEnactedCard(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const last = this.model?.lastPhase;
      if (root === undefined || last === undefined || this.stage !== 'recap' || this.recapPending.govAwaits === undefined || this.recapPending.parked !== undefined) {
        return;
      }
      const from = this.formerSlotRect(root);
      const face = resolutionPremiumVmById(last.enacted.resolution);
      if (from === undefined || face === undefined || consoleReducedMotionActive()) {
        this.recapPending.govAwaits = undefined;
        return;
      }
      const id = `enact${++this.flightSerial}`;
      this.cardFlights.push({id, width: Math.round(from.width), height: Math.round(from.height), face});
      this.recapPending.parked = id;
      void this.$nextTick(() => {
        const proxy = this.flightEls[id];
        if (proxy === null || proxy === undefined || this.recapPending.parked !== id) {
          this.dropFlight(id);
          this.recapPending.parked = undefined;
          this.recapPending.govAwaits = undefined;
          return;
        }
        gsap.set(proxy, {x: from.left, y: from.top, scale: 1, transformOrigin: '50% 50%', autoAlpha: 0});
        gsap.to(proxy, {autoAlpha: 1, duration: motionMs(180) / 1000, ease: 'power1.out'});
      });
    },
    /** The enactment beat: the parked card flies into the government; the face shows on the touchdown, then `then` runs. */
    moveEnactedCard(root: HTMLElement, then: () => void): void {
      const id = this.recapPending.parked;
      const settle = () => {
        if (id !== undefined) {
          this.dropFlight(id);
        }
        this.recapPending.parked = undefined;
        this.recapPending.govAwaits = undefined;
      };
      const proxy = id === undefined ? undefined : this.flightEls[id];
      const rect = (el: Element | null | undefined): Rect | undefined => {
        const r = el?.getBoundingClientRect();
        return r === undefined || r.width < 2 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      const to = rect(root.querySelector('[data-parl-gov] .con-parl__gov-card .pcard') ?? root.querySelector('[data-parl-gov] .con-parl__gov-card'));
      const from = this.formerSlotRect(root);
      if (id === undefined || proxy === null || proxy === undefined || to === undefined || from === undefined || consoleReducedMotionActive()) {
        settle();
        then();
        return;
      }
      gsap.killTweensOf(proxy);
      const handle = runCardDealFlight({
        proxy,
        from,
        to,
        durationMs: ENACT_MOVE_MS,
        onLanded: () => {
          // The face shows under the proxy on the touchdown; the proxy leaves the next frame.
          this.recapPending.govAwaits = undefined;
          probeTick(() => {
            settle();
            then();
          });
        },
      });
      this.flightHandles[id] = markRaw(handle);
    },
    /**
     * An effect beat's GAIN for the viewer, in the shared transfer language: a
     * production (or stock) chip leaves the enacted card's own effect block
     * and lands on the viewer's resource rail — one chip carrying the whole
     * amount, the production sprite in its production plate. A skip, a zero,
     * another seat's gain and a card resource (paid live in its own picker)
     * fly nothing.
     */
    playOutcomeFlight(outcome: ParliamentEnactOutcomeModel): void {
      const amount = outcome.amount ?? 0;
      if (outcome.player !== this.viewerColor || amount <= 0) {
        return;
      }
      const spec = outcome.kind === 'production' && outcome.production !== undefined ?
        {channel: 'production' as const, resource: outcome.production, amount} :
        outcome.kind === 'stock' && outcome.stock !== undefined ?
          {channel: 'stock' as const, resource: outcome.stock, amount} :
          undefined;
      if (spec === undefined) {
        return;
      }
      void runResourceTransfers({
        specs: [spec],
        source: {selectors: ['[data-parl-gov] .con-parl__gov-card .pcard__mech', '[data-parl-gov] .con-parl__gov-card']},
        arrival: 'auto',
      });
    },
    /** The chairman's delegate leaves the card it was taken from and settles on the seat mark of the ledger. */
    flySeatDelegate(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const me = this.viewerColor;
      const from = this.seatFrom;
      this.seatFrom = undefined;
      if (root === undefined || me === undefined || from === undefined) {
        this.pulseChair();
        return;
      }
      const chair = root.querySelector<HTMLElement>(`[data-parl-seat-chair="${me}"]`);
      const r = chair?.getBoundingClientRect();
      const to = r === undefined || r.width < 2 ? undefined : {left: r.left, top: r.top, width: r.height, height: r.height};
      if (!this.flyCube(me, from, to, 0, () => this.pulseChair())) {
        this.pulseChair();
      }
    },
    pulseChair(): void {
      this.chairPulse = true;
      if (this.chairTimer !== undefined) {
        window.clearTimeout(this.chairTimer);
      }
      this.chairTimer = window.setTimeout(() => {
        this.chairPulse = false;
        this.chairTimer = undefined;
      }, consoleMotionMs(1400));
    },
    /**
     * ONE cube from a real rect to a real rect (a results beat, the seat). The
     * proxy is born at the source's size and lands at the destination's.
     * Returns false when there is nothing measurable — the caller settles the
     * display holds itself.
     */
    flyCube(color: Color | 'neutral', from: Rect | undefined, to: Rect | undefined, delayMs: number, onLanded: () => void): boolean {
      if (from === undefined || to === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
        onLanded();
        return false;
      }
      const id = `f${++this.flightSerial}`;
      const size = Math.max(8, Math.round(Math.min(from.width, from.height)));
      this.flights.push({id, color, size});
      void this.$nextTick(() => {
        const proxy = this.flightEls[id];
        if (proxy === null || proxy === undefined) {
          this.dropFlight(id);
          onLanded();
          return;
        }
        gsap.set(proxy, {autoAlpha: 0});
        window.setTimeout(() => {
          if (this.flightEls[id] === undefined) {
            return;
          }
          const handle = runDelegateCubeFlight({
            proxy,
            from,
            to,
            durationMs: RECAP_FLIGHT_MS,
            onLanded: () => {
              onLanded();
              probeTick(() => this.dropFlight(id));
            },
          });
          this.flightHandles[id] = markRaw(handle);
        }, consoleMotionMs(delayMs));
      });
      return true;
    },
    dropFlight(id: string): void {
      this.flightHandles[id]?.kill();
      delete this.flightHandles[id];
      delete this.flightEls[id];
      this.flights = this.flights.filter((f) => f.id !== id);
      this.cardFlights = this.cardFlights.filter((f) => f.id !== id);
    },
    killFlights(): void {
      for (const id of Object.keys(this.flightHandles)) {
        this.flightHandles[id]?.kill();
      }
      this.flightHandles = {};
      this.flightEls = {};
      this.flights = [];
      this.cardFlights = [];
    },
    /**
     * ONE card dealt from the deck: a back-faced proxy the size of the slot's
     * face is born over the pile's top card (scaled down to it) and grows
     * into the slot; the face beneath reveals on the touchdown and the
     * proxy leaves the next frame. Returns false when nothing is measurable —
     * the caller settles the display holds itself.
     */
    flyCard(from: Rect | undefined, to: Rect | undefined, delayMs: number, onLanded: () => void, onLaunch?: () => void): boolean {
      if (from === undefined || to === undefined || to.width < 4 || typeof window === 'undefined' || consoleReducedMotionActive()) {
        onLanded();
        return false;
      }
      const id = `deal${++this.flightSerial}`;
      this.cardFlights.push({id, width: Math.round(to.width), height: Math.round(to.height)});
      void this.$nextTick(() => {
        const proxy = this.flightEls[id];
        if (proxy === null || proxy === undefined) {
          this.dropFlight(id);
          onLaunch?.();
          onLanded();
          return;
        }
        gsap.set(proxy, {autoAlpha: 0});
        window.setTimeout(() => {
          if (this.flightEls[id] === undefined) {
            return;
          }
          onLaunch?.();
          const handle = runCardDealFlight({
            proxy,
            from,
            to,
            durationMs: DEAL_FLIGHT_MS,
            onLanded: () => {
              onLanded();
              probeTick(() => this.dropFlight(id));
            },
          });
          this.flightHandles[id] = markRaw(handle);
        }, consoleMotionMs(delayMs));
      });
      return true;
    },
    /**
     * THE DELEGATE FLIGHT + LANDING. The vote's answer is in the model: the
     * viewer's newest delegate on the selected card is the one that just
     * arrived. Its cube LEAVES the place it came from (the bench's lobby socket
     * or the top of the reserve stack — real, measured places), flies to its
     * place on the card's ribbon and lands there; the counters tick on the
     * landing. Returns false when the model shows no new delegate (a refusal,
     * a paid vote still owing its payment) — the caller decides what that means.
     */
    landVote(): boolean {
      const slot = this.voteSlot;
      const me = this.viewerColor;
      const snap = this.voteSnapshot;
      if (slot === undefined || me === undefined || snap === undefined || slot.viewerVotes <= snap.mine) {
        return false;
      }
      const mine = slot.votes.filter((vote) => vote.owner === me);
      if (mine.length === 0) {
        return false;
      }
      const seq = Math.max(...mine.map((vote) => vote.seq));
      this.clearSubmitTimer();
      this.stage = 'landed';
      setWorkspaceFramePhase('parliament', 'committed');
      this.landingHold = beginAnimationHold('parliament-vote-landing', {maxHoldMs: 4000});
      this.flightSeq = seq;
      // The bench keeps painting the source cube until the proxy stands over
      // it, and keeps its WORDS until the cube has visibly left.
      this.sourceHold = snap.source;
      this.sourceLeaving = snap.source;
      void this.$nextTick(() => {
        if (!this.flyDelegate(seq, me)) {
          this.sourceHold = undefined;
          this.sourceLeaving = undefined;
          this.flightSeq = undefined;
          this.beginLanding(seq);
        }
      });
      return true;
    },
    flyDelegate(seq: number, color: Color): boolean {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
        return false;
      }
      // The REAL places on the delegates zone, measured where they stand right
      // now (the zone has moved with the mode; nothing here remembers the
      // overview's coordinates).
      const fromLobby = this.voteSource === 'lobby';
      const sourceCube = fromLobby ?
        root.querySelector<HTMLElement>(`[data-parl-seat-lobby="${color}"] .player-cube`) :
        root.querySelector<HTMLElement>(`[data-parl-seat-reserve="${color}"] .con-parl__stack-cube:last-child .player-cube`);
      const place = root.querySelector<HTMLElement>(`.con-parl__slot[data-instance] [data-seq="${seq}"]`);
      // The proxy lands on the CUBE's own box — the ribbon's place is a wider socket drawn around it.
      const target = place?.querySelector<HTMLElement>('.player-cube') ?? place;
      if (sourceCube === null || target === null || target === undefined) {
        return false;
      }
      const fr = sourceCube.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      if (fr.width < 2 || tr.width < 2) {
        return false;
      }
      const from: Rect = {left: fr.left, top: fr.top, width: fr.width, height: fr.height};
      const to: Rect = {left: tr.left, top: tr.top, width: tr.width, height: tr.height};
      const id = `vote${++this.flightSerial}`;
      const size = Math.round(fr.width);
      this.flights.push({id, color, size});
      void this.$nextTick(() => {
        const proxy = this.flightEls[id];
        if (proxy === null || proxy === undefined) {
          this.dropFlight(id);
          this.sourceHold = undefined;
          this.sourceLeaving = undefined;
          this.flightSeq = undefined;
          this.beginLanding(seq);
          return;
        }
        const handle = runDelegateCubeFlight({
          proxy,
          from,
          to,
          durationMs: VOTE_FLIGHT_MS,
          onLifted: () => {
            // The proxy stands exactly over the source cube: the source may vanish now.
            this.sourceHold = undefined;
          },
          onDeparted: () => {
            // The cube has visibly left its place: the socket's note / the stack's count may say so now.
            this.sourceLeaving = undefined;
          },
          onLanded: () => {
            this.flightSeq = undefined;
            this.beginLanding(seq);
            probeTick(() => this.dropFlight(id));
          },
        });
        this.flightHandles[id] = markRaw(handle);
        this.flightHold = beginAnimationHold('parliament-vote-flight', {maxHoldMs: 4000});
      });
      return true;
    },
    beginLanding(seq: number): void {
      this.landedSeq = seq;
      this.flightHold?.release();
      this.flightHold = undefined;
      if (this.landingTimer !== undefined) {
        window.clearTimeout(this.landingTimer);
      }
      this.landingTimer = window.setTimeout(() => this.finishLanding(), consoleMotionMs(VOTE_LANDING_MS));
    },
    finishLanding(): void {
      if (this.landingTimer !== undefined) {
        window.clearTimeout(this.landingTimer);
        this.landingTimer = undefined;
      }
      if (this.stage !== 'landed') {
        this.clearLanding();
        return;
      }
      // The flow is over: the landed scene lets go as ONE picture — cards, zone
      // and band together (a leaving Teleport would drop the cards a frame
      // before the fading layer) — while its counters keep the landed reading
      // (`landedSeq` stands until the fade is out); then the shell's ONE
      // guarded conclusion decides whether the workspace leaves (a vote is a
      // full action — it does). A CLASS fade, not a tween: the unmount's
      // prop reset would have popped a tweened layer back to full.
      this.concluded = true;
      this.concludeTimer = window.setTimeout(() => {
        this.concludeTimer = undefined;
        this.clearLanding();
        if (this.stage === 'landed') {
          this.$emit('flow-complete', 'vote');
        }
      }, consoleMotionMs(VOTE_CONCLUDE_MS) + 40);
    },
    clearConclude(): void {
      if (this.concludeTimer !== undefined) {
        window.clearTimeout(this.concludeTimer);
        this.concludeTimer = undefined;
      }
      this.concluded = false;
    },
    clearLanding(): void {
      if (this.landingTimer !== undefined) {
        window.clearTimeout(this.landingTimer);
        this.landingTimer = undefined;
      }
      for (const id of Object.keys(this.flightHandles)) {
        if (id.startsWith('vote')) {
          this.dropFlight(id);
        }
      }
      this.flightHold?.release();
      this.flightHold = undefined;
      this.landingHold?.release();
      this.landingHold = undefined;
      this.landedSeq = undefined;
      this.flightSeq = undefined;
      this.sourceHold = undefined;
      this.sourceLeaving = undefined;
    },
    // ── THE AGENDA MARKER'S MOVE ──────────────────────────────────────────
    /**
     * The marker glides along the track — the Hydronetwork's own director
     * (charge → glide → arrive → lock → release): the real cube at the
     * destination stays hidden until the proxy has locked onto its exact
     * rect, then the step pulses. While it moves, the card-bonus scene of an
     * Agenda card reward waits (`agendaSettling`) — the reward follows the
     * arrival, never precedes it. Bounded by the director's own safeties
     * and an animation hold.
     */
    async playAgendaGlide(move: AgendaMove): Promise<void> {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined || typeof window === 'undefined' || move.to === move.from) {
        this.pulseAgendaStep(move.to);
        return;
      }
      this.stopAgendaGlide();
      const fromEl = root.querySelector<HTMLElement>(`[data-agenda-markers="${move.from}"]`);
      this.agendaHidden = {color: move.player, step: move.to};
      this.agendaFlight = {color: move.player};
      consoleParliamentUi.agendaSettling = true;
      await this.$nextTick();
      const proxy = this.$refs.agendaFlightEl as HTMLElement | undefined;
      const toEl = root.querySelector<HTMLElement>(`[data-agenda-markers="${move.to}"] [data-agenda-cube="${move.player}"]`);
      // The cube the marker LEFT is no longer drawn (the model already stands
      // on the new step), so its rect is rebuilt from the old step's marker
      // ROW: the row's centre, at the destination cube's own size and on its
      // own line — the director scales the proxy by the two rects' widths,
      // and the row spans the whole cell.
      const fromRow = fromEl?.getBoundingClientRect();
      const to = toEl?.getBoundingClientRect();
      const from = fromRow === undefined || to === undefined ? undefined :
        new DOMRect(fromRow.left + fromRow.width / 2 - to.width / 2, to.top, to.width, to.height);
      if (proxy === undefined || from === undefined || to === undefined || to.width < 2 || (fromRow?.width ?? 0) < 2) {
        this.finishAgendaGlide(move.to);
        return;
      }
      this.agendaGlideHold = beginAnimationHold('parliament-agenda-glide', {maxHoldMs: 5000});
      const handle = runHydroMarkerGlide({
        marker: proxy,
        from,
        to,
        reduced: consoleReducedMotionActive(),
        onPhase: () => undefined,
      });
      // RAW on purpose: the director's callbacks compare identities (`this.agendaGlide === handle`) — a reactive proxy never equals its raw object.
      this.agendaGlide = markRaw(handle);
      // The server has already confirmed the move: the lock releases as soon
      // as the marker arrives — the real cube materializes under the proxy,
      // the step pulses, the proxy crossfades away.
      handle.lock(() => {
        if (this.agendaGlide !== handle) {
          return;
        }
        this.agendaHidden = undefined;
        this.pulseAgendaStep(move.to);
        handle.release(() => {
          if (this.agendaGlide === handle) {
            this.finishAgendaGlide(move.to);
          }
        });
      });
    },
    finishAgendaGlide(step: number): void {
      this.agendaGlide = undefined;
      this.agendaFlight = undefined;
      if (this.agendaHidden !== undefined) {
        this.agendaHidden = undefined;
        this.pulseAgendaStep(step);
      }
      this.agendaGlideHold?.release();
      this.agendaGlideHold = undefined;
      consoleParliamentUi.agendaSettling = false;
    },
    stopAgendaGlide(): void {
      const handle = this.agendaGlide;
      this.agendaGlide = undefined;
      handle?.skip();
      this.agendaFlight = undefined;
      this.agendaHidden = undefined;
      this.agendaGlideHold?.release();
      this.agendaGlideHold = undefined;
      consoleParliamentUi.agendaSettling = false;
    },
    pulseAgendaStep(step: number): void {
      this.agendaPulseStep = step;
      if (this.agendaTimer !== undefined) {
        window.clearTimeout(this.agendaTimer);
      }
      this.agendaTimer = window.setTimeout(() => {
        this.agendaPulseStep = undefined;
        this.agendaTimer = undefined;
      }, consoleMotionMs(1400));
    },
    /** A REFUSED submit gives the stage back (the shell calls it on a transport error too). */
    resetSubmitting(): void {
      this.clearSubmitTimer();
      if (this.stage === 'submitting') {
        this.stage = this.stageBeforeSubmit === 'seat' ? 'seat' : this.stageBeforeSubmit;
        this.voteSnapshot = undefined;
        this.seatFrom = undefined;
        setWorkspaceFramePhase('parliament', this.stage === 'browse' ? 'browse' : 'configure');
      }
    },
    clearSubmitTimer(): void {
      if (this.submitTimer !== undefined) {
        window.clearTimeout(this.submitTimer);
        this.submitTimer = undefined;
      }
    },
  },
});
</script>
