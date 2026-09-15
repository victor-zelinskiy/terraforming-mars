<template>
  <!-- «ПАРЛАМЕНТ» — the Mars Parliament workspace (Turmoil Redux).

       ONE FLOW, one screen, and a GAME SCREEN — not a rulebook. The overview
       shows OBJECTS and STATES in three focus zones: the GOVERNMENT (the
       enacted resolution as the main object, the ruling party's effect
       readable beside it, the chairman quest), the VOTING AREA (ONE zone:
       three resolution cards in the order that breaks ties — the closest to
       the government first — with the delegates on each, who leads, which one
       wins now) and the six PARTIES as one row of plaques. The SEATS ledger
       (every player's lobby place and reserve — the ONE place the delegates
       are counted) and the AGENDA track are read-only instruments. Nothing
       here explains a general rule — the fullscreen inspector (X) does, on
       the object asked.

       THE VOTE MODE is a PHASE DESCENT of this frame: A on the voting area
       opens it INSIDE the same screen. The three cards are the continuity —
       the very same slot elements are TELEPORTED into the vote row and FLIP
       there from their overview rects (one DOM instance each, so a second
       copy cannot exist), the viewer's lobby socket and reserve stack come up
       from the ledger into the BENCH above them (the physical sources of the
       delegate), and an info surface unfolds under the row explaining the
       SELECTED card: what it does, what enacting it changes, its quest, and —
       kept apart — what THIS VOTE changes right now. ◀ ▶ switch the card, X
       inspects it, A sends the delegate (its cube leaves the bench and lands
       on the card's ribbon; the counters tick on the touchdown), B folds the
       same phrase back with every object returning home.

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
             'con-parl--flying': flights.length > 0,
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
      <!-- THE GLOBAL COUNTERS — the neutral supply (where popular support and
           neutral votes come from), the viewer's influence, the deck. The
           viewer's own delegates are counted ONCE, on the seats ledger. -->
      <span class="con-parl__chip con-parl__chip--neutral" data-parl-neutral-pool>
        <span class="con-parl__chip-dim">{{ $t('Neutral') }}</span>
        <span class="con-parl__socket" :class="{'con-parl__socket--empty': neutralSupplyShown === 0}" data-parl-neutral-cube>
          <PlayerCube v-if="neutralSupplyShown > 0" color="neutral" steel :size="cubePx(14)" />
        </span>
        <b :key="'n' + neutralSupplyShown" class="con-parl__tick">×{{ neutralSupplyShown }}</b>
      </span>
      <span v-if="view.viewer !== undefined" class="con-parl__chip">
        <span class="con-parl__chip-dim">{{ $t('Influence') }}</span><b :key="'i' + view.viewer.influence" class="con-parl__tick">{{ view.viewer.influence }}</b>
      </span>
      <span class="con-parl__chip con-parl__chip--deck">
        <span class="con-parl__chip-dim">{{ $t('Resolution deck') }}</span><b>{{ view.deckSize }}</b>
      </span>
    </ConsoleWsHead>

    <!-- THE FIELD — the overview's body and, over it, the vote mode's layer. -->
    <div class="con-parl__field">
    <div class="con-parl__body" ref="bodyEl">
      <!-- ══ TOP TIER: the GOVERNMENT · the VOTING AREA ══ -->
      <div class="con-parl__top">
        <!-- ── THE GOVERNMENT — the enacted resolution is the MAIN OBJECT; the
             ruling party is identified compactly and its EFFECT is printed
             large enough to be read here. ── -->
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
            <span class="con-parl__gov-basis" :class="{'con-parl__gov-basis--default': view.enacted === undefined}">
              {{ $t(view.enacted === undefined ? 'Starting rule' : 'Enacted resolution') }}
            </span>
          </div>
          <div class="con-parl__ruling">
            <div v-if="enactedVm !== undefined" class="con-parl__gov-card" :data-zoom-slot="'resolution:' + view.enacted?.resolutionId" ref="govCardEl">
              <premium-card-face :vmOverride="enactedVm" :lightweight="true" :inert="true" />
            </div>
            <!-- The ENACTED slot stands empty until the first political phase:
                 an honest empty seat, never a placeholder card. -->
            <div v-else class="con-parl__gov-empty" data-parl-gov-empty>
              <span class="con-parl__gov-empty-mark" aria-hidden="true">◇</span>
              <span class="con-parl__gov-empty-text">{{ $t('No resolution enacted yet') }}</span>
            </div>
            <!-- THE RULER — a compact identity line, then the effect everyone
                 holds while the party rules: its printed formula at a readable
                 size and its one-sentence reading. -->
            <div class="con-parl__ruler" :data-zoom-slot="partyKeyOf(view.rulingParty)" data-parl-ruler ref="rulerEl">
              <div class="con-parl__ruler-ident">
                <img class="con-parl__ruler-emblem" :src="emblemUrl(view.rulingParty)" alt="" />
                <div class="con-parl__ruler-text">
                  <span class="con-parl__ruler-kicker">{{ $t('Ruling party') }}</span>
                  <b class="con-parl__ruler-name">{{ $t(view.rulingParty) }}</b>
                </div>
              </div>
              <ConsolePartyFormula class="con-parl__ruler-formula" :party="view.rulingParty" size="wide" />
              <span v-if="rulingEffectText !== undefined" class="con-parl__ruler-rule">{{ $t(rulingEffectText) }}</span>
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
                  <PlayerCube :color="view.chairman" :size="cubePx(12)" />
                  <b>{{ nameOf(view.chairman) }}</b>
                </template>
                <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
              </span>
            </div>
          </div>
          <div v-else class="con-parl__chair con-parl__chair--alone" :class="{'con-parl__chair--pulse': chairPulse}" data-parl-chair>
            <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
            <template v-if="view.chairman !== undefined">
              <PlayerCube :color="view.chairman" :size="cubePx(12)" />
              <b>{{ nameOf(view.chairman) }}</b>
            </template>
            <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
          </div>
        </div>

        <!-- ── THE VOTING AREA — ONE focus zone: three resolutions in the order
             that breaks ties (the first stands closest to the government), the
             delegates on each in placement order, the leader, the winning card.
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
            <span v-if="winningSlot !== undefined" class="con-parl__voting-lead">
              <span class="con-parl__chip-dim">{{ $t('Winning') }}</span>
              <img class="con-parl__slot-emblem" :src="emblemUrl(winningSlot.party)" alt="" />
              <b>{{ $t(resolutionTitle(winningSlot.resolutionId)) }}</b>
            </span>
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
                    <span v-if="winningShownOf(slot)" class="con-parl__slot-win">{{ $t('Winning') }}</span>
                  </div>
                  <div class="con-parl__card"
                       :data-zoom-slot="'resolution:' + slot.resolutionId"
                       :data-zoom-handoff="slotsCarried && slotIndex === i ? 'parliament-vote' : undefined"
                       :data-parl-vote-card="slotsCarried && slotIndex === i ? '' : undefined">
                    <premium-card-face v-if="slotVms[i] !== undefined" :vmOverride="slotVms[i]" :lightweight="true" :inert="true" />
                  </div>
                  <!-- THE DELEGATE RIBBON — every delegate on the card, in placement
                       order (the order that breaks a tie among players), and — in
                       the vote mode, on the selected card — the PLACE the next
                       delegate takes (hollow until it lands). -->
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
                  <!-- THE TALLY — one line: how many delegates, who LEADS, what is
                       YOURS with the two places of the party-effect threshold. In
                       flight, the selected card's numbers wait for the touchdown. -->
                  <div class="con-parl__tally" data-parl-tally>
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
                    <span v-if="viewerParticipates && viewerColor !== undefined" class="con-parl__tally-row con-parl__tally-row--mine"
                          :class="{'con-parl__tally-row--held': tallyOf(slot, i).mine >= PARTY_EFFECT_THRESHOLD}" data-parl-mine>
                      <span class="con-parl__tally-key">{{ $t('Yours') }}</span>
                      <span class="con-parl__places" aria-hidden="true">
                        <span v-for="n in PARTY_EFFECT_THRESHOLD" :key="n" class="con-parl__place" :class="{'con-parl__place--on': n <= tallyOf(slot, i).mine}">
                          <PlayerCube v-if="n <= tallyOf(slot, i).mine" :color="viewerColor" :size="cubePx(10)" :glow="false" />
                        </span>
                      </span>
                      <b :key="'m' + tallyOf(slot, i).mine" class="con-parl__tick">{{ tallyOf(slot, i).mine }}</b>
                    </span>
                  </div>
                </div>
              </Teleport>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ THE SEATS — every player's delegates by PLACE: the lobby's one
           socket, the reserve, the chairman's seat. THE one ledger of the
           delegates — the physical sources and destinations of a delegate's
           every move (a vote, a return, the lobby's refill, the seat). ══ -->
      <div class="con-parl__seats" data-parl-seats data-parl-recede>
        <div v-for="seat in seats" :key="seat.color" class="con-parl__seat" :class="{'con-parl__seat--me': seat.color === viewerColor}" :data-parl-seat="seat.color">
          <PlayerCube :color="seat.color" :size="cubePx(12)" :glow="false" />
          <span class="con-parl__seat-name">{{ seat.name }}</span>
          <span class="con-parl__seat-key">{{ $t('Lobby') }}</span>
          <span class="con-parl__socket con-parl__socket--small" :class="{'con-parl__socket--empty': !seat.lobby}" :data-parl-seat-lobby="seat.color">
            <PlayerCube v-if="seat.lobby" :color="seat.color" :size="cubePx(12)" :glow="false" />
          </span>
          <span class="con-parl__seat-key">{{ $t('Reserve') }}</span>
          <span class="con-parl__socket con-parl__socket--small" :class="{'con-parl__socket--empty': seat.reserve === 0}" :data-parl-seat-reserve="seat.color">
            <PlayerCube v-if="seat.reserve > 0" :color="seat.color" :size="cubePx(12)" :glow="false" />
          </span>
          <b :key="'sr' + seat.reserve" class="con-parl__seat-count con-parl__tick">×{{ seat.reserve }}</b>
          <span v-if="seat.chairman" class="con-parl__seat-chair" :class="{'con-parl__seat-chair--pulse': chairPulse && seat.color === view.chairman}" :data-parl-seat-chair="seat.color"><span class="con-parl__seat-glyph" aria-hidden="true"></span>{{ $t('Chairman') }}</span>
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
                                  :focused="zone === 'parties' && partyIndex === i && stage === 'browse'" />
            </div>
          </div>
          <!-- THE PARTY LINE — one fixed-height line under the row: the ONE
               short reason the focused party's action cannot be taken right
               now. Empty when it can, or when the party has no action. -->
          <div class="con-parl__pline" :class="{'con-parl__pline--off': partyLine === '', ['con-parl__pline--' + partyLineTone]: partyLine !== ''}" data-parl-pline>
            <span v-if="partyLine !== ''" class="con-parl__pline-text">{{ partyLine }}</span>
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
        <div class="con-parl__track">
          <div class="con-parl__step con-parl__step--start" :class="{'con-parl__step--here': viewerParticipates && agendaVm.viewerPosition === 0}" data-step="0">
            <span class="con-parl__step-icon">{{ $t('Agenda start') }}</span>
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
                 'con-parl__step--pulse': agendaPulseStep === step.index,
               }]"
               :data-step="step.index">
              <span class="con-parl__step-icon">
                <template v-if="step.step.kind === 'influence'"><span class="con-parl__step-level">{{ step.step.influence }}</span></template>
                <template v-else-if="step.step.kind === 'tr'"><i class="con-parl__step-res resource_icon resource_icon--rating" aria-hidden="true"></i></template>
                <template v-else><i class="con-parl__step-res resource_icon resource_icon--cards" aria-hidden="true"></i></template>
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
         that exists before the slots do); visible while the mode stands. ══ -->
    <div class="con-parl__vote"
         :class="{
           'con-parl__vote--up': voteUp || voteLeaving,
           'con-parl__vote--committed': voteCommitted,
           'con-parl__vote--landed': stage === 'landed',
           'con-parl__vote--paying': stage === 'paying',
           'con-parl__vote--entering': voteEntering,
         }"
         :style="{'--parl-accent': voteSlot !== undefined ? partyAccent(voteSlot.party) : undefined}"
         :aria-hidden="voteUp ? undefined : 'true'"
         data-parl-vote
         ref="voteEl">
      <!-- THE BENCH — the viewer's two places: the lobby's ONE socket (the free
           delegate waits there, or it is spent) and the reserve as a stack with
           its count. The delegate LEAVES one of these; the one that will is
           marked. -->
      <div class="con-parl__bench" data-parl-bench :data-parl-bench-source="voteSource">
        <span class="con-parl__bench-kicker">
          <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="cubePx(12)" :glow="false" />
          <span>{{ $t('Your delegates') }}</span>
        </span>
        <div class="con-parl__bench-group con-parl__bench-group--lobby" :class="{'con-parl__bench-group--source': benchSource === 'lobby', 'con-parl__bench-group--empty': !lobbyCubeShown}" data-parl-bench-lobby>
          <span class="con-parl__bench-key">{{ $t('Lobby') }}</span>
          <span class="con-parl__socket con-parl__socket--bench" :class="{'con-parl__socket--empty': !lobbyCubeShown}" data-parl-lobby-cube>
            <PlayerCube v-if="lobbyCubeShown && viewerColor !== undefined" :color="viewerColor" :size="cubePx(RIBBON_CUBE)" />
          </span>
          <span class="con-parl__bench-note">{{ $t(lobbyNoteFree ? 'free delegate' : 'spent this generation') }}</span>
        </div>
        <div class="con-parl__bench-group con-parl__bench-group--reserve" :class="{'con-parl__bench-group--source': benchSource === 'reserve' && !benchWarn, 'con-parl__bench-group--empty': reserveCubesShown === 0}" data-parl-bench-reserve>
          <span class="con-parl__bench-key">{{ $t('Reserve') }}</span>
          <span class="con-parl__stack" :class="{'con-parl__stack--empty': reserveCubesShown === 0}" data-parl-reserve-cube :data-count="reserveCubesShown">
            <span v-for="n in Math.min(reserveCubesShown, 3)" :key="n" class="con-parl__stack-cube" :data-stack="n">
              <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="cubePx(RIBBON_CUBE)" :glow="n === Math.min(reserveCubesShown, 3)" />
            </span>
          </span>
          <b :key="'rc' + reserveCountShown" class="con-parl__bench-count con-parl__tick">×{{ reserveCountShown }}</b>
          <span class="con-parl__bench-note">{{ reserveCostText }}</span>
        </div>
        <!-- The source is MARKED on its own group; only «nothing to send» needs words here. -->
        <span v-if="benchWarn" class="con-parl__bench-hint con-parl__bench-hint--warn" data-parl-bench-hint>{{ benchHint }}</span>
      </div>

      <!-- THE CARD ROW — the three slots stand here while the mode is up. -->
      <div class="con-parl__vrow" data-parl-vrow ref="vrowEl"></div>

      <!-- THE INFO SURFACE — what the SELECTED card is (left) and what THIS
           VOTE changes (right). Fixed geometry: the bodies crossfade in place
           when the selection moves; nothing above them ever reflows. -->
      <div class="con-parl__info" data-parl-vote-surface>
        <div class="con-parl__info-res">
          <transition name="con-parl-xfade">
            <!-- Always MOUNTED (the layer hides it): the press that opens the mode
                 then moves the cards and lifts the surface — it builds nothing. -->
            <div v-if="voteInfo !== undefined" :key="voteInfo.instance" class="con-parl__info-body" data-parl-vote-body>
              <div class="con-parl__info-head" data-parl-vote-item>
                <img class="con-parl__info-emblem" :src="emblemUrl(voteInfo.party)" alt="" />
                <span class="con-parl__info-title">
                  <b class="con-parl__info-name">{{ $t(voteInfo.name) }}</b>
                  <span class="con-parl__info-party">{{ $t(voteInfo.party) }}</span>
                </span>
                <span v-if="voteInfo.winning" class="con-parl__slot-win">{{ $t('Winning') }}</span>
              </div>
              <!-- THE RESOLUTION'S OWN EFFECT — its printed graphic and its
                   one sentence; a dummy says calmly that it has none. -->
              <div class="con-parl__info-block con-parl__info-block--own" :class="{'con-parl__info-block--none': voteInfo.ownMechanics === undefined && voteInfo.ownText === undefined}" data-parl-vote-item data-parl-info="own">
                <span class="con-parl__info-kicker" data-parl-vote-late>{{ $t('Resolution effect') }}</span>
                <div class="con-parl__info-row">
                  <PremiumMechanicsPanel v-if="voteInfo.ownMechanics !== undefined" class="con-parl__info-mech" :mechanics="voteInfo.ownMechanics" />
                  <span v-else class="con-parl__info-none">{{ $t('No effect of its own') }}</span>
                  <span v-if="voteInfo.ownText !== undefined" class="con-parl__info-text" data-parl-vote-late>{{ $t(voteInfo.ownText) }}</span>
                </div>
              </div>
              <!-- IF ENACTED — the party rules and everyone gets its effect. The
                   viewer's OWN access to it is a separate fact (two delegates),
                   stated on the right beside the vote. -->
              <div class="con-parl__info-block con-parl__info-block--party" data-parl-vote-item data-parl-info="party">
                <span class="con-parl__info-kicker" data-parl-vote-late>{{ $t('If the resolution is enacted') }}</span>
                <span class="con-parl__info-rule" data-parl-vote-late>{{ enactedRuleText(voteInfo.party) }}</span>
                <div class="con-parl__info-row">
                  <ConsolePartyFormula class="con-parl__info-pformula" :party="voteInfo.party" size="wide" />
                  <span class="con-parl__info-text con-parl__info-text--party" data-parl-vote-late>
                    <span v-if="voteInfo.partyPassive !== undefined">{{ $t(voteInfo.partyPassive) }}</span>
                    <span v-if="voteInfo.partyAction !== undefined" class="con-parl__info-action">{{ $t('Action') }}: {{ $t(voteInfo.partyAction) }} · {{ $t('once per generation') }}</span>
                  </span>
                </div>
              </div>
              <!-- THE CHAIRMAN QUEST it would set — the condition and what
                   completing it pays. -->
              <div class="con-parl__info-block con-parl__info-block--quest" data-parl-vote-item data-parl-info="quest">
                <span class="con-parl__info-kicker" data-parl-vote-late>{{ $t('Chairman quest') }}</span>
                <div class="con-parl__info-row">
                  <PremiumMechanicsPanel v-if="voteInfo.questMechanics !== undefined" class="con-parl__info-quest" :mechanics="voteInfo.questMechanics" />
                  <span class="con-parl__info-text" data-parl-vote-late>{{ $t(voteInfo.questText) }} · {{ $t('reward: the chairman seat and one Agenda step') }}</span>
                </div>
              </div>
            </div>
          </transition>
        </div>
        <div class="con-parl__info-vote">
          <div class="con-parl__info-vote-main" v-show="stage !== 'paying'">
            <transition name="con-parl-xfade">
              <div v-if="voteInfo !== undefined" :key="voteInfo.instance" class="con-parl__info-body con-parl__info-body--vote">
                <!-- THE SOURCE — the delegate at its place, and its price. -->
                <div class="con-parl__info-block con-parl__info-block--source" data-parl-vote-item data-parl-vote-source>
                  <span class="con-parl__info-kicker" data-parl-vote-late>{{ $t('Your vote') }}</span>
                  <div class="con-parl__info-src">
                    <span class="con-parl__socket con-parl__socket--small" :class="{'con-parl__socket--empty': benchSource === 'none'}">
                      <PlayerCube v-if="benchSource !== 'none' && viewerColor !== undefined" :color="viewerColor" :size="cubePx(12)" :glow="false" />
                    </span>
                    <b class="con-parl__info-src-text">{{ sourceText }}</b>
                    <ActionEffectChip v-if="voteSource === 'reserve' && benchSource !== 'none'" class="con-parl__vote-cost" :effect="voteCostChip" />
                    <span v-else-if="benchSource === 'lobby'" class="con-parl__info-free">{{ $t('free') }}</span>
                  </div>
                </div>
                <!-- AFTER YOUR VOTE — only this vote's own consequences, each
                     as current → projected; the projected side is marked as a
                     forecast until the delegate has landed. -->
                <div class="con-parl__info-block con-parl__info-block--after" :class="{'con-parl__info-block--done': stage === 'landed'}" data-parl-vote-item data-parl-vote-forecast>
                  <span class="con-parl__info-kicker" data-parl-vote-late>{{ $t(stage === 'landed' ? 'Result' : 'After your vote') }}</span>
                  <div class="con-parl__facts">
                    <!-- ONE row for the count — the card's total, and of them the viewer's own. -->
                    <div class="con-parl__fact" data-parl-fact="votes" data-parl-vote-late>
                      <span class="con-parl__fact-key">{{ $t('Delegates on the card') }}</span>
                      <span class="con-parl__fact-val">
                        <b>{{ voteNumbers.votesBefore }}</b><span class="con-parl__fact-arrow" aria-hidden="true">→</span><b class="con-parl__fact-after">{{ voteNumbers.votesAfter }}</b>
                        <span class="con-parl__fact-tail" data-parl-fact="mine">{{ $t('of them yours') }} <b>{{ voteNumbers.mineBefore }}</b><span class="con-parl__fact-arrow" aria-hidden="true">→</span><b class="con-parl__fact-after">{{ voteNumbers.mineAfter }}</b></span>
                      </span>
                    </div>
                    <div class="con-parl__fact" :class="{'con-parl__fact--gain': voteFacts.lead.change === 'take', 'con-parl__fact--dim': voteFacts.lead.change === 'none'}" data-parl-fact="lead" data-parl-vote-late>
                      <span class="con-parl__fact-key">{{ $t('Leader') }}</span>
                      <span class="con-parl__fact-val">
                        <template v-if="voteFacts.lead.before !== undefined">
                          <PlayerCube v-if="voteFacts.lead.before !== 'neutral'" :color="voteFacts.lead.before" :size="cubePx(11)" :glow="false" />
                          <PlayerCube v-else color="neutral" steel :size="cubePx(11)" :glow="false" />
                        </template>
                        <span v-else class="con-parl__fact-none">—</span>
                        <span class="con-parl__fact-arrow" aria-hidden="true">→</span>
                        <template v-if="voteFacts.lead.after !== undefined">
                          <PlayerCube v-if="voteFacts.lead.after !== 'neutral'" :color="voteFacts.lead.after" :size="cubePx(11)" :glow="false" />
                          <PlayerCube v-else color="neutral" steel :size="cubePx(11)" :glow="false" />
                        </template>
                        <b class="con-parl__fact-after">{{ $t(voteFacts.lead.label) }}</b>
                      </span>
                    </div>
                    <div class="con-parl__fact" :class="{'con-parl__fact--gain': voteFacts.win.change === 'become', 'con-parl__fact--dim': voteFacts.win.change === 'none'}" data-parl-fact="win" data-parl-vote-late>
                      <!-- A row's NOTE stands under its key (never beside the value — it squeezed the key into an ellipsis). -->
                      <span class="con-parl__fact-key">{{ $t('Winning') }}<span v-if="voteFacts.win.note !== undefined" class="con-parl__fact-note">{{ $t(voteFacts.win.note) }}</span></span>
                      <span class="con-parl__fact-val"><b>{{ $t(voteFacts.win.before) }}</b><span class="con-parl__fact-arrow" aria-hidden="true">→</span><b class="con-parl__fact-after">{{ $t(voteFacts.win.after) }}</b></span>
                    </div>
                    <div class="con-parl__fact" :class="{'con-parl__fact--gain': voteFacts.access.change === 'unlock', 'con-parl__fact--dim': voteFacts.access.change === 'none'}" data-parl-fact="access" data-parl-vote-late>
                      <span class="con-parl__fact-key">{{ $t('Party effect for you') }}<span v-if="voteFacts.access.note !== undefined" class="con-parl__fact-note">{{ $t(voteFacts.access.note) }}</span></span>
                      <span class="con-parl__fact-val"><b>{{ voteFacts.access.before }}</b><span class="con-parl__fact-arrow" aria-hidden="true">→</span><b class="con-parl__fact-after">{{ voteFacts.access.after }}</b></span>
                    </div>
                  </div>
                </div>
              </div>
            </transition>
          </div>
          <!-- A paid vote's PAYMENT stands here, inside the mode. -->
          <div class="con-parl__embed" data-embed-slot="parliament-vote"></div>
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
            <span v-if="stage === 'vote' && canVoteNow" class="con-parl__cta-sub">{{ $t('A full action') }}</span>
          </div>
        </div>
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
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectPaymentModel, VotePaymentMeta} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PARLIAMENT_VOTE_COST, PARTY_EFFECT_DELEGATES as PARTY_EFFECT_THRESHOLD, PartyActionId, ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import ConsolePartyPlaque from '@/client/components/console/parliament/ConsolePartyPlaque.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {consoleParliamentUi, markParliamentRecapSeen, parliamentRecapSeen} from '@/client/console/consoleParliamentState';
import {
  agendaViewOf, AgendaVm, buildParliamentView, ParliamentPartyVm, ParliamentPromptBridge,
  ParliamentSlotVm, ParliamentTileVm, ParliamentViewVm, parliamentPromptBridge, partyActionStateOf, PartyActionStateVm,
  partyStateOf, PartyStateVm, seatResponse, voteAccessOf, voteForecastOf, VoteForecastVm, voteResponse,
} from '@/client/console/parliament/consoleParliamentModel';
import {partyTileKey} from '@/client/console/parliament/partyActionKey';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {
  descendWorkspaceFrame, foldWorkspaceFrame, setWorkspaceFramePhase, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameHasNested,
} from '@/client/console/consoleWorkspaceStack';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {promptIdentityKey} from '@/client/console/turnIntents';
import {getPartyEffect, getResolution} from '@/client/parliament/ClientParliamentManifest';
import {useResizeObserver} from '@vueuse/core';
import {consoleLayoutState, conUiScale} from '@/client/console/consoleLayoutProfile';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {probeTick} from '@/client/console/probeTick';
import {motionMs} from '@/client/components/motion/motionTokens';
import {armDescendOrigin, armDescendRect, descendSurfaceInset, guardedDescend} from '@/client/console/surfaceMotion/workspaceDescend';
import {armActionFocusOrigin} from '@/client/console/consoleActionFocusMotion';
import {
  CubeFlightHandle, killParliamentVoteMotion, measureVoteRects, parkParliamentBody, playParliamentVoteEnter, playParliamentVoteLeave,
  Rect, restoreParliamentBody, runDelegateCubeFlight,
} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {HydroMarkerDirectorHandle, runHydroMarkerGlide} from '@/client/console/hydroMarker/hydroMarkerDirector';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

