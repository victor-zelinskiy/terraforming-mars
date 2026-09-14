<template>
  <!-- «ПАРЛАМЕНТ» — the Mars Parliament workspace (Turmoil Redux).

       ONE FLOW, one screen: the GOVERNMENT (who rules, what that gives, the
       chairman quest, the seat) beside the VOTING AREA (three resolutions, the
       delegates on each, who leads them, which one wins now — and, under the
       cursor, what the viewer's next delegate changes); the six PARTIES with
       their access states and ONE detail zone that unfolds the focused
       party's printed formula; the AGENDA track. A stage — the VOTE, the
       chairman SEAT, a party ACTION, the RESULTS of the last political phase —
       UNFOLDS IN PLACE of the parties tier (the cards, the frame, the rail do
       not move) and the header's crumb grows a tail («ПАРЛАМЕНТ › <резолюция> ›
       ГОЛОС»). Nothing here re-derives a rule: availability is the PRESENCE of
       the server's own option in the action menu (found by its structural
       marker), the numbers are the server's projections, and a submit is the
       byte-identical response the live prompt expects. -->
  <section class="con-parl con-ws"
           :class="{
             'con-parl--handed-over': sceneHandedOver,
             'con-parl--stage': stageUp,
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
      <!-- The viewer's DELEGATES — the two physical sources of a vote (the
           free lobby delegate, the paid reserve). The vote flight LAUNCHES
           from these chips. -->
      <span v-if="view.viewer !== undefined" class="con-parl__chip con-parl__chip--delegates" data-parl-delegates>
        <span class="con-parl__chip-dim">{{ $t('Lobby') }}</span>
        <span class="con-parl__chip-cube" :class="{'con-parl__chip-cube--empty': !view.viewer.lobby}" data-parl-lobby-cube>
          <PlayerCube v-if="view.viewer.lobby" :color="view.viewer.color" :size="14" />
        </span>
        <span class="con-parl__chip-dim">{{ $t('Reserve') }}</span>
        <span class="con-parl__chip-cube" :class="{'con-parl__chip-cube--empty': view.viewer.reserve === 0}" data-parl-reserve-cube>
          <PlayerCube v-if="view.viewer.reserve > 0" :color="view.viewer.color" :size="14" />
        </span>
        <b :key="'r' + view.viewer.reserve" class="con-parl__tick">{{ view.viewer.reserve }}</b>
      </span>
      <span v-if="view.viewer !== undefined" class="con-parl__chip">
        <span class="con-parl__chip-dim">{{ $t('Influence') }}</span><b :key="'i' + view.viewer.influence" class="con-parl__tick">{{ view.viewer.influence }}</b>
      </span>
      <span class="con-parl__chip con-parl__chip--deck">
        <span class="con-parl__chip-dim">{{ $t('Resolution deck') }}</span><b>{{ view.deckSize }}</b>
      </span>
    </ConsoleWsHead>

    <div class="con-parl__body">
      <!-- ══ TOP TIER: the GOVERNMENT · the VOTING AREA ══ -->
      <div class="con-parl__top">
        <!-- ── THE GOVERNMENT — one connected reading: the enacted resolution
             (or the starting rule), the ruling party and its effect, the
             chairman quest with its reward, the seat. Nothing here is repeated
             elsewhere on the screen. ── -->
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

          <!-- WHO RULES AND WHAT IT GIVES — one row: the object the rule comes
               from (the ENACTED CARD; before the first enactment the ruling
               party's own emblem), and beside it the party, its basis and its
               printed EFFECT. Said once: the basis names the source, the note
               under the formula says who holds it. -->
          <div class="con-parl__ruling">
            <div v-if="enactedVm !== undefined" class="con-parl__gov-card" :data-zoom-slot="'resolution:' + view.enacted?.resolutionId">
              <premium-card-face :vmOverride="enactedVm" :lightweight="true" :inert="true" />
            </div>
            <img v-else class="con-parl__gov-emblem" :src="emblemUrl(view.rulingParty)" alt="" />
            <div class="con-parl__ruling-text">
              <span class="con-parl__kicker">{{ $t('Ruling party') }}</span>
              <span class="con-parl__ruling-line">
                <img v-if="view.enacted !== undefined" class="con-parl__ruling-emblem" :src="emblemUrl(view.rulingParty)" alt="" />
                <b class="con-parl__ruling-name">{{ $t(view.rulingParty) }}</b>
              </span>
              <span v-if="view.enacted === undefined" class="con-parl__ruling-note">{{ $t('The Greens rule until the first resolution is enacted') }}</span>
              <span v-else class="con-parl__ruling-res">{{ $t(resolutionTitle(view.enacted.resolutionId)) }}</span>
              <ConsolePartyFormula class="con-parl__gov-formula" :party="view.rulingParty" size="wide" />
              <span class="con-parl__gov-effect-note">{{ $t('Every player has this effect while the party rules') }}</span>
            </div>
          </div>

          <!-- THE CHAIRMAN QUEST: the goal as a graphic, the progress per seat,
               the reward (the seat + the concrete Agenda step), the CURRENT
               chairman — and, once done, a compact finished state naming who. -->
          <div v-if="view.quest !== undefined" class="con-parl__quest"
               :class="{'con-parl__quest--done': view.quest.completedBy !== undefined, 'con-parl__quest--pulse': questPulse}"
               data-parl-quest>
            <div class="con-parl__quest-head">
              <span class="con-parl__kicker">{{ $t('Chairman quest') }}</span>
              <span v-if="view.quest.completedBy !== undefined" class="con-parl__quest-state">✓ {{ $t('Completed') }}</span>
            </div>
            <div class="con-parl__quest-goal">
              <PremiumMechanicsPanel v-if="questMechanics !== undefined && !questMechanics.textOnly" class="con-parl__quest-graphic" :mechanics="questMechanics" />
              <span class="con-parl__quest-text">{{ $t(view.quest.text) }}</span>
            </div>
            <div v-if="view.quest.completedBy === undefined" class="con-parl__quest-progress" data-parl-quest-progress>
              <span v-for="row in questRows" :key="row.color" class="con-parl__quest-row"
                    :class="{'con-parl__quest-row--me': row.color === viewerColor, 'con-parl__quest-row--close': row.value > 0 && row.value >= view.quest.definition.count - 1}">
                <PlayerCube :color="row.color" :size="14" />
                <b :key="row.value" class="con-parl__tick">{{ row.value }}</b><span class="con-parl__quest-of">/{{ view.quest.definition.count }}</span>
              </span>
            </div>
            <div class="con-parl__quest-reward">
              <span class="con-parl__quest-reward-kicker">{{ $t(view.quest.completedBy !== undefined ? 'Won by' : 'Reward') }}</span>
              <template v-if="view.quest.completedBy !== undefined">
                <span class="con-parl__quest-who">
                  <PlayerCube :color="view.quest.completedBy" :size="14" />
                  <b>{{ nameOf(view.quest.completedBy) }}</b>
                </span>
                <span class="con-parl__quest-reward-note">{{ $t('the chairman seat and an Agenda step') }}</span>
                <span v-if="view.quest.completedBy === view.chairman" class="con-parl__quest-reward-seat">{{ $t('now the chairman') }}</span>
              </template>
              <template v-else>
                <span class="con-parl__quest-reward-text">{{ $t('The chairman seat and one Agenda step') }}</span>
                <span class="con-parl__quest-reward-short">{{ $t('Chairman seat + Agenda step') }}</span>
                <span v-if="agendaNextText !== ''" class="con-parl__quest-reward-next">→ {{ translateParams('for you: ${0}', [agendaNextText]) }}</span>
              </template>
            </div>
            <div v-if="!(view.quest.completedBy !== undefined && view.quest.completedBy === view.chairman)" class="con-parl__chair" data-parl-chair>
              <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
              <template v-if="view.chairman !== undefined">
                <PlayerCube :color="view.chairman" :size="14" />
                <b>{{ nameOf(view.chairman) }}</b>
              </template>
              <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
            </div>
          </div>
          <div v-else class="con-parl__chair con-parl__chair--alone" data-parl-chair>
            <span class="con-parl__quest-reward-kicker">{{ $t('Chairman') }}</span>
            <template v-if="view.chairman !== undefined">
              <PlayerCube :color="view.chairman" :size="14" />
              <b>{{ nameOf(view.chairman) }}</b>
            </template>
            <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
          </div>
        </div>

        <!-- ── THE VOTING AREA — the screen's centre: three resolutions, the
             delegates on each (in placement order — the order breaks ties),
             the leader, the winning card. ── -->
        <div class="con-parl__voting" data-parl-voting>
          <div class="con-parl__voting-head">
            <span class="con-parl__kicker">{{ $t('Voting area') }}</span>
            <span class="con-parl__voting-note">{{ $t('Most delegates wins; a tie goes to the slot closest to the government') }}</span>
          </div>
          <div class="con-parl__slots">
            <div v-for="(slot, i) in view.slots" :key="slot.instance"
                 class="con-parl__slot"
                 :class="{
                   'con-parl__slot--focus': zone === 'voting' && slotIndex === i && stage === 'browse',
                   'con-parl__slot--winning': slot.isWinning,
                   'con-parl__slot--target': targeting && slotIndex === i,
                   'con-parl__slot--candidate': stage === 'seat' && seatCandidates.includes(i),
                   'con-parl__slot--landed': stage === 'landed' && slotIndex === i,
                   'con-parl__slot--recap': stage === 'recap' && recapHighlight === 'refresh',
                   'con-parl__slot--mine': slot.leader !== undefined && slot.leader === viewerColor,
                 }"
                 :style="{'--parl-accent': partyAccent(slot.party)}"
                 :data-instance="slot.instance"
                 :data-party="slot.party"
                 :data-votes="slot.totalVotes">
              <div class="con-parl__slot-label">
                <span class="con-parl__slot-no">V{{ slot.tiePriority }}</span>
                <span v-if="slot.tiePriority === 1" class="con-parl__slot-prio" :data-hint="$t('Closest to the government — wins a tie between resolutions')">★</span>
                <img class="con-parl__slot-emblem" :src="emblemUrl(slot.party)" alt="" />
                <span class="con-parl__slot-party">{{ $t(slot.party) }}</span>
                <span v-if="slot.isWinning" class="con-parl__slot-win">{{ $t('Winning') }}</span>
              </div>
              <div class="con-parl__card" :data-zoom-slot="'resolution:' + slot.resolutionId">
                <premium-card-face v-if="slotVms[i] !== undefined" :vmOverride="slotVms[i]" :lightweight="true" :inert="true" />
              </div>
              <!-- THE TALLY — the vote read at a glance, beside the card: how many
                   delegates, who LEADS (the player who would win it — never the
                   winning card, never the chairman), what is YOURS and how close
                   it is to the party's effect. -->
              <div class="con-parl__tally" data-parl-tally>
                <div class="con-parl__tally-total">
                  <b :key="'t' + slot.totalVotes" class="con-parl__tally-num con-parl__tick">{{ slot.totalVotes }}</b>
                  <span class="con-parl__tally-unit">{{ $t('delegates') }}</span>
                </div>
                <div v-if="slot.leader !== undefined" class="con-parl__tally-row con-parl__tally-row--leader" data-parl-leader>
                  <span class="con-parl__tally-key">{{ $t('Leader') }}</span>
                  <span class="con-parl__tally-val">
                    <PlayerCube v-if="slot.leader !== 'neutral'" :color="slot.leader" :size="16" />
                    <span v-else class="con-parl__neutral con-parl__neutral--big" aria-hidden="true"></span>
                    <b :key="'l' + slot.leaderVotes" class="con-parl__tick">{{ slot.leaderVotes }}</b>
                  </span>
                  <span v-if="slotTieNote(slot) !== ''" class="con-parl__tally-note">{{ $t(slotTieNote(slot)) }}</span>
                </div>
                <div v-else class="con-parl__tally-row con-parl__tally-row--none">{{ $t('No leader yet') }}</div>
                <div v-if="viewerParticipates && viewerColor !== undefined" class="con-parl__tally-row con-parl__tally-row--mine"
                     :class="{'con-parl__tally-row--held': slot.viewerVotes >= PARTY_EFFECT_THRESHOLD}" data-parl-mine>
                  <span class="con-parl__tally-key">{{ $t('Yours') }}</span>
                  <span class="con-parl__tally-val">
                    <PlayerCube :color="viewerColor" :size="16" />
                    <b :key="'m' + slot.viewerVotes" class="con-parl__tick">{{ slot.viewerVotes }}</b>
                  </span>
                  <span class="con-parl__tally-access">{{ slot.viewerVotes >= PARTY_EFFECT_THRESHOLD ? $t('effect is yours') : translateParams('${0} of ${1} for the effect', [String(slot.viewerVotes), String(PARTY_EFFECT_THRESHOLD)]) }}</span>
                </div>
                <div v-if="slot.isWinning && slotWinsTie(i)" class="con-parl__tally-note con-parl__tally-note--win">★ {{ $t('tie · closer to the government') }}</div>
              </div>
              <!-- THE DELEGATE RIBBON — every delegate on the card, in placement
                   order (the order the player tie reads); a crowded card folds
                   into one stack per owner, still in first-arrival order. -->
              <div class="con-parl__ribbon" :class="{'con-parl__ribbon--dense': slot.votes.length > DENSE_RIBBON}" :data-votes="slot.totalVotes">
                <template v-if="slot.votes.length <= DENSE_RIBBON">
                  <span v-for="vote in slot.votes" :key="vote.seq" class="con-parl__vote"
                        :class="{'con-parl__vote--neutral': vote.owner === 'neutral', 'con-parl__vote--landed': vote.seq === landedSeq, 'con-parl__vote--hidden': vote.seq === flightSeq}"
                        :data-seq="vote.seq"
                        :data-landed="vote.seq === landedSeq ? '' : undefined">
                    <PlayerCube v-if="vote.owner !== 'neutral'" :color="vote.owner" :size="20" />
                    <span v-else class="con-parl__neutral" aria-hidden="true"></span>
                  </span>
                </template>
                <template v-else>
                  <span v-for="group in ribbonGroups(slot)" :key="group.owner" class="con-parl__vote-stack"
                        :class="{'con-parl__vote-stack--neutral': group.owner === 'neutral', 'con-parl__vote-stack--landed': group.hasSeq(landedSeq)}"
                        :data-seq="group.seqs[group.seqs.length - 1]">
                    <PlayerCube v-if="group.owner !== 'neutral'" :color="group.owner" :size="20" />
                    <span v-else class="con-parl__neutral" aria-hidden="true"></span>
                    <b>×{{ group.count }}</b>
                  </span>
                </template>
                <span v-if="ghostOn && slotIndex === i && viewerColor !== undefined" class="con-parl__vote con-parl__vote--ghost" data-parl-ghost>
                  <PlayerCube :color="viewerColor" :size="20" />
                </span>
                <span v-if="slot.votes.length === 0 && !(ghostOn && slotIndex === i)" class="con-parl__ribbon-empty">{{ $t('No delegates yet') }}</span>
              </div>
            </div>
          </div>
          <!-- THE FOCUS RAIL — one line, fixed height: what the viewer's next
               delegate on the focused card changes (the server's projection),
               or why no delegate can be sent. -->
          <div class="con-parl__rail" :class="{'con-parl__rail--live': railForecast !== undefined && canVoteNow, 'con-parl__rail--off': !canVoteNow}" data-parl-rail>
            <template v-if="railForecast !== undefined && canVoteNow">
              <span class="con-parl__rail-source">
                <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="12" />
                <span>{{ $t(railForecast.source === 'lobby' ? 'from the lobby · free' : 'from the reserve') }}</span>
                <ActionEffectChip v-if="railForecast.source === 'reserve'" class="con-parl__rail-cost" :effect="voteCostChip" />
              </span>
              <span class="con-parl__rail-sep" aria-hidden="true">›</span>
              <span class="con-parl__rail-votes"><b>{{ railForecast.votesBefore }} → {{ railForecast.votesAfter }}</b> {{ $t('delegates') }}</span>
              <span v-for="(row, k) in railRows" :key="k" class="con-parl__rail-row" :class="'con-parl__rail-row--' + row.tone">{{ $t(row.key) }}</span>
            </template>
            <span v-else class="con-parl__rail-reason">{{ voteBlockedText }}</span>
          </div>
        </div>
      </div>

      <!-- ══ MIDDLE TIER — the PARTIES (browse) or the STAGE (a flow) — ONE
           zone, one rect: the stage unfolds from the tier the parties occupy
           and folds back into it, so the frame above and the track below
           never move. ══ -->
      <div class="con-parl__mid" ref="midEl" data-parl-mid>
        <div class="con-parl__parties-tier" ref="partiesTierEl" :class="{'con-parl__parties-tier--parked': stageUp}" v-show="!stageUp || stageLeaving">
          <div class="con-parl__parties" data-parl-parties>
            <div v-for="(p, i) in view.parties" :key="p.party"
                 class="con-parl__party"
                 :class="[
                   'con-parl__party--' + partyStates[i].kind,
                   'con-parl__party--tone-' + partyStates[i].tone,
                   {
                     'con-parl__party--focus': zone === 'parties' && partyIndex === i,
                     'con-parl__party--held': partyStates[i].held,
                     'con-parl__party--recap': stage === 'recap' && recapHighlight === 'support' && (recapCurrent?.parties ?? []).includes(p.party),
                     'con-parl__party--pulse': accessPulse === p.party,
                     'con-parl__party--lost': accessLost === p.party,
                   },
                 ]"
                 :style="{'--parl-accent': partyAccent(p.party)}"
                 :data-party="p.party"
                 :data-party-state="partyStates[i].kind"
                 :data-action-state="partyActionStates[i].kind">
              <img class="con-parl__party-emblem" :src="emblemUrl(p.party)" alt="" />
              <span class="con-parl__party-body">
                <span class="con-parl__party-top">
                  <span class="con-parl__party-name">{{ $t(p.party) }}</span>
                  <!-- POPULAR SUPPORT — neutral delegates waiting for the party's
                       next resolution: grey cubes (the neutral player's own
                       colour), the count beside them, never a bare dot. -->
                  <span class="con-parl__support" :data-support="p.support"
                        :data-hint="$t('Popular support: neutral delegates that will vote for this party\'s next resolution')">
                    <span v-for="n in 3" :key="n" class="con-parl__support-cube" :class="{'con-parl__support-cube--on': n <= p.support}"></span>
                  </span>
                </span>
                <span class="con-parl__party-state">{{ partyStateText(partyStates[i]) }}</span>
              </span>
              <span v-if="partyActionStates[i].kind !== 'none'" class="con-parl__party-action" :class="'con-parl__party-action--' + partyActionStates[i].kind" aria-hidden="true">
                {{ partyActionStates[i].kind === 'used' ? '⟳' : (partyActionStates[i].kind === 'available' ? '◈' : '◇') }}
              </span>
            </div>
          </div>
          <!-- THE PARTY DETAIL — the ONE zone that unfolds the party under the
               cursor: its printed formula (the same drawing the face and the
               inspector use), why the viewer holds it (by the current game
               state), and its action's state. -->
          <div class="con-parl__pdetail" v-if="detailParty !== undefined" :style="{'--parl-accent': partyAccent(detailParty.party)}" :data-party="detailParty.party">
            <div class="con-parl__pdetail-head">
              <img class="con-parl__pdetail-emblem" :src="emblemUrl(detailParty.party)" alt="" />
              <div class="con-parl__pdetail-title">
                <b>{{ $t(detailParty.party) }}</b>
                <span class="con-parl__pdetail-state" :class="'con-parl__pdetail-state--' + detailState.tone">{{ partyStateText(detailState) }}</span>
              </div>
              <span v-if="detailActionState.kind !== 'none'" class="con-parl__pdetail-action" :class="'con-parl__pdetail-action--' + detailActionState.kind">
                <span class="con-parl__chip-dim">{{ $t('Action') }}</span>
                <b>{{ $t(detailActionState.label) }}</b>
                <span v-if="detailActionState.kind === 'available' || detailActionState.kind === 'used'" class="con-parl__pdetail-uses">{{ detailActionState.usesLeft }}/{{ detailActionState.usesPerGeneration }}</span>
              </span>
            </div>
            <div class="con-parl__pdetail-body">
              <ConsolePartyFormula class="con-parl__pdetail-formula" :party="detailParty.party" size="wide" :dim="!detailState.held" />
              <!-- The LIVE reading first (why the viewer holds it, what blocks
                   its action). The effect and the action in their SHORT printed
                   words follow only while the live reading is short — a zone of
                   fixed height never cuts a reason to make room for a sentence
                   the formula beside it and the inspector (X) already carry. -->
              <div class="con-parl__pdetail-text">
                <span v-for="(row, k) in detailReasons" :key="k" class="con-parl__pdetail-reason" :class="'con-parl__pdetail-reason--' + row.tone">{{ reasonRowText(row) }}</span>
                <span v-if="detailActionState.reason !== undefined" class="con-parl__pdetail-reason con-parl__pdetail-reason--lacks">{{ reasonText(detailActionState.reason) }}</span>
                <template v-if="detailWords">
                  <span v-if="detailParty.effect?.text.passive !== undefined" class="con-parl__pdetail-rule">{{ translateParams('Effect: ${0}', [$t(detailParty.effect.text.passive)]) }}</span>
                  <span v-if="detailParty.effect?.text.action !== undefined" class="con-parl__pdetail-rule">{{ translateParams('Action (once per generation): ${0}', [$t(detailParty.effect.text.action)]) }}</span>
                </template>
              </div>
            </div>
          </div>
        </div>

        <!-- ── THE STAGE ZONE — one zone, one stage at a time ── -->
        <transition :css="false" @enter="onStageEnter" @leave="onStageLeave" @enter-cancelled="onStageEnterCancelled" @leave-cancelled="onStageLeaveCancelled">
          <div v-if="stageUp" class="con-parl__stage" :class="'con-parl__stage--' + stage" :data-parl-stage="stage" ref="stageEl">
            <!-- VOTE -->
            <template v-if="stageKind === 'vote' && focusedSlot !== undefined">
              <div class="con-parl__stage-head" :style="{'--parl-accent': partyAccent(focusedSlot.party)}">
                <img class="con-parl__emblem" :src="emblemUrl(focusedSlot.party)" alt="" />
                <div>
                  <b class="con-parl__stage-title">{{ $t(resolutionTitle(focusedSlot.resolutionId)) }}</b>
                  <span class="con-parl__stage-sub">{{ $t(focusedSlot.party) }} · V{{ focusedSlot.tiePriority }}<template v-if="focusedSlot.isWinning"> · {{ $t('winning now') }}</template></span>
                </div>
                <span class="con-parl__stage-nav" aria-hidden="true">◀ ▶</span>
              </div>
              <div class="con-parl__stage-body">
                <div class="con-parl__txn" data-parl-txn>
                  <div class="con-parl__txn-row">
                    <span class="con-parl__chip-dim">{{ $t('Delegate') }}</span>
                    <span class="con-parl__txn-val">
                      <PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="12" />
                      <b>{{ $t(voteTile?.source === 'lobby' ? 'Free delegate from the lobby' : 'From the reserve') }}</b>
                    </span>
                  </div>
                  <div class="con-parl__txn-row" v-if="voteTile?.source === 'reserve' && view.viewer !== undefined">
                    <span class="con-parl__chip-dim">{{ $t('Cost') }}</span>
                    <ActionEffectChip :effect="voteCostChip" />
                  </div>
                  <div class="con-parl__txn-row" v-if="view.viewer !== undefined">
                    <span class="con-parl__chip-dim">{{ $t('Reserve') }}</span>
                    <b>{{ view.viewer.reserve }} → {{ voteTile?.source === 'reserve' ? view.viewer.reserve - 1 : view.viewer.reserve }}</b>
                  </div>
                  <div class="con-parl__txn-row">
                    <span class="con-parl__chip-dim">{{ $t('Delegates on the card') }}</span>
                    <b>{{ focusedSlot.totalVotes }} → {{ focusedSlot.totalVotes + 1 }}</b>
                  </div>
                  <div class="con-parl__txn-row">
                    <span class="con-parl__chip-dim">{{ $t('Yours') }}</span>
                    <b>{{ focusedSlot.viewerVotes }} → {{ focusedSlot.viewerVotes + 1 }}</b>
                  </div>
                  <div class="con-parl__txn-row" v-if="voteForecast !== undefined">
                    <span class="con-parl__chip-dim">{{ $t('Leader') }}</span>
                    <span class="con-parl__txn-val">
                      <template v-if="voteForecast.leaderBefore !== undefined && voteForecast.leaderBefore !== 'neutral'"><PlayerCube :color="voteForecast.leaderBefore" :size="12" /></template>
                      <span v-else class="con-parl__neutral con-parl__neutral--inline" aria-hidden="true"></span>
                      <span aria-hidden="true">→</span>
                      <template v-if="voteForecast.leaderAfter !== undefined && voteForecast.leaderAfter !== 'neutral'"><PlayerCube :color="voteForecast.leaderAfter" :size="12" /></template>
                      <span v-else class="con-parl__neutral con-parl__neutral--inline" aria-hidden="true"></span>
                      <b>{{ nameOf(voteForecast.leaderAfter) }}</b>
                    </span>
                  </div>
                </div>
                <ul class="con-parl__consequences" data-parl-consequences>
                  <li v-for="(c, i) in voteConsequenceRows" :key="i" :class="'con-parl__consequence--' + c.tone">{{ $t(c.key) }}</li>
                  <li class="con-parl__consequence--note con-parl__consequence--fine">{{ $t('A forecast at the current distribution — other players still vote.') }}</li>
                </ul>
              </div>
              <div class="con-parl__cta" :class="{'con-parl__cta--ready': canVoteNow && stage === 'vote', 'con-parl__cta--busy': stage === 'submitting'}" data-parl-cta @click="submitVote()">
                <GamepadGlyph control="confirm" class="con-parl__cta-glyph" />
                <span class="con-parl__cta-label">{{ $t(stage === 'submitting' ? 'Performing…' : 'Send the delegate') }}</span>
                <span v-if="stage !== 'submitting'" class="con-parl__cta-sub">{{ $t('A full action') }}</span>
              </div>
            </template>

            <!-- CHAIRMAN SEAT -->
            <template v-else-if="stageKind === 'seat' && focusedSlot !== undefined">
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
                    <span class="con-parl__txn-val"><PlayerCube v-if="viewerColor !== undefined" :color="viewerColor" :size="12" /><b>{{ $t('yours') }}</b></span>
                  </div>
                </div>
              </div>
              <div class="con-parl__cta" :class="{'con-parl__cta--ready': stage === 'seat', 'con-parl__cta--busy': stage === 'submitting'}" data-parl-cta @click="submitSeat()">
                <GamepadGlyph control="confirm" class="con-parl__cta-glyph" />
                <span class="con-parl__cta-label">{{ $t(stage === 'submitting' ? 'Performing…' : 'Take the delegate') }}</span>
              </div>
            </template>

            <!-- A PARTY ACTION — the shared composer, hosted here as a stage
                 (the canonical door is the action menu; this is the contextual launch). -->
            <ConsolePartyActionComposer v-else-if="stageKind === 'action' && actionParty !== undefined"
                                        ref="partyComposer"
                                        class="con-parl__composer"
                                        :playerView="playerView"
                                        :party="actionParty"
                                        :submitting="stage === 'submitting'"
                                        @confirm="onPartyConfirm"
                                        @cancel="closeStage()"
                                        @inspect="inspectParty($event)"
                                        @commands="onComposerCommands" />

            <!-- RESULTS — the previous generation's political phase, one beat per
                 line; each line lights the object it changed. -->
            <template v-else-if="stage === 'recap'">
              <!-- The head carries the commit plate on its own row, so the beat
                   list owns every remaining line of the tier (a list that ran
                   under the plate once hid its own last beats). -->
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

            <!-- SUBMITTING — the executing beat: the decision is sent, nothing to undo. -->
            <template v-else-if="stage === 'submitting'">
              <div class="con-parl__stage-head">
                <div>
                  <b class="con-parl__stage-title">{{ $t('Recording your decision…') }}</b>
                </div>
              </div>
            </template>
            <!-- THE EMBED ZONE — a step teleported into this stage (a resolution's
                 own choice) takes the room here; the zone contract's «children get
                 the room» rule is scoped to this element, never to the stage's own rows. -->
            <div class="con-parl__embed" data-embed-slot="parliament"></div>
          </div>
        </transition>
      </div>

      <!-- ══ THE AGENDA — a compact graphic track: the markers, the influence
           LEVELS (never «+2»), the TR and card rewards, the viewer's next step. ══ -->
      <div class="con-parl__agenda" data-parl-agenda :class="{'con-parl__agenda--focus': zone === 'agenda'}">
        <div class="con-parl__agenda-head">
          <span class="con-parl__kicker">{{ $t('Agenda') }}</span>
          <span v-if="view.viewer !== undefined" class="con-parl__agenda-me">
            <PlayerCube :color="view.viewer.color" :size="14" />
            <span class="con-parl__chip-dim">{{ $t('Influence') }}</span>
            <b :key="'ai' + agendaVm.viewerInfluence" class="con-parl__tick">{{ agendaVm.viewerInfluence }}</b>
            <span v-if="agendaNextText !== ''" class="con-parl__agenda-next">{{ $t('next step') }}: <b>{{ agendaNextText }}</b></span>
            <span v-else class="con-parl__agenda-next">{{ $t('end of the track') }}</span>
          </span>
          <span class="con-parl__agenda-legend">{{ $t('Numbered steps set the influence LEVEL; a step with the rating icon gives +1 TR, one with the card icon draws a card') }}</span>
        </div>
        <div class="con-parl__track">
          <div class="con-parl__step con-parl__step--start" :class="{'con-parl__step--here': viewerParticipates && agendaVm.viewerPosition === 0}" data-step="0">
            <span class="con-parl__step-icon">{{ $t('Agenda start') }}</span>
            <span class="con-parl__step-cubes">
              <PlayerCube v-for="color in agendaVm.start" :key="color" :color="color" :size="14" />
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
              <span class="con-parl__step-cubes">
                <PlayerCube v-for="color in step.cubes" :key="color" :color="color" :size="14" />
              </span>
          </div>
        </div>
      </div>
    </div>

    <!-- THE DELEGATE FLIGHT — a cube on its way from the lobby / reserve chip
         to the card it was sent to (shell-level fixed layer, measured rects). -->
    <Teleport to="body">
      <div v-if="flight !== undefined" class="con-parl__flight" ref="flightEl" aria-hidden="true">
        <PlayerCube :color="flight.color" :size="14" />
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
import {PlayerInputModel} from '@/common/models/PlayerInputModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PARTY_EFFECT_DELEGATES as PARTY_EFFECT_THRESHOLD, PartyActionId, ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import PremiumMechanicsPanel from '@/client/components/premiumCard/PremiumMechanicsPanel.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import ConsolePartyActionComposer from '@/client/components/console/parliament/ConsolePartyActionComposer.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {consoleParliamentUi, markParliamentRecapSeen, parliamentRecapSeen} from '@/client/console/consoleParliamentState';
import {
  accessReasonRows, AccessReasonRow, agendaViewOf, AgendaVm, buildParliamentView, ParliamentPartyVm, ParliamentPromptBridge,
  ParliamentSlotVm, ParliamentTileVm, ParliamentViewVm, parliamentPromptBridge, partyActionStateOf, PartyActionStateVm,
  partyStateOf, PartyStateVm, seatResponse, voteForecastOf, VoteForecastVm, voteForecastRows, voteResponse,
} from '@/client/console/parliament/consoleParliamentModel';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {buildMechanics, MechanicsVM} from '@/client/components/premiumCard/mechanicsModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {setWorkspaceFramePhase, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameHasNested, workspaceFrameKnown} from '@/client/console/consoleWorkspaceStack';
import {clearCardColonyTrade, partyColonyTradeParty} from '@/client/console/colonyTrade/colonyTradeEntry';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {useResizeObserver} from '@vueuse/core';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {AnimationHold, beginAnimationHold, holdForGsapAnimation} from '@/client/components/presentation/animationHold';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {motionMs} from '@/client/components/motion/motionTokens';
import {descendSurfaceInset, guardedDescend} from '@/client/console/surfaceMotion/workspaceDescend';

