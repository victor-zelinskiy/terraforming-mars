<template>
  <!-- «ПАРЛАМЕНТ» — the Mars Parliament workspace (Turmoil Redux).

       ONE FLOW, one screen, and a GAME SCREEN — not a rulebook. The overview
       shows OBJECTS and STATES: the GOVERNMENT (the enacted resolution as the
       main object, the ruling party as its badge, the chairman quest as its
       own block: condition · race · reward), the VOTING AREA (three resolution
       cards in the order that breaks ties — the closest to the government
       first — with the delegates on each, who leads, which one wins now), the
       SEATS ledger (every player's lobby place, reserve and the chairman's
       seat — the physical sources and destinations of every delegate move),
       the six PARTIES as one row of plaques, the AGENDA track. Nothing here
       explains a general rule — the fullscreen inspector (X) does, on the
       object asked; and nothing here forecasts: the vote step does.

       THE VOTE is a PHASE DESCENT of this frame (the Action Browser's browse ⇄
       focus phrase): the overview recedes into the press point, the pressed
       card FLIPs from its slot into the hero column, the decision surface
       unfolds from the slot's rect — the source of the delegate, its cost,
       what changes, the confirm. B folds the same phrase back; A sends the
       delegate from its real place (the lobby's socket, the reserve) onto the
       card, the counters tick when it lands, then the flow leaves.

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
             'con-parl--flying': flightUp,
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
      <!-- THE VIEWER'S DELEGATES — the two physical sources of a vote: the
           lobby's ONE place (a socket: filled = the free delegate waits,
           empty = spent) and the reserve. A vote's cube LEAVES one of these. -->
      <span v-if="view.viewer !== undefined" class="con-parl__chip con-parl__chip--delegates" data-parl-delegates>
        <span class="con-parl__chip-dim">{{ $t('Lobby') }}</span>
        <span class="con-parl__socket" :class="{'con-parl__socket--empty': !view.viewer.lobby || lobbyTokenAway}" data-parl-lobby-cube>
          <PlayerCube v-if="view.viewer.lobby && !lobbyTokenAway" :color="view.viewer.color" :size="cubePx(14)" />
        </span>
        <span class="con-parl__chip-dim">{{ $t('Reserve') }}</span>
        <span class="con-parl__socket" :class="{'con-parl__socket--empty': view.viewer.reserve === 0}" data-parl-reserve-cube>
          <PlayerCube v-if="view.viewer.reserve > 0" :color="view.viewer.color" :size="cubePx(14)" />
        </span>
        <b :key="'r' + view.viewer.reserve" class="con-parl__tick">×{{ view.viewer.reserve }}</b>
      </span>
      <!-- THE NEUTRAL SUPPLY — where popular support and neutral votes come from. -->
      <span class="con-parl__chip con-parl__chip--neutral" data-parl-neutral-pool>
        <span class="con-parl__chip-dim">{{ $t('Neutral') }}</span>
        <span class="con-parl__socket" :class="{'con-parl__socket--empty': view.neutralSupply === 0}">
          <PlayerCube v-if="view.neutralSupply > 0" color="neutral" steel :size="cubePx(14)" />
        </span>
        <b :key="'n' + view.neutralSupply" class="con-parl__tick">×{{ view.neutralSupply }}</b>
      </span>
      <span v-if="view.viewer !== undefined" class="con-parl__chip">
        <span class="con-parl__chip-dim">{{ $t('Influence') }}</span><b :key="'i' + view.viewer.influence" class="con-parl__tick">{{ view.viewer.influence }}</b>
      </span>
      <span class="con-parl__chip con-parl__chip--deck">
        <span class="con-parl__chip-dim">{{ $t('Resolution deck') }}</span><b>{{ view.deckSize }}</b>
      </span>
    </ConsoleWsHead>

    <!-- THE FIELD — the overview's body and, over it, the vote step's layer
         (the body recedes under the layer; the layer measures nothing of it). -->
    <div class="con-parl__field">
    <div class="con-parl__body" ref="bodyEl">
      <!-- ══ TOP TIER: the GOVERNMENT · the VOTING AREA ══ -->
      <div class="con-parl__top">
        <!-- ── THE GOVERNMENT — the enacted resolution is the MAIN OBJECT (its
             effects are what rules); the ruling party is its badge. ── -->
        <div class="con-parl__gov"
             :class="{
               'con-parl__gov--focus': zone === 'government',
               'con-parl__gov--recap': stage === 'recap' && recapHighlight === 'enacted',
               'con-parl__gov--enacted': view.enacted !== undefined,
             }"
             :style="{'--parl-accent': partyAccent(view.rulingParty)}"
             data-parl-gov>
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
            <!-- THE RULING PARTY'S BADGE: seal, «rules», its printed effect —
                 everyone has it while the party rules. -->
            <div class="con-parl__ruler" :data-zoom-slot="partyKeyOf(view.rulingParty)" data-parl-ruler ref="rulerEl">
              <img class="con-parl__ruler-emblem" :src="emblemUrl(view.rulingParty)" alt="" />
              <div class="con-parl__ruler-text">
                <span class="con-parl__ruler-kicker">{{ $t('Ruling party') }}</span>
                <b class="con-parl__ruler-name">{{ $t(view.rulingParty) }}</b>
              </div>
              <ConsolePartyFormula class="con-parl__ruler-formula" :party="view.rulingParty" size="compact" />
            </div>
          </div>

          <!-- THE CHAIRMAN QUEST: the printed condition (a graphic + its short
               words), the race per seat as a separate state layer, the reward
               as two things — the SEAT and ONE STEP of the Agenda (with what
               the viewer's next step pays) — and the chairman. -->
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
              <span class="con-parl__chair" :class="{'con-parl__chair--won': view.quest.completedBy !== undefined && view.quest.completedBy === view.chairman}" data-parl-chair>
                <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
                <template v-if="view.chairman !== undefined">
                  <PlayerCube :color="view.chairman" :size="cubePx(12)" />
                  <b>{{ nameOf(view.chairman) }}</b>
                </template>
                <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
              </span>
            </div>
          </div>
          <div v-else class="con-parl__chair con-parl__chair--alone" data-parl-chair>
            <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
            <template v-if="view.chairman !== undefined">
              <PlayerCube :color="view.chairman" :size="cubePx(12)" />
              <b>{{ nameOf(view.chairman) }}</b>
            </template>
            <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
          </div>
        </div>

        <!-- ── THE VOTING AREA — three resolutions in the order that breaks
             ties (the first stands closest to the government), the delegates
             on each in placement order, the leader, the winning card. ── -->
        <div class="con-parl__voting" data-parl-voting>
          <div class="con-parl__voting-head">
            <span class="con-parl__kicker">{{ $t('Voting') }}</span>
            <span class="con-parl__voting-order" aria-hidden="true">‹ {{ $t('closest to the government first') }}</span>
          </div>
          <div class="con-parl__slots">
            <div v-for="(slot, i) in view.slots" :key="slot.instance"
                 class="con-parl__slot"
                 :class="{
                   'con-parl__slot--focus': zone === 'voting' && slotIndex === i && stage === 'browse',
                   'con-parl__slot--winning': slot.isWinning,
                   'con-parl__slot--target': targeting && slotIndex === i,
                   'con-parl__slot--candidate': stage === 'seat' && seatCandidates.includes(i),
                   'con-parl__slot--recap': stage === 'recap' && recapHighlight === 'refresh',
                   'con-parl__slot--mine': slot.leader !== undefined && slot.leader === viewerColor,
                   'con-parl__slot--carried': carriedId === slot.resolutionId,
                 }"
                 :style="{'--parl-accent': partyAccent(slot.party)}"
                 :data-instance="slot.instance"
                 :data-party="slot.party"
                 :data-order="slot.tiePriority"
                 :data-votes="slot.totalVotes">
              <div class="con-parl__slot-label">
                <img class="con-parl__slot-emblem" :src="emblemUrl(slot.party)" alt="" />
                <span class="con-parl__slot-party">{{ $t(slot.party) }}</span>
                <span v-if="slot.isWinning" class="con-parl__slot-win">{{ $t('Winning') }}</span>
              </div>
              <div class="con-parl__card" :data-zoom-slot="carriedId === slot.resolutionId ? undefined : 'resolution:' + slot.resolutionId">
                <premium-card-face v-if="slotVms[i] !== undefined" :vmOverride="slotVms[i]" :lightweight="true" :inert="true" />
              </div>
              <!-- THE TALLY — the vote at a glance: how many delegates, who
                   LEADS (the player who would win it), what is YOURS with the
                   two places of the party-effect threshold. -->
              <div class="con-parl__tally" data-parl-tally>
                <span class="con-parl__tally-total">
                  <b :key="'t' + slot.totalVotes" class="con-parl__tally-num con-parl__tick">{{ slot.totalVotes }}</b>
                  <span class="con-parl__tally-unit">{{ delegatesWord(slot.totalVotes) }}</span>
                </span>
                <span v-if="slot.leader !== undefined" class="con-parl__tally-row con-parl__tally-row--leader" data-parl-leader>
                  <span class="con-parl__tally-key">{{ $t('Leader') }}</span>
                  <PlayerCube v-if="slot.leader !== 'neutral'" :color="slot.leader" :size="cubePx(13)" />
                  <PlayerCube v-else color="neutral" steel :size="cubePx(13)" />
                  <b :key="'l' + slot.leaderVotes" class="con-parl__tick">{{ slot.leaderVotes }}</b>
                  <span v-if="slotTieNote(slot) !== ''" class="con-parl__tally-note">{{ $t(slotTieNote(slot)) }}</span>
                </span>
                <span v-else class="con-parl__tally-row con-parl__tally-row--none">{{ $t('No leader yet') }}</span>
                <span v-if="viewerParticipates && viewerColor !== undefined" class="con-parl__tally-row con-parl__tally-row--mine"
                      :class="{'con-parl__tally-row--held': slot.viewerVotes >= PARTY_EFFECT_THRESHOLD}" data-parl-mine>
                  <span class="con-parl__tally-key">{{ $t('Yours') }}</span>
                  <span class="con-parl__places" aria-hidden="true">
                    <span v-for="n in PARTY_EFFECT_THRESHOLD" :key="n" class="con-parl__place" :class="{'con-parl__place--on': n <= slot.viewerVotes}">
                      <PlayerCube v-if="n <= slot.viewerVotes" :color="viewerColor" :size="cubePx(11)" :glow="false" />
                    </span>
                  </span>
                  <b :key="'m' + slot.viewerVotes" class="con-parl__tick">{{ slot.viewerVotes }}</b>
                  <span v-if="slot.viewerVotes >= PARTY_EFFECT_THRESHOLD" class="con-parl__tally-access">{{ $t('effect is yours') }}</span>
                </span>
                <span v-if="slot.isWinning && slotWinsTie(i)" class="con-parl__tally-note con-parl__tally-note--win">★ {{ $t('tie · closer to the government') }}</span>
              </div>
              <!-- THE DELEGATE RIBBON — every delegate on the card, in placement
                   order (the order that breaks a tie among players). -->
              <div class="con-parl__ribbon" :class="{'con-parl__ribbon--dense': slot.votes.length > DENSE_RIBBON}" :data-votes="slot.totalVotes">
                <template v-if="slot.votes.length <= DENSE_RIBBON">
                  <span v-for="vote in slot.votes" :key="vote.seq" class="con-parl__vote-cube"
                        :class="{'con-parl__vote-cube--landed': vote.seq === landedSeq, 'con-parl__vote-cube--hidden': vote.seq === flightSeq}"
                        :data-seq="vote.seq"
                        :data-landed="vote.seq === landedSeq ? '' : undefined">
                    <PlayerCube v-if="vote.owner !== 'neutral'" :color="vote.owner" :size="cubePx(16)" />
                    <PlayerCube v-else color="neutral" steel :size="cubePx(16)" />
                  </span>
                </template>
                <template v-else>
                  <span v-for="group in ribbonGroups(slot)" :key="group.owner" class="con-parl__vote-stack"
                        :class="{'con-parl__vote-stack--landed': group.hasSeq(landedSeq)}"
                        :data-seq="group.seqs[group.seqs.length - 1]">
                    <PlayerCube v-if="group.owner !== 'neutral'" :color="group.owner" :size="cubePx(16)" />
                    <PlayerCube v-else color="neutral" steel :size="cubePx(16)" />
                    <b>×{{ group.count }}</b>
                  </span>
                </template>
                <span v-if="slot.votes.length === 0" class="con-parl__ribbon-empty">{{ $t('No delegates yet') }}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ══ THE SEATS — every player's delegates by PLACE: the lobby's one
           socket, the reserve, the chairman's seat. The physical sources and
           destinations of a delegate's every move (a vote, a return, the
           lobby's refill, the seat). ══ -->
      <div class="con-parl__seats" data-parl-seats>
        <div v-for="seat in seats" :key="seat.color" class="con-parl__seat" :class="{'con-parl__seat--me': seat.color === viewerColor}" :data-parl-seat="seat.color">
          <PlayerCube :color="seat.color" :size="cubePx(13)" />
          <span class="con-parl__seat-name">{{ seat.name }}</span>
          <span class="con-parl__seat-key">{{ $t('Lobby') }}</span>
          <span class="con-parl__socket con-parl__socket--small" :class="{'con-parl__socket--empty': !seat.lobby}" :data-parl-seat-lobby="seat.color">
            <PlayerCube v-if="seat.lobby" :color="seat.color" :size="cubePx(11)" :glow="false" />
          </span>
          <span class="con-parl__seat-key">{{ $t('Reserve') }}</span>
          <span class="con-parl__socket con-parl__socket--small" :class="{'con-parl__socket--empty': seat.reserve === 0}" :data-parl-seat-reserve="seat.color">
            <PlayerCube v-if="seat.reserve > 0" :color="seat.color" :size="cubePx(11)" :glow="false" />
          </span>
          <b :key="'sr' + seat.reserve" class="con-parl__seat-count con-parl__tick">×{{ seat.reserve }}</b>
          <span v-if="seat.chairman" class="con-parl__seat-chair" :data-parl-seat-chair="seat.color"><span class="con-parl__seat-glyph" aria-hidden="true"></span>{{ $t('Chairman') }}</span>
        </div>
      </div>

      <!-- ══ MIDDLE TIER — the PARTIES (browse) or a STAGE (the seat pick, the
           results) — ONE zone, one rect. ══ -->
      <div class="con-parl__mid" ref="midEl" data-parl-mid>
        <div class="con-parl__parties-tier" ref="partiesTierEl" :class="{'con-parl__parties-tier--parked': stageUp}" v-show="!stageUp || stageLeaving">
          <div class="con-parl__parties" data-parl-parties>
            <div v-for="(p, i) in view.parties" :key="p.party"
                 class="con-parl__party"
                 :class="[
                   'con-parl__party--' + partyStates[i].kind,
                   {
                     'con-parl__party--focus': zone === 'parties' && partyIndex === i,
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
                                  :support="p.support"
                                  :viewerColor="viewerColor"
                                  :formula="partyFormulaOnTile"
                                  :focused="zone === 'parties' && partyIndex === i" />
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
                 line; each line lights the object it changed. -->
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

      <!-- ══ THE AGENDA — a compact graphic track: the markers, the influence
           LEVELS, the TR and card rewards, the viewer's next step. ══ -->
      <div class="con-parl__agenda" data-parl-agenda :class="{'con-parl__agenda--focus': zone === 'agenda'}">
        <div class="con-parl__agenda-head">
          <span class="con-parl__kicker">{{ $t('Agenda') }}</span>
          <span v-if="view.viewer !== undefined" class="con-parl__agenda-me">
            <PlayerCube :color="view.viewer.color" :size="cubePx(13)" />
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
                <PlayerCube :color="color" :size="cubePx(13)" />
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
                  <PlayerCube :color="color" :size="cubePx(13)" />
                </span>
              </span>
          </div>
        </div>
      </div>
    </div>

    <!-- ══ THE VOTE STEP — the frame's PHASE DESCENT: the pressed card carried
         into the hero column, the decision beside it. ══ -->
    <transition :css="false" @enter="onVoteEnter" @leave="onVoteLeave" @enter-cancelled="onVoteEnterCancelled" @leave-cancelled="onVoteLeaveCancelled">
      <div v-if="voteUp && voteSlot !== undefined"
           class="con-parl__vote"
           :class="{'con-parl__vote--committed': voteCommitted, 'con-parl__vote--landed': stage === 'landed'}"
           :style="{'--parl-accent': partyAccent(voteSlot.party)}"
           data-parl-vote
           ref="voteEl">
        <!-- THE CARRIED CARD — the one physical object of the step. -->
        <div class="con-parl__vote-hero">
          <div class="con-parl__vote-card" :data-zoom-slot="'resolution:' + voteSlot.resolutionId" data-zoom-handoff="parliament-vote" data-parl-vote-card ref="voteCardEl">
            <premium-card-face v-if="voteVm !== undefined" :vmOverride="voteVm" :lightweight="true" :inert="true" />
          </div>
          <div class="con-parl__vote-ident" data-parl-vote-item>
            <img class="con-parl__slot-emblem" :src="emblemUrl(voteSlot.party)" alt="" />
            <span class="con-parl__vote-party">{{ $t(voteSlot.party) }}</span>
            <span v-if="voteSlot.isWinning" class="con-parl__slot-win">{{ $t('Winning') }}</span>
          </div>
        </div>
        <div class="con-parl__vote-surface" data-parl-vote-surface>
          <!-- THE SOURCE — the delegate at its real place, and where it goes. -->
          <div class="con-parl__vote-row con-parl__vote-row--source" data-parl-vote-item data-parl-vote-source>
            <span class="con-parl__vote-key">{{ $t('Delegate') }}</span>
            <span class="con-parl__vote-source">
              <span class="con-parl__socket" :class="{'con-parl__socket--empty': lobbyTokenAway && voteSource === 'lobby'}">
                <PlayerCube v-if="viewerColor !== undefined && !(lobbyTokenAway && voteSource === 'lobby')" :color="viewerColor" :size="cubePx(16)" />
              </span>
              <span class="con-parl__vote-source-text">
                <b>{{ $t(voteSource === 'lobby' ? 'Free delegate from the lobby' : 'From the reserve') }}</b>
                <ActionEffectChip v-if="voteSource === 'reserve'" class="con-parl__vote-cost" :effect="voteCostChip" />
              </span>
            </span>
          </div>
          <!-- THE CARD'S DELEGATES — the ribbon as it stands, and the PLACE the
               new delegate takes (hollow until it lands). -->
          <div class="con-parl__vote-row con-parl__vote-row--ribbon" data-parl-vote-item>
            <span class="con-parl__vote-key">{{ $t('On the card') }}</span>
            <span class="con-parl__vote-ribbon" data-parl-vote-ribbon>
              <span v-for="vote in voteSlot.votes" :key="vote.seq" class="con-parl__vote-cube"
                    :class="{'con-parl__vote-cube--landed': vote.seq === landedSeq, 'con-parl__vote-cube--hidden': vote.seq === flightSeq}"
                    :data-seq="vote.seq">
                <PlayerCube v-if="vote.owner !== 'neutral'" :color="vote.owner" :size="cubePx(16)" />
                <PlayerCube v-else color="neutral" steel :size="cubePx(16)" />
              </span>
              <span v-if="voteSnapshot !== undefined && voteSlot.votes.length <= voteSnapshot.votes" class="con-parl__vote-cube con-parl__vote-cube--place" data-parl-vote-place aria-hidden="true"></span>
              <span v-else-if="voteSnapshot === undefined" class="con-parl__vote-cube con-parl__vote-cube--place" data-parl-vote-place aria-hidden="true"></span>
            </span>
          </div>
          <!-- THE FORECAST — only what CHANGES, current → projected; the projected
               half is marked as a forecast until the delegate has landed. -->
          <div class="con-parl__vote-forecast" :class="{'con-parl__vote-forecast--done': stage === 'landed'}" data-parl-vote-item data-parl-vote-forecast>
            <span class="con-parl__vote-key">{{ $t(stage === 'landed' ? 'Result' : 'Forecast') }}</span>
            <div class="con-parl__vote-facts">
              <span class="con-parl__vote-fact" data-parl-fact="votes">
                <span class="con-parl__vote-fact-key">{{ $t('Delegates on the card') }}</span>
                <span class="con-parl__vote-fact-val"><b>{{ voteNumbers.votesBefore }}</b><span class="con-parl__vote-arrow" aria-hidden="true">→</span><b class="con-parl__vote-after">{{ voteNumbers.votesAfter }}</b></span>
              </span>
              <span class="con-parl__vote-fact" data-parl-fact="mine">
                <span class="con-parl__vote-fact-key">{{ $t('Yours') }}</span>
                <span class="con-parl__vote-fact-val">
                  <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="cubePx(12)" :glow="false" />
                  <b>{{ voteNumbers.mineBefore }}</b><span class="con-parl__vote-arrow" aria-hidden="true">→</span><b class="con-parl__vote-after">{{ voteNumbers.mineAfter }}</b>
                </span>
              </span>
              <span v-if="voteFacts.lead !== undefined" class="con-parl__vote-fact con-parl__vote-fact--gain" data-parl-fact="lead">
                <span class="con-parl__vote-fact-key">{{ $t('Leader') }}</span>
                <span class="con-parl__vote-fact-val">
                  <template v-if="voteFacts.lead.before !== undefined">
                    <PlayerCube v-if="voteFacts.lead.before !== 'neutral'" :color="voteFacts.lead.before" :size="cubePx(12)" :glow="false" />
                    <PlayerCube v-else color="neutral" steel :size="cubePx(12)" :glow="false" />
                  </template>
                  <span v-else class="con-parl__vote-none">—</span>
                  <span class="con-parl__vote-arrow" aria-hidden="true">→</span>
                  <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="cubePx(12)" :glow="false" />
                  <b class="con-parl__vote-after">{{ $t(voteFacts.lead.note ?? 'you') }}</b>
                </span>
              </span>
              <span v-if="voteFacts.win !== undefined" class="con-parl__vote-fact con-parl__vote-fact--gain" data-parl-fact="win">
                <span class="con-parl__vote-fact-key">{{ $t('Winning') }}</span>
                <span class="con-parl__vote-fact-val"><b class="con-parl__vote-after">{{ $t(voteFacts.win) }}</b></span>
              </span>
              <span v-if="voteFacts.access" class="con-parl__vote-fact con-parl__vote-fact--gain" data-parl-fact="access">
                <span class="con-parl__vote-fact-key">{{ $t('Party effect') }}</span>
                <span class="con-parl__vote-fact-val"><b class="con-parl__vote-after">{{ $t('becomes yours') }}</b></span>
              </span>
              <span v-if="voteFacts.warn !== undefined" class="con-parl__vote-fact con-parl__vote-fact--warn" data-parl-fact="warn">
                <span class="con-parl__vote-fact-val">{{ $t(voteFacts.warn) }}</span>
              </span>
            </div>
          </div>
          <!-- A paid vote's PAYMENT stands here, inside the step. -->
          <div class="con-parl__embed" data-embed-slot="parliament-vote"></div>
          <div class="con-parl__cta"
               :class="{'con-parl__cta--ready': canVoteNow && stage === 'vote', 'con-parl__cta--busy': stage === 'submitting' || stage === 'paying', 'con-parl__cta--done': stage === 'landed'}"
               data-parl-vote-item data-parl-cta @click="submitVote()">
            <GamepadGlyph v-if="stage === 'vote'" control="confirm" class="con-parl__cta-glyph" />
            <span class="con-parl__cta-label">{{ $t(ctaLabel) }}</span>
            <span v-if="stage === 'vote'" class="con-parl__cta-sub">{{ $t('A full action') }}</span>
          </div>
        </div>
      </div>
    </transition>
    </div>

    <!-- THE DELEGATE FLIGHT — a cube on its way from its source place to the
         card (shell-level fixed layer, measured rects). -->
    <Teleport to="body">
      <div v-if="flight !== undefined" class="con-parl__flight" ref="flightEl" aria-hidden="true">
        <PlayerCube :color="flight.color" :size="cubePx(16)" />
      </div>
    </Teleport>
    <!-- THE AGENDA MARKER in motion — the Hydronetwork's marker director on the
         Parliament's track: from the step it left to the step it reached. -->
    <Teleport to="body">
      <div v-if="agendaFlight !== undefined" class="con-parl__flight con-parl__flight--agenda" ref="agendaFlightEl" aria-hidden="true">
        <PlayerCube :color="agendaFlight.color" :size="cubePx(13)" />
      </div>
    </Teleport>
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {gsap} from 'gsap';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectPaymentModel, VotePaymentMeta} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PARTY_EFFECT_DELEGATES as PARTY_EFFECT_THRESHOLD, PartyActionId, ReduxParty} from '@/common/parliament/ParliamentTypes';
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
  partyStateOf, PartyStateVm, seatResponse, voteForecastOf, VoteForecastVm, voteResponse,
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
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {useResizeObserver} from '@vueuse/core';
import {consoleLayoutState, conUiScale} from '@/client/console/consoleLayoutProfile';
import {AnimationHold, beginAnimationHold, holdForGsapAnimation} from '@/client/components/presentation/animationHold';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {armDescendOrigin, armDescendRect, descendSurfaceInset, guardedDescend} from '@/client/console/surfaceMotion/workspaceDescend';
import {armActionFocusOrigin} from '@/client/console/consoleActionFocusMotion';
import {
  armParliamentVote, parliamentVoteEnterCancelledHook, parliamentVoteEnterHook, parliamentVoteLeaveCancelledHook, parliamentVoteLeaveHook,
  resetParliamentVoteMotion,
} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {HydroMarkerDirectorHandle, runHydroMarkerGlide} from '@/client/console/hydroMarker/hydroMarkerDirector';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';

