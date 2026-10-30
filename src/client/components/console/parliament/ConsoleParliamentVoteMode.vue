<template>
  <!-- ══ THE VOTE MODE — the frame's PHASE DESCENT, as a layer over the body.
       Always mounted (it is the teleport target of the three slots — a target
       that exists before the slots do); visible while the mode stands. The
       head line above (crumb + delegates zone) does not move. ══ -->
  <div class="con-parl__vote"
       :class="{
         'con-parl__vote--up': voteUp || flow.voteLeaving,
         'con-parl__vote--committed': voteCommitted,
         'con-parl__vote--landed': flow.stage === 'landed',
         'con-parl__vote--paying': flow.stage === 'paying',
         'con-parl__vote--bill': billGeometry,
         'con-parl__vote--entering': flow.voteEntering,
       }"
       :style="{'--parl-accent': voteSlot !== undefined ? partyAccent(voteSlot.party) : undefined}"
       :aria-hidden="voteUp ? undefined : 'true'"
       :data-parl-vote-source-kind="voteSource"
       :data-parl-vote-door="voteUp && voteInfo !== undefined ? voteInfo.vote.door : undefined"
       :data-parl-vote-staged="stagedDoor ? '' : undefined"
       data-parl-vote>
    <!-- THE CARD ROW — the slots stand here while the mode is up (fewer
         than three stand centred at their usual size). -->
    <div class="con-parl__vrow" data-parl-vrow :style="{'--con-parl-slot-count': String(Math.max(1, view.slots.length))}"></div>

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
          <!-- Keyed on the CARD only: a SUBJECT change (LB/RB) re-reads the own block in place (its own key
               below) — re-keying the body crossfaded the head and the party box too, so two things that do not
               change with the subject rose .25rem on every press (`console-parliament-vote-geometry`). -->
          <div v-if="voteInfo !== undefined" :key="voteInfo.instance" class="con-parl__info-body" data-parl-vote-body>
            <div class="con-parl__info-head" data-parl-vote-item>
              <img class="con-parl__info-emblem" :src="emblemUrl(voteInfo.party)" alt="" />
              <b class="con-parl__info-name">{{ $t(voteInfo.name) }}</b>
            </div>
            <!-- THE READING — the card's printed graphic as the formula, the
                 viewer's ONE number beside it (the estimate by the current
                 influence; what the win adds rides it as a suffix), and the
                 ruling party's answer to that number. A viewer without a
                 seat reads the graphic alone. -->
            <!-- THE READING and, beside it, THE PARTY the card brings to power:
                 its emblem, its printed formula and one line of moment («эффект
                 партии · всем при принятии») — a graphic, never a sentence
                 (registry example 4: the reading stood alone in a half-empty
                 plate; the words are the inspector's). -->
            <div class="con-parl__info-main">
              <div class="con-parl__info-own"
                   :key="'own:' + (voteSubject ?? 'viewer')"
                   :class="{
                     'con-parl__info-own--yields': voteInfo.reading.yields.length > 0 || voteInfo.reading.grant !== undefined,
                     'con-parl__info-own--ledger': ledgerShown,
                     'con-parl__info-own--dense': ledgerShown && voteInfo.reading.yields.length > 1,
                     'con-parl__info-own--rival': voteInfo.reading.subject !== undefined,
                   }"
                   data-parl-vote-item data-parl-info="own" :data-parl-subject="voteSubject">
                <!-- THE HEAD LINE — the kicker and, at its right end, THE LEDGER OF OUTCOMES.
                     THE KICKER NAMES THE SUBJECT, ONCE: «ДЛЯ ВАС ПРИ ПРИНЯТИИ», or another seat by its
                     CUBE and its name. Everything below speaks in the third person and repeats no name —
                     and the block drops the cyan «mine» register, so a rival's number can never be read
                     as the player's own. The row
                     rides this line because it is the block's only strip with room: measured at 4K, a
                     row of its own costs 41 px and the block's tallest readings leave 12 («clipped-y
                     con-parl__info-own 332 > 302»). Where the line cannot hold both, flex-wrap drops
                     the row underneath — no magic number decides it. -->
                <div class="con-parl__info-own-head">
                  <span class="con-parl__info-kicker" data-parl-kicker="reading" data-parl-vote-late :data-parl-kicker-subject="voteInfo.reading.subject?.color">
                    <template v-if="voteInfo.reading.subject !== undefined">
                      <span>{{ subjectKicker.before }}</span>
                      <span class="con-parl__socket con-parl__socket--small con-parl__info-kicker-cube">
                        <PlayerDelegate :color="voteInfo.reading.subject.color" :size="figurePx(18)" :glow="false" />
                      </span>
                      <b class="con-parl__info-kicker-name" data-parl-kicker-name>{{ voteInfo.reading.subject.name }}</b>
                      <span>{{ subjectKicker.after }}</span>
                    </template>
                    <template v-else>{{ $t(voteInfo.reading.kicker) }}</template>
                  </span>
                  <ConsoleVoteLedger class="con-parl__info-ledger-row" :chips="voteLedger" :subject="voteSubject" :cubeLogicalPx="11" />
                </div>
                <div class="con-parl__info-own-body">
                  <!-- («Зал» v7, Ф4: the card's PRINTED graphic is on the bill itself, a size up right above this
                       plate — the reading no longer repeats it; the formula → number plate alone is the reading.) -->
                  <div v-if="voteInfo.reading.yields.length > 0 || voteInfo.reading.grant !== undefined || voteInfo.reading.uses !== undefined || voteInfo.veto !== undefined || ledgerShown" class="con-parl__info-readings" data-parl-vote-late>
                    <ConsoleInfluenceYield v-if="voteInfo.reading.yields.length > 0"
                                           class="con-parl__info-yield"
                                           :yields="voteInfo.reading.yields"
                                           :suffixes="voteInfo.reading.suffixes"
                                           :formula="false"
                                           :captions="false"
                                           :oneNumber="true"
                                           :note="voteInfo.reading.note"
                                           :levy="voteInfo.reading.levy"
                                           :person="voteInfo.reading.person"
                                           :size="readingSize"
                                           data-parl-vote-yield
                                           data-parl-vote-reading />
                    <ConsolePartyReaction v-for="r in voteInfo.reading.reactions" :key="r.reaction.id"
                                          class="con-parl__info-reaction"
                                          :reading="r"
                                          :withCaption="false"
                                          :size="readingSize"
                                          data-parl-vote-reaction />
                    <!-- THE COLONY TABLE (Unity Budget): the law's own line — it depends on nothing of the
                         seat's and never enters the net; the tiles read in the inspector. -->
                    <span v-if="voteInfo.reading.tracks !== undefined" class="con-parl__info-tracks" data-parl-vote-tracks
                          :data-parl-vote-tracks-steps="voteInfo.reading.tracks.steps">
                      <i class="con-parl__info-tracks-icon" aria-hidden="true"></i>
                      <span>{{ tracksLabel(voteInfo.reading.tracks.steps) }}</span>
                    </span>
                    <!-- THE CARDS IT WOULD FEED (Sponsored Projects RX40): each counted holder with its own kind and
                         «before → after», then the points the units bring — the server's count by card; one wrapping
                         run, never a table (the faces stand in the receipt once the law is enacted). -->
                    <span v-if="voteInfo.reading.holders !== undefined" class="con-parl__info-holders" data-parl-vote-holders
                          :data-parl-vote-holders-count="voteInfo.reading.holders.rows.length" :data-parl-vote-holders-vp="voteInfo.reading.holders.vp">
                      <span v-for="row in voteInfo.reading.holders.rows" :key="row.card" class="con-parl__info-holder" :data-parl-vote-holder="row.card">
                        <i class="con-parl__info-holder-unit" :class="holderUnitClass(row.resource)" aria-hidden="true"></i>
                        <span class="con-parl__info-holder-name">{{ $t(row.card) }}</span>
                        <b>{{ row.before }}</b><span aria-hidden="true">→</span><b class="con-parl__info-holder-to">{{ row.after }}</b>
                      </span>
                      <b v-if="voteInfo.reading.holders.vp !== 0" class="con-parl__info-holders-vp" data-parl-vote-holders-points>{{ $t('VP') }} {{ signed(voteInfo.reading.holders.vp) }}</b>
                    </span>
                    <!-- THE KINDS A COUNT BY KIND STANDS ON (Tax Breaks RX41): the count's own noun LEADS («3 вида
                         ресурсов»), then each kind's icon with the cards that hold it — the server's count by card
                         grouped by the one grouping (`holderKindsOf`). Every group is ONE unbreakable unit, so a wrapped
                         line always starts with a KIND's icon — never with a separator or a stray «= N»; a holder at 0 is
                         not in the server's list, so it is not here either. -->
                    <span v-if="voteInfo.reading.kinds !== undefined" class="con-parl__info-kinds" data-parl-vote-kinds
                          :data-parl-vote-kinds-count="voteInfo.reading.kinds.rows.length">
                      <b class="con-parl__info-kinds-total" data-parl-vote-kinds-total>{{ kindsTotalText(voteInfo.reading.kinds.totalKey, voteInfo.reading.kinds.rows.length) }}</b>
                      <span v-for="row in voteInfo.reading.kinds.rows" :key="row.resource" class="con-parl__info-kind" :data-parl-vote-kind="row.resource">
                        <i class="con-parl__info-holder-unit" :class="holderUnitClass(row.resource)" aria-hidden="true"></i>
                        <span class="con-parl__info-holder-name">{{ kindCardsText(row.cards) }}</span>
                      </span>
                    </span>
                    <!-- HOW MANY TIMES THE ACTION IS TAKEN (Manufacturing Run RX37): the printed count with its
                         threshold, then the seat's own count — on the line or how far below it — and the win's
                         forecast where the Agenda step lifts it over the line. One reading of the declaration. -->
                    <!-- WHO THE VETO BINDS (RX42 UNMI Veto) — «as if enacted now», the server's live leaders, the subject
                         named «you» where it is one of them: the warning stands BEFORE the vote, in the law's register. -->
                    <span v-if="voteInfo.veto !== undefined" class="con-parl__info-veto" data-parl-vote-veto :data-parl-vote-veto-kind="voteInfo.veto.kind">
                      <i class="con-parl__info-veto-icon resource_icon resource_icon--rating" aria-hidden="true"></i>
                      <span class="con-parl__info-veto-text">{{ vetoText(voteInfo.veto) }}</span>
                    </span>
                    <span v-if="voteInfo.reading.uses !== undefined" class="con-parl__info-uses" data-parl-vote-uses
                          :data-parl-vote-uses-now="voteInfo.reading.uses.uses" :data-parl-vote-uses-win="voteInfo.reading.uses.usesIfWin">
                      <span class="con-parl__info-uses-rule" data-parl-vote-uses-rule>{{ line(voteInfo.reading.uses.rule) }}</span>
                      <b v-if="voteInfo.reading.uses.seat !== undefined" class="con-parl__info-uses-seat" data-parl-vote-uses-seat>{{ line(voteInfo.reading.uses.seat) }}</b>
                      <span v-if="voteInfo.reading.uses.ifWin !== undefined" class="con-parl__info-uses-win" data-parl-vote-uses-ifwin>{{ line(voteInfo.reading.uses.ifWin) }}</span>
                    </span>
                    <!-- THE COLONY LEDGER (Colonial Affairs): the tiles the «×k» above multiplies — the
                         SERVER's registry, one row per tile, the sums; «no colonies» in words. -->
                    <ConsoleColonyLedger v-if="voteInfo.reading.ledger !== undefined"
                                         class="con-parl__info-ledger"
                                         :reading="voteInfo.reading.ledger"
                                         :person="voteInfo.reading.person"
                                         :size="readingSize"
                                         data-parl-vote-ledger />
                    <!-- A TILE GRANTED BY THRESHOLD (Skyscrapers): the viewer's own standing — theirs at this
                         influence or only by winning — and the cities on Mars the tier may land on. -->
                    <ConsoleTileGrant v-if="voteInfo.reading.grant !== undefined"
                                      class="con-parl__info-grant"
                                      :reading="voteInfo.reading.grant"
                                      :person="voteInfo.reading.person"
                                      :size="readingSize"
                                      variant="inline"
                                      data-parl-vote-grant />
                    <!-- A STEP OF THE CAREER FOR EVERY SEAT (Reds Budget): a line of its own, never added to the money —
                         the subject's next node and what it pays, and the win's two nodes (the winner's step first). -->
                    <ConsoleAgendaGrant v-if="voteInfo.reading.career !== undefined"
                                        class="con-parl__info-grant"
                                        :reading="voteInfo.reading.career"
                                        :person="voteInfo.reading.person"
                                        :size="readingSize"
                                        variant="inline"
                                        data-parl-vote-career />
                  </div>
                </div>
              </div>
              <!-- THE LAW'S OWN COLUMN — what the card does to the TABLE and what it does WHILE ENACTED, in two
                   quiet rows OUTSIDE «для вас»: the world part has no recipient (the first player removes an
                   ocean for everybody; it never enters the seat's net, and it may cost a Capital a point), and
                   the standing effect is everybody's law. Data-driven: the column stands for a declaration that
                   takes a tile off the board (`reading.removal`); the passive row rides it when the card has one. -->
              <div v-if="voteInfo.reading.removal !== undefined" class="con-parl__info-law" data-parl-vote-item data-parl-info="law" data-parl-vote-late>
                <div class="con-parl__info-law-row con-parl__info-law-row--world" data-parl-vote-world>
                  <span class="con-parl__info-kicker con-parl__info-law-kicker">{{ $t('The table') }}</span>
                  <span class="con-parl__info-law-line">
                    <i class="wgt-icon wgt-icon--ocean con-parl__info-law-icon" aria-hidden="true"></i>
                    <span class="con-parl__info-law-text">{{ $t(removalSummaryKey) }}</span>
                  </span>
                  <span class="con-parl__info-law-note" data-parl-vote-world-note>{{ $t(removalNoteKey) }}</span>
                </div>
                <div v-if="lawPassiveText !== undefined" class="con-parl__info-law-row con-parl__info-law-row--passive" data-parl-vote-passive>
                  <span class="con-parl__info-kicker con-parl__info-law-kicker">{{ $t('Effect while enacted') }}</span>
                  <span class="con-parl__info-law-text">{{ $t(lawPassiveText) }}</span>
                </div>
              </div>
              <!-- THE PARTY BOX stands ONLY under a door that pays the party («Зал» v7, Ф4 — the plan's § 3.2): the
                   party's printed formula is never repeated on the panel — it stands in the GOVERNMENT when the party
                   rules and in the resolution's dossier (X) otherwise; the mode is ONE block, «ДЛЯ ВАС». Under TR03's
                   door the box is where the neutral cubes LAND, so it stands for that door's whole life. -->
              <div v-if="voteInfo.support !== undefined" class="con-parl__info-party con-parl__info-party--support"
                   data-parl-vote-item data-parl-info="party-effect" :data-party="voteInfo.party">
                <ConsolePartyFormula class="con-parl__info-party-formula" :party="voteInfo.party" :emblem="true" size="compact" />
                <!-- «НАРОДНАЯ ПОДДЕРЖКА» — a door that ALSO pays the chosen resolution's PARTY (TR03 Political
                     Donation: «then up to 3 neutral delegates…»). The area in the plaque's own vocabulary — three
                     places: filled · arriving (hollow) · empty — then `current → resulting` and a tail that NAMES
                     what cut the printed number. Every number is the SERVER's row (`votePrompt.support`); this
                     block is also where the neutral cubes LAND, so it stands for the door's whole life, a «+0»
                     included. It takes the box's line of moment (one caption, one place): the box keeps its
                     geometry from card to card and from the press to the leave. Nothing here is «yours» —
                     the support is the party's. -->
                <div class="con-parl__info-support" :class="'con-parl__info-support--' + voteInfo.support.tone"
                     data-parl-vote-support data-parl-vote-late
                     :data-support-party="voteInfo.support.party"
                     :data-support-current="voteInfo.support.current"
                     :data-support-resulting="voteInfo.support.resulting"
                     :data-support-gained="voteInfo.support.gained"
                     :data-support-shown="voteInfo.support.places.filled">
                  <span class="con-parl__info-kicker con-parl__info-support-kicker">{{ $t(supportKicker) }}</span>
                  <span class="con-parl__info-support-row">
                    <ConsoleSupportPlaces class="con-parl__info-support-places"
                                          :filled="voteInfo.support.places.filled" :incoming="voteInfo.support.places.incoming" />
                    <!-- `current → resulting`, and the left number is the area AS IT STANDS: it ticks with each
                         neutral cube's touchdown, and a fact that does not change (a full area, the landed
                         result) is ONE value. -->
                    <span class="con-parl__info-support-num"><template v-if="voteInfo.support.places.filled !== voteInfo.support.resulting"><b>{{ voteInfo.support.places.filled }}</b><span class="con-parl__fact-arrow" aria-hidden="true">→</span></template><b class="con-parl__info-support-after">{{ voteInfo.support.resulting }}</b></span>
                  </span>
                  <span class="con-parl__info-support-tail" data-parl-vote-support-tail>{{ supportTail }}</span>
                </div>
              </div>
            </div>
          </div>
        </transition>
      </div>
      <div class="con-parl__info-vote">
        <div class="con-parl__info-vote-main" v-show="flow.stage !== 'paying'">
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
              <div class="con-parl__info-block con-parl__info-block--after" :class="{'con-parl__info-block--done': flow.stage === 'landed'}" data-parl-vote-item data-parl-vote-forecast>
                <div class="con-parl__info-src" :class="{'con-parl__info-src--none': voteInfo.vote.source === 'none'}" data-parl-vote-source>
                  <span class="con-parl__info-kicker con-parl__info-kicker--inline" data-parl-kicker="vote" data-parl-vote-late>{{ $t(voteInfo.vote.kicker) }}</span>
                  <template v-if="voteInfo.vote.source !== 'none'">
                    <span class="con-parl__socket con-parl__socket--small">
                      <PlayerDelegate v-if="viewerColor !== undefined" :color="viewerColor" :size="figurePx(18)" :glow="false" />
                    </span>
                    <span class="con-parl__info-src-text" data-parl-vote-late :data-parl-vote-count="voteInfo.vote.count">
                      <!-- A CARD's own door (TR03): «из резерва · по карте» — the delegate is free, the card is what is paid for. -->
                      <template v-if="voteInfo.vote.door === 'card'">{{ $t(cardDoorSource) }}</template>
                      <!-- A delegate GRANT: «×2 из резерва · бесплатно» — the count, the place, no price. -->
                      <template v-else-if="voteInfo.vote.grant">{{ grantSourceText }}</template>
                      <template v-else-if="voteInfo.vote.source === 'lobby'">{{ $t('from the lobby · free') }}</template>
                      <template v-else>
                        <span>{{ $t('from the reserve') }}</span>
                        <span class="con-parl__info-src-sep" aria-hidden="true">·</span>
                        <b class="con-parl__info-src-num">{{ voteInfo.vote.cost }}</b>
                        <i class="con-parl__info-src-mc resource_icon resource_icon--megacredits" aria-hidden="true"></i>
                      </template>
                    </span>
                  </template>
                </div>
                <!-- THE RECEIPT of a staged card door: the card's price as the composer settled it — LOCKED here
                     (the mode cannot change it; B walks back to the composer, which can). Its icon is the price's
                     place ON SCREEN while the step holds the stage (the source card is parked under it): a card
                     resource leaves FROM it for the reserve, a rail price is drawn INTO it. -->
                <div v-if="voteInfo.vote.receipt !== undefined" class="con-parl__info-receipt" data-parl-vote-receipt data-parl-vote-late
                     :data-receipt-cost="voteInfo.vote.receipt.amount" :data-receipt-icon="voteInfo.vote.receipt.icon">
                  <span class="con-parl__info-receipt-key">{{ $t(cardDoorReceipt) }}</span>
                  <span class="con-parl__info-src-sep" aria-hidden="true">·</span>
                  <b class="con-parl__info-src-num">{{ voteInfo.vote.receipt.amount }}</b>
                  <i class="con-parl__info-src-mc" :class="receiptIconClass" aria-hidden="true" data-parl-vote-receipt-icon></i>
                </div>
                <!-- The SHARED fact row (ConsoleVoteFactRow) — the same markup the fullscreen inspector's footer prints. -->
                <div class="con-parl__facts">
                  <ConsoleVoteFactRow v-for="fact in voteInfo.vote.facts" :key="fact.id" :fact="fact" :figurePx="figurePx(18)" data-parl-vote-late />
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
               'con-parl__cta--ready': canVoteNow && flow.stage === 'vote',
               'con-parl__cta--blocked': !canVoteNow && flow.stage === 'vote',
               'con-parl__cta--busy': flow.stage === 'submitting' || flow.stage === 'paying' || (flow.stage === 'landed' && (voteInFlight || supportInFlight)),
               'con-parl__cta--done': (flow.stage === 'landed' && !voteInFlight && !supportInFlight) || flow.stage === 'access',
             }"
             data-parl-vote-item data-parl-cta @click="submitVote()">
          <GamepadGlyph v-if="flow.stage === 'vote' && canVoteNow" control="confirm" class="con-parl__cta-glyph" />
          <!-- The verb alone (R-14): the delegate's source and price are the «ВАШ ГОЛОС» row's, said once —
               the tail here doubled them and wrapped the plate onto two lines on the TV. The cost stays
               readable to probes on the plate's own attribute. -->
          <span class="con-parl__cta-label">{{ ctaText }}</span>
          <span v-if="flow.stage === 'vote' && canVoteNow && ctaCost.kind !== 'none'" class="con-parl__cta-cost con-parl__cta-cost--silent" data-parl-cta-cost :data-cost-kind="ctaCost.kind" :data-cost-amount="ctaCost.kind === 'free' ? 0 : ctaCost.amount" aria-hidden="true"></span>
        </div>
      </div>
    </div>
  </div>