type Zone = 'voting' | 'government' | 'parties' | 'agenda';
/**
 * `landed` — the vote's answer arrived: the delegate settles on the card
 * before the flow leaves. `recap` — the RESULTS scene: the previous
 * generation's political phase, read from the server's summary and played
 * beat by beat on the objects it changed (once per generation, on the
 * workspace's first open). `action` — a party action composed here (the
 * contextual launch from the party's detail; the canonical door is the action
 * menu, same composer).
 */
type Stage = 'browse' | 'vote' | 'seat' | 'action' | 'submitting' | 'landed' | 'recap';

/** The delegate's landing beat (the cube settles on the ribbon, the slot flashes). */
const VOTE_LANDING_MS = 620;
/** The delegate's flight from its source chip to the card. */
const VOTE_FLIGHT_MS = 560;
/** One results beat: the next line lights and the object it names flashes. */
const RECAP_BEAT_MS = 900;
/** The stage's unfold / fold (the same phrase every workspace descent plays). */
const STAGE_UNFOLD_MS = 300;
const STAGE_FOLD_MS = 220;
/** A ribbon past this many delegates collapses into per-owner stacks. */
const DENSE_RIBBON = 12;
/** The parties tier's columns (the grid is 3 × 2 on every profile). */
const PARTY_COLUMNS = 3;
/** Past this many live reasons the party detail drops its printed words (the zone's height is fixed). */
const DETAIL_WORDS_MAX_REASONS = 2;