type Zone = 'voting' | 'government' | 'parties';
/**
 * `vote` — the decision mode (a phase descent); `submitting` — sent;
 * `paying` — a paid vote's payment stands inside the mode; `landed` — the
 * answer arrived: the delegate settles on the card before the flow leaves.
 * `seat` — the chairman's mandatory pick; `recap` — the RESULTS scene.
 */
type Stage = 'browse' | 'vote' | 'seat' | 'submitting' | 'paying' | 'landed' | 'recap';

/** The delegate's landing beat (the cube settles, the counters tick). */
const VOTE_LANDING_MS = 700;
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
const MAX_CARD_ZOOM = 0.72;
const MIN_CARD_ZOOM = 0.3;
/** The enacted face — the government's MAIN object. */
const MAX_GOV_ZOOM = 0.62;
const MIN_GOV_ZOOM = 0.2;
/** The vote row's cards. */
const MAX_VOTE_ZOOM = 1.05;
const MIN_VOTE_ZOOM = 0.35;

/**
 * The inspector's request: WHAT to open, WHERE it physically stands (the
 * card lifts out of that element and returns into it) and — for the voting
 * area — the A verb the fullscreen offers, which opens the SAME vote mode on
 * the card the viewer is showing (the card flies from the viewer into its
 * place in the vote row).
 */
