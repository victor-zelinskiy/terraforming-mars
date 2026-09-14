<template>
  <!-- «ПАРЛАМЕНТ» — the Mars Parliament workspace (Turmoil Redux).

       ONE FLOW: the browse layer is the whole parliament (the voting area
       first, the enacted resolution and the ruling party second, the parties /
       Agenda / delegates / actions third); a stage — the VOTE, a party ACTION,
       the chairman SEAT — opens INSIDE the same frame, in the stage zone on the
       right, and the header's crumb grows a tail («ПАРЛАМЕНТ › <резолюция> ›
       ГОЛОС»). Nothing here re-derives a rule: availability is the PRESENCE of
       the server's own option in the action menu (found by its structural
       marker), the numbers are the server's projections, and a submit is the
       byte-identical response the live prompt expects. -->
  <section class="con-parl con-ws"
           :class="{
             'con-parl--handed-over': sceneHandedOver,
             'con-parl--stage': stage !== 'browse',
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
                   :stage="crumbStage"
                   :committed="stage === 'submitting'">
      <span class="con-parl__chip">
        <span class="con-parl__chip-dim">{{ $t('Ruling party') }}</span>
        <img class="con-parl__chip-emblem" :src="emblemUrl(view.rulingParty)" alt="" />
        <b>{{ $t(view.rulingParty) }}</b>
      </span>
      <span v-if="view.viewer !== undefined" class="con-parl__chip">
        <span class="con-parl__chip-dim">{{ $t('Lobby') }}</span><b>{{ view.viewer.lobby ? 1 : 0 }}</b>
        <span class="con-parl__chip-dim">{{ $t('Reserve') }}</span><b>{{ view.viewer.reserve }}</b>
      </span>
      <span v-if="view.viewer !== undefined" class="con-parl__chip">
        <span class="con-parl__chip-dim">{{ $t('Influence') }}</span><b>{{ view.viewer.influence }}</b>
      </span>
      <span class="con-parl__chip con-parl__chip--deck">
        <span class="con-parl__chip-dim">{{ $t('Resolution deck') }}</span><b>{{ view.deckSize }}</b>
      </span>
    </ConsoleWsHead>

    <!-- ── THE LAST PHASE — what the Parliament did at the end of the previous
         generation, read from the server's own summary (never the log):
         winner, Agenda, enactment, popular support, the refreshed area. The
         full beat-by-beat scene rides this same model (iteration 0 TODO). -->
    <div v-if="recapLines.length > 0 && stage !== 'recap'" class="con-parl__recap" data-parl-recap>
      <span class="con-parl__kicker">{{ recapKicker }}</span>
      <span v-for="(line, i) in recapLines" :key="i" class="con-parl__recap-line">{{ line }}</span>
    </div>

    <div class="con-parl__body">
      <!-- ── UPPER TIER: the enacted resolution + the voting area ── -->
      <div class="con-parl__upper">
        <div class="con-parl__enacted" :class="{'con-parl__enacted--focus': zone === 'enacted', 'con-parl__enacted--recap': stage === 'recap' && recapHighlight === 'enacted'}" data-parl-enacted>
          <div class="con-parl__slot-label">
            <span>{{ $t('Enacted') }}</span>
          </div>
          <div class="con-parl__card con-parl__card--enacted">
            <premium-card-face v-if="enactedVm !== undefined" :vmOverride="enactedVm" :lightweight="true" :inert="true" />
            <div v-else class="con-parl__empty-slot">
              <span class="con-parl__empty-kicker">{{ $t('Empty slot') }}</span>
              <span>{{ $t('The Greens rule until the first resolution is enacted') }}</span>
            </div>
          </div>
          <div class="con-parl__ruling" :style="{'--parl-accent': partyAccent(view.rulingParty)}">
            <img class="con-parl__emblem" :src="emblemUrl(view.rulingParty)" alt="" />
            <div class="con-parl__ruling-text">
              <span class="con-parl__kicker">{{ $t('Ruling party') }}</span>
              <b>{{ $t(view.rulingParty) }}</b>
              <span class="con-parl__ruling-rule">{{ rulingRuleText }}</span>
            </div>
          </div>
          <div v-if="view.quest !== undefined" class="con-parl__quest" :class="{'con-parl__quest--done': view.quest.completedBy !== undefined}">
            <span class="con-parl__kicker">{{ $t('Chairman quest') }}</span>
            <span class="con-parl__quest-text">{{ $t(view.quest.text) }}</span>
            <div class="con-parl__quest-progress">
              <span v-for="row in questRows" :key="row.color" class="con-parl__quest-row" :class="{'con-parl__quest-row--winner': view.quest.completedBy === row.color}">
                <PlayerCube :color="row.color" :size="14" />
                <b>{{ row.value }}</b><span class="con-parl__quest-of">/ {{ view.quest.definition.count }}</span>
              </span>
            </div>
            <span v-if="view.quest.completedBy !== undefined" class="con-parl__quest-done">{{ $t('Completed this generation') }}</span>
          </div>
          <div class="con-parl__chair">
            <span class="con-parl__kicker">{{ $t('Chairman') }}</span>
            <PlayerCube v-if="view.chairman !== undefined" :color="view.chairman" :size="18" />
            <span v-else class="con-parl__chair-empty">{{ $t('Seat empty') }}</span>
          </div>
        </div>

        <div class="con-parl__voting" data-parl-voting>
          <div class="con-parl__voting-head">
            <span class="con-parl__kicker">{{ $t('Voting area') }}</span>
            <span class="con-parl__voting-note">{{ $t('The resolution with most delegates is enacted at the end of the generation') }}</span>
          </div>
          <div class="con-parl__slots">
            <div v-for="(slot, i) in view.slots" :key="slot.instance"
                 class="con-parl__slot"
                 :class="{
                   'con-parl__slot--focus': zone === 'voting' && slotIndex === i,
                   'con-parl__slot--winning': slot.isWinning,
                   'con-parl__slot--target': (stage === 'vote' || stage === 'seat') && slotIndex === i,
                   'con-parl__slot--landed': stage === 'landed' && slotIndex === i,
                   'con-parl__slot--recap': stage === 'recap' && recapHighlight === 'refresh',
                 }"
                 :style="{'--parl-accent': partyAccent(slot.party)}"
                 :data-instance="slot.instance"
                 :data-party="slot.party">
              <div class="con-parl__slot-label">
                <span class="con-parl__slot-no">V{{ slot.tiePriority }}</span>
                <span v-if="slot.tiePriority === 1" class="con-parl__slot-prio">{{ $t('closest to Enacted — wins ties') }}</span>
                <span v-if="slot.isWinning" class="con-parl__slot-win">{{ $t('Winning') }}</span>
              </div>
              <div class="con-parl__card">
                <premium-card-face v-if="slotVms[i] !== undefined" :vmOverride="slotVms[i]" :lightweight="true" :inert="true" />
              </div>
              <div class="con-parl__ribbon" :data-votes="slot.totalVotes">
                <span v-for="vote in slot.votes" :key="vote.seq" class="con-parl__vote"
                      :class="{'con-parl__vote--neutral': vote.owner === 'neutral', 'con-parl__vote--landed': vote.seq === landedSeq}"
                      :data-landed="vote.seq === landedSeq ? '' : undefined">
                  <PlayerCube v-if="vote.owner !== 'neutral'" :color="vote.owner" :size="14" />
                  <span v-else class="con-parl__neutral" aria-hidden="true"></span>
                </span>
                <span v-if="stage === 'vote' && slotIndex === i && viewerColor !== undefined" class="con-parl__vote con-parl__vote--ghost">
                  <PlayerCube :color="viewerColor" :size="14" />
                </span>
                <span v-if="slot.votes.length === 0 && !(stage === 'vote' && slotIndex === i)" class="con-parl__ribbon-empty">{{ $t('No delegates yet') }}</span>
              </div>
              <div class="con-parl__slot-meta">
                <span class="con-parl__meta"><span class="con-parl__chip-dim">{{ $t('Delegates') }}</span><b>{{ slot.totalVotes }}</b></span>
                <span class="con-parl__meta" v-if="slot.leader !== undefined">
                  <span class="con-parl__chip-dim">{{ $t('Leader') }}</span>
                  <PlayerCube v-if="slot.leader !== 'neutral'" :color="slot.leader" :size="12" />
                  <span v-else>{{ $t('neutral') }}</span>
                </span>
                <span class="con-parl__meta" v-if="slot.viewerVotes > 0"><span class="con-parl__chip-dim">{{ $t('Yours') }}</span><b>{{ slot.viewerVotes }}</b></span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- ── LOWER TIER: parties · Agenda · delegates · actions ── -->
      <div class="con-parl__lower">
        <div class="con-parl__parties" data-parl-parties>
          <div v-for="(p, i) in view.parties" :key="p.party"
               class="con-parl__party"
               :class="{
                 'con-parl__party--focus': zone === 'parties' && partyIndex === i,
                 'con-parl__party--ruling': p.ruling,
                 'con-parl__party--access': p.access?.hasEffect === true,
                 'con-parl__party--recap': stage === 'recap' && recapHighlight === 'support' && (recapCurrent?.parties ?? []).includes(p.party),
               }"
               :style="{'--parl-accent': partyAccent(p.party)}"
               :data-party="p.party">
            <img class="con-parl__party-emblem" :src="emblemUrl(p.party)" alt="" />
            <span class="con-parl__party-name">{{ $t(p.party) }}</span>
            <span class="con-parl__support" :title="undefined">
              <span v-for="n in 3" :key="n" class="con-parl__support-dot" :class="{'con-parl__support-dot--on': n <= p.support}"></span>
            </span>
            <span class="con-parl__party-state">{{ partyStateText(p) }}</span>
            <span v-if="p.rule !== undefined" class="con-parl__party-rule">{{ $t(p.rule) }}</span>
          </div>
        </div>

        <div class="con-parl__agenda" data-parl-agenda :class="{'con-parl__agenda--focus': zone === 'agenda'}">
          <span class="con-parl__kicker con-parl__agenda-kicker">{{ $t('Agenda') }}</span>
          <div class="con-parl__track">
            <div class="con-parl__step con-parl__step--start" data-step="0">
              <span class="con-parl__step-icon">{{ $t('Agenda start') }}</span>
              <span class="con-parl__step-cubes">
                <PlayerCube v-for="color in view.agendaStart" :key="color" :color="color" :size="12" />
              </span>
            </div>
            <div v-for="step in view.agenda" :key="step.index" class="con-parl__step"
                 :class="['con-parl__step--' + step.step.kind, {'con-parl__step--recap': stage === 'recap' && recapHighlight === 'agenda' && recapCurrent?.step === step.index}]"
                 :data-step="step.index">
              <span class="con-parl__step-icon">
                <template v-if="step.step.kind === 'influence'">★{{ step.step.influence }}</template>
                <template v-else-if="step.step.kind === 'tr'">{{ $t('TR') }}</template>
                <template v-else>{{ $t('Card') }}</template>
              </span>
              <span class="con-parl__step-cubes">
                <PlayerCube v-for="color in step.cubes" :key="color" :color="color" :size="12" />
              </span>
            </div>
          </div>
          <span class="con-parl__agenda-legend">{{ $t('★ = influence · TR = +1 TR · Card = draw a card') }}</span>
        </div>

        <div class="con-parl__tiles" data-parl-actions>
          <div v-for="(tile, i) in view.tiles" :key="tile.id"
               class="con-parl__tile"
               :class="{
                 'con-parl__tile--focus': zone === 'actions' && tileIndex === i,
                 'con-parl__tile--off': !tile.available,
               }"
               :style="tile.party !== undefined ? {'--parl-accent': partyAccent(tile.party)} : undefined"
               :data-tile="tile.id">
            <img v-if="tile.party !== undefined" class="con-parl__tile-emblem" :src="emblemUrl(tile.party)" alt="" />
            <span v-else class="con-parl__tile-glyph" aria-hidden="true">⚖</span>
            <span class="con-parl__tile-label">{{ $t(tile.label) }}</span>
            <span v-if="tile.available" class="con-parl__tile-sub">{{ tileSubline(tile) }}</span>
            <span v-if="!tile.available" class="con-parl__tile-reason">{{ reasonText(tile.reason) }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- ── THE STAGE ZONE — one zone, one stage at a time ── -->
    <transition name="con-parl-stage">
      <div v-if="stage !== 'browse' && stage !== 'landed'" class="con-parl__stage" :data-parl-stage="stage">
        <!-- VOTE -->
        <template v-if="stage === 'vote' && focusedSlot !== undefined">
          <div class="con-parl__stage-head" :style="{'--parl-accent': partyAccent(focusedSlot.party)}">
            <img class="con-parl__emblem" :src="emblemUrl(focusedSlot.party)" alt="" />
            <div>
              <span class="con-parl__kicker">{{ $t('Vote') }}</span>
              <b class="con-parl__stage-title">{{ $t(focusedSlot.resolution?.text.name ?? focusedSlot.resolutionId) }}</b>
              <span class="con-parl__stage-sub">{{ $t(focusedSlot.party) }}</span>
            </div>
          </div>
          <div class="con-parl__txn">
            <div class="con-parl__txn-row">
              <span class="con-parl__chip-dim">{{ $t('Delegate') }}</span>
              <b v-if="voteTile?.source === 'lobby'">{{ $t('Free delegate from the lobby') }}</b>
              <b v-else>{{ $t('From the reserve') }}</b>
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
          </div>
          <ul class="con-parl__consequences">
            <li v-for="(c, i) in voteConsequenceRows" :key="i" :class="'con-parl__consequence--' + c.tone">{{ $t(c.key) }}</li>
          </ul>
          <p class="con-parl__stage-hint">{{ $t('A full action. Only the voting area accepts delegates.') }}</p>
        </template>

        <!-- CHAIRMAN SEAT -->
        <template v-else-if="stage === 'seat' && focusedSlot !== undefined">
          <div class="con-parl__stage-head">
            <div>
              <span class="con-parl__kicker">{{ $t('Chairman seat') }}</span>
              <b class="con-parl__stage-title">{{ $t('You completed the chairman quest') }}</b>
              <span class="con-parl__stage-sub">{{ $t('Every delegate of yours is on a resolution — choose which one gives a delegate up for the seat.') }}</span>
            </div>
          </div>
          <div class="con-parl__txn">
            <div class="con-parl__txn-row">
              <span class="con-parl__chip-dim">{{ $t('Resolution') }}</span>
              <b>{{ $t(focusedSlot.resolution?.text.name ?? focusedSlot.resolutionId) }}</b>
            </div>
            <div class="con-parl__txn-row">
              <span class="con-parl__chip-dim">{{ $t('Your delegates there') }}</span>
              <b>{{ focusedSlot.viewerVotes }} → {{ focusedSlot.viewerVotes - 1 }}</b>
            </div>
          </div>
        </template>

        <!-- INDUSTRIALISTS -->
        <template v-else-if="stage === 'industrialists'">
          <div class="con-parl__stage-head" :style="{'--parl-accent': partyAccent(PARTY_INDUSTRIALISTS)}">
            <img class="con-parl__emblem" :src="emblemUrl(PARTY_INDUSTRIALISTS)" alt="" />
            <div>
              <span class="con-parl__kicker">{{ $t('Party action') }}</span>
              <b class="con-parl__stage-title">{{ $t('Shift production') }}</b>
              <span class="con-parl__stage-sub">{{ $t('Decrease one production 1 step to increase your M€ or energy production 2 steps.') }}</span>
            </div>
          </div>
          <div class="con-parl__rows">
            <div class="con-parl__row" :class="{'con-parl__row--focus': actionRow === 0}">
              <span class="con-parl__kicker">{{ $t('Decrease') }}</span>
              <div class="con-parl__opts">
                <button v-for="(opt, i) in industrialistsDecrease" :key="i" type="button" class="con-parl__opt"
                        :class="{'con-parl__opt--cursor': actionRow === 0 && decreaseIndex === i, 'con-parl__opt--picked': decreasePick === i}"
                        @click="pickDecrease(i)">
                  <span :class="['con-parl__opt-icon', iconClass(opt.metadata?.icon)]" aria-hidden="true"></span>
                  <span class="con-parl__opt-val">{{ opt.metadata?.resource?.current }} → {{ opt.metadata?.resource?.resulting }}</span>
                </button>
              </div>
            </div>
            <div class="con-parl__row" :class="{'con-parl__row--focus': actionRow === 1}">
              <span class="con-parl__kicker">{{ $t('Increase') }}</span>
              <div class="con-parl__opts">
                <button v-for="(opt, i) in industrialistsIncrease" :key="i" type="button" class="con-parl__opt"
                        :class="{'con-parl__opt--cursor': actionRow === 1 && increaseIndex === i, 'con-parl__opt--picked': increasePick === i}"
                        @click="pickIncrease(i)">
                  <span :class="['con-parl__opt-icon', iconClass(opt.metadata?.icon)]" aria-hidden="true"></span>
                  <span class="con-parl__opt-val">{{ opt.metadata?.resource?.current }} → {{ opt.metadata?.resource?.resulting }}</span>
                </button>
              </div>
            </div>
          </div>
          <p class="con-parl__stage-hint">{{ $t('Nothing changes until you confirm. Once per generation.') }}</p>
        </template>

        <!-- SCIENTISTS -->
        <template v-else-if="stage === 'scientists'">
          <div class="con-parl__stage-head" :style="{'--parl-accent': partyAccent(PARTY_SCIENTISTS)}">
            <img class="con-parl__emblem" :src="emblemUrl(PARTY_SCIENTISTS)" alt="" />
            <div>
              <span class="con-parl__kicker">{{ $t('Party action') }}</span>
              <b class="con-parl__stage-title">{{ $t('Add 2 data or microbes') }}</b>
              <span class="con-parl__stage-sub">{{ $t('Add 2 data or 2 microbes to one of your cards.') }}</span>
            </div>
          </div>
          <div class="con-parl__rows">
            <div class="con-parl__row" :class="{'con-parl__row--focus': actionRow === 0}">
              <span class="con-parl__kicker">{{ $t('Resource') }}</span>
              <div class="con-parl__opts">
                <button v-for="(branch, i) in scientistsBranches" :key="i" type="button" class="con-parl__opt"
                        :class="{'con-parl__opt--cursor': actionRow === 0 && branchIndex === i, 'con-parl__opt--picked': branchPick === i}"
                        @click="pickBranch(i)">
                  <span :class="['con-parl__opt-icon', iconClass(branch.icon)]" aria-hidden="true"></span>
                  <span class="con-parl__opt-val">×2</span>
                </button>
              </div>
            </div>
            <div class="con-parl__row" :class="{'con-parl__row--focus': actionRow === 1}">
              <span class="con-parl__kicker">{{ $t('Target card') }}</span>
              <div class="con-parl__opts con-parl__opts--cards">
                <button v-for="(card, i) in scientistsCards" :key="card.name" type="button" class="con-parl__opt con-parl__opt--card"
                        :class="{'con-parl__opt--cursor': actionRow === 1 && cardIndex === i, 'con-parl__opt--picked': cardPick === i}"
                        @click="pickCard(i)">
                  <span class="con-parl__opt-card">{{ $t(card.name) }}</span>
                  <span class="con-parl__opt-val">{{ card.resources ?? 0 }} → {{ (card.resources ?? 0) + 2 }}</span>
                </button>
                <span v-if="scientistsCards.length === 0" class="con-parl__opt-none">{{ $t('Choose the resource first') }}</span>
              </div>
            </div>
          </div>
          <p class="con-parl__stage-hint">{{ $t('Nothing changes until you confirm. Once per generation.') }}</p>
        </template>

        <!-- REDS -->
        <template v-else-if="stage === 'reds'">
          <div class="con-parl__stage-head" :style="{'--parl-accent': partyAccent(PARTY_REDS)}">
            <img class="con-parl__emblem" :src="emblemUrl(PARTY_REDS)" alt="" />
            <div>
              <span class="con-parl__kicker">{{ $t('Party action') }}</span>
              <b class="con-parl__stage-title">{{ $t('Draw 2, discard 2') }}</b>
              <span class="con-parl__stage-sub">{{ $t('Draw 2 cards, then discard 2 cards from your hand. Gain 2 M€ for every plant, microbe and animal tag on the discarded cards.') }}</span>
            </div>
          </div>
          <div class="con-parl__chips">
            <ActionEffectChip v-for="(effect, i) in redsPreview" :key="i" :effect="effect" />
          </div>
          <p class="con-parl__stage-hint con-parl__stage-hint--warn">{{ $t('Confirming draws the cards at once. The discard that follows cannot be cancelled.') }}</p>
        </template>

        <!-- RESULTS — the previous generation's political phase, one beat per
             line; each line lights the object it changed (the enacted zone,
             the Agenda step, the parties, the fresh slots). -->
        <template v-else-if="stage === 'recap'">
          <div class="con-parl__stage-head">
            <div>
              <span class="con-parl__kicker">{{ $t('Parliament') }}</span>
              <b class="con-parl__stage-title">{{ recapKicker }}</b>
            </div>
          </div>
          <ol class="con-parl__recap-list" data-parl-recap-list>
            <li v-for="(item, i) in recapItems" :key="item.key"
                class="con-parl__recap-item"
                :class="{'con-parl__recap-item--shown': i <= recapBeat, 'con-parl__recap-item--now': i === recapBeat}"
                :data-focus="item.focus">{{ item.text }}</li>
          </ol>
          <p class="con-parl__stage-hint">{{ $t('What the Parliament decided at the end of the generation — press A to continue.') }}</p>
        </template>

        <!-- SUBMITTING -->
        <template v-else-if="stage === 'submitting'">
          <div class="con-parl__stage-head">
            <div>
              <span class="con-parl__kicker">{{ $t('Parliament') }}</span>
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
  </section>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {Message} from '@/common/logs/Message';
import {PartyName} from '@/common/turmoil/PartyName';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {PlayerInputModel, SelectCardModel, SelectOptionModel} from '@/common/models/PlayerInputModel';
import {CardModel} from '@/common/models/CardModel';
import {InputResponse} from '@/common/inputs/InputResponse';
import {ActionEffect} from '@/common/models/ActionPreviewModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {PartyActionId, ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import PlayerCube from '@/client/components/PlayerCube.vue';
import ActionEffectChip from '@/client/components/actions/ActionEffectChip.vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {consoleParliamentUi} from '@/client/console/consoleParliamentState';
import {
  buildParliamentView, industrialistsResponse, ParliamentPartyVm, ParliamentPromptBridge, ParliamentSlotVm, ParliamentTileVm,
  ParliamentViewVm, parliamentPromptBridge, redsResponse, scientistsResponse, seatResponse, voteConsequences, voteResponse,
} from '@/client/console/parliament/consoleParliamentModel';
import {PremiumCardVM} from '@/client/components/premiumCard/premiumCardViewModel';
import {resolutionPremiumVmById} from '@/client/components/premiumCard/resolutionPremiumVm';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {setWorkspaceFramePhase, setWorkspaceFrameStage, setWorkspaceFrameSubject, workspaceFrameHasNested} from '@/client/console/consoleWorkspaceStack';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {useResizeObserver} from '@vueuse/core';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';

type Zone = 'voting' | 'enacted' | 'parties' | 'agenda' | 'actions';
/**
 * `landed` — the vote's answer arrived: the delegate settles on the card before
 * the flow leaves. `recap` — the RESULTS scene: the previous generation's
 * political phase, read from the server's summary and played beat by beat on
 * the objects it changed (once per generation, on the workspace's first open).
 */
type Stage = 'browse' | 'vote' | 'seat' | 'industrialists' | 'scientists' | 'reds' | 'submitting' | 'landed' | 'recap';

/** The delegate's landing beat (the cube drops onto the ribbon, the slot flashes). */
const VOTE_LANDING_MS = 620;
/** One results beat: the next line lights and the object it names flashes. */
const RECAP_BEAT_MS = 900;

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
   MEASURED chrome (label / ribbon / meta are text, independent of the zoom)
   and never reads its own output. */
const PCARD_W = 320;
const PCARD_H = 460;
/** Per unit of `--con-ui-scale`: a card never grows past this, whatever the room. */
const MAX_CARD_ZOOM = 0.95;
const MIN_CARD_ZOOM = 0.3;
/** The enacted zone's text column beside its card: the side-by-side layout, and the stacked (handheld) one. */
const ENACTED_TEXT_MIN_REM = 10.5;
const ENACTED_TEXT_MIN_STACKED_REM = 6;

export type ParliamentInspectRequest = {kind: 'resolution', id: string} | {kind: 'party', party: ReduxParty};

export default defineComponent({
  name: 'ConsoleParliamentSection',
  components: {ConsoleWsHead, PlayerCube, ActionEffectChip},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    myTurn: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
  },
  emits: ['close', 'submit', 'notice', 'inspect', 'open-trading', 'flow-complete'],
  data() {
    return {
      zone: 'voting' as Zone,
      stage: 'browse' as Stage,
      slotIndex: 0,
      partyIndex: 0,
      tileIndex: 0,
      // The party-action stages: a two-row picker (row 0 / row 1), cursor + pick per row.
      actionRow: 0,
      decreaseIndex: 0,
      increaseIndex: 0,
      decreasePick: undefined as number | undefined,
      increasePick: undefined as number | undefined,
      branchIndex: 0,
      cardIndex: 0,
      branchPick: undefined as number | undefined,
      cardPick: undefined as number | undefined,
      /** The stage the submit left — restored if the server refuses. */
      stageBeforeSubmit: 'browse' as Stage,
      submitTimer: undefined as number | undefined,
      submittedAge: -1,
      PARTY_INDUSTRIALISTS: PartyName.INDUSTRIALISTS as ReduxParty,
      PARTY_SCIENTISTS: PartyName.SCIENTISTS as ReduxParty,
      PARTY_REDS: PartyName.REDS as ReduxParty,
      stopFitObs: undefined as (() => void) | undefined,
      /** The vote that just landed (its `seq`) — the cube the landing beat animates. */
      landedSeq: undefined as number | undefined,
      landingTimer: undefined as number | undefined,
      landingHold: undefined as AnimationHold | undefined,
      /** The results scene's current beat (−1 = not playing). */
      recapBeat: -1,
      recapTimers: [] as Array<number>,
    };
  },
  computed: {
    model(): ParliamentModel | undefined {
      return this.playerView.game.parliament;
    },
    viewerColor(): Color | undefined {
      return this.playerView.thisPlayer?.color;
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
    focusedTile(): ParliamentTileVm | undefined {
      return this.view.tiles[this.tileIndex];
    },
    voteTile(): ParliamentTileVm | undefined {
      return this.view.tiles.find((t) => t.id === 'vote');
    },
    rulingRuleText(): string {
      const effect = this.view.rulingEffect;
      return effect === undefined ? '' : translateText(effect.text.rule);
    },
    questRows(): ReadonlyArray<{color: Color, value: number}> {
      return (this.view.quest?.progress ?? []).filter((row) => row.participates);
    },
    voteConsequenceRows(): Array<{key: string, tone: 'gain' | 'note' | 'warn'}> {
      const slot = this.focusedSlot;
      return slot === undefined ? [] : voteConsequences(slot.projection, slot, this.viewerColor);
    },
    voteCostChip(): ActionEffect {
      const cost = this.voteTile?.cost ?? 0;
      const current = this.playerView.thisPlayer?.megacredits ?? 0;
      return {direction: 'cost', icon: 'megacredits', amount: cost, current, resulting: Math.max(0, current - cost)};
    },
    /** The server's own options for the Industrialists' two picks (byte-identical indices). */
    industrialistsDecrease(): ReadonlyArray<SelectOptionModel> {
      const entry = this.bridge.actions['industrialists-shift'];
      if (entry === undefined || entry.model.type !== 'and') {
        return [];
      }
      const decrease = entry.model.options[0];
      return decrease?.type === 'or' ? decrease.options.filter((o): o is SelectOptionModel => o.type === 'option') : [];
    },
    industrialistsIncrease(): ReadonlyArray<SelectOptionModel> {
      const entry = this.bridge.actions['industrialists-shift'];
      if (entry === undefined || entry.model.type !== 'and') {
        return [];
      }
      const increase = entry.model.options[1];
      return increase?.type === 'or' ? increase.options.filter((o): o is SelectOptionModel => o.type === 'option') : [];
    },
    scientistsBranches(): ReadonlyArray<{icon: string, model: SelectCardModel}> {
      const entry = this.bridge.actions['scientists-lab'];
      if (entry === undefined || entry.model.type !== 'or') {
        return [];
      }
      return entry.model.options
        .filter((o): o is SelectCardModel => o.type === 'card')
        .map((model) => ({icon: model.resourceGainPrompt?.cardResource ?? 'resources', model}));
    },
    scientistsCards(): ReadonlyArray<CardModel> {
      const pick = this.branchPick ?? this.branchIndex;
      return this.scientistsBranches[pick]?.model.cards ?? [];
    },
    redsPreview(): ReadonlyArray<ActionEffect> {
      return this.view.tiles.find((t) => t.id === 'reds-recycle')?.preview ?? [];
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
      const nameOf = (color: Color | 'neutral' | undefined): string => {
        if (color === undefined || color === 'neutral') {
          return translateText('the neutral player');
        }
        return this.playerView.players.find((p) => p.color === color)?.name ?? color;
      };
      const resolutionName = (id: string): string => translateText(this.resolutionTitle(id));
      const items: Array<RecapItem> = [];
      items.push({key: 'winner', focus: 'enacted', text: translateTextWithParams('${0} (${1}) won the vote with ${2} delegate(s) — winning player: ${3}', [
        resolutionName(last.winner.resolution), translateText(last.winner.party), String(last.winner.votes), nameOf(last.winner.player)])});
      if (last.agenda !== undefined) {
        const bonus = last.agenda.bonus === 'tr' ? translateText('+1 TR') : last.agenda.bonus === 'card' ? translateText('+1 card') : '';
        items.push({key: 'agenda', focus: 'agenda', step: last.agenda.to,
          text: translateTextWithParams('${0} advanced on the Agenda track to step ${1} ${2}', [nameOf(last.agenda.player), String(last.agenda.to), bonus]).trim()});
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
    /** The same results as plain sentences — the compact strip over the browse layer. */
    recapLines(): Array<string> {
      return this.recapItems.map((item) => item.text);
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
        return this.focusedSlot?.resolution?.text.name ?? '';
      // The results scene is a DESCENT into the generation (the crumb's
      // subject); it has no stage of its own.
      case 'recap': return this.recapKicker;
      case 'industrialists': return PartyName.INDUSTRIALISTS;
      case 'scientists': return PartyName.SCIENTISTS;
      case 'reds': return PartyName.REDS;
      case 'submitting': return this.stageBeforeSubmit === 'vote' || this.stageBeforeSubmit === 'seat' ? (this.focusedSlot?.resolution?.text.name ?? '') : this.partyOfStage(this.stageBeforeSubmit) ?? '';
      default: return '';
      }
    },
    crumbStage(): string {
      switch (this.stage) {
      case 'vote':
      case 'landed':
        return 'Vote';
      case 'seat': return 'Chairman seat';
      case 'industrialists':
      case 'scientists':
      case 'reds':
        return 'Action';
      case 'submitting': return 'Sending';
      default: return '';
      }
    },
    /** THE ONE COMMAND CONTRACT — published to the shell's bar. */
    commands(): Array<ConsoleCommand> {
      const back: ConsoleCommand = {control: 'back', label: this.stage === 'browse' ? 'To the board' : 'Back'};
      switch (this.stage) {
      case 'browse':
        return this.browseCommands(back);
      case 'vote':
        return [{control: 'confirm', label: 'Vote', enabled: this.canVoteNow, highlight: true}, {control: 'inspect', label: 'Inspect'}, back];
      case 'seat':
        return [{control: 'confirm', label: 'Take the delegate', highlight: true}];
      case 'industrialists':
        return [{control: 'confirm', label: 'Shift', enabled: this.decreasePick !== undefined && this.increasePick !== undefined, highlight: this.decreasePick !== undefined && this.increasePick !== undefined}, back];
      case 'scientists':
        return [{control: 'confirm', label: 'Add', enabled: this.branchPick !== undefined && this.cardPick !== undefined, highlight: this.branchPick !== undefined && this.cardPick !== undefined}, back];
      case 'reds':
        return [{control: 'confirm', label: 'Draw 2 cards', highlight: true, tone: 'danger'}, back];
      case 'recap':
        return [{control: 'confirm', label: 'Continue', highlight: true}];
      case 'submitting':
      case 'landed':
        return [];
      }
    },
    canVoteNow(): boolean {
      return this.bridge.vote !== undefined && this.myTurn && this.awaitingInput;
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
          this.stage = 'seat';
          setWorkspaceFramePhase('parliament', 'configure');
        }
      },
    },
  },
  mounted() {
    // Synchronous in the mount task: measured and applied before the first
    // paint, so the CSS fallback zoom never shows.
    this.fitCards();
    const upper = (this.$refs.rootEl as HTMLElement | undefined)?.querySelector<HTMLElement>('.con-parl__upper');
    if (upper !== null && upper !== undefined) {
      this.stopFitObs = useResizeObserver(upper, () => this.fitCards()).stop;
    }
    this.maybeOpenRecap();
  },
  beforeUnmount() {
    this.stopFitObs?.();
    this.clearSubmitTimer();
    this.clearLanding();
    this.clearRecapTimers();
    consoleParliamentUi.commands = [];
    setWorkspaceFrameSubject('parliament', '');
    setWorkspaceFrameStage('parliament', '');
  },
  methods: {
    /** Solve the two card zooms (voting slots · the enacted zone) from the measured frame. */
    fitCards(): void {
      const root = this.$refs.rootEl as HTMLElement | undefined;
      if (root === undefined) {
        return;
      }
      const scale = conUiScale();
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 20;
      const px = (v: string): number => parseFloat(v) || 0;
      const heightOf = (host: Element, sel: string): number => host.querySelector<HTMLElement>(sel)?.getBoundingClientRect().height ?? 0;
      const snap = (zoom: number): number => Math.max(MIN_CARD_ZOOM * scale, Math.floor(zoom * 1000) / 1000);

      let zoom = 0.62 * scale;
      const slots = Array.from(root.querySelectorAll<HTMLElement>('.con-parl__slot'));
      if (slots.length > 0) {
        const slot = slots[0];
        const cs = getComputedStyle(slot);
        // The TALLEST slot's chrome budgets every card (one wrapped meta line
        // in one slot must not push that slot's card over its ribbon).
        const chrome = Math.max(...slots.map((s) =>
          heightOf(s, '.con-parl__slot-label') + heightOf(s, '.con-parl__ribbon') + heightOf(s, '.con-parl__slot-meta')));
        const availH = slot.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom) - chrome - px(cs.rowGap) * 3;
        const availW = slot.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
        zoom = Math.min(availH / PCARD_H, availW / PCARD_W, MAX_CARD_ZOOM * scale);
      }
      zoom = snap(zoom);
      root.style.setProperty('--con-parl-card-zoom', String(zoom));

      let enactedZoom = zoom;
      const enacted = root.querySelector<HTMLElement>('.con-parl__enacted');
      if (enacted !== null) {
        const cs = getComputedStyle(enacted);
        const innerW = enacted.clientWidth - px(cs.paddingLeft) - px(cs.paddingRight);
        const innerH = enacted.clientHeight - px(cs.paddingTop) - px(cs.paddingBottom);
        // Rows the profile stacks FULL-WIDTH under the card (the handheld
        // ladder) take height from the card's row; beside it they take width.
        const contentLeft = enacted.getBoundingClientRect().left + px(cs.paddingLeft);
        let stackedRows = 0;
        for (const sel of ['.con-parl__quest', '.con-parl__chair']) {
          const el = enacted.querySelector<HTMLElement>(sel);
          if (el !== null && Math.abs(el.getBoundingClientRect().left - contentLeft) < 2) {
            stackedRows += el.getBoundingClientRect().height;
          }
        }
        const textMinPx = (stackedRows > 0 ? ENACTED_TEXT_MIN_STACKED_REM : ENACTED_TEXT_MIN_REM) * remPx;
        const heightBound = (innerH - heightOf(enacted, '.con-parl__slot-label') - px(cs.rowGap) * 3 - stackedRows) / PCARD_H;
        const widthBound = (innerW - px(cs.columnGap) - textMinPx) / PCARD_W;
        enactedZoom = Math.min(zoom, heightBound, widthBound);
      }
      root.style.setProperty('--con-parl-enacted-zoom', String(snap(enactedZoom)));
    },
    /** The browse layer's verbs depend on the focused ZONE (one bar, one contract). */
    browseCommands(back: ConsoleCommand): Array<ConsoleCommand> {
      switch (this.zone) {
      case 'voting': {
        const vote = this.voteTile;
        const cmds: Array<ConsoleCommand> = [];
        if (vote !== undefined) {
          cmds.push({control: 'confirm', label: 'Vote', enabled: this.canVoteNow, highlight: this.canVoteNow});
        }
        cmds.push({control: 'inspect', label: 'Inspect'}, back);
        return cmds;
      }
      case 'enacted':
        return [{control: 'inspect', label: 'Inspect'}, back];
      case 'parties': {
        const party = this.focusedParty;
        const cmds: Array<ConsoleCommand> = [];
        if (party?.action !== undefined) {
          cmds.push({control: 'confirm', label: 'Party action', enabled: this.actionAvailableNow(party.action.id), highlight: this.actionAvailableNow(party.action.id)});
        }
        cmds.push({control: 'inspect', label: 'Party effect'}, back);
        return cmds;
      }
      case 'agenda':
        return [back];
      case 'actions': {
        const tile = this.focusedTile;
        const cmds: Array<ConsoleCommand> = [];
        if (tile !== undefined) {
          const live = tile.id === 'vote' ? this.canVoteNow : this.actionAvailableNow(tile.id);
          cmds.push({control: 'confirm', label: tile.id === 'vote' ? 'Vote' : 'Use', enabled: live, highlight: live});
        }
        cmds.push(back);
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
    iconClass(icon: string | undefined): string {
      return iconClassFor(icon);
    },
    reasonText(reason: string | Message): string {
      return typeof reason === 'string' ? translateText(reason) : translateText(reason.message);
    },
    /** A resolution's printed name (English key), or its id for an unknown one — never a blank. */
    resolutionTitle(id: string): string {
      return this.view.slots.find((s) => s.resolutionId === id)?.resolution?.text.name ??
        (this.view.enacted?.resolutionId === id ? this.view.enacted.resolution?.text.name : undefined) ??
        getResolution(id)?.text.name ?? id;
    },
    partyOfStage(stage: Stage): string | undefined {
      switch (stage) {
      case 'industrialists': return PartyName.INDUSTRIALISTS;
      case 'scientists': return PartyName.SCIENTISTS;
      case 'reds': return PartyName.REDS;
      default: return undefined;
      }
    },
    partyStateText(p: ParliamentPartyVm): string {
      if (p.ruling) {
        return translateText('Ruling');
      }
      const access = p.access;
      if (access?.byDelegates) {
        return translateText('Your effect (2 delegates)');
      }
      if (access !== undefined && access.granted.length > 0) {
        return translateText('Your effect (granted)');
      }
      if (p.inArea) {
        return access !== undefined && access.delegates > 0 ?
          translateText('${0} of 2 delegates').replace('${0}', String(access.delegates)) :
          translateText('In the vote');
      }
      return translateText('Not in the vote');
    },
    tileSubline(tile: ParliamentTileVm): string {
      if (tile.id === 'vote') {
        if (tile.source === 'lobby') {
          return translateText('Free delegate from the lobby');
        }
        if (tile.source === 'reserve') {
          return translateText('${0} M€ from the reserve').replace('${0}', String(tile.cost ?? 0));
        }
        return '';
      }
      if (tile.usesLeft !== undefined && tile.usesPerGeneration !== undefined) {
        return tile.usesLeft > 0 ?
          translateText('Available this generation') :
          translateText('Used this generation');
      }
      return '';
    },
    actionAvailableNow(id: PartyActionId | 'vote'): boolean {
      if (id === 'vote') {
        return this.canVoteNow;
      }
      if (id === 'unity-trade') {
        const tile = this.view.tiles.find((t) => t.id === id);
        return tile?.available === true && this.myTurn && this.awaitingInput;
      }
      return this.bridge.actions[id] !== undefined && this.myTurn && this.awaitingInput;
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
            this.zone = 'enacted';
          } else {
            this.slotIndex--;
          }
        } else if (dir === 'right') {
          this.slotIndex = Math.min(this.view.slots.length - 1, this.slotIndex + 1);
        } else if (dir === 'down') {
          this.zone = 'parties';
        }
        return;
      case 'enacted':
        if (dir === 'right') {
          this.zone = 'voting';
          this.slotIndex = 0;
        } else if (dir === 'down') {
          this.zone = 'parties';
          this.partyIndex = 0;
        }
        return;
      case 'parties':
        if (dir === 'left') {
          this.partyIndex = Math.max(0, this.partyIndex - 1);
        } else if (dir === 'right') {
          if (this.partyIndex >= this.view.parties.length - 1) {
            this.zone = 'actions';
            this.tileIndex = 0;
          } else {
            this.partyIndex++;
          }
        } else if (dir === 'up') {
          this.zone = 'voting';
        } else if (dir === 'down') {
          this.zone = 'agenda';
        }
        return;
      case 'agenda':
        if (dir === 'up') {
          this.zone = 'parties';
        } else if (dir === 'right') {
          this.zone = 'actions';
        }
        return;
      case 'actions':
        if (dir === 'left') {
          if (this.tileIndex === 0) {
            this.zone = 'parties';
            this.partyIndex = this.view.parties.length - 1;
          } else {
            this.tileIndex--;
          }
        } else if (dir === 'right') {
          this.tileIndex = Math.min(this.view.tiles.length - 1, this.tileIndex + 1);
        } else if (dir === 'up') {
          this.zone = 'voting';
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
        if (party?.action === undefined) {
          this.$emit('notice', translateText('This party has no action'));
          return;
        }
        this.openAction(party.action.id);
        return;
      }
      case 'actions': {
        const tile = this.focusedTile;
        if (tile === undefined) {
          return;
        }
        if (tile.id === 'vote') {
          this.openVote();
        } else {
          this.openAction(tile.id);
        }
        return;
      }
      case 'enacted':
        this.$emit('notice', translateText('The enacted resolution has no action of its own'));
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
        this.$emit('notice', tile.available && !(this.myTurn && this.awaitingInput) ? translateText('Not your turn') : this.reasonText(tile.reason));
        return;
      }
      if (this.zone !== 'voting') {
        this.zone = 'voting';
      }
      this.stage = 'vote';
      setWorkspaceFramePhase('parliament', 'configure');
    },
    openAction(id: PartyActionId): void {
      const tile = this.view.tiles.find((t) => t.id === id);
      if (!this.actionAvailableNow(id)) {
        const reason = tile !== undefined && tile.available ? translateText('Not your turn') : (tile === undefined ? '' : this.reasonText(tile.reason));
        this.$emit('notice', reason);
        return;
      }
      switch (id) {
      case 'unity-trade':
        // The Unity trade IS the colony trade action with a free payment path —
        // the colony workspace stands inside this one for its span.
        setWorkspaceFrameSubject('parliament', PartyName.UNITY);
        setWorkspaceFrameStage('parliament', 'Trade');
        setWorkspaceFramePhase('parliament', 'configure');
        this.$emit('open-trading');
        return;
      case 'industrialists-shift':
        this.actionRow = 0;
        this.decreaseIndex = 0;
        this.increaseIndex = 0;
        this.decreasePick = undefined;
        this.increasePick = undefined;
        this.stage = 'industrialists';
        break;
      case 'scientists-lab':
        this.actionRow = 0;
        this.branchIndex = 0;
        this.cardIndex = 0;
        this.branchPick = undefined;
        this.cardPick = undefined;
        this.stage = 'scientists';
        break;
      case 'reds-recycle':
        this.stage = 'reds';
        break;
      }
      setWorkspaceFramePhase('parliament', 'configure');
    },
    inspect(): void {
      if (this.zone === 'voting' || this.stage === 'vote') {
        const slot = this.focusedSlot;
        if (slot !== undefined) {
          this.$emit('inspect', {kind: 'resolution', id: slot.resolutionId} as ParliamentInspectRequest);
        }
        return;
      }
      if (this.zone === 'enacted') {
        if (this.view.enacted !== undefined) {
          this.$emit('inspect', {kind: 'resolution', id: this.view.enacted.resolutionId} as ParliamentInspectRequest);
        } else {
          this.$emit('inspect', {kind: 'party', party: this.view.rulingParty} as ParliamentInspectRequest);
        }
        return;
      }
      if (this.zone === 'parties' && this.focusedParty !== undefined) {
        this.$emit('inspect', {kind: 'party', party: this.focusedParty.party} as ParliamentInspectRequest);
        return;
      }
      if (this.zone === 'actions' && this.focusedTile?.party !== undefined) {
        this.$emit('inspect', {kind: 'party', party: this.focusedTile.party} as ParliamentInspectRequest);
      }
    },
    handleStageIntent(intent: GamepadIntent): void {
      const action = consoleActionOf(intent);
      if (action === 'back') {
        if (this.stage === 'seat') {
          this.$emit('notice', translateText('The chairman seat must be filled'));
          return;
        }
        this.stage = 'browse';
        setWorkspaceFramePhase('parliament', 'browse');
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
          const parties = (this.bridge.seat as {parties?: Array<PartyName>} | undefined)?.parties ?? [];
          const candidates = this.view.slots.map((slot, i) => ({slot, i})).filter(({slot}) => parties.includes(slot.party)).map(({i}) => i);
          if (candidates.length > 0) {
            const at = candidates.indexOf(this.slotIndex);
            const next = intent.dir === 'left' ? Math.max(0, at - 1) : intent.dir === 'right' ? Math.min(candidates.length - 1, at + 1) : at;
            this.slotIndex = candidates[next < 0 ? 0 : next];
          }
          return;
        }
        if (action === 'primary') {
          this.submitSeat();
        }
        return;
      case 'industrialists':
        if (intent.kind === 'nav') {
          if (intent.dir === 'up') {
            this.actionRow = 0;
          } else if (intent.dir === 'down') {
            this.actionRow = 1;
          } else {
            const delta = intent.dir === 'right' ? 1 : -1;
            if (this.actionRow === 0) {
              this.decreaseIndex = clamp(this.decreaseIndex + delta, this.industrialistsDecrease.length);
            } else {
              this.increaseIndex = clamp(this.increaseIndex + delta, this.industrialistsIncrease.length);
            }
          }
          return;
        }
        if (action === 'primary') {
          if (this.decreasePick === undefined || this.increasePick === undefined || (this.actionRow === 0 && this.decreasePick !== this.decreaseIndex) || (this.actionRow === 1 && this.increasePick !== this.increaseIndex)) {
            // A on a row PICKS it; when both are picked the next A commits.
            if (this.actionRow === 0) {
              this.pickDecrease(this.decreaseIndex);
            } else {
              this.pickIncrease(this.increaseIndex);
            }
            return;
          }
          this.submitIndustrialists();
        }
        return;
      case 'scientists':
        if (intent.kind === 'nav') {
          if (intent.dir === 'up') {
            this.actionRow = 0;
          } else if (intent.dir === 'down') {
            this.actionRow = 1;
          } else {
            const delta = intent.dir === 'right' ? 1 : -1;
            if (this.actionRow === 0) {
              this.branchIndex = clamp(this.branchIndex + delta, this.scientistsBranches.length);
              // The target list follows the resource under the cursor.
              this.cardIndex = 0;
            } else {
              this.cardIndex = clamp(this.cardIndex + delta, this.scientistsCards.length);
            }
          }
          return;
        }
        if (action === 'primary') {
          if (this.actionRow === 0) {
            this.pickBranch(this.branchIndex);
            return;
          }
          if (this.branchPick === undefined || this.cardPick !== this.cardIndex) {
            this.pickCard(this.cardIndex);
            return;
          }
          this.submitScientists();
        }
        return;
      case 'reds':
        if (action === 'primary') {
          this.submitReds();
        }
        return;
      default:
        return;
      }
    },
    pickDecrease(i: number): void {
      this.decreaseIndex = i;
      this.decreasePick = i;
      this.actionRow = 1;
    },
    pickIncrease(i: number): void {
      this.increaseIndex = i;
      this.increasePick = i;
    },
    pickBranch(i: number): void {
      this.branchIndex = i;
      this.branchPick = i;
      this.cardPick = undefined;
      this.cardIndex = 0;
      this.actionRow = 1;
    },
    pickCard(i: number): void {
      if (this.branchPick === undefined) {
        this.branchPick = this.branchIndex;
      }
      this.cardIndex = i;
      this.cardPick = i;
    },
    // ── submits (byte-identical to the live prompt) ─────────────────────
    submitVote(): void {
      const slot = this.focusedSlot;
      if (slot === undefined) {
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
    submitIndustrialists(): void {
      if (this.decreasePick === undefined || this.increasePick === undefined) {
        return;
      }
      this.send(industrialistsResponse(this.bridge, this.decreasePick, this.increasePick), 'industrialists');
    },
    submitScientists(): void {
      const card = this.cardPick === undefined ? undefined : this.scientistsCards[this.cardPick];
      if (this.branchPick === undefined || card === undefined) {
        return;
      }
      this.send(scientistsResponse(this.bridge, this.branchPick, card.name), 'scientists');
    },
    submitReds(): void {
      this.send(redsResponse(this.bridge), 'reds');
    },
    send(response: InputResponse | undefined, from: Stage): void {
      if (response === undefined) {
        this.$emit('notice', translateText('This option is no longer offered'));
        this.stage = 'browse';
        setWorkspaceFramePhase('parliament', 'browse');
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
      if (consoleParliamentUi.recapSeen === key) {
        return;
      }
      consoleParliamentUi.recapSeen = key;
      this.stage = 'recap';
      this.recapBeat = 0;
      setWorkspaceFramePhase('parliament', 'configure');
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
        this.stage = 'browse';
        setWorkspaceFramePhase('parliament', 'browse');
      }
    },
    clearRecapTimers(): void {
      for (const timer of this.recapTimers) {
        window.clearTimeout(timer);
      }
      this.recapTimers = [];
    },
    /**
     * THE LANDING BEAT. The vote's answer is in the model: the viewer's newest
     * delegate on the focused card is the one that just arrived, and it drops
     * onto the ribbon (a bounded animation hold keeps the flow from leaving
     * under it). Returns false when the model shows no new delegate — a refusal
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
      this.landedSeq = Math.max(...mine.map((vote) => vote.seq));
      this.stage = 'landed';
      setWorkspaceFramePhase('parliament', 'committed');
      this.landingHold = beginAnimationHold('parliament-vote-landing', {maxHoldMs: 3000});
      this.landingTimer = window.setTimeout(() => this.finishLanding(), consoleMotionMs(VOTE_LANDING_MS));
      return true;
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
      this.landingHold?.release();
      this.landingHold = undefined;
      this.landedSeq = undefined;
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

function clamp(value: number, length: number): number {
  if (length <= 0) {
    return 0;
  }
  return Math.min(length - 1, Math.max(0, value));
}
</script>