/** A results beat: what the sentence says, and which object on the board it points at. */
type RecapItem = {
  key: string;
  text: string;
  focus: 'enacted' | 'agenda' | 'support' | 'refresh' | 'lobby';
  step?: number;
  parties?: ReadonlyArray<ReduxParty>;
};

/** How long a submit may stay unanswered before the stage gives the player back their hands. */
const SUBMIT_SAFETY_MS = 6000;

/* THE CARD FIT. The premium face is px-designed (`--pcard-w/h`) and integrates
   through `zoom`; the zones it stands in are sized by the FRAME (the body's
   grid rows), never by the cards — so the fit budgets from the zone minus its
   MEASURED chrome (label / ribbon / meta / rail are text, independent of the
   zoom) and never reads its own output. */
const PCARD_W = 320;
const PCARD_H = 460;
/** Per unit of `--con-ui-scale`: a card never grows past this, whatever the room. */
const MAX_CARD_ZOOM = 0.95;
const MIN_CARD_ZOOM = 0.3;
/** The enacted face in the government column — a small object beside the ruling text. */
const MAX_GOV_ZOOM = 0.42;
const MIN_GOV_ZOOM = 0.16;

export type ParliamentInspectRequest = {kind: 'resolution', id: string} | {kind: 'party', party: ReduxParty};