</template>
<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {CardName} from '@/common/cards/CardName';
import {Message} from '@/common/logs/Message';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {ParliamentModel} from '@/common/models/ParliamentModel';
import {SelectPaymentModel, VotePaymentMeta} from '@/common/models/PlayerInputModel';
import {PARLIAMENT_VOTE_COST, ReduxParty} from '@/common/parliament/ParliamentTypes';
import ConsoleInfluenceYield from '@/client/components/console/parliament/ConsoleInfluenceYield.vue';
import ConsoleColonyLedger from '@/client/components/console/parliament/ConsoleColonyLedger.vue';
import ConsoleTileGrant from '@/client/components/console/parliament/ConsoleTileGrant.vue';
import ConsoleAgendaGrant from '@/client/components/console/parliament/ConsoleAgendaGrant.vue';
import ConsoleVoteLedger from '@/client/components/console/parliament/ConsoleVoteLedger.vue';
import ConsolePartyReaction from '@/client/components/console/parliament/ConsolePartyReaction.vue';
import ConsolePartyFormula from '@/client/components/console/parliament/ConsolePartyFormula.vue';
import ConsoleVoteFactRow from '@/client/components/console/parliament/ConsoleVoteFactRow.vue';
import ConsoleSupportPlaces from '@/client/components/console/parliament/ConsoleSupportPlaces.vue';
import PlayerDelegate from '@/client/components/playerToken/PlayerDelegate.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {partyAccent, partyEmblemUrl} from '@/client/components/premiumCard/partyEmblems';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {delegateFigurePx} from '@/client/components/playerToken/delegateFigureSize';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ParliamentBeat, scheduleParliamentBeat} from '@/client/console/parliament/parliamentBeat';
import {GRANT_CUBE_STAGGER_MS, GRANT_TOUCH_GAP_MS, grantCubeSchedule} from '@/client/console/parliament/grantCubeSchedule';
import {grantContinuesSeries, grantSeriesKeyOf} from '@/client/console/parliament/grantSeries';
import {descendWorkspaceFrame, foldWorkspaceFrame, setWorkspaceFramePhase, workspaceFrameHasNested} from '@/client/console/consoleWorkspaceStack';
import {armAccessToldOnStage, disarmAccessToldOnStage} from '@/client/console/parliament/accessToldOnStage';
import {translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {COLONY_TRACK_SUMMARY_KEY} from '@/client/console/parliament/colonyTrackModel';
import {TILE_REMOVAL_COST_NOTE_KEY, TILE_REMOVAL_SUMMARY_KEY} from '@/client/console/parliament/tileRemovalModel';
import {offTurnReason} from '@/client/console/offTurnReason';
import {Reading, readingText} from '@/client/console/readingText';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {cardResourceKey, isStandardResource} from '@/client/console/resourceTransfer/resourceTransferModel';
import {StagedReceipt} from '@/client/console/stagedPlay';
import {afterCommitImpulse} from '@/client/console/consoleActionCommit';
import {flyStagedVotePrice} from '@/client/console/consoleActionCommitRail';
import {stagedDoorVerb} from '@/client/console/parliament/parliamentCommands';
import {probeTick} from '@/client/console/probeTick';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {
  consoleParliamentUi, parliamentFlow, parliamentRootEl, parliamentSupportInFlight, parliamentVoteInFlight, parliamentVoteSubject, parliamentVoteUp,
} from '@/client/console/parliament/consoleParliamentFlow';
import {fitParliamentCards, freezeParliamentFit} from '@/client/console/parliament/parliamentCardFit';
import {
  dropFlight, dropFlightsWithPrefix, flightEl, flyAccessSeal, flyDelegate, flyPriceToken, nextFlightId, placeFigureRect, pushCubeFlight, rectOf, registerFlightHandle,
} from '@/client/console/parliament/parliamentFlights';
import {
  emptyVoteRects, hurryParliamentVoteEnter, killParliamentVoteMotion, measureVoteRects, parkParliamentBody, playParliamentVoteEnter, playParliamentVoteLeave, Rect,
  restoreParliamentBody, runDelegateFlight,
} from '@/client/console/parliament/consoleParliamentVoteMotion';
import {
  effectDelegatesOf, grantResponse, grantSupportOf, ParliamentPromptBridge, parliamentPlayerName, ParliamentSlotVm, ParliamentTileVm, ParliamentViewVm, resolutionTitleOf, voteForecastOf,
  SUPPORT_CUBE_STAGGER_MS, VoteForecastVm, voteResponse, voteVerbOf, VoteVerbVm,
} from '@/client/console/parliament/consoleParliamentModel';
import {
  CARD_DOOR_RECEIPT, CARD_DOOR_SOURCE, SUPPORT_KICKER, supportTailText, voteFactsOf, VoteFactsVm, voteInfoOf, VoteInfoVm,
} from '@/client/console/parliament/voteInfoModel';
import {VoteSupportProjection} from '@/common/models/PlayerInputModel';
import {LedgerChipVm, voteLedgerOf} from '@/client/console/parliament/voteLedgerModel';
import {BenchSource, voteSourceOf, winningShownOf} from '@/client/console/parliament/parliamentVoteView';
import {ParliamentInspectRequest, slotFaceOf} from '@/client/console/parliament/parliamentInspect';

/** The delegate's landing beat (the cube settles, the counters tick, the landed reading is READ) — then the flow leaves as ONE surface. */
const VOTE_LANDING_MS = 700;
/** THE ACCESS SCENE's beats: the count on the bill · the guard on the vote layer's leave · the read of the landed seal. */
const ACCESS_COUNT_MS = 520;
const ACCESS_RETURN_GUARD_MS = 1100;
const ACCESS_READ_MS = 1700;

/** The neutral cubes of a grant's support leave the supply one after another — the support scene's own rhythm (law 12: a cube every ≥ 90 ms). */

/** The confirm's price line: the lobby's delegate is free, the reserve's costs the server's own M€. */
type CtaCost = {kind: 'free' | 'cost' | 'none', amount: number};

/**
 * The reading's own scale steps in its frame, largest first (PL-785 — `fitReading`): ×1 is the floor. Since the win column (2026-10-26)
 * a one-row reading is far narrower than its frame, and at ×1.5 it still floated in a third of the hall's plate — the ladder reaches
 * ×1.8, and the measurement still decides (a reading that does not stand whole at a step never takes it).
 */
const READING_FIT_STEPS: ReadonlyArray<number> = [1.8, 1.65, 1.5, 1.35, 1.2, 1.1, 1];

/**
 * THE VOTE MODE — the Parliament frame's phase descent: the three slots are
 * teleported into this layer's row and FLIP there from their overview rects,
 * the info surface reads the SELECTED card in one number, the confirm sends
 * the delegate, and the answer LANDS: the cube leaves its real place on the
 * bench and settles on the card's ribbon before the flow leaves. The stage
 * machine it moves is the section's shared flow record; the submit itself
 * (the safety timer, the answer key) is the section's — this component
 * emits `send` and is told when the answer is in.
 */
export default defineComponent({
  name: 'ConsoleParliamentVoteMode',
  components: {
    ConsoleInfluenceYield, ConsoleColonyLedger, ConsoleTileGrant, ConsoleAgendaGrant, ConsoleVoteLedger, ConsolePartyFormula, ConsolePartyReaction, ConsoleVoteFactRow,
    ConsoleSupportPlaces, PlayerDelegate, GamepadGlyph,
  },
  props: {
    view: {type: Object as PropType<ParliamentViewVm>, required: true},
    model: {type: Object as PropType<ParliamentModel | undefined>, default: undefined},
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    viewerColor: {type: String as PropType<Color | undefined>, default: undefined},
    viewerParticipates: {type: Boolean, default: false},
    awaitingInput: {type: Boolean, default: false},
    bridge: {type: Object as PropType<ParliamentPromptBridge>, required: true},
    voteTile: {type: Object as PropType<ParliamentTileVm | undefined>, default: undefined},
    winningSlot: {type: Object as PropType<ParliamentSlotVm | undefined>, default: undefined},
    benchSource: {type: String as PropType<BenchSource>, required: true},
    benchWarn: {type: Boolean, default: false},
    /** The execution gate — the viewer's own action window (never a reason of its own). */
    canActNow: {type: Boolean, default: false},
    canVoteNow: {type: Boolean, default: false},
    /**
     * A STAGED card door's receipt — what the commit charges for the card, as the composer settled it (the
     * shell hands it in from the staged-play store): a play's price in M€, an action's own cost chip. Undefined
     * for every other door: the card is already paid, or there is none.
     */
    cardReceipt: {type: Object as PropType<StagedReceipt | undefined>, default: undefined},
    /**
     * WHICH FLOW the staged door commits — a card's PLAY (TR03: A «Разыграть карту», the play's own verb) or a
     * blue card's ACTION (TR15: A «Подтвердить», the action's own commit verb). Read only while staged.
     */
    stagedFlow: {type: String as PropType<'play' | 'action'>, default: 'play'},
  },
  emits: ['notice', 'inspect', 'send', 'flow-complete'],
  data() {
    return {
      supportKicker: SUPPORT_KICKER,
      cardDoorSource: CARD_DOOR_SOURCE,
      cardDoorReceipt: CARD_DOOR_RECEIPT,
      /** The neutral cubes' flights of the running landing (dropped with it). */
      supportFlights: [] as Array<string>,
      landingBeat: undefined as ParliamentBeat | undefined,
      landingHold: undefined as AnimationHold | undefined,
      flightHold: undefined as AnimationHold | undefined,
      /** The grant's later cubes' launches (P72 · CZ — ONE phrase): killed with the landing. */
      grantBeats: [] as Array<ParliamentBeat>,
      /** The viewer's own cubes in the air right now — the flight hold stands while any is. */
      cubesInAir: 0,
      /** THE ACCESS SCENE's own hold and its running beat (the count, the read). */
      accessHold: undefined as AnimationHold | undefined,
      accessBeatHandle: undefined as ParliamentBeat | undefined,
      /**
       * A CONFIRM OWED BY THE ENTRANCE — the instance of the card an A pressed while the mode was still entering
       * (the double A through the card the player came in by). The entrance is hurried and the vote is sent the
       * moment it lands, on that card only: a ◀ ▶ after the press moves the selection and the owed press lapses.
       */
      confirmOwed: undefined as string | undefined,
      /** The reading's own frame is watched for a change of ITS room (a profile, the panel) — the fit's other trigger. */
      readingRoomObserver: undefined as ResizeObserver | undefined,
    };
  },
  computed: {
    /**
     * THE READING'S SIZE: the hall's panel is the chamber's whole rect (v8 § 5) — the one number reads at the
     * panel's own scale; the band of a hosted door keeps its compact pieces.
     */
    readingSize(): 'compact' | 'normal' {
      return consoleParliamentUi.hall ? 'normal' : 'compact';
    },
    flow() {
      return parliamentFlow;
    },
    /** The card the vote mode is on — the cursor's slot. */
    voteSlot(): ParliamentSlotVm | undefined {
      return this.view.slots[parliamentFlow.slotIndex];
    },
    voteUp(): boolean {
      return parliamentVoteUp();
    },
    voteCommitted(): boolean {
      return this.voteUp && parliamentFlow.stage !== 'vote';
    },
    voteSource(): BenchSource {
      return voteSourceOf(this.view, parliamentFlow.voteSnapshot, this.voteTile);
    },
    voteInFlight(): boolean {
      return parliamentVoteInFlight();
    },
    /** A grant's neutral delegates are still on their way to the party's places. */
    supportInFlight(): boolean {
      return parliamentSupportInFlight();
    },
    /** A nested frame (the action workspace) took the scene — this screen yields and waits. */
    sceneHandedOver(): boolean {
      return workspaceFrameHasNested('parliament');
    },
    /**
     * THE DELEGATES THIS PRESS SENDS: one for the vote; a GRANT's count while
     * its prompt stands, and — past the submit, when that prompt is gone — the
     * count the SNAPSHOT remembered (the landing flies exactly that many).
     */
    voteCount(): number {
      return parliamentFlow.voteSnapshot?.count ?? this.bridge.grant?.count ?? 1;
    },
    /** The vote mode serves a DELEGATE GRANT (Turmoil Redux — the Venus tile), not the player's vote. */
    grantUp(): boolean {
      return this.bridge.grant !== undefined;
    },
    grantSourceText(): string {
      return translateTextWithParams('${0} from the reserve · free', ['×' + String(this.voteCount)]);
    },
    /**
     * THE DOOR IS STAGED (a card that places a delegate by being played — TR03): nothing has been sent,
     * A is the play's own commit and B walks back to the composer. Past the press the snapshot remembers
     * nothing of it — the door is then simply «a card's», live or landing.
     */
    stagedDoor(): boolean {
      return this.bridge.grant?.staged === true && parliamentFlow.voteSnapshot === undefined;
    },
    /** The delegate is placed by a CARD (its own play, staged or met live) — the source line says so, through the landing too. */
    cardDoor(): boolean {
      return parliamentFlow.voteSnapshot?.door === 'card' || (parliamentFlow.voteSnapshot === undefined && this.bridge.grant?.card !== undefined);
    },
    /** The staged card door's receipt: the shell's before the press, the snapshot's through the landing; none once the card is paid (a live door). */
    receiptChip(): StagedReceipt | undefined {
      const snap = parliamentFlow.voteSnapshot;
      if (snap !== undefined) {
        return snap.receipt;
      }
      return this.stagedDoor ? this.cardReceipt : undefined;
    },
    /** The receipt's unit, drawn by the console's ONE icon resolver (M€ for a play, the card's resource for an action). */
    receiptIconClass(): string {
      return iconClassFor(this.voteInfo?.vote.receipt?.icon);
    },
    /**
     * THE SUPPORT ROW of the selected card's party: the press's own snapshot once it is made (the places
     * fill on the touchdowns, never on the packet), the SERVER's projection before it. Undefined when the
     * door pays no support — the block is not drawn at all.
     */
    supportRow(): VoteSupportProjection | undefined {
      const snap = parliamentFlow.voteSnapshot;
      if (snap !== undefined) {
        return snap.support;
      }
      const slot = this.voteSlot;
      return slot === undefined ? undefined : grantSupportOf(this.bridge.grant, slot.party);
    },
    /** The support block's tail, in words («+1 из 3 · предел области»; the bare «+3» when all of it lands). */
    supportTail(): string {
      const support = this.voteInfo?.support;
      return support === undefined ? '' : supportTailText(support, (key, params) => translateTextWithParams(key, params === undefined ? [] : [...params]));
    },
    voteForecast(): VoteForecastVm | undefined {
      const slot = this.voteSlot;
      return slot === undefined ? undefined : voteForecastOf(slot, this.viewerColor, this.model?.viewer?.vote, this.voteCount);
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
        subject: this.voteSubject,
        rival: this.subjectIsRival ? {name: this.nameOf(this.voteSubject)} : undefined,
        nameOf: (color: Color) => this.nameOf(color),
        subjectRating: this.playerView.players.find((p) => p.color === this.voteSubject)?.terraformRating,
        tableau: this.subjectTableau,
        name: resolutionTitleOf(this.view, slot.resolutionId),
        winning: winningShownOf(slot),
        source: this.benchSource,
        cost: this.ctaCost.amount,
        facts: this.voteFacts,
        numbers: this.voteNumbers,
        // A grant's block keeps saying «ваши делегаты» through the landing (the prompt is gone by then, the snapshot remembers).
        grant: this.grantUp || this.cardDoor || (parliamentFlow.voteSnapshot?.count ?? 1) > 1 ?
          {count: this.voteCount, card: this.cardDoor, receipt: this.receiptChip} :
          undefined,
        support: this.supportRow === undefined ? undefined : {row: this.supportRow, landed: parliamentFlow.supportLanded},
      });
    },
    /**
     * THE LEDGER OF OUTCOMES — what the selected card pays EVERY participating
     * seat at its own influence, the viewer's chip first (`voteLedgerModel`).
     * The tableaux are the PUBLIC ones the view already carries: the holder
     * law («no card can hold animals») is read per seat, exactly as for the
     * viewer.
     */
    /**
     * THE SUBJECT of the big reading — the viewer unless the player moved it
     * along the row of seats with the bumpers. A READING, never a decision:
     * «ВАШ ГОЛОС», the price and A are the viewer's at every subject.
     */
    voteSubject(): Color | undefined {
      return parliamentVoteSubject(this.viewerColor);
    },
    /** The subject is ANOTHER seat: the reading speaks in the third person and drops the «mine» register. */
    subjectIsRival(): boolean {
      const subject = this.voteSubject;
      return subject !== undefined && subject !== this.viewerColor;
    },
    /** The SUBJECT's public tableau — the holder law is read for the seat the reading is about. */
    subjectTableau(): ReadonlyArray<{name: CardName}> {
      const subject = this.voteSubject;
      if (subject === undefined || subject === this.viewerColor) {
        return this.playerView.thisPlayer.tableau;
      }
      return this.playerView.players.find((p) => p.color === subject)?.tableau ?? [];
    },
    voteLedger(): ReadonlyArray<LedgerChipVm> {
      const slot = this.voteSlot;
      if (slot === undefined) {
        return [];
      }
      return voteLedgerOf({
        resolution: slot.resolution ?? getResolution(slot.resolutionId),
        model: this.model,
        viewer: this.viewerColor,
        players: this.playerView.players,
      });
    },
    /** The row of seats stands only where it COMPARES — two seats or more (`ConsoleVoteLedger` draws nothing below). */
    ledgerShown(): boolean {
      return this.voteLedger.length > 1;
    },
    /**
     * THE RIVAL KICKER's words, split around the name: the key's own `${0}`
     * slot is where the CUBE and the NAME stand, so the line reads «ДЛЯ ▮ АННА
     * ПРИ ПРИНЯТИИ» in whatever word order the language puts them.
     */
    subjectKicker(): {before: string, after: string} {
      const rendered = translateText(this.voteInfo?.reading.kicker ?? '');
      const at = rendered.indexOf('${0}');
      if (at === -1) {
        return {before: rendered, after: ''};
      }
      return {before: rendered.slice(0, at), after: rendered.slice(at + 4)};
    },
    /** The selected card's STANDING effect (its `text.passive`) — the law column's second row (undefined without one). */
    lawPassiveText(): string | undefined {
      const slot = this.voteSlot;
      const resolution = slot === undefined ? undefined : (slot.resolution ?? getResolution(slot.resolutionId));
      return resolution?.text.passive;
    },
    /** The world part's one sentence and its honest footnote (the removal family's own keys). */
    removalSummaryKey(): string {
      return TILE_REMOVAL_SUMMARY_KEY;
    },
    removalNoteKey(): string {
      return TILE_REMOVAL_COST_NOTE_KEY;
    },
    /**
     * THE VOTE'S NUMBERS: before the submit, the live model and its
     * projection; from the submit to the landing, the SNAPSHOT (the counters
     * tick when the cube lands, not when the packet does); after the landing,
     * the live model on both sides.
     */
    voteNumbers(): {votesBefore: number, votesAfter: number, mineBefore: number, mineAfter: number} {
      const slot = this.voteSlot;
      const snap = parliamentFlow.voteSnapshot;
      if (slot === undefined) {
        return {votesBefore: 0, votesAfter: 0, mineBefore: 0, mineAfter: 0};
      }
      if (parliamentFlow.stage === 'landed' && snap !== undefined) {
        return {votesBefore: snap.votes, votesAfter: slot.totalVotes, mineBefore: snap.mine, mineAfter: slot.viewerVotes};
      }
      const count = this.voteCount;
      if (snap !== undefined) {
        return {votesBefore: snap.votes, votesAfter: snap.votes + count, mineBefore: snap.mine, mineAfter: snap.mine + count};
      }
      const f = this.voteForecast;
      return {
        votesBefore: slot.totalVotes, votesAfter: f?.votesAfter ?? slot.totalVotes + count,
        mineBefore: slot.viewerVotes, mineAfter: slot.viewerVotes + count,
      };
    },
    /** THIS VOTE's consequences — every fact as current → projected (`voteFactsOf`; the panel prints two, the inspector all). */
    voteFacts(): VoteFactsVm {
      const slot = this.voteSlot;
      const snap = parliamentFlow.voteSnapshot;
      const landed = parliamentFlow.stage === 'landed' || parliamentFlow.stage === 'access';
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
      const several = this.voteCount > 1;
      switch (parliamentFlow.stage) {
      case 'submitting': return translateText('Performing…');
      case 'paying': return translateText('Pay for the delegate');
      // «placed» only once the cube has landed — the answer's arrival is not the delegate's.
      case 'landed': return translateText(this.voteInFlight || this.supportInFlight ? 'Performing…' : (several ? 'Delegates placed' : 'Delegate placed'));
      // The access scene's leave keeps the landed reading on the panel while it lets go of the chamber.
      case 'access': return translateText(several ? 'Delegates placed' : 'Delegate placed');
      default:
        if (!this.canVoteNow) {
          return this.voteBlockedText;
        }
        // A STAGED door's confirm is the FLOW's own commit — a play's «Разыграть карту», an action's «Подтвердить»:
        // the very verb the composer would have carried had the card asked nothing (one verb for one act).
        return translateText(this.stagedDoor ? stagedDoorVerb(this.stagedFlow) : (several ? 'Send the delegates' : 'Send the delegate'));
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
      // A delegate GRANT's cubes are free wherever they leave from.
      if (source === 'lobby' || this.grantUp) {
        return {kind: 'free', amount: 0};
      }
      return {kind: 'cost', amount: this.votePayment?.cost ?? this.voteTile?.cost ?? PARLIAMENT_VOTE_COST};
    },
    /** A paid vote's BILL stands — the server's own marker, never a title (the vote mode hosts it). */
    votePayment(): VotePaymentMeta | undefined {
      const wf = this.playerView.waitingFor;
      return wf?.type === 'payment' ? (wf as SelectPaymentModel).votePayment : undefined;
    },
    /**
     * THE BILL GEOMETRY (v2, § Б5) — ONLY while a payment panel REALLY stands
     * (the server's `votePayment` bill): the vote column widens to host it,
     * and NOTHING ELSE moves — the card row keeps its rows, the panel its
     * height (the bill rises out of the fixed panel as an overlay). A vote
     * from the reserve the server auto-pays raises no bill and changes no
     * geometry: from the press to the flow's end only text, the confirm's
     * state and the cube's flight change.
     */
    billGeometry(): boolean {
      return this.paymentStands && (parliamentFlow.stage === 'paying' || parliamentFlow.stage === 'submitting');
    },
    paymentStands(): boolean {
      return this.votePayment !== undefined;
    },
  },
  watch: {
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
        const f = parliamentFlow;
        f.slotIndex = idx;
        f.zone = 'voting';
        f.voteSnapshot = {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, winner: this.winningSlot?.instance, source: 'reserve', count: 1};
        f.stageBeforeSubmit = 'vote';
        f.stage = 'paying';
        descendWorkspaceFrame('parliament', 'Voting', 'Payment');
        setWorkspaceFramePhase('parliament', 'committed');
        void this.$nextTick(() => {
          fitParliamentCards();
          freezeParliamentFit(true);
          parkParliamentBody(parliamentRootEl());
        });
      },
    },
  },
  mounted() {
    // ARMED BEFORE THE FIRST RENDER (`armGrantVoteFlow` — a delegate grant
    // hosted inside another workspace): the section mounted straight into the
    // vote pose, so the entrance is played from here, FRESH — no overview to
    // recede, every carried object surfaces in place.
    if (parliamentFlow.stage === 'vote' && parliamentFlow.voteEntering) {
      this.playFreshEntrance();
    }
    if (typeof ResizeObserver !== 'undefined') {
      this.readingRoomObserver = new ResizeObserver(() => this.fitReading());
    }
    void this.$nextTick(() => this.fitReading());
  },
  updated() {
    // A new card, a new subject, a reading that changed: the reading re-seats in its frame (the frame never moves).
    this.fitReading();
  },
  beforeUnmount() {
    this.clearLanding();
    freezeParliamentFit(false);
    this.readingRoomObserver?.disconnect();
  },
  methods: {
    /**
     * THE READING SITS IN ITS FRAME (PL-785). «ДЛЯ ВАС ПРИ ПРИНЯТИИ» keeps ONE frame whatever the card (the stability
     * law — a one-row and a two-row reading draw the same box), so a short reading floated in its middle between two
     * empty bands. The reading now takes the frame's room: the largest step of the reading's own scale (×1 … ×1.5) at
     * which it still stands whole inside its body — measured, never assumed (each step laid out once, the first that
     * fits wins; a reading that fills the frame at ×1 stays ×1). The FRAME never moves; only its content's scale, and
     * only on a new card, subject or reading — the vote's committed geometry is frozen from A to the leave (law 8).
     */
    fitReading(): void {
      const root = this.$el as HTMLElement | undefined;
      const body = root?.querySelector?.<HTMLElement>('.con-parl__info-own-body') ?? null;
      const readings = body?.querySelector<HTMLElement>('.con-parl__info-readings') ?? null;
      if (body === null) {
        return;
      }
      const observer = this.readingRoomObserver;
      if (observer !== undefined && (body as HTMLElement & {__fitObserved?: boolean}).__fitObserved !== true) {
        observer.observe(body);
        (body as HTMLElement & {__fitObserved?: boolean}).__fitObserved = true;
      }
      if (readings === null || this.voteCommitted) {
        return;
      }
      // Only the HALL's panel is a frame with room to fill; a hosted door's band (TR03 · TR15) keeps its compact reading.
      if (!consoleParliamentUi.hall) {
        readings.style.removeProperty('--con-parl-reading-fit');
        return;
      }
      const room = body.getBoundingClientRect();
      const key = `${Math.round(room.width)}x${Math.round(room.height)}|${readings.childElementCount}|${readings.textContent ?? ''}`;
      if (readings.dataset.fitKey === key) {
        return;
      }
      // The entrance poses the reading with a TRANSFORM (a .96 scale while it surfaces): measured under it, every step
      // reads 4 % small. The pose is lifted for the synchronous measurement and put back — nothing paints in between.
      const pose = readings.style.transform;
      readings.style.transform = 'none';
      // A READING PLATE never wraps INSIDE itself to buy scale («3 + 1 →» over «+4 …» read as two half-sentences): each
      // plate's height at ×1 is the reference, and a step may grow it only by the step itself. A secondary line (the
      // holders', the kinds') may still wrap — it is a list, not one number.
      const plates = Array.from(readings.querySelectorAll<HTMLElement>('.con-iyield__reading'));
      readings.style.setProperty('--con-parl-reading-fit', '1');
      const natural = plates.map((plate) => plate.getBoundingClientRect().height);
      let fit = 1;
      for (const step of READING_FIT_STEPS) {
        readings.style.setProperty('--con-parl-reading-fit', String(step));
        const r = readings.getBoundingClientRect();
        const whole = plates.every((plate, i) => plate.getBoundingClientRect().height <= natural[i] * step + 2);
        if (whole && r.height <= room.height - 1 && r.width <= room.width + 1 && readings.scrollWidth <= readings.clientWidth + 1) {
          fit = step;
          break;
        }
      }
      readings.style.transform = pose;
      readings.style.setProperty('--con-parl-reading-fit', String(fit));
      readings.dataset.fitKey = key;
      readings.dataset.readingFit = String(fit);
    },
    /** The FRESH entrance of a mode armed before the mount (see `mounted`). */
    /** An ARMED vote met by a mode already mounted (a warm section unveiled — P72 · CZ): the fresh entrance, as `mounted` plays it. */
    enterArmedVote(): void {
      if (parliamentFlow.stage === 'vote' && parliamentFlow.voteEntering) {
        this.playFreshEntrance();
      }
    },
    playFreshEntrance(): void {
      const f = parliamentFlow;
      void this.$nextTick(() => {
        const root = parliamentRootEl();
        const selected = this.view.slots[f.slotIndex];
        if (root === undefined || selected === undefined) {
          f.voteEntering = false;
          return;
        }
        fitParliamentCards();
        playParliamentVoteEnter({
          root,
          before: emptyVoteRects(),
          selected: selected.instance,
          fromViewer: false,
          instant: false,
          fresh: true,
          done: () => {
            f.voteEntering = false;
            this.flushOwedConfirm();
          },
        });
      });
    },
    /** «Все треки колоний +2» — the colony table's one line (Unity Budget). */
    /** A reading line with its params — the ONE renderer (PL-160). */
    line(reading: Reading): string {
      return readingText(reading);
    },
    /** The veto's sentence (RX42) — its key with its params through the one i18n helper. */
    vetoText(veto: {key: string, params: ReadonlyArray<string>}): string {
      return translateTextWithParams(veto.key, [...veto.params]);
    },
    /** A counted holder's own kind — the icon its unit lands as. */
    holderUnitClass(resource: string): string {
      return iconClassFor(cardResourceKey(resource));
    },
    signed(n: number): string {
      return n > 0 ? `+${n}` : String(n);
    },
    /** The cards of ONE kind, translated, in play order — «Рыба · Птицы». */
    kindCardsText(cards: ReadonlyArray<CardName>): string {
      return cards.map((card) => translateText(card)).join(' · ');
    },
    /** The count's own noun, the line's lead — «3 вида ресурсов». */
    kindsTotalText(key: string, count: number): string {
      return translateTextWithParams(key, [String(count)]);
    },
    tracksLabel(steps: number): string {
      return translateTextWithParams(COLONY_TRACK_SUMMARY_KEY, [String(steps)]);
    },
    figurePx(logical: number): number {
      return delegateFigurePx(logical);
    },
    emblemUrl(party: ReduxParty): string {
      return partyEmblemUrl(party);
    },
    partyAccent(party: ReduxParty): string {
      return partyAccent(party);
    },
    nameOf(color: Color | 'neutral' | undefined): string {
      return parliamentPlayerName(this.playerView.players, color);
    },
    reasonText(reason: string | Message): string {
      return typeof reason === 'string' ? translateText(reason) : translateMessage(reason);
    },
    /**
     * A on the voting area: the frame DESCENDS into the vote mode (a phase,
     * not a frame — the overview is parked, its focus survives). The three
     * slots are measured where they stand, teleported into the vote row, and
     * the entrance FLIPs every carried object from the rect it just had.
     * The mode opens whether or not a vote is possible right now — comparing
     * the three proposals is its job too; the confirm carries the reason.
     */
    openVote(opts?: {fromViewer?: boolean, index?: number}): void {
      const root = parliamentRootEl();
      const f = parliamentFlow;
      if (this.view.slots.length === 0 || root === undefined) {
        this.$emit('notice', translateText('Not in this game'));
        return;
      }
      if (this.voteUp || f.voteLeaving) {
        return;
      }
      if (opts?.index !== undefined) {
        f.slotIndex = opts.index;
      }
      f.slotIndex = Math.max(0, Math.min(this.view.slots.length - 1, f.slotIndex));
      const selected = this.view.slots[f.slotIndex];
      const plate = root.querySelector<HTMLElement>('.con-parl__voting');
      const pr = plate?.getBoundingClientRect();
      const press = pr === undefined || pr.width < 2 ? undefined : {x: pr.left + pr.width / 2, y: pr.top + pr.height / 2};
      // Measure BEFORE the layout changes — the overview's rects are the FLIPs' departures.
      const before = measureVoteRects(root, {press, viewer: this.viewerColor, mode: 'browse'});
      killParliamentVoteMotion(root);
      f.voteSnapshot = undefined;
      // The mode always OPENS on the viewer's own reading — a subject left over from a previous
      // visit would greet the player with somebody else's number under their own delegate.
      this.resetSubject();
      f.sourceHold = undefined;
      f.sourceLeaving = undefined;
      f.sourceHoldCount = 0;
      f.sourceLeavingCount = 0;
      f.zone = 'voting';
      f.stage = 'vote';
      f.voteEntering = true;
      descendWorkspaceFrame('parliament', 'Voting', '');
      void this.$nextTick(() => {
        // The slots are in the vote row now: fit them, then play from the old rects.
        fitParliamentCards();
        playParliamentVoteEnter({
          root,
          before,
          selected: selected.instance,
          fromViewer: opts?.fromViewer === true,
          instant: false,
          done: () => {
            f.voteEntering = false;
            this.flushOwedConfirm();
          },
        });
      });
    },
    /** B before the commit: the same phrase folded back — every object returns home, the focus is where it was. */
    closeVote(): void {
      if (!this.voteUp) {
        return;
      }
      const root = parliamentRootEl();
      const f = parliamentFlow;
      this.clearLanding();
      freezeParliamentFit(false);
      f.voteSnapshot = undefined;
      // Nothing was won here (a B before the commit, a refused press): no gain is owed a scene.
      f.accessExpected = undefined;
      disarmAccessToldOnStage();
      this.resetSubject();
      f.sourceHold = undefined;
      f.sourceLeaving = undefined;
      f.voteEntering = false;
      this.confirmOwed = undefined;
      foldWorkspaceFrame();
      setWorkspaceFramePhase('parliament', 'browse');
      if (root === undefined || this.sceneHandedOver) {
        f.stage = 'browse';
        restoreParliamentBody(root);
        return;
      }
      // Measure the VOTE layout before the teleport home, then let the slots
      // go home and animate them from where they were.
      killParliamentVoteMotion(root);
      const before = measureVoteRects(root, {viewer: this.viewerColor, mode: 'vote'});
      f.voteLeaving = true;
      f.stage = 'browse';
      void this.$nextTick(() => {
        fitParliamentCards();
        playParliamentVoteLeave({
          root,
          viewer: this.viewerColor,
          before,
          done: () => {
            f.voteLeaving = false;
          },
        });
      });
    },
    /** The vote mode's own verbs: ◀ ▶ select, LB/RB move the SUBJECT, A sends, X inspects (B — the section's, folds back). */
    handleIntent(intent: GamepadIntent): void {
      // LB/RB — «ИГРОКИ»: the subject of the READING walks the row of seats, the
      // viewer's chip being its home. It is a side step, not a level: ◀ ▶ keep
      // their meaning, the selection keeps its card, and A keeps its delegate.
      if (intent.kind === 'press' && (intent.button === 'bumperL' || intent.button === 'bumperR')) {
        this.cycleSubject(intent.button === 'bumperR' ? 1 : -1);
        return;
      }
      if (intent.kind === 'nav') {
        if (intent.dir === 'left') {
          this.selectVoteSlot(parliamentFlow.slotIndex - 1);
        } else if (intent.dir === 'right') {
          this.selectVoteSlot(parliamentFlow.slotIndex + 1);
        }
        return;
      }
      const action = consoleActionOf(intent);
      if (action === 'inspect') {
        this.inspect();
      } else if (action === 'primary') {
        // A press DURING the entrance is the player's second A on the card they came in by — a decision, never
        // dropped: the entrance is hurried to its end and the vote goes out as it lands (`flushOwedConfirm`).
        // (The press that OPENED the mode never reaches here — the overview consumed it.)
        if (parliamentFlow.voteEntering) {
          const slot = this.voteSlot;
          if (slot !== undefined && parliamentFlow.stage === 'vote') {
            this.confirmOwed = slot.instance;
            hurryParliamentVoteEnter(parliamentRootEl());
          }
          return;
        }
        this.submitVote();
      }
    },
    /**
     * THE OWED CONFIRM lands with the entrance: the selection is still the card the press was made on and the mode
     * still stands at its vote — then it is exactly the A the player pressed, the same submit and the same refusal.
     */
    flushOwedConfirm(): void {
      const owed = this.confirmOwed;
      this.confirmOwed = undefined;
      if (owed === undefined || !this.voteUp || parliamentFlow.stage !== 'vote' || this.voteSlot?.instance !== owed) {
        return;
      }
      this.submitVote();
    },
    /**
     * THE INSPECTOR — X on the selected card. Inside the vote mode it opens
     * the viewer over ALL THREE cards (LB/RB browse them, the cursor follows)
     * and offers the A verb that sends the delegate to the card shown; a bill
     * standing or a delegate in flight binds the viewer to ONE card.
     */
    inspect(): void {
      const root = parliamentRootEl();
      const slots = this.view.slots;
      const selected = this.voteSlot;
      if (selected === undefined) {
        return;
      }
      if (parliamentFlow.stage !== 'vote') {
        // A bill standing or a delegate in flight belongs to ONE card: the
        // viewer reads that card alone, and nothing in it can move the
        // selection the transaction is bound to.
        const single: ParliamentInspectRequest = {kind: 'resolution', ids: [selected.resolutionId], index: 0, origin: () => slotFaceOf(root, selected.instance)};
        this.$emit('inspect', single);
        return;
      }
      // THE THREE PROPOSALS, in the order they stand in the row: LB/RB page
      // them inside the viewer and the mode's selection follows (B lands on
      // the last card looked at); A sends the delegate to the card on screen
      // through this mode's own submit.
      const request: ParliamentInspectRequest = {
        kind: 'resolution',
        ids: slots.map((slot) => slot.resolutionId),
        index: parliamentFlow.slotIndex,
        origin: (index) => {
          const slot = slots[index];
          return slot === undefined ? null : slotFaceOf(root, slot.instance);
        },
        onBrowse: (index) => this.selectVoteSlot(index),
        vote: {
          verbAt: (index) => this.voteVerbAt(index),
          execute: (index) => this.sendVoteFromInspector(index),
        },
      };
      this.$emit('inspect', request);
    },
    /**
     * MOVE THE SUBJECT one seat along the LEDGER's own order (the viewer first,
     * then the model's) — the very row the panel prints, so the cursor and the
     * chips can never disagree. The walk WRAPS: the row is a ring of seats, not
     * a list with edges, and the viewer's own chip is always one step away.
     */
    cycleSubject(step: number): void {
      const order = this.voteLedger.map((chip) => chip.color);
      if (order.length < 2) {
        return;
      }
      const at = Math.max(0, order.indexOf(this.voteSubject ?? order[0]));
      const next = order[(at + step + order.length) % order.length];
      // The viewer's own seat is stored as «no subject»: one state for «this is my reading».
      parliamentFlow.voteSubject = next === this.viewerColor ? undefined : next;
    },
    /** The reading is the VIEWER's again — the mode's own boundaries (open, commit, close) and a seat that left the table. */
    resetSubject(): void {
      parliamentFlow.voteSubject = undefined;
    },
    /** Select the vote mode's card (the d-pad inside the mode, the viewer's paging). */
    selectVoteSlot(index: number): void {
      // The crumb stays «Голосование»: the selection is named by the surface, never by the head line.
      parliamentFlow.slotIndex = Math.max(0, Math.min(this.view.slots.length - 1, index));
    },
    /**
     * «Send the delegate» for the card at `index`, as THIS mode reads it — the
     * same option, source, price and blocked text its own confirm uses.
     */
    voteVerbAt(index: number): VoteVerbVm | undefined {
      const slot = this.view.slots[index];
      if (slot === undefined || parliamentFlow.stage !== 'vote') {
        return undefined;
      }
      const tile = this.voteTile;
      // A GRANT (live or staged) is the decision standing on this very screen:
      // what it offers is ITS prompt's parties, and the viewer's action window
      // is not its gate (`canVoteNow` — the mode's own confirm reads the same).
      const grant = this.bridge.grant;
      return voteVerbOf({
        participates: this.viewerParticipates,
        tile,
        refusalText: tile === undefined || tile.available ? '' : this.reasonText(tile.reason),
        offered: grant !== undefined || this.bridge.vote !== undefined,
        canActNow: grant !== undefined ? this.canVoteNow : this.canActNow,
        offeredParties: (grant ?? this.bridge.vote)?.model.parties,
        party: slot.party,
        turnText: translateText(offTurnReason(this.awaitingInput)),
        notOfferedText: translateText('This option is no longer offered'),
        door: grant === undefined ? undefined : (grant.staged === true ? 'card' : 'grant'),
      });
    },
    /**
     * The inspector's A, after the viewer has flown back into the card's slot:
     * the card it showed becomes the mode's selection and the mode's own
     * submit runs — the same snapshot, the same answer handling, the same
     * delegate flight. A refusal speaks through the same notice.
     */
    sendVoteFromInspector(index: number): void {
      if (parliamentFlow.stage !== 'vote') {
        return;
      }
      this.selectVoteSlot(index);
      this.submitVote();
    },
    // ── the submit (byte-identical to the live prompt) ─────────────────
    submitVote(): void {
      const slot = this.voteSlot;
      if (slot === undefined || parliamentFlow.stage !== 'vote') {
        return;
      }
      if (!this.canVoteNow) {
        this.$emit('notice', this.voteBlockedText);
        return;
      }
      // A GRANT's cubes leave the RESERVE, however the bench reads otherwise (the lobby's cube is the free vote and stays).
      const grant = this.bridge.grant;
      const source = grant !== undefined ? 'reserve' : (this.benchSource === 'none' ? 'lobby' : this.benchSource);
      // THE COMMIT BOUNDARY is the viewer's own: the cube, the counters and «Делегат поставлен» are
      // about them, so the reading comes home before the beat that shows it.
      this.resetSubject();
      // Read BEFORE the snapshot stands (they switch to it the moment it does): the door's own facts, remembered
      // through the landing — the prompt that stated them is gone with the answer.
      const support = this.supportRow;
      const receipt = this.receiptChip;
      const byCard = this.cardDoor;
      // A decision of a SERIES (P70): which one, and whose — the mode stands through the rest of it.
      const series = grant !== undefined && grant.staged !== true ? grantSeriesKeyOf(grant.model) : undefined;
      // An ACTION's price on the RAIL (T07's 3 M€) is the commit's own token, flown before the cube; a card's resource
      // (TR15's data) is this mode's price token; a play's M€ is the payment's business.
      const railPrice = byCard && this.stagedDoor && this.stagedFlow === 'action' && receipt !== undefined && isStandardResource(receipt.icon);
      parliamentFlow.supportHeld = 0;
      parliamentFlow.supportLanded = 0;
      parliamentFlow.grantDegraded = '';
      parliamentFlow.voteSnapshot = {
        votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, winner: this.winningSlot?.instance, source,
        count: grant?.count ?? 1,
        ...(byCard ? {door: 'card' as const} : {}),
        ...(receipt === undefined ? {} : {receipt}),
        ...(railPrice ? {railPrice: true as const} : {}),
        ...(support === undefined ? {} : {support}),
        ...(series === undefined ? {} : {series}),
      };
      // THE PARTY'S EFFECT THIS PRESS WILL WIN (the access scene): the viewer does not hold it and the press reaches the
      // viewer's own threshold. Armed BEFORE the response — the feed builds its card when the response is ingested,
      // before the hall has played the moment (`accessToldOnStage.ts`).
      const access = this.view.viewer?.access.find((a) => a.party === slot.party);
      const reaches = access !== undefined && !access.hasEffect && access.delegates + (grant?.count ?? 1) >= effectDelegatesOf(access);
      parliamentFlow.accessExpected = reaches ? slot.party : undefined;
      if (reaches) {
        armAccessToldOnStage(slot.party);
      }
      // FROM THE PRESS TO THE FLOW'S END nothing but text, the confirm's state and the cube's flight may change:
      // the card fit is FROZEN (a re-fit under the flight jumped the scene it measured — § Б5).
      freezeParliamentFit(true);
      // The grant answers its own stand-alone prompt; the vote answers its branch of the action menu.
      const response = grant !== undefined ? grantResponse(this.bridge, slot.party) : voteResponse(this.bridge, slot.party);
      this.$emit('send', {response, from: 'vote'});
    },
    /** The server answered while the BILL stood: the paid delegate lands — or the payment was refused / the prompt moved on. */
    answerWhilePaying(): void {
      if (this.landVote()) {
        return;
      }
      if (!this.paymentStands) {
        // The payment was refused / the prompt moved on without a delegate.
        this.closeVote();
        this.$emit('flow-complete', 'vote');
      }
    },
    /** The server answered the vote's submit: the delegate LANDS, or the bill is raised, or nothing was placed. */
    answerAfterSubmit(): void {
      if (this.landVote()) {
        return;
      }
      if (this.paymentStands) {
        parliamentFlow.stage = 'paying';
        setWorkspaceFramePhase('parliament', 'committed');
        return;
      }
      // RE-ASKED — the answer placed nothing and the GRANT itself stands live (a staged tail the server
      // dropped as stale; a grant raised again): this very mode BECOMES that door, in place — the selection
      // is kept, B is «Свернуть», the crumb stays past the commit. Never a close followed by an open.
      const grant = this.bridge.grant;
      if (grant !== undefined && grant.staged !== true) {
        parliamentFlow.voteSnapshot = undefined;
        parliamentFlow.stage = 'vote';
        freezeParliamentFit(false);
        setWorkspaceFramePhase('parliament', 'committed');
        return;
      }
      // PARKED — a card's own door whose answer waits behind somebody else's prompt (the play is real, the
      // delegate is not on the table yet): nothing landed, so nothing flies; the step LEAVES WHOLE and the
      // delegate and the support arrive with the ordinary update once the server's drain lands them.
      if (parliamentFlow.voteSnapshot?.door === 'card') {
        // …but only once the COMMIT is real: the play on the table, the action recorded as used. A key that
        // moved for somebody else's reason while the staged commit is still on the wire is not this door's
        // answer: keep waiting for it. (An action's card is on the table the whole time — tableau membership
        // could never witness its commit.)
        const card = grant?.card;
        const me = this.playerView.thisPlayer;
        const committed = card !== undefined && (this.stagedFlow === 'action' ?
          me.actionsThisGeneration.includes(card) : me.tableau.some((c) => c.name === card));
        if (grant?.staged === true && card !== undefined && !committed) {
          return;
        }
        this.$emit('flow-complete', 'vote');
        return;
      }
      this.closeVote();
      this.$emit('flow-complete', 'vote');
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
      const f = parliamentFlow;
      const snap = f.voteSnapshot;
      if (slot === undefined || me === undefined || snap === undefined || slot.viewerVotes <= snap.mine) {
        return false;
      }
      const mine = slot.votes.filter((vote) => vote.owner === me);
      if (mine.length === 0) {
        return false;
      }
      // THE CUBES THAT JUST ARRIVED — the viewer's newest on the card, as many
      // as the answer added (a vote: one; a grant: its count — capped by what
      // the model actually shows, never by what the prompt promised). They fly
      // IN PLACEMENT ORDER, one after another, off the top of the reserve.
      const arrived = Math.max(1, Math.min(slot.viewerVotes - snap.mine, snap.count));
      const seqs = mine.map((vote) => vote.seq).sort((a, b) => b - a).slice(0, arrived).reverse();
      f.stage = 'landed';
      setWorkspaceFramePhase('parliament', 'committed');
      // THE PARTY'S SUPPORT (a door that also pays it): how many neutral delegates REALLY landed is the
      // model's answer (the party's stock against the snapshot's), never the prompt's promise. They stay
      // «in the supply» on the bench until each lifts off.
      const support = snap.support;
      const supportLanded = support === undefined ? 0 :
        Math.max(0, Math.min(support.gained, (this.view.parties.find((p) => p.party === support.party)?.support ?? support.current) - support.current));
      if (support !== undefined) {
        snap.support = {...support, gained: supportLanded, resulting: support.current + supportLanded};
      }
      f.supportHeld = supportLanded;
      f.supportLanded = 0;
      // The ceiling budgets the price token's flight too (PL-100) when the door has a price to fly — a card resource's
      // (this mode's token) or an action's rail price (the commit's token, PL-104).
      const priced = snap.door === 'card' && snap.receipt !== undefined && (snap.receipt.icon !== 'megacredits' || snap.railPrice === true);
      // The ceiling: ONE flight + the read (the 4 s base) + the phrase's staggers (P72 · CZ — the cubes overlap, never
      // a whole flight per cube) + the support + the price token.
      const stagger = (GRANT_CUBE_STAGGER_MS + GRANT_TOUCH_GAP_MS) * Math.max(0, seqs.length - 1);
      this.landingHold = beginAnimationHold('parliament-vote-landing', {maxHoldMs: 4000 + stagger + 900 * supportLanded + (priced ? 900 : 0)});
      f.landedSeqs = [];
      f.flightSeq = seqs[0];
      f.pendingSeqs = seqs.slice(1);
      // The bench keeps painting the source cubes until each proxy stands over
      // its own, and keeps its WORDS until each has visibly left.
      f.sourceHold = snap.source;
      f.sourceLeaving = snap.source;
      f.sourceHoldCount = seqs.length;
      f.sourceLeavingCount = seqs.length;
      void this.$nextTick(() => {
        this.flyPriceThenDelegates(seqs, me);
      });
      return true;
    },
    /**
     * THE PRICE LEAVES FIRST (PL-100 — «the resource buys the delegate»: TR15 / TR24 / TR34 / TR35). A staged ACTION
     * door pays with the card's own resource (its receipt — data, a mech, a fighter), and that resource is the cube's
     * CAUSE: a token of it leaves the price where it stands ON SCREEN and lands on the viewer's RESERVE stack (which
     * answers with its landed flash), and only then does the cube lift off that very stack. Price → cube: one chain on
     * the motion clock, the cube's law intact (it always comes from the reserve). Since the Parliament takes the WHOLE
     * stage (the owner, 2026-10-24) the source card is parked under it, so the price's place on screen is this mode's
     * own locked RECEIPT («Карта · 3 [data]») — never a capsule nobody can see. A play's M€ receipt is the payment's
     * business and a live door is already paid — no token there; nothing measurable or reduced motion — the cube at
     * once (`priceStage` stays `none`, the composer falls back).
     */
    flyPriceThenDelegates(seqs: ReadonlyArray<number>, me: Color): void {
      const f = parliamentFlow;
      const snap = f.voteSnapshot;
      const receipt = snap?.receipt;
      const launch = () => this.flyDelegates(seqs, me);
      const stillLanding = () => parliamentFlow.stage === 'landed' && parliamentFlow.voteSnapshot !== undefined;
      if (snap?.railPrice === true) {
        // THE ACTION'S PRICE OFF THE RAIL (T07 — PL-104, then TR15 §6): after the impulse has landed (PL-103) the
        // commit's seeded half flies the «−3» off the M€ row's digits into the printed cost icon, the row ticking on
        // the departure; the cube lifts off the reserve once that token is absorbed. Nothing seeded → the cube at once.
        afterCommitImpulse(() => {
          if (!stillLanding()) {
            return;
          }
          const price = flyStagedVotePrice();
          if (price === undefined) {
            launch();
            return;
          }
          void price.then(() => {
            if (stillLanding()) {
              launch();
            }
          });
        });
        return;
      }
      if (snap === undefined || snap.door !== 'card' || receipt === undefined || receipt.icon === 'megacredits') {
        launch();
        return;
      }
      // THE PRICE WAITS FOR ITS CAUSE (PL-103): the answer may land while the ACTION COMMIT's impulse is still
      // running row B (a fast server: the token left the capsule at ≈ 0.26 s, the ring reached the delegate icon at
      // ≈ 0.5 s). The token is born when the impulse has LANDED — on the motion's own clock (the latch), at once
      // when no impulse is in flight; a flow that moved on meanwhile flies nothing.
      afterCommitImpulse(() => {
        if (parliamentFlow.stage === 'landed' && parliamentFlow.voteSnapshot !== undefined) {
          this.launchPriceToken(receipt, me, launch);
        }
      });
    },
    /** The price token's flight itself (PL-100) — the receipt → the reserve stack, the cube's launch on its absorption. */
    launchPriceToken(receipt: StagedReceipt, me: Color, launch: () => void): void {
      const f = parliamentFlow;
      // The receipt's icon — the place the resource LEAVES (the card it is spent off is parked under this step).
      // (Asked of the document: there is ONE Parliament, and this root carries a leading comment — a dev-build fragment.)
      const from = document.querySelector<HTMLElement>('[data-parl-vote-receipt-icon]');
      const stack = document.querySelector<HTMLElement>(`[data-parl-seat-reserve="${me}"]`);
      f.priceStage = 'flying';
      const id = flyPriceToken({
        iconClass: iconClassFor(receipt.icon),
        amount: receipt.amount,
        from: rectOf(from),
        to: rectOf(stack),
        delayMs: 0,
        onDeparted: () => {
          f.priceStage = 'departed';
        },
        onLanded: () => {
          // The stack answers (its landed flash); the cube waits for the token to be absorbed.
          f.priceStage = 'landed';
          f.reserveAnswers++;
        },
        onAbsorbed: launch,
      });
      if (id === undefined) {
        f.priceStage = 'none';
        launch();
      }
    },
    /**
     * THE GRANT'S CUBES — ONE PHRASE (P72 · ledger CZ; the class: every grant N > 1). They used to fly strictly in turn
     * (the touchdown of one launched the next — a grant of 2 was two whole flights of waiting); now they leave the
     * reserve as ONE gesture on `grantCubeSchedule`: each starts a beat after the one before it (law 12's rhythm), flies
     * its OWN arc into its OWN place on the ribbon, the reserve ticks on each DEPARTURE, the ribbon and the counter on
     * each TOUCHDOWN — and the read (the lead, «принимается») turns ONCE, after the last. One flight keeps its own
     * length (the cube's law, §8). The later launches ride the motion clock (`scheduleParliamentBeat`), killed with
     * the landing; nothing measurable / reduced motion — the cubes are simply there.
     */
    flyDelegates(seqs: ReadonlyArray<number>, color: Color): void {
      const f = parliamentFlow;
      const settleAll = () => {
        f.sourceHold = undefined;
        f.sourceLeaving = undefined;
        f.sourceHoldCount = 0;
        f.sourceLeavingCount = 0;
        f.flightSeq = undefined;
        f.pendingSeqs = [];
        f.landedSeqs = [...seqs];
        this.flySupport(seqs[seqs.length - 1] ?? 0);
      };
      if (seqs.length === 0) {
        this.beginLanding(0);
        return;
      }
      const root = parliamentRootEl();
      const reduced = root === undefined || typeof window === 'undefined' || consoleReducedMotionActive();
      const schedule = reduced || root === undefined ? [] : grantCubeSchedule(seqs.map((seq, i) => this.cubeDistance(root, seq, i, color)));
      if (schedule.length === 0) {
        settleAll();
        return;
      }
      // Every cube of the phrase is hidden on its place until ITS touchdown.
      f.flightSeq = undefined;
      f.pendingSeqs = [...seqs];
      let left = seqs.length;
      const touched = (seq: number) => {
        f.pendingSeqs = f.pendingSeqs.filter((s) => s !== seq);
        if (!f.landedSeqs.includes(seq)) {
          f.landedSeqs = [...f.landedSeqs, seq];
        }
        left--;
        if (left === 0) {
          this.flySupport(seqs[seqs.length - 1]);
        }
      };
      seqs.forEach((seq, i) => {
        const launch = () => {
          if (parliamentFlow.stage !== 'landed') {
            return;
          }
          if (!this.flyOwnDelegate(seq, color, () => touched(seq))) {
            // This cube cannot fly (nothing measurable): it is simply there — its source lets go of exactly one.
            this.releaseOneSource();
            touched(seq);
          }
        };
        if (i === 0) {
          launch();
        } else {
          this.grantBeats.push(scheduleParliamentBeat(schedule[i].startMs, launch));
        }
      });
    },
    /** One cube's source figure lets go (a phrase's other cubes may still be standing on the same stack). */
    releaseOneSource(): void {
      const f = parliamentFlow;
      f.sourceHoldCount = Math.max(0, f.sourceHoldCount - 1);
      f.sourceLeavingCount = Math.max(0, f.sourceLeavingCount - 1);
      if (f.sourceHoldCount === 0) {
        f.sourceHold = undefined;
      }
      if (f.sourceLeavingCount === 0) {
        f.sourceLeaving = undefined;
      }
    },
    /**
     * The base-to-base distance of cube `index`'s flight (screen px) — for the phrase's schedule only (each flight
     * re-measures its own ends at its launch): the reserve stack's `index`-th figure from the top (the ones above it
     * will have lifted by then), or the lobby's; into its own place on the ribbon. 0 when unmeasurable.
     */
    cubeDistance(root: HTMLElement, seq: number, index: number, color: Color): number {
      const stack = Array.from(root.querySelectorAll<HTMLElement>(`[data-parl-seat-reserve="${color}"] .con-parl__stack-cube .player-delegate`));
      const source = this.voteSource === 'lobby' ?
        root.querySelector<HTMLElement>(`[data-parl-seat-lobby="${color}"] .player-delegate`) :
        stack[stack.length - 1 - index] ?? stack[0] ?? null;
      const place = root.querySelector<HTMLElement>(`.con-parl__slot[data-instance] [data-seq="${seq}"]`);
      const target = place?.querySelector<HTMLElement>('.player-delegate') ?? place;
      if (source === null || target === null || target === undefined) {
        return 0;
      }
      const a = source.getBoundingClientRect();
      const b = target.getBoundingClientRect();
      return Math.hypot((b.left + b.width / 2) - (a.left + a.width / 2), (b.top + b.height) - (a.top + a.height));
    },
    /**
     * THE NEUTRAL DELEGATES OF THE PARTY'S SUPPORT — second source, second addressee, AFTER the player's own
     * cube has landed: each leaves the COMMON SUPPLY on the bench (its count drops on the lift-off) and
     * lands on the next free place of the vote panel's support block (the place fills on the touchdown and
     * answers ONCE). One after another, the support scene's rhythm. No support to land → straight to the
     * landed read; nothing measurable → the places are simply filled and the miss is CONFESSED on the
     * section root (`data-parl-grant-degraded`), never silent.
     */
    flySupport(seq: number): void {
      const f = parliamentFlow;
      const support = f.voteSnapshot?.support;
      const root = parliamentRootEl();
      const count = support?.gained ?? 0;
      if (support === undefined || count <= 0 || root === undefined) {
        f.supportHeld = 0;
        this.beginLanding(seq);
        return;
      }
      const reduced = typeof window === 'undefined' || consoleReducedMotionActive();
      const from = placeFigureRect(root, '[data-parl-neutral-cube]');
      let remaining = count;
      for (let n = 0; n < count; n++) {
        const placeEl = root.querySelector<HTMLElement>(`[data-parl-vote-support] [data-support-place="${support.current + n + 1}"]`);
        const to = rectOf(placeEl);
        if (!reduced && (from === undefined || to === undefined)) {
          f.grantDegraded = from === undefined ? 'support: the neutral supply has no measurable place' : 'support: the party block has no measurable place';
          console.warn(`[parliament] grant: ${f.grantDegraded} — settled without a flight`);
        }
        const id = flyDelegate('neutral', from, to, n * SUPPORT_CUBE_STAGGER_MS, () => {
          f.supportLanded = Math.min(count, f.supportLanded + 1);
          this.answerSupportPlace(placeEl);
          remaining--;
          if (remaining === 0) {
            this.beginLanding(seq);
          }
        }, {
          onLifted: () => {
            f.supportHeld = Math.max(0, f.supportHeld - 1);
          },
        });
        if (id !== undefined) {
          this.supportFlights.push(id);
        }
      }
    },
    /** The ONE place that received the cube answers, once (the plaque's own touchdown — law 11): ended by its own animationend. */
    answerSupportPlace(el: HTMLElement | null): void {
      if (el === null || consoleReducedMotionActive()) {
        return;
      }
      void this.$nextTick(() => {
        el.classList.remove('con-pseal__support-place--landed');
        void el.offsetWidth;
        el.classList.add('con-pseal__support-place--landed');
        el.addEventListener('animationend', () => el.classList.remove('con-pseal__support-place--landed'), {once: true});
      });
    },
    /** The viewer's own delegate's flight, paced by its distance — `onLanded` is the caller's continuation (the next figure, or the landed read). */
    flyOwnDelegate(seq: number, color: Color, onLanded: () => void): boolean {
      const root = parliamentRootEl();
      const f = parliamentFlow;
      if (root === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
        return false;
      }
      // The REAL places on the delegates zone, measured where they stand right
      // now (the zone has moved with the mode; nothing here remembers the
      // overview's coordinates).
      const fromLobby = this.voteSource === 'lobby';
      const sourceFigure = fromLobby ?
        root.querySelector<HTMLElement>(`[data-parl-seat-lobby="${color}"] .player-delegate`) :
        root.querySelector<HTMLElement>(`[data-parl-seat-reserve="${color}"] .con-parl__stack-cube:last-child .player-delegate`);
      const place = root.querySelector<HTMLElement>(`.con-parl__slot[data-instance] [data-seq="${seq}"]`);
      // The proxy lands on the FIGURE's own box — the ribbon's place is a wider footprint box drawn around it.
      const target = place?.querySelector<HTMLElement>('.player-delegate') ?? place;
      if (sourceFigure === null || target === null || target === undefined) {
        return false;
      }
      const fr = sourceFigure.getBoundingClientRect();
      const tr = target.getBoundingClientRect();
      if (fr.width < 2 || tr.width < 2) {
        return false;
      }
      const from: Rect = {left: fr.left, top: fr.top, width: fr.width, height: fr.height};
      const to: Rect = {left: tr.left, top: tr.top, width: tr.width, height: tr.height};
      const id = nextFlightId('vote');
      const size = Math.round(fr.height);
      pushCubeFlight({id, color, size});
      void this.$nextTick(() => {
        const proxy = flightEl(id);
        if (proxy === null || proxy === undefined) {
          dropFlight(id);
          // This cube's source lets go of exactly ONE figure (a phrase's other cubes may still be standing on it).
          this.releaseOneSource();
          f.flightSeq = undefined;
          onLanded();
          return;
        }
        const handle = runDelegateFlight({
          proxy,
          from,
          to,
          // The distance sets the tempo (`delegateFlightMs`); VOTE_FLIGHT_MS stays the
          // nominal figure the landing hold is budgeted against.
          durationMs: undefined,
          onLifted: () => {
            // The proxy stands exactly over the source figure: THAT figure may vanish now (the next one, if any, stays).
            f.sourceHoldCount = Math.max(0, f.sourceHoldCount - 1);
            if (f.sourceHoldCount === 0) {
              f.sourceHold = undefined;
            }
          },
          onDeparted: () => {
            // The figure has visibly left its place: the footprint's note / the pile's count may say so now.
            f.sourceLeavingCount = Math.max(0, f.sourceLeavingCount - 1);
            if (f.sourceLeavingCount === 0) {
              f.sourceLeaving = undefined;
            }
          },
          onLanded: () => {
            f.flightSeq = undefined;
            // ONE hold over the phrase: it lets go with the last cube in the air.
            this.cubesInAir = Math.max(0, this.cubesInAir - 1);
            if (this.cubesInAir === 0) {
              this.flightHold?.release();
              this.flightHold = undefined;
            }
            onLanded();
            probeTick(() => dropFlight(id));
          },
        });
        registerFlightHandle(id, handle);
        this.cubesInAir++;
        if (this.flightHold === undefined) {
          this.flightHold = beginAnimationHold('parliament-vote-flight', {maxHoldMs: 4000});
        }
      });
      return true;
    },
    beginLanding(seq: number): void {
      // THE READ TURNS ONCE (P72 · CZ): the lead / «принимается» held their pre-vote reading through every touchdown
      // (`tallyShownOf` / `winningShownOf` read the snapshot while in flight) and turn HERE, after the last cube —
      // marked once when the lead became the viewer's.
      const snap = parliamentFlow.voteSnapshot;
      const slot = this.voteSlot;
      const me = this.viewerColor;
      parliamentFlow.leadTurned = snap !== undefined && slot !== undefined && me !== undefined && snap.leader !== me && slot.leader === me ?
        slot.instance : undefined;
      parliamentFlow.landedSeq = seq;
      if (!parliamentFlow.landedSeqs.includes(seq)) {
        parliamentFlow.landedSeqs = [...parliamentFlow.landedSeqs, seq];
      }
      parliamentFlow.pendingSeqs = [];
      this.flightHold?.release();
      this.flightHold = undefined;
      this.landingBeat?.kill();
      // The landed READ — a beat on the motion clock (never a wall-clock timer).
      this.landingBeat = scheduleParliamentBeat(VOTE_LANDING_MS, () => this.finishLanding());
    },
    finishLanding(): void {
      this.landingBeat?.kill();
      this.landingBeat = undefined;
      if (parliamentFlow.stage !== 'landed') {
        this.clearLanding();
        return;
      }
      // The flow is over: the landed reading has been READ, and the WHOLE surface leaves as ONE motion — the
      // shell's ONE guarded conclusion pops the frame and the surface-motion director dissolves the root with
      // the vote layer, the cards and the zone inside it (v2, § Б5: a separate fade of the layer before the
      // frame left a frame with an empty body under a live crumb). The counters keep the landed reading
      // until the unmount (`landedSeq` stands); the fit stays frozen through the leave.
      // …UNLESS THIS DELEGATE WON A PARTY'S EFFECT: the hall plays that moment before the flow leaves (the access scene).
      const won = parliamentFlow.accessExpected;
      if (won !== undefined && this.view.viewer?.access.some((a) => a.party === won && a.hasEffect) === true) {
        this.playAccessScene(won);
        return;
      }
      this.landingHold?.release();
      this.landingHold = undefined;
      if (this.continueSeriesInPlace()) {
        return;
      }
      this.$emit('flow-complete', 'vote');
    },
    /**
     * A SERIES OF GRANTS IS ONE VISIT (P70 Colonial Envoys — `grantSeries.ts`): the landed cube was decision k, and the
     * prompt standing NOW is decision k + 1 of the same giver. The flow does not end — nothing folds, nothing unfolds:
     * the mode returns to its selection ON THE SPOT (the cursor stays on the resolution the cube just landed on, the
     * forecast and the reserve read the new model), past the commit (B «Свернуть» parks the whole series; A from the
     * board brings back the same decision). Each decision keeps its own A — nothing is glued to the next.
     */
    continueSeriesInPlace(): boolean {
      const f = parliamentFlow;
      const next = this.bridge.grant;
      if (next === undefined || next.staged === true || !grantContinuesSeries(f.voteSnapshot?.series, next.model)) {
        return false;
      }
      this.clearLanding();
      f.voteSnapshot = undefined;
      f.accessExpected = undefined;
      f.accessParty = undefined;
      f.accessBeat = '';
      this.resetSubject();
      freezeParliamentFit(false);
      setWorkspaceFramePhase('parliament', 'committed');
      if (f.stage === 'access') {
        // The access scene let the vote layer go: the next decision is OPENED again in the same chamber (one phrase).
        f.stage = 'browse';
        void this.$nextTick(() => {
          this.openVote({index: f.slotIndex});
          setWorkspaceFramePhase('parliament', 'committed');
        });
        return true;
      }
      f.stage = 'vote';
      return true;
    },
    /**
     * THE ACCESS SCENE (the owner, 2026-10-25: «момент, когда игрок располагает второго делегата в партию и получает её
     * эффект — workspace просто закрывается и игрок получает слабую нотификацию; надо, чтобы получение эффекта партии
     * обыгрывалось на самом workspace … и связь визуально с тем делегатом»). Four beats on the motion clock, one hold
     * over all of them (the feed waits; the input is absorbed — the frame's phase is a beat in flight):
     *   COUNT  — the viewer's delegates on the bill are touched by the count (the recount's mark): «these two won it»;
     *   RETURN — the vote layer lets go of the chamber (the same phrase B plays), «ВАШИ ЭФФЕКТЫ» stands on screen with
     *            the new tile's place reserved;
     *   FLIGHT — the party's SEAL is born on the delegate that crossed the threshold and travels into that place;
     *   LANDED — the tile unfolds, the zone's head says «Эффект партии получен», the party's bench answers; a read;
     * then the flow leaves as ever. The crumb's tail names the stage («… › ГОЛОСОВАНИЕ › ЭФФЕКТ ПАРТИИ»).
     */
    playAccessScene(party: ReduxParty): void {
      const f = parliamentFlow;
      f.accessParty = party;
      f.accessBeat = 'count';
      setWorkspaceFramePhase('parliament', 'executing');
      this.accessHold = beginAnimationHold('parliament-access-scene', {maxHoldMs: 9000});
      this.landingHold?.release();
      this.landingHold = undefined;
      this.accessBeatHandle = scheduleParliamentBeat(ACCESS_COUNT_MS, () => this.accessReturn());
    },
    accessReturn(): void {
      const f = parliamentFlow;
      if (f.accessParty === undefined) {
        return;
      }
      f.accessBeat = 'return';
      const root = parliamentRootEl();
      freezeParliamentFit(false);
      this.resetSubject();
      f.sourceHold = undefined;
      f.sourceLeaving = undefined;
      let flown = false;
      const fly = () => {
        if (!flown) {
          flown = true;
          this.accessFly();
        }
      };
      if (root === undefined || this.sceneHandedOver) {
        f.stage = 'access';
        restoreParliamentBody(root);
        void this.$nextTick(fly);
        return;
      }
      // The same leave B plays (measure the vote layout, let the slots go home, animate them from where they were) —
      // into the scene's own stage, which the hall paints as the chamber with no cursor and which absorbs every press.
      killParliamentVoteMotion(root);
      const before = measureVoteRects(root, {viewer: this.viewerColor, mode: 'vote'});
      f.voteLeaving = true;
      f.stage = 'access';
      void this.$nextTick(() => {
        fitParliamentCards();
        playParliamentVoteLeave({
          root,
          viewer: this.viewerColor,
          before,
          done: () => {
            f.voteLeaving = false;
            fly();
          },
        });
      });
      // A leave that never reports its end (nothing measurable) must not strand the scene.
      this.accessBeatHandle = scheduleParliamentBeat(ACCESS_RETURN_GUARD_MS, fly);
    },
    accessFly(): void {
      const f = parliamentFlow;
      const party = f.accessParty;
      if (party === undefined) {
        return;
      }
      f.accessBeat = 'flight';
      void this.$nextTick(() => {
        const root = parliamentRootEl();
        const seq = f.landedSeq;
        const from = root === undefined || seq === undefined ? undefined : placeFigureRect(root, `.con-parl__slot[data-instance] [data-seq="${seq}"]`);
        const to = rectOf(root?.querySelector(`.con-parl__effects-row[data-party="${party}"] .con-parl__effects-seal`));
        flyAccessSeal({from, to, emblemUrl: partyEmblemUrl(party), onLanded: () => this.accessLanded()});
      });
    },
    accessLanded(): void {
      const f = parliamentFlow;
      if (f.accessParty === undefined || f.accessBeat === 'landed' || f.accessBeat === 'done') {
        return;
      }
      f.accessBeat = 'landed';
      this.accessBeatHandle?.kill();
      this.accessBeatHandle = scheduleParliamentBeat(ACCESS_READ_MS, () => this.accessDone());
    },
    accessDone(): void {
      const f = parliamentFlow;
      if (f.accessParty === undefined) {
        return;
      }
      // The tile, the head and the counted delegates KEEP their landed reading through the leave (the surface leaves
      // frozen and whole — law 13); the flow's reset clears them with the rest of the flow.
      f.accessBeat = 'done';
      this.accessHold?.release();
      this.accessHold = undefined;
      disarmAccessToldOnStage();
      if (this.continueSeriesInPlace()) {
        return;
      }
      this.$emit('flow-complete', 'vote');
    },
    clearLanding(): void {
      this.landingBeat?.kill();
      this.landingBeat = undefined;
      this.grantBeats.forEach((beat) => beat.kill());
      this.grantBeats = [];
      this.cubesInAir = 0;
      dropFlightsWithPrefix('vote');
      this.supportFlights.forEach((id) => dropFlight(id));
      this.supportFlights = [];
      this.flightHold?.release();
      this.flightHold = undefined;
      this.landingHold?.release();
      this.landingHold = undefined;
      const f = parliamentFlow;
      f.supportHeld = 0;
      f.supportLanded = 0;
      f.landedSeq = undefined;
      f.landedSeqs = [];
      f.leadTurned = undefined;
      f.flightSeq = undefined;
      f.pendingSeqs = [];
      f.sourceHold = undefined;
      f.sourceLeaving = undefined;
      f.sourceHoldCount = 0;
      f.sourceLeavingCount = 0;
      dropFlightsWithPrefix('price');
      f.priceStage = 'none';
      this.accessBeatHandle?.kill();
      this.accessBeatHandle = undefined;
      this.accessHold?.release();
      this.accessHold = undefined;
      dropFlightsWithPrefix('access-seal');
    },
  },
});
</script>