export type ParliamentInspectRequest =
  | {
    kind: 'resolution',
    ids: ReadonlyArray<string>,
    index: number,
    origin?: (index: number) => HTMLElement | null,
    onBrowse?: (index: number) => void,
    vote?: {labelFor: (id: string) => string | undefined, reasonsFor: (id: string) => ReadonlyArray<string>, execute: (id: string) => void},
  }
  | {kind: 'party', party: ReduxParty, origin?: () => HTMLElement | null};

type RibbonGroup = {owner: Color | 'neutral', count: number, seqs: ReadonlyArray<number>, hasSeq: (seq: number | undefined) => boolean};

type SeatRow = {color: Color, name: string, lobby: boolean, reserve: number, chairman: boolean};

/** The vote's numbers at the SUBMIT — the mode reads these until the delegate has landed (and the source the delegate leaves from). */
type VoteSnapshot = {votes: number, mine: number, leader: Color | 'neutral' | undefined, winning: boolean, winner: string | undefined, source: 'lobby' | 'reserve'};

type FlightSpec = {id: string, color: Color | 'neutral', size: number};

/** THIS VOTE's consequences, each as current → projected. */
type VoteFactsVm = {
  lead: {before: Color | 'neutral' | undefined, after: Color | 'neutral' | undefined, label: string, change: 'take' | 'keep' | 'none'};
  win: {before: string, after: string, note: string | undefined, change: 'become' | 'stay' | 'none'};
  access: {before: string, after: string, note: string | undefined, change: 'unlock' | 'held' | 'progress' | 'none'};
};