type RibbonGroup = {owner: Color | 'neutral', count: number, seqs: ReadonlyArray<number>, hasSeq: (seq: number | undefined) => boolean};

export default defineComponent({
  name: 'ConsoleParliamentSection',
  components: {ConsoleWsHead, PlayerCube, ActionEffectChip, GamepadGlyph, PremiumMechanicsPanel, ConsolePartyFormula, ConsolePartyActionComposer},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    myTurn: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
  },
  emits: ['close', 'submit', 'notice', 'inspect', 'open-trading', 'flow-complete', 'collapse'],
  data() {
    return {
      DENSE_RIBBON,
      PARTY_EFFECT_THRESHOLD,
      zone: 'voting' as Zone,
      stage: 'browse' as Stage,
      /** The stage is folding back — its DOM stays for the leave beat. */
      stageLeaving: false,
      slotIndex: 0,
      partyIndex: 0,
      /** The party whose action is composed in the `action` stage. */
      actionParty: undefined as ReduxParty | undefined,
      /** The composer's live command contract (it hands its bar UP). */
      composerCommands: [] as Array<ConsoleCommand>,
      /** The stage the submit left — restored if the server refuses. */
      stageBeforeSubmit: 'browse' as Stage,
      submitTimer: undefined as number | undefined,
      submittedAge: -1,
      stopFitObs: undefined as (() => void) | undefined,
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
      /** A party whose effect the viewer just GAINED / LOST — the tile pulses once. */
      accessPulse: undefined as ReduxParty | undefined,
      accessLost: undefined as ReduxParty | undefined,
      accessTimer: undefined as number | undefined,
      /** The Agenda step the viewer's marker just reached — flashes once. */
      agendaPulseStep: undefined as number | undefined,
      agendaTimer: undefined as number | undefined,
      /** The quest just completed — the block pulses once. */
      questPulse: false,
      questTimer: undefined as number | undefined,
      /** The parties tier's rect at the press — the stage unfolds from it. */
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
    /** The viewer takes part in the parliament (a MarsBot seat / a spectator does not). */
    viewerParticipates(): boolean {
      return this.view.viewer?.participates === true;
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
    sceneHandedOver(): boolean {
      return workspaceFrameHasNested('parliament');
    },
    stageUp(): boolean {
      return this.stage !== 'browse' && this.stage !== 'landed';
    },
    /** The stage's CONTENT identity — a submit keeps the stage it left on screen (busy), never a swap to a bare «sending» panel. */
    stageKind(): Stage {
      return this.stage === 'submitting' ? this.stageBeforeSubmit : this.stage;
    },
    /** A slot is the TARGET of a vote / seat pick (through the submit's executing beat too). */
    targeting(): boolean {
      return this.stageKind === 'vote' || this.stageKind === 'seat';
    },
    ghostOn(): boolean {
      return this.stageKind === 'vote';
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
    focusedParty(): ParliamentPartyVm | undefined {
      return this.view.parties[this.partyIndex];
    },
    voteTile(): ParliamentTileVm | undefined {
      return this.view.tiles.find((t) => t.id === 'vote');
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
    /**
     * THE PARTY UNDER THE LENS: the focused party tile, or — while the cursor
     * stands in the voting area / the government — the party of the object
     * under it, so the detail zone always explains the party the player is
     * looking at.
     */
    detailPartyIndex(): number {
      if (this.zone === 'parties') {
        return this.partyIndex;
      }
      const party = this.zone === 'government' ? this.view.rulingParty : this.focusedSlot?.party;
      const idx = this.view.parties.findIndex((p) => p.party === party);
      return idx >= 0 ? idx : this.partyIndex;
    },
    detailParty(): ParliamentPartyVm | undefined {
      return this.view.parties[this.detailPartyIndex];
    },
    detailState(): PartyStateVm {
      return this.partyStates[this.detailPartyIndex] ?? partyStateOf(this.detailParty as ParliamentPartyVm, this.view.enacted === undefined);
    },
    detailActionState(): PartyActionStateVm {
      return this.partyActionStates[this.detailPartyIndex] ?? {kind: 'none', label: '', reason: undefined, usesLeft: 0, usesPerGeneration: 0};
    },
    detailReasons(): Array<AccessReasonRow> {
      const p = this.detailParty;
      if (p === undefined) {
        return [];
      }
      return accessReasonRows(p.access, {
        party: p.party,
        enactedEmpty: this.view.enacted === undefined,
        enactedName: this.view.enacted === undefined ? undefined : translateText(this.resolutionTitle(this.view.enacted.resolutionId)),
        inArea: p.inArea,
      });
    },
    /** The detail zone's short words stand only beside a short live reading (see the template). */
    detailWords(): boolean {
      return this.detailReasons.length + (this.detailActionState.reason !== undefined ? 1 : 0) <= DETAIL_WORDS_MAX_REASONS;
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
    /** The viewer's NEXT Agenda step, as a reward sentence («influence level 2» / «+1 TR» / «draw a card»). */
    agendaNextText(): string {
      const next = this.agendaVm.nextStep;
      if (next === undefined) {
        return '';
      }
      switch (next.kind) {
      case 'influence': return translateTextWithParams('influence level ${0}', [String(next.influence)]);
      case 'tr': return translateText('+1 TR');
      case 'card': return translateText('draw a card');
      }
    },
    voteForecast(): VoteForecastVm | undefined {
      const slot = this.focusedSlot;
      return slot === undefined ? undefined : voteForecastOf(slot, this.viewerColor, this.model?.viewer?.vote);
    },
    railForecast(): VoteForecastVm | undefined {
      return this.voteForecast;
    },
    railRows(): Array<{key: string, tone: 'gain' | 'note' | 'warn'}> {
      return voteForecastRows(this.railForecast, true);
    },
    voteConsequenceRows(): Array<{key: string, tone: 'gain' | 'note' | 'warn'}> {
      return voteForecastRows(this.voteForecast);
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
      const cost = this.voteTile?.cost ?? 0;
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
    /**
     * The previous generation's political results as BEATS (the server's
     * summary, translated here — never the log): each sentence points at the
     * object it changed, so the scene can light that object as the line lands.
     */
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
    /** The beat the scene is on (undefined between scenes). */
    recapCurrent(): RecapItem | undefined {
      return this.stage === 'recap' ? this.recapItems[this.recapBeat] : undefined;
    },
    recapHighlight(): RecapItem['focus'] | '' {
      return this.recapCurrent?.focus ?? '';
    },
    crumbSubject(): string {
      switch (this.stage) {
      case 'vote':
      case 'seat':
      case 'landed':
        return this.resolutionTitle(this.focusedSlot?.resolutionId ?? '');
      // The results scene is a DESCENT into the generation (the crumb's
      // subject); it has no stage of its own.
      case 'recap': return this.recapKicker;
      case 'action': return this.actionParty ?? '';
      case 'submitting':
        return this.stageBeforeSubmit === 'vote' || this.stageBeforeSubmit === 'seat' ?
          this.resolutionTitle(this.focusedSlot?.resolutionId ?? '') : (this.actionParty ?? '');
      default: return '';
      }
    },
    /** The results kicker is a composed, pre-translated phrase; every other subject is an i18n key. */
    crumbSubjectRaw(): boolean {
      return this.stage === 'recap';
    },
    crumbStage(): string {
      switch (this.stage) {
      case 'vote':
      case 'landed':
        return 'Vote';
      case 'seat': return 'Chairman seat';
      case 'action': return 'Action';
      case 'submitting': return 'Sending';
      default: return '';
      }
    },
    crumbCommitted(): boolean {
      return this.stage === 'submitting' || this.stage === 'landed';
    },
    /** THE ONE COMMAND CONTRACT — published to the shell's bar. */
    commands(): Array<ConsoleCommand> {
      const back: ConsoleCommand = {control: 'back', label: this.stage === 'browse' ? 'To the board' : 'Back'};
      switch (this.stage) {
      case 'browse':
        return this.browseCommands(back);
      case 'vote':
        return [{control: 'confirm', label: 'Vote', enabled: this.canVoteNow, highlight: this.canVoteNow}, {control: 'secondary', label: 'Inspect'}, back];
      case 'seat':
        return [{control: 'confirm', label: 'Take the delegate', highlight: true}, {control: 'secondary', label: 'Inspect'}, {control: 'back', label: 'Minimize'}];
      case 'action':
        return this.composerCommands.length > 0 ? this.composerCommands : [back];
      case 'recap':
        return [{control: 'confirm', label: 'Continue', highlight: true}];
      case 'submitting':
        return [{control: 'confirm', label: 'Performing…', enabled: false}];
      case 'landed':
        return [];
      }
    },
    /** A change-key for the viewer's ACCESS set — a gained / lost effect pulses its tile. */
    accessKey(): string {
      return (this.view.viewer?.access ?? []).filter((a) => a.hasEffect).map((a) => a.party).join('|');
    },
    /** The viewer's Agenda position — a move flashes the step reached. */
    agendaPosition(): number {
      return this.view.viewer?.agenda ?? 0;
    },
    questCompletedBy(): Color | undefined {
      return this.view.quest?.completedBy;
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
    /**
     * THE UNITY DOOR ENDS WITH ITS STEP. The colony workspace stood over this
     * one locked to the Unity payment path; once it is gone (B walked out, or the
     * trade concluded) the lock has no subject. A PARKED step keeps it (the frame
     * is still known) — «свернуть» keeps the decision live.
     */
    sceneHandedOver(on: boolean): void {
      if (!on && !workspaceFrameKnown('colonies') && partyColonyTradeParty() === PartyName.UNITY) {
        clearCardColonyTrade();
      }
      if (!on && this.stage === 'browse') {
        // The crumb the door wrote («СОЮЗ › ТОРГОВЛЯ») belongs to the step.
        setWorkspaceFrameSubject('parliament', this.crumbSubject);
        setWorkspaceFrameStage('parliament', this.crumbStage);
        setWorkspaceFramePhase('parliament', 'browse');
      }
    },
    /** A new projection can wrap a slot's meta line — the chrome changed, the frame did not. */
    'view'(): void {
      void this.$nextTick(() => this.fitCards());
    },
    /** The server answered: the stage it committed is over — a vote LANDS first. */
    'playerView.game.gameAge'(age: number): void {
      if (this.stage === 'submitting' && age !== this.submittedAge) {
        this.clearSubmitTimer();
        if (this.stageBeforeSubmit === 'vote' && this.landVote()) {
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
    /** The viewer GAINED or LOST a party effect: the tile answers once (never replayed on a reload — the watcher only sees live changes). */
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
    agendaPosition(now: number, was: number): void {
      if (now > was) {
        this.agendaPulseStep = now;
        if (this.agendaTimer !== undefined) {
          window.clearTimeout(this.agendaTimer);
        }
        this.agendaTimer = window.setTimeout(() => {
          this.agendaPulseStep = undefined;
          this.agendaTimer = undefined;
        }, consoleMotionMs(1400));
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
    // Synchronous in the mount task: measured and applied before the first
    // paint, so the CSS fallback zoom never shows.
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
    for (const timer of [this.accessTimer, this.agendaTimer, this.questTimer]) {
      if (timer !== undefined) {
        window.clearTimeout(timer);
      }
    }
    consoleParliamentUi.commands = [];
    setWorkspaceFrameSubject('parliament', '');
    setWorkspaceFrameStage('parliament', '');
    if (!workspaceFrameKnown('colonies') && partyColonyTradeParty() === PartyName.UNITY) {
      clearCardColonyTrade();
    }
  },
  methods: {
    /** Solve the two card zooms (voting slots · the government's enacted face) from the measured frame. */
    fitCards(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined) {
        return;
      }
      const scale = conUiScale();
      const px = (v: string): number => parseFloat(v) || 0;
      const heightOf = (host: Element, sel: string): number => host.querySelector<HTMLElement>(sel)?.getBoundingClientRect().height ?? 0;
      const snap = (zoom: number): number => Math.max(MIN_CARD_ZOOM * scale, Math.floor(zoom * 1000) / 1000);

      let zoom = 0.62 * scale;
      const slots = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot'));
      if (slots.length > 0) {
        const slot = slots[0];
        const cs = getComputedStyle(slot);
        // BESIDE or STACKED is the profile's call (the slot grid's column count),
        // read off the computed tracks — never a second flag.
        const beside = cs.gridTemplateColumns.trim().split(/\s+/).length > 1;
        const tallyOf = (host: Element) => host.querySelector<HTMLElement>('.con-parl__tally')?.getBoundingClientRect();
        // The TALLEST slot's chrome budgets every card (one wrapped note in one
        // slot must not push that slot's card over its ribbon).
        const chrome = Math.max(...slots.map((s) =>
          heightOf(s, '.con-parl__slot-label') + heightOf(s, '.con-parl__ribbon') + (beside ? 0 : (tallyOf(s)?.height ?? 0))));
        const rows = beside ? 2 : 3;
        const availH = slot.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - chrome - px(cs.rowGap) * rows;
        // The tally's width is a CSS token (`--con-parl-tally-w`), never the
        // card's output — measuring it cannot feed the zoom back into itself.
        const tallyW = beside ? (tallyOf(slot)?.width ?? 0) + px(cs.columnGap) : 0;
        const availW = slot.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight) - tallyW;
        zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_CARD_ZOOM * scale);
      }
      zoom = snap(zoom);
      root.style.setProperty('--con-parl-card-zoom', String(zoom));

      // THE ENACTED FACE budgets from the government column's FREE height —
      // the column minus every other block in it (head, quest, chair: text,
      // independent of the card) — never from the ruling row, whose height IS
      // the card: reading it back fed the zoom its own output and let the face
      // run over the quest below. Its width stays a minority of the row, so
      // the party, its basis and its formula keep the reading side.
      const gov = root.querySelector<HTMLElement>('.con-parl__gov');
      const govCard = root.querySelector<HTMLElement>('.con-parl__gov-card');
      const ruling = root.querySelector<HTMLElement>('.con-parl__ruling');
      let govZoom = MAX_GOV_ZOOM * scale;
      if (gov !== null && govCard !== null && ruling !== null) {
        const gcs = getComputedStyle(gov);
        const innerH = gov.clientHeight - px(gcs.paddingTop) - px(gcs.paddingBottom);
        const blocks = Array.from(gov.children).filter((child) => child !== ruling);
        const taken = blocks.reduce((sum, child) => sum + child.getBoundingClientRect().height, 0) + px(gcs.rowGap) * blocks.length;
        const rcs = getComputedStyle(ruling);
        const innerW = ruling.clientWidth - px(rcs.paddingLeft) - px(rcs.paddingRight);
        govZoom = Math.min(govZoom, (innerH - taken) / PCARD_H, (innerW * 0.4) / PCARD_W);
      }
      root.style.setProperty('--con-parl-gov-zoom', String(Math.max(MIN_GOV_ZOOM * scale, Math.floor(govZoom * 1000) / 1000)));
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
    reasonRowText(row: AccessReasonRow): string {
      return row.params.length > 0 ? translateTextWithParams(row.key, [...row.params]) : translateText(row.key);
    },
    partyStateText(state: PartyStateVm): string {
      return state.params.length > 0 ? translateTextWithParams(state.label, [...state.params]) : translateText(state.label);
    },
    /** A resolution's printed name (English key), or its id for an unknown one — never a blank. */
    resolutionTitle(id: string): string {
      return this.view.slots.find((s) => s.resolutionId === id)?.resolution?.text.name ??
        (this.view.enacted?.resolutionId === id ? this.view.enacted.resolution?.text.name : undefined) ??
        getResolution(id)?.text.name ?? id;
    },
    translateParams(key: string, params: Array<string>): string {
      return translateTextWithParams(key, params);
    },
    /**
     * A TIE among PLAYERS on this card — read off the server's own vote list
     * (the top two players hold the same count). The server already named the
     * leader by the tie rule; this only says why the leader is who it is.
     */
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
    /** The winning card wins a TIE among resolutions (another slot holds as many delegates). */
    slotWinsTie(index: number): boolean {
      const slot = this.view.slots[index];
      return slot !== undefined && this.view.slots.some((other, j) => j !== index && other.totalVotes === slot.totalVotes);
    },
    /** A crowded ribbon: one stack per owner, in first-arrival order. */
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
      if (this.stage === 'submitting' || this.stage === 'landed') {
        return;
      }
      if (this.stage === 'recap') {
        // The results scene: A or B lets the player through; navigation waits.
        const action = consoleActionOf(intent);
        if (action === 'primary' || action === 'back') {
          this.finishRecap();
        }
        return;
      }
      if (this.stage === 'action') {
        const composer = this.$refs.partyComposer as InstanceType<typeof ConsolePartyActionComposer> | undefined;
        composer?.handleIntent(intent);
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
        // The tiles stand in a 3 × 2 grid: ←→ walk the six in reading order,
        // ↑↓ move between the two rows and leave the grid at its edges.
        if (dir === 'left') {
          this.partyIndex = Math.max(0, this.partyIndex - 1);
        } else if (dir === 'right') {
          this.partyIndex = Math.min(this.view.parties.length - 1, this.partyIndex + 1);
        } else if (dir === 'up') {
          if (this.partyIndex >= PARTY_COLUMNS) {
            this.partyIndex -= PARTY_COLUMNS;
          } else {
            this.zone = 'voting';
          }
        } else if (dir === 'down') {
          if (this.partyIndex + PARTY_COLUMNS < this.view.parties.length) {
            this.partyIndex += PARTY_COLUMNS;
          } else {
            this.zone = 'agenda';
          }
        }
        return;
      case 'agenda':
        if (dir === 'up') {
          // Back onto the row the track touches — the parties' LOWER row.
          this.zone = 'parties';
          if (this.partyIndex < PARTY_COLUMNS) {
            this.partyIndex = Math.min(this.view.parties.length - 1, this.partyIndex + PARTY_COLUMNS);
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
        this.openAction(party.actionId, state);
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
    openVote(): void {
      const tile = this.voteTile;
      if (tile === undefined) {
        this.$emit('notice', translateText('Not in this game'));
        return;
      }
      if (!this.canVoteNow) {
        this.$emit('notice', this.voteBlockedText);
        return;
      }
      this.zone = 'voting';
      this.openStage('vote');
    },
    /**
     * A PARTY ACTION from the party's detail — the contextual launch. Same
     * composer, same server prompt, same limits as the action menu's door.
     * The Unity trade IS the colony trade with a free payment path: the
     * colony workspace stands inside this one for its span.
     */
    openAction(id: PartyActionId, state: PartyActionStateVm): void {
      if (state.kind !== 'available') {
        const reason = state.reason !== undefined ? this.reasonText(state.reason) :
          translateText(state.kind === 'used' ? 'This party action was already used this generation' :
            (state.kind === 'not-now' ? (this.awaitingInput ? 'Finish your current action first' : 'Not your turn') : 'You do not have this party\'s effect'));
        this.$emit('notice', reason);
        return;
      }
      if (id === 'unity-trade') {
        setWorkspaceFrameSubject('parliament', PartyName.UNITY);
        setWorkspaceFrameStage('parliament', 'Trade');
        setWorkspaceFramePhase('parliament', 'configure');
        this.$emit('open-trading');
        return;
      }
      if (this.bridge.actions[id] === undefined) {
        this.$emit('notice', translateText('This option is no longer offered'));
        return;
      }
      this.actionParty = this.focusedParty?.party;
      this.openStage('action');
    },
    inspect(): void {
      if (this.zone === 'voting' || this.stage === 'vote') {
        const slot = this.focusedSlot;
        if (slot !== undefined) {
          this.$emit('inspect', {kind: 'resolution', id: slot.resolutionId} as ParliamentInspectRequest);
        }
        return;
      }
      if (this.zone === 'government') {
        if (this.view.enacted !== undefined) {
          this.$emit('inspect', {kind: 'resolution', id: this.view.enacted.resolutionId} as ParliamentInspectRequest);
        } else {
          this.$emit('inspect', {kind: 'party', party: this.view.rulingParty} as ParliamentInspectRequest);
        }
        return;
      }
      if (this.zone === 'parties' && this.focusedParty !== undefined) {
        this.$emit('inspect', {kind: 'party', party: this.focusedParty.party} as ParliamentInspectRequest);
      }
    },
    inspectParty(party: ReduxParty): void {
      this.$emit('inspect', {kind: 'party', party} as ParliamentInspectRequest);
    },
    handleStageIntent(intent: GamepadIntent): void {
      const action = consoleActionOf(intent);
      if (action === 'back') {
        if (this.stage === 'seat') {
          // A MANDATORY pick: B cannot unmake it — it COLLAPSES the workspace
          // (the player goes to read the board; the pick stays owed and the
          // board-home restore card brings them straight back to this stage).
          this.$emit('collapse');
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
    // ── the stage phrase: RELEASE the parties tier, UNFOLD the stage from its rect ──
    openStage(stage: Stage): void {
      const tier = this.$refs.partiesTierEl as HTMLElement | undefined;
      const rect = tier?.getBoundingClientRect();
      this.stageFromRect = rect !== undefined && rect.width > 0 ? {left: rect.left, top: rect.top, width: rect.width, height: rect.height} : undefined;
      this.stage = stage;
      setWorkspaceFramePhase('parliament', 'configure');
    },
    closeStage(): void {
      if (this.stage === 'action') {
        this.actionParty = undefined;
        this.composerCommands = [];
      }
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
    onComposerCommands(cmds: ReadonlyArray<ConsoleCommand>): void {
      this.composerCommands = [...cmds];
    },
    onPartyConfirm(response: InputResponse): void {
      this.send(response, 'action');
    },
    // ── submits (byte-identical to the live prompt) ─────────────────────
    submitVote(): void {
      const slot = this.focusedSlot;
      if (slot === undefined || !this.canVoteNow) {
        return;
      }
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
        this.closeStage();
        return;
      }
      this.stageBeforeSubmit = from;
      this.submittedAge = this.playerView.game.gameAge;
      this.stage = 'submitting';
      setWorkspaceFramePhase('parliament', 'committed');
      this.$emit('submit', response);
      this.clearSubmitTimer();
      this.submitTimer = window.setTimeout(() => this.resetSubmitting(), SUBMIT_SAFETY_MS);
    },
    /**
     * THE RESULTS SCENE. On the workspace's first open after a political phase
     * the previous generation's results play as beats on the objects they
     * changed — once per generation; a standing chairman-seat pick outranks it.
     */
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
     * viewer's newest delegate on the focused card is the one that just
     * arrived. Its cube LEAVES the chip it came from (the lobby cube or the
     * reserve cube in the header — the real, measured source), flies to its
     * own slot on the ribbon and lands there; the slot flashes and the
     * counters tick. A bounded animation hold keeps the flow from leaving
     * under it. Returns false when the model shows no new delegate — a refusal
     * or a stale answer — and the caller falls through to the plain ending.
     */
    landVote(): boolean {
      const slot = this.focusedSlot;
      const me = this.viewerColor;
      if (slot === undefined || me === undefined) {
        return false;
      }
      const mine = slot.votes.filter((vote) => vote.owner === me);
      if (mine.length === 0) {
        return false;
      }
      const seq = Math.max(...mine.map((vote) => vote.seq));
      this.stage = 'landed';
      setWorkspaceFramePhase('parliament', 'committed');
      this.landingHold = beginAnimationHold('parliament-vote-landing', {maxHoldMs: 4000});
      // The cube is hidden on the ribbon while its proxy flies; a source that
      // cannot be measured (a re-fit mid-flight, reduced motion) degrades to the
      // landing beat alone — never to a cube that appears nowhere.
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
      const source = this.stageBeforeSubmit === 'vote' && this.voteTile?.source === 'reserve' ?
        root.querySelector<HTMLElement>('[data-parl-reserve-cube]') :
        root.querySelector<HTMLElement>('[data-parl-lobby-cube]');
      const target = root.querySelector<HTMLElement>(`.con-parl__ribbon [data-seq="${seq}"]`);
      if (source === null || target === null) {
        return false;
      }
      const from = source.getBoundingClientRect();
      const to = target.getBoundingClientRect();
      if (from.width < 2 || to.width < 2) {
        return false;
      }
      this.flight = {color};
      void this.$nextTick(() => {
        const proxy = this.$refs.flightEl as HTMLElement | undefined;
        if (proxy === undefined) {
          this.flight = undefined;
          this.flightSeq = undefined;
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
          {x: start.x, y: start.y, scale: 1.35, opacity: 1},
          {
            x: end.x, y: end.y, scale: 1, duration, ease: 'power2.inOut',
            onComplete: () => {
              // HANDOFF: reveal the real cube, drop the proxy on the next frame.
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
        this.stage = 'browse';
        setWorkspaceFramePhase('parliament', 'browse');
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
    /** A REFUSED submit gives the stage back (the shell calls it on a transport error too). */
    resetSubmitting(): void {
      this.clearSubmitTimer();
      if (this.stage === 'submitting') {
        this.stage = this.stageBeforeSubmit === 'seat' ? 'seat' : this.stageBeforeSubmit;
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