type Zone = 'voting' | 'government' | 'parties' | 'agenda';
/**
 * `vote` — the decision step (a phase descent); `submitting` — sent;
 * `paying` — a paid vote's payment stands inside the step; `landed` — the
 * answer arrived: the delegate settles on the card before the flow leaves.
 * `seat` — the chairman's mandatory pick; `recap` — the RESULTS scene.
 */
type Stage = 'browse' | 'vote' | 'seat' | 'submitting' | 'paying' | 'landed' | 'recap';

/** The delegate's landing beat (the cube settles, the counters tick). */
const VOTE_LANDING_MS = 720;
/** The delegate's flight from its source place to the card. */
const VOTE_FLIGHT_MS = 560;
/** One results beat: the next line lights and the object it names flashes. */
const RECAP_BEAT_MS = 900;
/** The seat / recap stage's unfold / fold. */
const STAGE_UNFOLD_MS = 300;
const STAGE_FOLD_MS = 220;
/** A ribbon past this many delegates collapses into per-owner stacks. */
const DENSE_RIBBON = 12;

/** A marker's move along the Agenda track: whose, from which step, to which. */
type AgendaMove = {player: Color, from: number, to: number};

/** A results beat: what the sentence says, and which object on the board it points at. */
type RecapItem = {
  key: string;
  text: string;
  focus: 'enacted' | 'agenda' | 'support' | 'refresh' | 'lobby';
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
const MAX_CARD_ZOOM = 0.95;
const MIN_CARD_ZOOM = 0.3;
/** The enacted face — the government's MAIN object. */
const MAX_GOV_ZOOM = 0.6;
const MIN_GOV_ZOOM = 0.2;
/** The vote step's hero card. */
const MAX_HERO_ZOOM = 1.1;
const MIN_HERO_ZOOM = 0.4;

/**
 * The inspector's request: WHAT to open, WHERE it physically stands (the
 * card lifts out of that element and returns into it) and — for a resolution
 * the viewer may vote on — the A verb the fullscreen offers, which opens the
 * SAME vote step the overview's A opens (the card flies from the viewer into
 * the step's hero slot).
 */
export type ParliamentInspectRequest =
  | {kind: 'resolution', id: string, origin?: () => HTMLElement | null, vote?: {label: string, reasons: ReadonlyArray<string>, execute: () => void}}
  | {kind: 'party', party: ReduxParty, origin?: () => HTMLElement | null};

type RibbonGroup = {owner: Color | 'neutral', count: number, seqs: ReadonlyArray<number>, hasSeq: (seq: number | undefined) => boolean};

type SeatRow = {color: Color, name: string, lobby: boolean, reserve: number, chairman: boolean};

/** The vote's numbers at the SUBMIT — the step reads these until the delegate has landed (and the source the delegate leaves from). */
type VoteSnapshot = {votes: number, mine: number, leader: Color | 'neutral' | undefined, winning: boolean, source: 'lobby' | 'reserve'};

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
      zone: 'voting' as Zone,
      stage: 'browse' as Stage,
      /** The seat / recap stage is folding back — its DOM stays for the leave beat. */
      stageLeaving: false,
      slotIndex: 0,
      partyIndex: 0,
      /** The stage the submit left — restored if the server refuses. */
      stageBeforeSubmit: 'browse' as Stage,
      submitTimer: undefined as number | undefined,
      /** The server's answer key at the submit — the answer is whatever changes it. */
      submittedKey: '',
      stopFitObs: undefined as (() => void) | undefined,
      /** The resolution whose card is CARRIED by the vote step (its slot stands empty, in place). */
      carriedId: undefined as string | undefined,
      /** The vote's numbers at the submit (undefined = not sent yet). */
      voteSnapshot: undefined as VoteSnapshot | undefined,
      /** The lobby's cube is in flight (the socket reads empty until it lands). */
      lobbyTokenAway: false,
      /** The vote that just landed (its `seq`) — the cube the landing beat animates. */
      landedSeq: undefined as number | undefined,
      /** The vote whose cube is IN FLIGHT (hidden on the ribbon until the handoff). */
      flightSeq: undefined as number | undefined,
      flight: undefined as {color: Color} | undefined,
      landingTimer: undefined as number | undefined,
      landingHold: undefined as AnimationHold | undefined,
      flightHold: undefined as AnimationHold | undefined,
      flightTween: undefined as gsap.core.Tween | undefined,
      /** The results scene's current beat (−1 = not playing). */
      recapBeat: -1,
      recapTimers: [] as Array<number>,
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
      stageFromRect: undefined as {left: number, top: number, width: number, height: number} | undefined,
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
    /** The vote step stands over the overview. */
    voteUp(): boolean {
      return this.stage === 'vote' || this.stage === 'paying' || this.stage === 'landed' ||
        (this.stage === 'submitting' && this.stageBeforeSubmit === 'vote');
    },
    voteCommitted(): boolean {
      return this.voteUp && this.stage !== 'vote';
    },
    /** The stage's CONTENT identity — a submit keeps the stage it left on screen (busy). */
    stageKind(): Stage {
      return this.stage === 'submitting' ? this.stageBeforeSubmit : this.stage;
    },
    targeting(): boolean {
      return this.stageKind === 'vote' || this.stageKind === 'seat' || this.stage === 'paying' || this.stage === 'landed';
    },
    flightUp(): boolean {
      return this.flight !== undefined;
    },
    slotVms(): Array<PremiumCardVM | undefined> {
      return this.view.slots.map((slot) => resolutionPremiumVmById(slot.resolutionId));
    },
    enactedVm(): PremiumCardVM | undefined {
      return this.view.enacted === undefined ? undefined : resolutionPremiumVmById(this.view.enacted.resolutionId);
    },
    focusedSlot(): ParliamentSlotVm | undefined {
      return this.view.slots[this.slotIndex];
    },
    /** The slot the vote step carries — by identity, so a re-ordered model never swaps the card under the step. */
    voteSlot(): ParliamentSlotVm | undefined {
      return this.carriedId === undefined ? this.focusedSlot : (this.view.slots.find((s) => s.resolutionId === this.carriedId) ?? this.focusedSlot);
    },
    voteVm(): PremiumCardVM | undefined {
      return this.voteSlot === undefined ? undefined : resolutionPremiumVmById(this.voteSlot.resolutionId);
    },
    focusedParty(): ParliamentPartyVm | undefined {
      return this.view.parties[this.partyIndex];
    },
    voteTile(): ParliamentTileVm | undefined {
      return this.view.tiles.find((t) => t.id === 'vote');
    },
    /** WHERE the delegate leaves from — the server's own source; past the submit the snapshot's (the menu option is gone by then). */
    voteSource(): 'lobby' | 'reserve' {
      if (this.voteSnapshot !== undefined) {
        return this.voteSnapshot.source;
      }
      return this.voteTile?.source === 'reserve' ? 'reserve' : 'lobby';
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
      return consoleLayoutState.profile === 'handheld' ? 3 : 6;
    },
    partyFormulaOnTile(): boolean {
      return consoleLayoutState.profile !== 'handheld';
    },
    /** THE SEATS — every participating player's places. */
    seats(): Array<SeatRow> {
      return this.view.players.filter((p) => p.participates).map((p) => ({
        color: p.color, name: p.name, lobby: p.lobby, reserve: p.reserve, chairman: p.chairman,
      }));
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
    /**
     * THE STEP'S NUMBERS: before the submit, the live model and its
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
    /** The CHANGES the delegate makes — nothing that stays the same is listed. */
    voteFacts(): {lead?: {before: Color | 'neutral' | undefined, note?: string}, win?: string, access: boolean, warn?: string} {
      const f = this.voteForecast;
      const out: {lead?: {before: Color | 'neutral' | undefined, note?: string}, win?: string, access: boolean, warn?: string} = {access: false};
      if (f === undefined) {
        return out;
      }
      if (f.leadChange === 'take') {
        out.lead = {before: f.leaderBefore, note: f.tieNote === 'earlier-delegate' ? 'you (earlier delegate)' : undefined};
      }
      if (f.winChange === 'become') {
        out.win = f.tieNote === 'slot-priority' ? 'this resolution (wins the tie)' : 'this resolution';
      }
      out.access = f.unlocksEffect;
      if (f.leadChange === 'none' && f.leaderAfter !== undefined && f.leaderAfter !== 'neutral' && f.leaderAfter !== this.viewerColor) {
        out.warn = 'Another player still leads this resolution';
      } else if (f.winChange === 'none' && !f.winningBefore) {
        out.warn = 'Still not the winning resolution';
      }
      return out;
    },
    ctaLabel(): string {
      switch (this.stage) {
      case 'submitting': return 'Performing…';
      case 'paying': return 'Pay for the delegate';
      case 'landed': return 'Delegate placed';
      default: return 'Send the delegate';
      }
    },
    voteBlockedText(): string {
      const tile = this.voteTile;
      if (tile === undefined) {
        return translateText('Not in this game');
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
      items.push({key: 'winner', focus: 'enacted', text: translateTextWithParams('${0} (${1}) won the vote — delegates: ${2}, winning player: ${3}', [
        resolutionName(last.winner.resolution), translateText(last.winner.party), String(last.winner.votes), this.nameOf(last.winner.player)])});
      if (last.agenda !== undefined) {
        const bonus = last.agenda.bonus === 'tr' ? translateText('+1 TR') : last.agenda.bonus === 'card' ? translateText('+1 card') : '';
        items.push({key: 'agenda', focus: 'agenda', step: last.agenda.to,
          move: {player: last.agenda.player, from: last.agenda.from, to: last.agenda.to},
          text: translateTextWithParams('${0} advanced on the Agenda track to step ${1} ${2}', [this.nameOf(last.agenda.player), String(last.agenda.to), bonus]).trim()});
      }
      items.push({key: 'enacted', focus: 'enacted', text: translateTextWithParams('${0} is enacted — ${1} now rule', [resolutionName(last.enacted.resolution), translateText(last.enacted.party)])});
      const gained = last.support.filter((s) => s.gained > 0);
      if (gained.length > 0) {
        items.push({key: 'support', focus: 'support', parties: gained.map((s) => s.party),
          text: translateTextWithParams('Popular support: ${0}', [gained.map((s) => `${translateText(s.party)} +${s.gained}`).join(' · ')])});
      }
      if (last.refreshed.length > 0) {
        items.push({key: 'refresh', focus: 'refresh', text: translateTextWithParams('${0} new resolutions entered the voting area', [String(last.refreshed.length)])});
      }
      if (this.viewerColor !== undefined && last.lobbyRefilled.includes(this.viewerColor)) {
        items.push({key: 'lobby', focus: 'lobby', text: translateText('Your free delegate is back in the lobby')});
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
      switch (this.stage) {
      case 'vote':
      case 'landed':
        return 'Vote';
      case 'paying': return 'Payment';
      case 'seat': return 'Chairman seat';
      case 'submitting': return 'Sending';
      default: return '';
      }
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
        // The bill's own panel owns the bar while it stands in the step's zone.
        return [];
      case 'landed':
        return [{control: 'confirm', label: 'Delegate placed', enabled: false}];
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
    /** A paid vote's BILL stands — the server's own marker, never a title (the vote step hosts it). */
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
    /** The vote step's PAYMENT zone — published once the step's DOM stands (post-flush: a teleport into a zone not yet rendered drops its content). */
    'voteUp': {
      immediate: true,
      flush: 'post',
      handler(on: boolean): void {
        consoleParliamentUi.voteStanding = on;
      },
    },
    /**
     * A paid vote's BILL stands on a fresh mount (a reload, a restore from
     * the board home): the vote step re-forms around it — the card carried,
     * the counters at their pre-vote values, the payment in the step's own
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
        this.carriedId = slot.resolutionId;
        this.voteSnapshot = {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, source: 'reserve'};
        this.stageBeforeSubmit = 'vote';
        this.stage = 'paying';
        armParliamentVote({instant: true});
        descendWorkspaceFrame('parliament', this.resolutionTitle(slot.resolutionId), 'Payment');
        setWorkspaceFramePhase('parliament', 'committed');
        void this.$nextTick(() => this.fitCards());
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
        this.stage = 'browse';
        setWorkspaceFramePhase('parliament', 'browse');
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
    /** The results scene's AGENDA beat plays the winner's marker along the track. */
    recapBeat(beat: number): void {
      const item = this.stage === 'recap' ? this.recapItems[beat] : undefined;
      if (item?.move !== undefined) {
        void this.playAgendaGlide(item.move);
      }
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
    const top = (this.$refs.rootEl as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-parl__top');
    if (top !== null && top !== undefined) {
      this.stopFitObs = useResizeObserver(top, () => this.fitCards()).stop;
    }
    this.maybeOpenRecap();
  },
  beforeUnmount() {
    this.stopFitObs?.();
    this.clearSubmitTimer();
    this.clearLanding();
    this.clearRecapTimers();
    for (const timer of [this.accessTimer, this.agendaTimer, this.questTimer, this.usedTimer]) {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    }
    this.stopAgendaGlide();
    resetParliamentVoteMotion();
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
    /** Solve the card zooms (voting slots · the enacted face · the vote hero) from the measured frame. */
    fitCards(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined) {
        return;
      }
      const scale = conUiScale();
      const px = (v: string): number => parseFloat(v) || 0;
      const heightOf = (host: Element, sel: string): number => host.querySelector<HTMLElement>(sel)?.getBoundingClientRect().height ?? 0;
      const snap = (zoom: number, min: number): number => Math.max(min * scale, Math.floor(zoom * 1000) / 1000);

      let zoom = 0.62 * scale;
      const slots = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot'));
      if (slots.length > 0) {
        const slot = slots[0];
        const cs = getComputedStyle(slot);
        const chrome = Math.max(...slots.map((s) =>
          heightOf(s, '.con-parl__slot-label') + heightOf(s, '.con-parl__ribbon') + heightOf(s, '.con-parl__tally')));
        const availH = slot.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - chrome - px(cs.rowGap) * 3;
        const availW = slot.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
        zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_CARD_ZOOM * scale);
      }
      root.style.setProperty('--con-parl-card-zoom', String(snap(zoom, MIN_CARD_ZOOM)));

      // THE ENACTED FACE is the government's main object: it takes the ruling
      // row's height (the column minus its other blocks) and up to 60 % of
      // the row's width — the ruling badge stands beside it.
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
        govZoom = Math.min(govZoom, (innerH - taken - px(rcs.paddingTop) - px(rcs.paddingBottom)) / PCARD_H, (innerW * 0.6) / PCARD_W);
      }
      root.style.setProperty('--con-parl-gov-zoom', String(snap(govZoom, MIN_GOV_ZOOM)));

      // THE VOTE HERO fills the step's hero column.
      const hero = root.querySelector<HTMLElement>('.con-parl__vote-hero');
      if (hero !== null) {
        const hcs = getComputedStyle(hero);
        const innerW = hero.clientWidth - px(hcs.paddingLeft) - px(hcs.paddingRight);
        const innerH = hero.clientHeight - px(hcs.paddingTop) - px(hcs.paddingBottom) - heightOf(hero, '.con-parl__vote-ident') - px(hcs.rowGap);
        const heroZoom = Math.min(innerW / PCARD_W, innerH / PCARD_H, MAX_HERO_ZOOM * scale);
        root.style.setProperty('--con-parl-hero-zoom', String(snap(heroZoom, MIN_HERO_ZOOM)));
      }
    },
    /** The browse layer's verbs depend on the focused ZONE (one bar, one contract). */
    browseCommands(back: ConsoleCommand): Array<ConsoleCommand> {
      switch (this.zone) {
      case 'voting': {
        const cmds: Array<ConsoleCommand> = [];
        if (this.voteTile !== undefined) {
          cmds.push({control: 'confirm', label: 'Vote', enabled: this.canVoteNow, highlight: this.canVoteNow});
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
      case 'agenda':
        return [back];
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
    slotTieNote(slot: ParliamentSlotVm): string {
      if (slot.leader === undefined || slot.leader === 'neutral') {
        return '';
      }
      const counts = new Map<string, number>();
      for (const vote of slot.votes) {
        if (vote.owner !== 'neutral') {
          counts.set(vote.owner, (counts.get(vote.owner) ?? 0) + 1);
        }
      }
      const sorted = [...counts.values()].sort((a, b) => b - a);
      return sorted.length > 1 && sorted[0] === sorted[1] ? 'tie · the earlier delegate leads' : '';
    },
    slotWinsTie(index: number): boolean {
      const slot = this.view.slots[index];
      return slot !== undefined && this.view.slots.some((other, j) => j !== index && other.totalVotes === slot.totalVotes);
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
          if (this.slotIndex === 0) {
            this.zone = 'government';
          } else {
            this.slotIndex--;
          }
        } else if (dir === 'right') {
          this.slotIndex = Math.min(this.view.slots.length - 1, this.slotIndex + 1);
        } else if (dir === 'down') {
          this.zone = 'parties';
          const idx = this.view.parties.findIndex((p) => p.party === this.focusedSlot?.party);
          this.partyIndex = idx >= 0 ? idx : Math.min(this.partyIndex, this.view.parties.length - 1);
        }
        return;
      case 'government':
        if (dir === 'right') {
          this.zone = 'voting';
          this.slotIndex = 0;
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
            this.zone = 'voting';
          }
        } else if (dir === 'down') {
          if (this.partyIndex + columns < this.view.parties.length) {
            this.partyIndex += columns;
          } else {
            this.zone = 'agenda';
          }
        }
        return;
      case 'agenda':
        if (dir === 'up') {
          this.zone = 'parties';
          if (this.partyIndex + columns < this.view.parties.length) {
            this.partyIndex = Math.min(this.view.parties.length - 1, this.partyIndex + columns);
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
    // ── THE VOTE STEP ────────────────────────────────────────────────────
    /**
     * A on a votable resolution: the frame DESCENDS into the vote (a phase,
     * not a frame — the overview is parked, its focus survives). The pressed
     * slot's rects are armed for the motion: the surface unfolds from the
     * slot, the card FLIPs from its own rect.
     */
    openVote(opts?: {fromViewer?: boolean}): void {
      const slot = this.focusedSlot;
      const tile = this.voteTile;
      if (slot === undefined || tile === undefined) {
        this.$emit('notice', translateText('Not in this game'));
        return;
      }
      if (!this.canVoteNow) {
        this.$emit('notice', this.voteBlockedText);
        return;
      }
      if (this.voteUp) {
        return;
      }
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const slotEl = root?.querySelector<HTMLElement>(`.con-parl__slot[data-instance="${slot.instance}"]`);
      const cardEl = slotEl?.querySelector<HTMLElement>('.con-parl__card .pcard') ?? slotEl?.querySelector<HTMLElement>('.con-parl__card');
      const rectOf = (el: HTMLElement | null | undefined) => {
        const r = el?.getBoundingClientRect();
        return r === undefined || r.width < 2 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      };
      const slotRect = rectOf(slotEl);
      armParliamentVote({
        slot: slotRect,
        card: rectOf(cardEl),
        press: slotRect === undefined ? undefined : {x: slotRect.left + slotRect.width / 2, y: slotRect.top + slotRect.height / 2},
        instant: opts?.fromViewer === true,
      });
      this.carriedId = slot.resolutionId;
      this.voteSnapshot = undefined;
      this.zone = 'voting';
      this.stage = 'vote';
      descendWorkspaceFrame('parliament', this.resolutionTitle(slot.resolutionId), 'Vote');
      void this.$nextTick(() => this.fitCards());
    },
    /** The SAME step, entered from the fullscreen viewer (the card flies from the viewer into the hero slot). */
    openVoteFromViewer(resolutionId: string): void {
      const idx = this.view.slots.findIndex((s) => s.resolutionId === resolutionId);
      if (idx === -1) {
        return;
      }
      this.slotIndex = idx;
      this.openVote({fromViewer: true});
    },
    /** B before the commit: the same phrase folded back — the card returns to its slot, the focus is where it was. */
    closeVote(): void {
      if (!this.voteUp) {
        return;
      }
      this.clearLanding();
      this.voteSnapshot = undefined;
      this.lobbyTokenAway = false;
      this.stage = 'browse';
      foldWorkspaceFrame();
      setWorkspaceFramePhase('parliament', 'browse');
    },
    onVoteEnter(el: Element, done: () => void): void {
      parliamentVoteEnterHook(el, done);
    },
    onVoteLeave(el: Element, done: () => void): void {
      const carried = this.carriedId;
      parliamentVoteLeaveHook(el, () => {
        // The slot's copy lights up only now — the hero has landed on it.
        if (this.carriedId === carried) {
          this.carriedId = undefined;
        }
        done();
      }, () => {
        const root = this.$refs.rootEl as HTMLElement | undefined;
        const cardEl = root?.querySelector<HTMLElement>(`.con-parl__slot--carried .con-parl__card .pcard`) ??
          root?.querySelector<HTMLElement>(`.con-parl__slot--carried .con-parl__card`);
        const r = cardEl?.getBoundingClientRect();
        return r === undefined || r.width < 2 ? undefined : {left: r.left, top: r.top, width: r.width, height: r.height};
      });
    },
    onVoteEnterCancelled(el: Element): void {
      parliamentVoteEnterCancelledHook(el);
    },
    onVoteLeaveCancelled(el: Element): void {
      parliamentVoteLeaveCancelledHook(el);
    },
    /** The vote step's own verbs: A sends, X inspects the carried card, B folds back. */
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
          return;
        }
        if (action === 'inspect') {
          this.inspect();
        } else if (action === 'primary') {
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
     * PHYSICAL element the card lifts out of (and returns into), and — for a
     * resolution the viewer may vote on — the A verb the fullscreen offers,
     * which opens the very same vote step.
     */
    inspect(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      const cardOriginOf = (sel: string) => () => root?.querySelector<HTMLElement>(`${sel} .pcard`) ?? root?.querySelector<HTMLElement>(sel) ?? null;
      if (this.voteUp) {
        const slot = this.voteSlot;
        if (slot !== undefined) {
          this.$emit('inspect', {kind: 'resolution', id: slot.resolutionId, origin: cardOriginOf('.con-parl__vote-card')} as ParliamentInspectRequest);
        }
        return;
      }
      if (this.zone === 'voting' || this.stage === 'seat') {
        const slot = this.focusedSlot;
        if (slot !== undefined) {
          const origin = cardOriginOf(`.con-parl__slot[data-instance="${slot.instance}"] .con-parl__card`);
          const votable = this.stage === 'browse' && this.voteTile !== undefined;
          const request: ParliamentInspectRequest = {kind: 'resolution', id: slot.resolutionId, origin};
          if (votable) {
            request.vote = {
              label: this.canVoteNow ? 'Vote' : '',
              reasons: this.canVoteNow ? [] : [this.voteBlockedText],
              execute: () => this.openVoteFromViewer(slot.resolutionId),
            };
          }
          this.$emit('inspect', request);
        }
        return;
      }
      if (this.zone === 'government') {
        if (this.view.enacted !== undefined) {
          this.$emit('inspect', {kind: 'resolution', id: this.view.enacted.resolutionId, origin: cardOriginOf('.con-parl__gov-card')} as ParliamentInspectRequest);
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
      if (slot === undefined || !this.canVoteNow || this.stage !== 'vote') {
        return;
      }
      this.voteSnapshot = {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, source: this.voteSource};
      this.send(voteResponse(this.bridge, slot.party), 'vote');
    },
    submitSeat(): void {
      const slot = this.focusedSlot;
      if (slot === undefined) {
        return;
      }
      this.send(seatResponse(this.bridge, slot.party), 'seat');
    },
    send(response: InputResponse | undefined, from: Stage): void {
      if (response === undefined) {
        this.$emit('notice', translateText('This option is no longer offered'));
        if (from === 'vote') {
          this.closeVote();
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
      this.recapBeat = 0;
      this.openStage('recap');
      for (let i = 1; i < items.length; i++) {
        this.recapTimers.push(window.setTimeout(() => {
          this.recapBeat = i;
        }, consoleMotionMs(RECAP_BEAT_MS) * i));
      }
    },
    finishRecap(): void {
      this.clearRecapTimers();
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
    /**
     * THE DELEGATE FLIGHT + LANDING. The vote's answer is in the model: the
     * viewer's newest delegate on the carried card is the one that just
     * arrived. Its cube LEAVES the place it came from (the lobby's socket or
     * the reserve — real, measured places in the header), flies to its place
     * on the step's ribbon and lands there; the counters tick on the landing.
     * Returns false when the model shows no new delegate (a refusal, a paid
     * vote still owing its payment) — the caller decides what that means.
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
      void this.$nextTick(() => {
        if (!this.flyDelegate(seq, me)) {
          this.flightSeq = undefined;
          this.beginLanding(seq);
        }
      });
      return true;
    },
    flyDelegate(seq: number, color: Color): boolean {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined || typeof window === 'undefined') {
        return false;
      }
      const fromLobby = this.voteSource === 'lobby';
      const source = fromLobby ?
        root.querySelector<HTMLElement>('[data-parl-lobby-cube]') :
        root.querySelector<HTMLElement>('[data-parl-reserve-cube]');
      const target = root.querySelector<HTMLElement>(`[data-parl-vote-ribbon] [data-seq="${seq}"]`) ??
        root.querySelector<HTMLElement>('[data-parl-vote-place]');
      if (source === null || target === null) {
        return false;
      }
      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      if (from.width < 2 || to.width < 2) {
        return false;
      }
      if (fromLobby) {
        this.lobbyTokenAway = true;
      }
      this.flight = {color};
      void this.$nextTick(() => {
        const proxy = this.$refs.flightEl as HTMLElement | undefined;
        if (proxy === undefined) {
          this.flight = undefined;
          this.flightSeq = undefined;
          this.lobbyTokenAway = false;
          this.beginLanding(seq);
          return;
        }
        const size = to.width;
        proxy.style.width = `${size}px`;
        proxy.style.height = `${size}px`;
        const start = {x: from.left + from.width / 2 - size / 2, y: from.top + from.height / 2 - size / 2};
        const end = {x: to.left, y: to.top};
        const duration = motionMs(VOTE_FLIGHT_MS) / 1000;
        const tween = gsap.fromTo(proxy,
          {x: start.x, y: start.y, scale: 1.25, opacity: 1},
          {
            x: end.x, y: end.y, scale: 1, duration, ease: 'power2.inOut',
            onComplete: () => {
              this.flightSeq = undefined;
              this.beginLanding(seq);
              window.requestAnimationFrame(() => {
                this.flight = undefined;
                this.flightTween = undefined;
              });
            },
          });
        this.flightTween = tween;
        this.flightHold = holdForGsapAnimation('parliament-vote-flight', tween, {maxHoldMs: 4000});
      });
      return true;
    },
    beginLanding(seq: number): void {
      this.landedSeq = seq;
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
      this.flightTween?.kill();
      this.flightTween = undefined;
      this.flightHold?.release();
      this.flightHold = undefined;
      this.landingHold?.release();
      this.landingHold = undefined;
      this.landedSeq = undefined;
      this.flightSeq = undefined;
      this.flight = undefined;
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
      this.agendaGlide = handle;
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