/** What the SELECTED card is — the info surface's left half. */
type VoteInfo = {
  instance: string;
  name: string;
  party: ReduxParty;
  winning: boolean;
  ownMechanics: MechanicsVM | undefined;
  ownText: string | undefined;
  partyPassive: string | undefined;
  partyAction: string | undefined;
  questMechanics: MechanicsVM | undefined;
  questText: string;
};

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
};

function emptyRecapPending(): RecapPending {
  return {returns: new Map(), support: new Map(), hiddenCubes: new Set(), lobby: new Set()};
}

export default defineComponent({
  name: 'ConsoleParliamentSection',
  components: {ConsoleWsHead, PlayerCube, ActionEffectChip, GamepadGlyph, PremiumMechanicsPanel, ConsolePartyPlaque, ConsolePartyFormula},
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
      flightEls: {} as Record<string, HTMLElement | null>,
      flightHandles: {} as Record<string, CubeFlightHandle>,
      flightSerial: 0,
      landingTimer: undefined as number | undefined,
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
    /** The vote mode stands over the overview. */
    voteUp(): boolean {
      return this.stage === 'vote' || this.stage === 'paying' || this.stage === 'landed' ||
        (this.stage === 'submitting' && this.stageBeforeSubmit === 'vote');
    },
    /** The three slots are in the vote row (up, or folding back — the leave animates them home first). */
    slotsCarried(): boolean {
      return this.voteUp;
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
    /** The ruling party's effect in one sentence (its passive, else its action). */
    rulingEffectText(): string | undefined {
      const effect = this.view.rulingEffect;
      return effect?.text.passive ?? effect?.text.action ?? effect?.text.rule;
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
    lobbyCubeShown(): boolean {
      return this.sourceHold === 'lobby' || (this.view.viewer?.lobby === true);
    },
    /** The lobby's note stays «free delegate» until the cube has visibly left the socket. */
    lobbyNoteFree(): boolean {
      return this.sourceLeaving === 'lobby' || this.lobbyCubeShown;
    },
    reserveCubesShown(): number {
      return (this.view.viewer?.reserve ?? 0) + (this.sourceHold === 'reserve' ? 1 : 0);
    },
    /** The reserve's COUNT ticks when the cube has visibly left the stack (the stack's top cube goes the frame the proxy stands over it). */
    reserveCountShown(): number {
      return (this.view.viewer?.reserve ?? 0) + (this.sourceLeaving === 'reserve' ? 1 : 0);
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
    /** The reserve's price per delegate — the rule's constant (the live tile's cost only while the reserve IS the source). */
    reserveCostText(): string {
      const tile = this.voteTile;
      const cost = tile !== undefined && tile.source === 'reserve' && tile.cost !== undefined && tile.cost > 0 ? tile.cost : PARLIAMENT_VOTE_COST;
      return translateTextWithParams('${0} M€ per delegate', [String(cost)]);
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
    benchHint(): string {
      switch (this.benchSource) {
      case 'lobby': return translateText('The free delegate goes');
      case 'reserve': return translateText(this.benchWarn ? 'Not enough M€ for a reserve delegate' : 'A reserve delegate goes');
      default: return translateText('No delegate left to send');
      }
    },
    sourceText(): string {
      switch (this.benchSource) {
      case 'lobby': return translateText('Free delegate from the lobby');
      case 'reserve': return translateText('From the reserve');
      default: return translateText('No delegate left to send');
      }
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
      return this.view.players.filter((p) => p.participates).map((p) => {
        const pendingLobby = this.recapPending.lobby.has(p.color);
        const pendingReturns = this.recapPending.returns.get(p.color) ?? 0;
        return {
          color: p.color, name: p.name,
          lobby: p.lobby && !pendingLobby,
          reserve: Math.max(0, p.reserve - pendingReturns + (pendingLobby ? 1 : 0)),
          chairman: p.chairman,
        };
      });
    },
    neutralSupplyShown(): number {
      return Math.max(0, this.view.neutralSupply - (this.recapPending.returns.get('neutral') ?? 0));
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
    /** The SELECTED card's reading — the info surface's left half. */
    voteInfo(): VoteInfo | undefined {
      const slot = this.voteSlot;
      if (slot === undefined) {
        return undefined;
      }
      const resolution = slot.resolution ?? getResolution(slot.resolutionId);
      const effect = getPartyEffect(slot.party);
      const own = resolution === undefined ? undefined : buildMechanics(resolution.renderData);
      const questRoot = resolution?.questRenderData;
      const quest = questRoot === undefined ? undefined : buildMechanics(questRoot);
      return {
        instance: slot.instance,
        name: this.resolutionTitle(slot.resolutionId),
        party: slot.party,
        winning: this.winningShownOf(slot),
        ownMechanics: own === undefined || own.textOnly ? undefined : own,
        ownText: resolution === undefined ? undefined : (resolution.dummy ? undefined : (resolution.text.effect ?? resolution.text.passive ?? resolution.text.action)),
        partyPassive: effect?.text.passive,
        partyAction: effect?.text.action,
        questMechanics: quest === undefined || quest.textOnly ? undefined : quest,
        questText: resolution?.text.quest ?? '',
      };
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
    /** THIS VOTE's consequences — every fact as current → projected (a fact that does not change is shown quiet, never hidden). */
    voteFacts(): VoteFactsVm {
      const slot = this.voteSlot;
      const f = this.voteForecast;
      const me = this.viewerColor;
      const leaderBefore = this.voteSnapshot?.leader ?? slot?.leader;
      const leaderAfter = this.stage === 'landed' ? slot?.leader : (f?.leaderAfter ?? (this.voteSnapshot !== undefined ? slot?.leader : leaderBefore));
      const leadChange: 'take' | 'keep' | 'none' = leaderAfter !== undefined && leaderAfter === me ? (leaderBefore === me ? 'keep' : 'take') : 'none';
      const leadLabel = leaderAfter === undefined ? 'no leader yet' : (leaderAfter === me ? (leadChange === 'take' && f?.tieNote === 'earlier-delegate' ? 'you (earlier delegate)' : 'you') : (leaderAfter === 'neutral' ? 'the neutral player' : this.nameOf(leaderAfter)));
      const winningBefore = this.voteSnapshot?.winning ?? slot?.isWinning ?? false;
      const winningAfter = this.stage === 'landed' ? (slot?.isWinning ?? false) : (f?.winningAfter ?? winningBefore);
      const winChange: 'become' | 'stay' | 'none' = winningAfter ? (winningBefore ? 'stay' : 'become') : 'none';
      const access = voteAccessOf(slot, this.view.parties.find((p) => p.party === slot?.party),
        this.stage === 'landed' ? slot?.viewerVotes : this.voteNumbers.mineAfter, this.voteNumbers.mineBefore);
      return {
        lead: {before: leaderBefore, after: leaderAfter, label: leadLabel, change: leadChange},
        win: {
          before: winningBefore ? 'yes' : 'no',
          after: winningAfter ? 'yes' : 'no',
          note: winChange === 'become' && f?.tieNote === 'slot-priority' ? 'wins the tie: closer to the government' : (winChange === 'none' && !winningAfter ? 'another resolution leads' : undefined),
          change: winChange,
        },
        access: {
          before: access.heldByOther ? translateText('effect is yours') : translateTextWithParams('${0} of ${1}', [String(access.before), String(access.threshold)]),
          after: access.heldByOther ? translateText('effect is yours') : (access.after >= access.threshold ? translateText('effect is yours') : translateTextWithParams('${0} of ${1}', [String(access.after), String(access.threshold)])),
          note: access.heldByOther ? access.reason : (access.after >= access.threshold && access.before < access.threshold ? 'two of your delegates' : undefined),
          change: access.heldByOther ? 'held' : (access.after >= access.threshold ? (access.before >= access.threshold ? 'held' : 'unlock') : (access.after > access.before ? 'progress' : 'none')),
        },
      };
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
    voteCostChip(): ActionEffect {
      const cost = this.votePayment?.cost ?? this.voteTile?.cost ?? 0;
      const current = this.playerView.thisPlayer?.megacredits ?? 0;
      return {direction: 'cost', icon: 'megacredits', amount: cost, current, resulting: Math.max(0, current - cost)};
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
      switch (this.stage) {
      case 'vote':
      case 'paying':
      case 'landed':
        return this.resolutionTitle(this.voteSlot?.resolutionId ?? '');
      case 'seat':
        return this.resolutionTitle(this.focusedSlot?.resolutionId ?? '');
      case 'submitting':
        return this.resolutionTitle((this.stageBeforeSubmit === 'vote' ? this.voteSlot : this.focusedSlot)?.resolutionId ?? '');
      case 'recap': return this.recapKicker;
      default: return '';
      }
    },
    crumbSubjectRaw(): boolean {
      return this.stage === 'recap';
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
        descendWorkspaceFrame('parliament', this.resolutionTitle(slot.resolutionId), 'Payment');
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
    this.clearRecapTimers();
    this.killFlights();
    for (const timer of [this.accessTimer, this.agendaTimer, this.questTimer, this.usedTimer, this.chairTimer]) {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    }
    this.stopAgendaGlide();
    killParliamentVoteMotion(this.$refs.rootEl as HTMLElement | undefined);
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
      case 'vote':
      case 'landed':
        return 'Vote';
      case 'paying': return 'Payment';
      case 'seat': return 'Chairman seat';
      default: return '';
      }
    },
    /** «The <party> rule — every player has their effect». */
    enactedRuleText(party: ReduxParty): string {
      return translateTextWithParams('${0} rule — every player has their effect', [translateText(party)]);
    },
    /** Solve the card zooms (voting slots · the enacted face · the vote row) from the measured frame. */
    fitCards(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined) {
        return;
      }
      const scale = conUiScale();
      const px = (v: string): number => parseFloat(v) || 0;
      const heightOf = (host: Element, sel: string): number => host.querySelector<HTMLElement>(sel)?.getBoundingClientRect().height ?? 0;
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
        const zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_CARD_ZOOM * scale);
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
    },
    /** The browse layer's verbs depend on the focused ZONE (one bar, one contract). */
    browseCommands(back: ConsoleCommand): Array<ConsoleCommand> {
      switch (this.zone) {
      case 'voting': {
        const cmds: Array<ConsoleCommand> = [];
        if (this.view.slots.length > 0) {
          cmds.push({control: 'confirm', label: 'Vote', enabled: true, highlight: this.canVoteNow});
        }
        cmds.push({control: 'secondary', label: 'Inspect'}, back);
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
      if (this.stage === 'submitting' || this.stage === 'landed' || this.stage === 'paying') {
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
      descendWorkspaceFrame('parliament', this.resolutionTitle(selected.resolutionId), 'Vote');
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
    /** The SAME mode, entered from the fullscreen viewer on the card it is showing (the card flies from the viewer into its place). */
    openVoteFromViewer(resolutionId: string): void {
      const idx = this.view.slots.findIndex((s) => s.resolutionId === resolutionId);
      if (idx === -1) {
        return;
      }
      this.openVote({fromViewer: true, index: idx});
    },
    /** B before the commit: the same phrase folded back — every object returns home, the focus is where it was. */
    closeVote(): void {
      if (!this.voteUp) {
        return;
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
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
            this.slotIndex = Math.max(0, this.slotIndex - 1);
          } else if (intent.dir === 'right') {
            this.slotIndex = Math.min(this.view.slots.length - 1, this.slotIndex + 1);
          }
          if (this.voteSlot !== undefined) {
            setWorkspaceFrameSubject('parliament', this.resolutionTitle(this.voteSlot.resolutionId));
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
        const slot = this.voteSlot;
        if (slot !== undefined) {
          this.$emit('inspect', {kind: 'resolution', ids: [slot.resolutionId], index: 0, origin: () => slotFace(slot.instance)} as ParliamentInspectRequest);
        }
        return;
      }
      if (this.zone === 'voting' || this.stage === 'seat') {
        const slots = this.view.slots;
        if (slots.length === 0) {
          return;
        }
        if (this.stage === 'seat') {
          const slot = this.focusedSlot;
          if (slot !== undefined) {
            this.$emit('inspect', {kind: 'resolution', ids: [slot.resolutionId], index: 0, origin: () => slotFace(slot.instance)} as ParliamentInspectRequest);
          }
          return;
        }
        const request: ParliamentInspectRequest = {
          kind: 'resolution',
          ids: slots.map((s) => s.resolutionId),
          index: Math.max(0, Math.min(slots.length - 1, this.slotIndex)),
          origin: (i) => {
            const s = slots[i];
            return s === undefined ? null : slotFace(s.instance);
          },
          onBrowse: (i) => {
            if (i >= 0 && i < slots.length) {
              this.slotIndex = i;
            }
          },
          vote: {
            labelFor: () => 'Vote',
            reasonsFor: () => (this.canVoteNow ? [] : [this.voteBlockedText]),
            execute: (id) => this.openVoteFromViewer(id),
          },
        };
        this.$emit('inspect', request);
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
      switch (item.focus) {
      case 'enacted': {
        // The enacted card's delegates go home: players' to their reserves, neutral to the supply.
        const from = rect(root.querySelector('.con-parl__gov-card .pcard') ?? root.querySelector('.con-parl__gov-card'));
        let i = 0;
        for (const [owner, count] of Array.from(this.recapPending.returns.entries())) {
          const to = owner === 'neutral' ?
            rect(root.querySelector('[data-parl-neutral-cube]')) :
            rect(root.querySelector(`[data-parl-seat-reserve="${owner}"]`));
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
        // Popular support becomes votes: each party's steel cubes leave their places for the fresh card.
        let i = 0;
        for (const fresh of last.refreshed) {
          const slot = this.view.slots.find((s) => s.instance === fresh.instance);
          if (slot === undefined) {
            continue;
          }
          const places = Array.from(root.querySelectorAll<HTMLElement>(`.con-parl__party[data-party="${fresh.party}"] .con-pseal__support-place`));
          const hidden = Array.from(this.recapPending.hiddenCubes).filter((key) => key.startsWith(`${slot.instance}#`));
          hidden.forEach((key, n) => {
            const seq = key.substring(key.indexOf('#') + 1);
            const from = rect(places[Math.min(n, places.length - 1)]);
            const to = rect(root.querySelector(`.con-parl__slot[data-instance="${slot.instance}"] [data-seq="${seq}"]`));
            const delay = i * 80;
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
          const from = rect(root.querySelector(`[data-parl-seat-reserve="${color}"]`));
          const to = rect(root.querySelector(`[data-parl-seat-lobby="${color}"]`));
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
    },
    killFlights(): void {
      for (const id of Object.keys(this.flightHandles)) {
        this.flightHandles[id]?.kill();
      }
      this.flightHandles = {};
      this.flightEls = {};
      this.flights = [];
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
      const fromLobby = this.voteSource === 'lobby';
      const sourceCube = fromLobby ?
        root.querySelector<HTMLElement>('[data-parl-lobby-cube] .player-cube') :
        root.querySelector<HTMLElement>('[data-parl-reserve-cube] .con-parl__stack-cube:last-child .player-cube');
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
      this.clearLanding();
      if (this.stage === 'landed') {
        // The flow is over: the shell's ONE guarded conclusion decides whether
        // the workspace leaves (a vote is a full action — it does).
        this.$emit('flow-complete', 'vote');
      }
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
      const from = fromEl?.getBoundingClientRect();
      const to = toEl?.getBoundingClientRect();
      if (proxy === undefined || from === undefined || to === undefined || to.width < 2 || from.width < 2) {
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
