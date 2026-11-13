<template>
  <div ref="root" class="con-parl__vote"
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
                <!-- THE HEAD LINE — THE KICKER NAMES THE SUBJECT, ONCE: «ДЛЯ ВАС ПРИ ПРИНЯТИИ», or another
                     seat by its CUBE and its name. Everything below speaks in the third person and repeats
                     no name — and the block drops the cyan «mine» register, so a rival's number can never be
                     read as the player's own. -->
                <!-- THE SEATS — the ledger of outcomes as the reading's TABS, on a row of their own at the plate's top
                     (P77 · DH): on the kicker's line its digits were a .5rem smudge beside their cubes. Inside the plate,
                     so a row that wraps on one card and not on the next moves the plate's CONTENT, never its box (the
                     stability law). Reserved for the table, never the card: one seat compares nothing (law 21). -->
                <div v-if="seatsRowReserved || ledgerShown" class="con-parl__info-seats">
                  <ConsoleVoteLedger class="con-parl__info-ledger-row" :chips="voteLedger" :subject="voteSubject" :cubeLogicalPx="16" />
                </div>
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
                </div>
                <div class="con-parl__info-own-body">
                  <!-- («Зал» v7, Ф4: the card's PRINTED graphic is on the bill itself, a size up right above this
                       plate — the reading no longer repeats it; the formula → number plate alone is the reading.) -->
                  <div v-if="voteInfo.reading.yields.length > 0 || voteInfo.reading.grant !== undefined || voteInfo.reading.standing !== undefined || voteInfo.veto !== undefined || ledgerShown" class="con-parl__info-readings" data-parl-vote-late>
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
                    <!-- WHO THE VETO BINDS (RX42 UNMI Veto) — «as if enacted now», the server's live leaders, the subject
                         named «you» where it is one of them: the warning stands BEFORE the vote, in the law's register. -->
                    <span v-if="voteInfo.veto !== undefined" class="con-parl__info-veto" data-parl-vote-veto :data-parl-vote-veto-kind="voteInfo.veto.kind">
                      <i class="con-parl__info-veto-icon resource_icon resource_icon--rating" aria-hidden="true"></i>
                      <span class="con-parl__info-veto-text">{{ vetoText(voteInfo.veto) }}</span>
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
                    <!-- WHILE ENACTED (P77 · DH): what the law gives the seat for as long as it stands — an action's price
                         and count at the seat's influence, a passive's number by its term, or the law's rule. Under a
                         payout it names itself («ПОКА ПРИНЯТА»); a law that pays nothing at the enactment speaks through
                         it alone, at the plate's voice size (the owner's frame: Trade Industries over an empty plate). -->
                    <ConsoleLawStanding v-if="voteInfo.reading.standing !== undefined"
                                        class="con-parl__info-standing"
                                        :standing="voteInfo.reading.standing"
                                        :person="voteInfo.reading.person" />
                  </div>
                </div>
              </div>
              <!-- THE TABLE — what the card does to the WORLD, OUTSIDE «для вас»: it has no recipient (the first player
                   removes an ocean for everybody; the planet's parameters move for everybody) and never enters the
                   seat's net. Data-driven: a declaration that takes a tile off the board (`reading.removal`) or moves a
                   parameter (`reading.worldMoves` — Gas Export, Heat Capture). The law's standing effect is the seat's
                   «пока принята» inside the reading (P77 · DH), never a second row here. -->
              <div v-if="voteInfo.reading.removal !== undefined || voteInfo.reading.worldMoves !== undefined" class="con-parl__info-law" data-parl-vote-item data-parl-info="law" data-parl-vote-late>
                <div class="con-parl__info-law-row con-parl__info-law-row--world" data-parl-vote-world>
                  <span class="con-parl__info-kicker con-parl__info-law-kicker">{{ $t('The table') }}</span>
                  <template v-if="voteInfo.reading.removal !== undefined">
                    <span class="con-parl__info-law-line">
                      <i class="wgt-icon wgt-icon--ocean con-parl__info-law-icon" aria-hidden="true"></i>
                      <span class="con-parl__info-law-text">{{ $t(removalSummaryKey) }}</span>
                    </span>
                    <span class="con-parl__info-law-note" data-parl-vote-world-note>{{ $t(removalNoteKey) }}</span>
                  </template>
                  <span v-if="voteInfo.reading.worldMoves !== undefined" class="con-parl__info-law-line con-parl__info-law-moves">
                    <span v-for="move in voteInfo.reading.worldMoves" :key="move.parameter" class="con-parl__info-law-move" :data-parl-world-move="move.parameter" :data-parl-world-steps="move.steps">
                      <i class="wgt-icon con-parl__info-law-icon" :class="'wgt-icon--' + worldIcon(move.parameter)" aria-hidden="true"></i>
                      <b class="con-parl__info-law-steps" :class="{'con-parl__info-law-steps--down': move.steps < 0}">{{ signed(move.steps) }}</b>
                    </span>
                  </span>
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
              <!-- THIS VOTE'S CONSEQUENCES (P77 · DH «ФАКТЫ — ОБЪЕКТЫ»): one row of TILES of one height — the leader as a
                   cube (an empty socket where nobody leads yet), the vote as a crown, the party effect as its sockets —
                   current → projected, a fact that does not change ONE value; the party effect only on the edge this
                   delegate crosses. The tiles take the zone's height: the block is the vote zone's body, never a strip
                   floating over a void. The count is the ribbon under the card; every note is the inspector's. -->
              <div class="con-parl__info-block con-parl__info-block--after" :class="{'con-parl__info-block--done': flow.stage === 'landed'}" data-parl-vote-item data-parl-vote-forecast>
                <div class="con-parl__facts con-parl__facts--tiles">
                  <ConsoleVoteFactRow v-for="fact in voteInfo.vote.facts" :key="fact.id" :fact="fact" :figurePx="figurePx(22)" variant="tile" data-parl-vote-late />
                </div>
              </div>
            </div>
          </transition>
        </div>
        <!-- A paid vote's PAYMENT stands here, inside the mode. -->
        <div class="con-parl__embed" data-embed-slot="parliament-vote"></div>
        <!-- THE FOOT — where the delegate leaves from, and the confirm as a PLATE (P77 · DH): one line, the source
             quiet at the left (the cube, «из резерва · 5 M€» / «из лобби · бесплатно» / «×2 из резерва · бесплатно»
             — no «ВАШ ГОЛОС» kicker: the crumb and the bar already say ГОЛОСОВАНИЕ; the words stay the line's
             label for assistive tech), the plate at the right, sized by its words. -->
        <div class="con-parl__info-foot">
          <div class="con-parl__info-foot-src" data-parl-vote-item>
            <div v-if="voteInfo !== undefined" class="con-parl__info-src" :class="{'con-parl__info-src--none': voteInfo.vote.source === 'none'}"
                 :aria-label="$t(voteInfo.vote.kicker)" data-parl-vote-source>
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
            <div v-if="voteInfo !== undefined && voteInfo.vote.receipt !== undefined" class="con-parl__info-receipt" data-parl-vote-receipt data-parl-vote-late
                 :data-receipt-cost="voteInfo.vote.receipt.amount" :data-receipt-icon="voteInfo.vote.receipt.icon">
              <span class="con-parl__info-receipt-key">{{ $t(cardDoorReceipt) }}</span>
              <span class="con-parl__info-src-sep" aria-hidden="true">·</span>
              <b class="con-parl__info-src-num">{{ voteInfo.vote.receipt.amount }}</b>
              <i class="con-parl__info-src-mc" :class="receiptIconClass" aria-hidden="true" data-parl-vote-receipt-icon></i>
            </div>
          </div>
          <!-- THE CONFIRM — a PLATE sized by its words: the A glyph, the verb, and the price on the plate's own
               attribute (the source line says it once). «Ready» is a kant and a weight, never a fill across the
               panel; blocked, the plate carries the ONE reason. -->
          <div class="con-parl__cta"
               :class="{
                 'con-parl__cta--ready': canVoteNow && flow.stage === 'vote',
                 'con-parl__cta--blocked': !canVoteNow && flow.stage === 'vote',
                 'con-parl__cta--busy': flow.stage === 'submitting' || flow.stage === 'paying' || (flow.stage === 'landed' && (voteInFlight || supportInFlight)),
                 'con-parl__cta--done': (flow.stage === 'landed' && !voteInFlight && !supportInFlight) || flow.stage === 'access',
               }"
               data-parl-vote-item data-parl-cta @click="submitVote()">
            <GamepadGlyph v-if="flow.stage === 'vote' && canVoteNow" control="confirm" class="con-parl__cta-glyph" />
            <span class="con-parl__cta-label">{{ ctaText }}</span>
            <span v-if="flow.stage === 'vote' && canVoteNow && ctaCost.kind !== 'none'" class="con-parl__cta-cost con-parl__cta-cost--silent" data-parl-cta-cost :data-cost-kind="ctaCost.kind" :data-cost-amount="ctaCost.kind === 'free' ? 0 : ctaCost.amount" aria-hidden="true"></span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
<script setup lang="ts">
/*
 * ══ THE VOTE MODE — the frame's PHASE DESCENT, as a layer over the body.
 * Always mounted (it is the teleport target of the three slots — a target
 * that exists before the slots do); visible while the mode stands. The
 * head line above (crumb + delegates zone) does not move. ══
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, onUpdated, PropType, ref, useTemplateRef, watch} from 'vue';
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
import ConsoleLawStanding from '@/client/components/console/parliament/ConsoleLawStanding.vue';
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
import {$t, translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {COLONY_TRACK_SUMMARY_KEY} from '@/client/console/parliament/colonyTrackModel';
import {TILE_REMOVAL_COST_NOTE_KEY, TILE_REMOVAL_SUMMARY_KEY} from '@/client/console/parliament/tileRemovalModel';
import {offTurnReason} from '@/client/console/offTurnReason';
import {getCard} from '@/client/cards/ClientCardManifest';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {cardResourceKey, isStandardResource} from '@/client/console/resourceTransfer/resourceTransferModel';
import {StagedReceipt} from '@/client/console/stagedPlay';
import {afterCommitImpulse} from '@/client/console/consoleActionCommit';
import {flyStagedVotePrice} from '@/client/console/consoleActionCommitRail';
import {stagedDoorVerb} from '@/client/console/parliament/parliamentCommands';
import {probeTick} from '@/client/console/probeTick';
import {StandingStock} from '@/client/console/parliament/lawStandingModel';
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
 * ×1.8, and the measurement still decides (a reading that does not stand whole at a step never takes it). Below ×1 two
 * last steps (P77 · DH): a reading taller than its frame at ×1 (a colony ledger on the Deck, where the seats' row took a
 * line) yields a step of scale rather than being cut — the smallest step is the floor when none stands whole.
 */
const READING_FIT_STEPS: ReadonlyArray<number> = [1.8, 1.65, 1.5, 1.35, 1.2, 1.1, 1, 0.92, 0.85];

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
defineOptions({name: 'ConsoleParliamentVoteMode'});
const props = defineProps({
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
});
const emit = defineEmits(['notice', 'inspect', 'send', 'flow-complete']);

const root = useTemplateRef<HTMLElement>('root');
const supportKicker = SUPPORT_KICKER;
const cardDoorSource = CARD_DOOR_SOURCE;
const cardDoorReceipt = CARD_DOOR_RECEIPT;
/** The neutral cubes' flights of the running landing (dropped with it). */
let supportFlights: Array<string> = [];
let landingBeat: ParliamentBeat | undefined;
let landingHold: AnimationHold | undefined;
let flightHold: AnimationHold | undefined;
/** The grant's later cubes' launches (P72 · CZ — ONE phrase): killed with the landing. */
let grantBeats: Array<ParliamentBeat> = [];
/** The viewer's own cubes in the air right now — the flight hold stands while any is. */
const cubesInAir = ref(0);
/** THE ACCESS SCENE's own hold and its running beat (the count, the read). */
let accessHold: AnimationHold | undefined;
let accessBeatHandle: ParliamentBeat | undefined;
/**
 * A CONFIRM OWED BY THE ENTRANCE — the instance of the card an A pressed while the mode was still entering
 * (the double A through the card the player came in by). The entrance is hurried and the vote is sent the
 * moment it lands, on that card only: a ◀ ▶ after the press moves the selection and the owed press lapses.
 */
const confirmOwed = ref<string | undefined>(undefined);
/** The reading's own frame is watched for a change of ITS room (a profile, the panel) — the fit's other trigger. */
let readingRoomObserver: ResizeObserver | undefined;

/**
 * THE READING'S SIZE: the hall's panel is the chamber's whole rect (v8 § 5) — the one number reads at the
 * panel's own scale; the band of a hosted door keeps its compact pieces.
 */
const readingSize = computed((): 'compact' | 'normal' => {
  return consoleParliamentUi.hall ? 'normal' : 'compact';
});
const flow = parliamentFlow;
/** The card the vote mode is on — the cursor's slot. */
const voteSlot = computed((): ParliamentSlotVm | undefined => {
  return props.view.slots[parliamentFlow.slotIndex];
});
const voteUp = computed((): boolean => {
  return parliamentVoteUp();
});
const voteCommitted = computed((): boolean => {
  return voteUp.value && parliamentFlow.stage !== 'vote';
});
const voteSource = computed((): BenchSource => {
  return voteSourceOf(props.view, parliamentFlow.voteSnapshot, props.voteTile);
});
const voteInFlight = computed((): boolean => {
  return parliamentVoteInFlight();
});
/** A grant's neutral delegates are still on their way to the party's places. */
const supportInFlight = computed((): boolean => {
  return parliamentSupportInFlight();
});
/** A nested frame (the action workspace) took the scene — this screen yields and waits. */
const sceneHandedOver = computed((): boolean => {
  return workspaceFrameHasNested('parliament');
});
/**
 * THE DELEGATES THIS PRESS SENDS: one for the vote; a GRANT's count while
 * its prompt stands, and — past the submit, when that prompt is gone — the
 * count the SNAPSHOT remembered (the landing flies exactly that many).
 */
const voteCount = computed((): number => {
  return parliamentFlow.voteSnapshot?.count ?? props.bridge.grant?.count ?? 1;
});
/** The vote mode serves a DELEGATE GRANT (Turmoil Redux — the Venus tile), not the player's vote. */
const grantUp = computed((): boolean => {
  return props.bridge.grant !== undefined;
});
const grantSourceText = computed((): string => {
  return translateTextWithParams('${0} from the reserve · free', ['×' + String(voteCount.value)]);
});
/**
 * THE DOOR IS STAGED (a card that places a delegate by being played — TR03): nothing has been sent,
 * A is the play's own commit and B walks back to the composer. Past the press the snapshot remembers
 * nothing of it — the door is then simply «a card's», live or landing.
 */
const stagedDoor = computed((): boolean => {
  return props.bridge.grant?.staged === true && parliamentFlow.voteSnapshot === undefined;
});
/** The delegate is placed by a CARD (its own play, staged or met live) — the source line says so, through the landing too. */
const cardDoor = computed((): boolean => {
  return parliamentFlow.voteSnapshot?.door === 'card' || (parliamentFlow.voteSnapshot === undefined && props.bridge.grant?.card !== undefined);
});
/** The staged card door's receipt: the shell's before the press, the snapshot's through the landing; none once the card is paid (a live door). */
const receiptChip = computed((): StagedReceipt | undefined => {
  const snap = parliamentFlow.voteSnapshot;
  if (snap !== undefined) {
    return snap.receipt;
  }
  return stagedDoor.value ? props.cardReceipt : undefined;
});
/** The receipt's unit, drawn by the console's ONE icon resolver (M€ for a play, the card's resource for an action). */
const receiptIconClass = computed((): string => {
  return iconClassFor(voteInfo.value?.vote.receipt?.icon);
});
/**
 * THE SUPPORT ROW of the selected card's party: the press's own snapshot once it is made (the places
 * fill on the touchdowns, never on the packet), the SERVER's projection before it. Undefined when the
 * door pays no support — the block is not drawn at all.
 */
const supportRow = computed((): VoteSupportProjection | undefined => {
  const snap = parliamentFlow.voteSnapshot;
  if (snap !== undefined) {
    return snap.support;
  }
  const slot = voteSlot.value;
  return slot === undefined ? undefined : grantSupportOf(props.bridge.grant, slot.party);
});
/** The support block's tail, in words («+1 из 3 · предел области»; the bare «+3» when all of it lands). */
const supportTail = computed((): string => {
  const support = voteInfo.value?.support;
  return support === undefined ? '' : supportTailText(support, (key, params) => translateTextWithParams(key, params === undefined ? [] : [...params]));
});
const voteForecast = computed((): VoteForecastVm | undefined => {
  const slot = voteSlot.value;
  return slot === undefined ? undefined : voteForecastOf(slot, props.viewerColor, props.model?.viewer?.vote, voteCount.value);
});
/** The SELECTED card's reading — the info surface (`voteInfoModel` decides; this renders). */
const voteInfo = computed((): VoteInfoVm | undefined => {
  const slot = voteSlot.value;
  if (slot === undefined) {
    return undefined;
  }
  return voteInfoOf({
    slot,
    resolution: slot.resolution ?? getResolution(slot.resolutionId),
    model: props.model,
    subject: voteSubject.value,
    rival: subjectIsRival.value ? {name: nameOf(voteSubject.value)} : undefined,
    nameOf: (color: Color) => nameOf(color),
    subjectRating: props.playerView.players.find((p) => p.color === voteSubject.value)?.terraformRating,
    tableau: subjectTableau.value,
    // «While enacted» (P77 · DH): the subject's public stock (a value term), the viewer's hand by its printed tags (a discount).
    stock: subjectStock.value,
    hand: subjectIsRival.value ? undefined : props.playerView.thisPlayer !== undefined ?
      (props.playerView.cardsInHand ?? []).map((card) => getCard(card.name)?.tags ?? []) : undefined,
    name: resolutionTitleOf(props.view, slot.resolutionId),
    winning: winningShownOf(slot),
    source: props.benchSource,
    cost: ctaCost.value.amount,
    facts: voteFacts.value,
    numbers: voteNumbers.value,
    // A grant's block keeps saying «ваши делегаты» through the landing (the prompt is gone by then, the snapshot remembers).
    grant: grantUp.value || cardDoor.value || (parliamentFlow.voteSnapshot?.count ?? 1) > 1 ?
      {count: voteCount.value, card: cardDoor.value, receipt: receiptChip.value} :
      undefined,
    support: supportRow.value === undefined ? undefined : {row: supportRow.value, landed: parliamentFlow.supportLanded},
  });
});
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
const voteSubject = computed((): Color | undefined => {
  return parliamentVoteSubject(props.viewerColor);
});
/** The subject is ANOTHER seat: the reading speaks in the third person and drops the «mine» register. */
const subjectIsRival = computed((): boolean => {
  const subject = voteSubject.value;
  return subject !== undefined && subject !== props.viewerColor;
});
/** The SUBJECT's public stock of the two metals and their per-unit values (a value term's reading — Metal Research). */
const subjectStock = computed((): StandingStock | undefined => {
  const color = voteSubject.value ?? props.viewerColor;
  const p = color === undefined ? undefined : props.playerView.players.find((player) => player.color === color);
  return p === undefined ? undefined : {steel: p.steel, titanium: p.titanium, steelValue: p.steelValue, titaniumValue: p.titaniumValue};
});
/** The SUBJECT's public tableau — the holder law is read for the seat the reading is about. */
const subjectTableau = computed((): ReadonlyArray<{name: CardName}> => {
  const subject = voteSubject.value;
  if (subject === undefined || subject === props.viewerColor) {
    return props.playerView.thisPlayer.tableau;
  }
  return props.playerView.players.find((p) => p.color === subject)?.tableau ?? [];
});
const voteLedger = computed((): ReadonlyArray<LedgerChipVm> => {
  const slot = voteSlot.value;
  if (slot === undefined) {
    return [];
  }
  return voteLedgerOf({
    resolution: slot.resolution ?? getResolution(slot.resolutionId),
    model: props.model,
    viewer: props.viewerColor,
    players: props.playerView.players,
  });
});
/**
 * THE SEATS' ROW is RESERVED for the game, never for the card (P77 · DH): a table of two seats or more keeps the row
 * whatever the selected card pays — a card that pays nobody draws no chips, and a row that came and went with the
 * card moved the reading under a d-pad step (`console-parliament-stability`).
 */
const seatsRowReserved = computed((): boolean => {
  // Asked of the TABLE: any resolution up for the vote that draws the row reserves it for all of them.
  return props.view.slots.some((slot) => voteLedgerOf({
    resolution: slot.resolution ?? getResolution(slot.resolutionId),
    model: props.model,
    viewer: props.viewerColor,
    players: props.playerView.players,
  }).length > 1);
});
/** The row of seats stands only where it COMPARES — two seats or more (`ConsoleVoteLedger` draws nothing below). */
const ledgerShown = computed((): boolean => {
  return voteLedger.value.length > 1;
});
/**
 * THE RIVAL KICKER's words, split around the name: the key's own `${0}`
 * slot is where the CUBE and the NAME stand, so the line reads «ДЛЯ ▮ АННА
 * ПРИ ПРИНЯТИИ» in whatever word order the language puts them.
 */
const subjectKicker = computed((): {before: string, after: string} => {
  const rendered = translateText(voteInfo.value?.reading.kicker ?? '');
  const at = rendered.indexOf('${0}');
  if (at === -1) {
    return {before: rendered, after: ''};
  }
  return {before: rendered.slice(0, at), after: rendered.slice(at + 4)};
});
/** The world part's one sentence and its honest footnote (the removal family's own keys). */
const removalSummaryKey = TILE_REMOVAL_SUMMARY_KEY;
const removalNoteKey = TILE_REMOVAL_COST_NOTE_KEY;
/**
 * THE VOTE'S NUMBERS: before the submit, the live model and its
 * projection; from the submit to the landing, the SNAPSHOT (the counters
 * tick when the cube lands, not when the packet does); after the landing,
 * the live model on both sides.
 */
const voteNumbers = computed((): {votesBefore: number, votesAfter: number, mineBefore: number, mineAfter: number} => {
  const slot = voteSlot.value;
  const snap = parliamentFlow.voteSnapshot;
  if (slot === undefined) {
    return {votesBefore: 0, votesAfter: 0, mineBefore: 0, mineAfter: 0};
  }
  if (parliamentFlow.stage === 'landed' && snap !== undefined) {
    return {votesBefore: snap.votes, votesAfter: slot.totalVotes, mineBefore: snap.mine, mineAfter: slot.viewerVotes};
  }
  const count = voteCount.value;
  if (snap !== undefined) {
    return {votesBefore: snap.votes, votesAfter: snap.votes + count, mineBefore: snap.mine, mineAfter: snap.mine + count};
  }
  const f = voteForecast.value;
  return {
    votesBefore: slot.totalVotes, votesAfter: f?.votesAfter ?? slot.totalVotes + count,
    mineBefore: slot.viewerVotes, mineAfter: slot.viewerVotes + count,
  };
});
/** THIS VOTE's consequences — every fact as current → projected (`voteFactsOf`; the panel prints two, the inspector all). */
const voteFacts = computed((): VoteFactsVm => {
  const slot = voteSlot.value;
  const snap = parliamentFlow.voteSnapshot;
  const landed = parliamentFlow.stage === 'landed' || parliamentFlow.stage === 'access';
  return voteFactsOf({
    slot,
    party: props.view.parties.find((p) => p.party === slot?.party),
    viewer: props.viewerColor,
    forecast: voteForecast.value,
    snapshot: snap === undefined ? undefined : {leader: snap.leader, winning: snap.winning},
    landed,
    mineBefore: voteNumbers.value.mineBefore,
    mineAfter: landed ? (slot?.viewerVotes ?? voteNumbers.value.mineAfter) : voteNumbers.value.mineAfter,
    nameOf: (color: Color) => nameOf(color),
  });
});
const ctaText = computed((): string => {
  const several = voteCount.value > 1;
  switch (parliamentFlow.stage) {
  case 'submitting': return translateText('Performing…');
  case 'paying': return translateText('Pay for the delegate');
  // «placed» only once the cube has landed — the answer's arrival is not the delegate's.
  case 'landed': return translateText(voteInFlight.value || supportInFlight.value ? 'Performing…' : (several ? 'Delegates placed' : 'Delegate placed'));
  // The access scene's leave keeps the landed reading on the panel while it lets go of the chamber.
  case 'access': return translateText(several ? 'Delegates placed' : 'Delegate placed');
  default:
    if (!props.canVoteNow) {
      return voteBlockedText.value;
    }
    // A STAGED door's confirm is the FLOW's own commit — a play's «Разыграть карту», an action's «Подтвердить»:
    // the very verb the composer would have carried had the card asked nothing (one verb for one act).
    return translateText(stagedDoor.value ? stagedDoorVerb(props.stagedFlow) : (several ? 'Send the delegates' : 'Send the delegate'));
  }
});
const voteBlockedText = computed((): string => {
  const tile = props.voteTile;
  if (tile === undefined) {
    return translateText(props.viewerParticipates ? 'Not your turn — you can read the Parliament' : 'Not in this game');
  }
  if (!tile.available) {
    return reasonText(tile.reason);
  }
  return translateText(props.awaitingInput ? 'Finish your current action first' : 'Not your turn — you can read the Parliament');
});
/**
 * THE PRICE ON THE CONFIRM — from the SAME vote option the submit answers
 * (the server's source and cost; a standing bill's own cost outranks the
 * tile's): the lobby's delegate is free, the reserve's costs M€. Nothing
 * to send → no price line (the confirm carries the one reason).
 */
const ctaCost = computed((): CtaCost => {
  const source = props.benchSource;
  if (source === 'none') {
    return {kind: 'none', amount: 0};
  }
  // A delegate GRANT's cubes are free wherever they leave from.
  if (source === 'lobby' || grantUp.value) {
    return {kind: 'free', amount: 0};
  }
  return {kind: 'cost', amount: votePayment.value?.cost ?? props.voteTile?.cost ?? PARLIAMENT_VOTE_COST};
});
/** A paid vote's BILL stands — the server's own marker, never a title (the vote mode hosts it). */
const votePayment = computed((): VotePaymentMeta | undefined => {
  const wf = props.playerView.waitingFor;
  return wf?.type === 'payment' ? (wf as SelectPaymentModel).votePayment : undefined;
});
/**
 * THE BILL GEOMETRY (v2, § Б5) — ONLY while a payment panel REALLY stands
 * (the server's `votePayment` bill): the vote column widens to host it,
 * and NOTHING ELSE moves — the card row keeps its rows, the panel its
 * height (the bill rises out of the fixed panel as an overlay). A vote
 * from the reserve the server auto-pays raises no bill and changes no
 * geometry: from the press to the flow's end only text, the confirm's
 * state and the cube's flight change.
 */
const billGeometry = computed((): boolean => {
  return paymentStands.value && (parliamentFlow.stage === 'paying' || parliamentFlow.stage === 'submitting');
});
const paymentStands = computed((): boolean => {
  return votePayment.value !== undefined;
});

/**
 * THE READING SITS IN ITS FRAME (PL-785). «ДЛЯ ВАС ПРИ ПРИНЯТИИ» keeps ONE frame whatever the card (the stability
 * law — a one-row and a two-row reading draw the same box), so a short reading floated in its middle between two
 * empty bands. The reading now takes the frame's room: the largest step of the reading's own scale (×1 … ×1.5) at
 * which it still stands whole inside its body — measured, never assumed (each step laid out once, the first that
 * fits wins; a reading that fills the frame at ×1 stays ×1). The FRAME never moves; only its content's scale, and
 * only on a new card, subject or reading — the vote's committed geometry is frozen from A to the leave (law 8).
 */
function fitReading(): void {
  const rootNow = root.value;
  const body = rootNow?.querySelector?.<HTMLElement>('.con-parl__info-own-body') ?? null;
  const readings = body?.querySelector<HTMLElement>('.con-parl__info-readings') ?? null;
  if (body === null) {
    return;
  }
  const observer = readingRoomObserver;
  if (observer !== undefined && (body as HTMLElement & {__fitObserved?: boolean}).__fitObserved !== true) {
    observer.observe(body);
    // …and the plate whose room the fit reads (PL-766 — the body is content-sized in the hall).
    const plate = body.closest<HTMLElement>('.con-parl__info-own');
    if (plate !== null) {
      observer.observe(plate);
    }
    (body as HTMLElement & {__fitObserved?: boolean}).__fitObserved = true;
  }
  if (readings === null || voteCommitted.value) {
    return;
  }
  // Only the HALL's panel is a frame with room to fill; a hosted door's band (TR03 · TR15) keeps its compact reading.
  if (!consoleParliamentUi.hall) {
    readings.style.removeProperty('--con-parl-reading-fit');
    return;
  }
  // The ROOM is the plate's, not the body's: in the hall the body is content-sized (its group centred in the plate —
  // PL-766), so its own box would only ever say «as big as now». The plate's inner height less its head line.
  const bodyBox = body.getBoundingClientRect();
  const own = body.closest<HTMLElement>('.con-parl__info-own');
  const head = own?.querySelector<HTMLElement>('.con-parl__info-own-head') ?? null;
  // GROUPED (the body content-sized — the hall on TV / 1080) reads the plate; a body that keeps the room (the Deck) its own box.
  const grouped = typeof getComputedStyle === 'function' && getComputedStyle(body).flexGrow === '0';
  const room = own === null || own === undefined || !grouped ? bodyBox : (() => {
    const cs = getComputedStyle(own);
    const inner = own.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom);
    const headH = head === null ? 0 : head.getBoundingClientRect().height + parseFloat(cs.rowGap || cs.gap || '0');
    return {width: bodyBox.width, height: Math.max(0, inner - headH)};
  })();
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
  // …and the ROW never wraps to buy scale either (PL-766 · FG): the number and the party's answer beside it stand on
  // as many lines as they did at ×1 — a step that pushes the answer under the number («город» over «+2 M€ Зелёные»)
  // reads as two statements and is refused.
  const rowsOf = (): number => {
    const tops: Array<number> = [];
    for (const child of Array.from(readings.children) as Array<HTMLElement>) {
      const r = child.getBoundingClientRect();
      if (r.width === 0 && r.height === 0) {
        continue;
      }
      if (!tops.some((t) => Math.abs(t - r.top) < r.height / 2)) {
        tops.push(r.top);
      }
    }
    return tops.length;
  };
  readings.style.setProperty('--con-parl-reading-fit', '1');
  const natural = plates.map((plate) => plate.getBoundingClientRect().height);
  const naturalRows = rowsOf();
  // The party's answer stands BESIDE the number (its row's middle inside the number's box) — the reading's one line.
  const yieldEl = readings.querySelector<HTMLElement>('.con-parl__info-yield');
  const answers = Array.from(readings.querySelectorAll<HTMLElement>('.con-parl__info-reaction'));
  const answerBeside = (): boolean => {
    if (yieldEl === null || answers.length === 0) {
      return true;
    }
    const y = yieldEl.getBoundingClientRect();
    return answers.every((a) => {
      const r = a.getBoundingClientRect();
      const mid = (r.top + r.bottom) / 2;
      return mid >= y.top && mid <= y.bottom;
    });
  };
  const stands = (step: number, beside: boolean): boolean => {
    readings.style.setProperty('--con-parl-reading-fit', String(step));
    const r = readings.getBoundingClientRect();
    const whole = plates.every((plate, i) => plate.getBoundingClientRect().height <= natural[i] * step + 2) && (step <= 1 || rowsOf() <= naturalRows);
    // Nothing clipped: in the hall the PLATE is the judge (its whole content — the head, the reading and whatever
    // stands beside the reading in the body — inside its box); elsewhere the body's own room.
    const fitsTall = grouped && own !== null && own !== undefined ? own.scrollHeight <= own.clientHeight + 1 : r.height <= room.height - 1;
    return whole && (!beside || answerBeside()) && fitsTall && r.width <= room.width + 1 && readings.scrollWidth <= readings.clientWidth + 1;
  };
  // The answer BESIDE the number first, at whatever step it stands (down to the ladder's floor); only when no step
  // keeps it there does the reading take the largest step that stands whole with the answer under it.
  let fit = READING_FIT_STEPS[READING_FIT_STEPS.length - 1];
  const besideStep = READING_FIT_STEPS.find((step) => stands(step, true));
  if (besideStep !== undefined) {
    fit = besideStep;
  } else {
    fit = READING_FIT_STEPS.find((step) => stands(step, false)) ?? fit;
  }
  readings.style.transform = pose;
  readings.style.setProperty('--con-parl-reading-fit', String(fit));
  readings.dataset.fitKey = key;
  readings.dataset.readingFit = String(fit);
}
/** The FRESH entrance of a mode armed before the mount (see `onMounted`). */
/** An ARMED vote met by a mode already mounted (a warm section unveiled — P72 · CZ): the fresh entrance, as `onMounted` plays it. */
function enterArmedVote(): void {
  if (parliamentFlow.stage === 'vote' && parliamentFlow.voteEntering) {
    playFreshEntrance();
  }
}
function playFreshEntrance(): void {
  const f = parliamentFlow;
  void nextTick(() => {
    const root = parliamentRootEl();
    const selected = props.view.slots[f.slotIndex];
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
        flushOwedConfirm();
      },
    });
  });
}
/** «Все треки колоний +2» — the colony table's one line (Unity Budget). */
/** The veto's sentence (RX42) — its key with its params through the one i18n helper. */
function vetoText(veto: {key: string, params: ReadonlyArray<string>}): string {
  return translateTextWithParams(veto.key, [...veto.params]);
}
/** A counted holder's own kind — the icon its unit lands as. */
function holderUnitClass(resource: string): string {
  return iconClassFor(cardResourceKey(resource));
}
function signed(n: number): string {
  return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
}
/** A world move's parameter as the HUD draws it (the ocean count is the ocean glyph). */
function worldIcon(parameter: string): string {
  return parameter === 'oceans' ? 'ocean' : parameter;
}
/** The cards of ONE kind, translated, in play order — «Рыба · Птицы». */
function kindCardsText(cards: ReadonlyArray<CardName>): string {
  return cards.map((card) => translateText(card)).join(' · ');
}
/** The count's own noun, the line's lead — «3 вида ресурсов». */
function kindsTotalText(key: string, count: number): string {
  return translateTextWithParams(key, [String(count)]);
}
function tracksLabel(steps: number): string {
  return translateTextWithParams(COLONY_TRACK_SUMMARY_KEY, [String(steps)]);
}
function figurePx(logical: number): number {
  return delegateFigurePx(logical);
}
function emblemUrl(party: ReduxParty): string {
  return partyEmblemUrl(party);
}
function nameOf(color: Color | 'neutral' | undefined): string {
  return parliamentPlayerName(props.playerView.players, color);
}
function reasonText(reason: string | Message): string {
  return typeof reason === 'string' ? translateText(reason) : translateMessage(reason);
}
/**
 * A on the voting area: the frame DESCENDS into the vote mode (a phase,
 * not a frame — the overview is parked, its focus survives). The three
 * slots are measured where they stand, teleported into the vote row, and
 * the entrance FLIPs every carried object from the rect it just had.
 * The mode opens whether or not a vote is possible right now — comparing
 * the three proposals is its job too; the confirm carries the reason.
 */
function openVote(opts?: {fromViewer?: boolean, index?: number}): void {
  const root = parliamentRootEl();
  const f = parliamentFlow;
  if (props.view.slots.length === 0 || root === undefined) {
    emit('notice', translateText('Not in this game'));
    return;
  }
  if (voteUp.value || f.voteLeaving) {
    return;
  }
  if (opts?.index !== undefined) {
    f.slotIndex = opts.index;
  }
  f.slotIndex = Math.max(0, Math.min(props.view.slots.length - 1, f.slotIndex));
  const selected = props.view.slots[f.slotIndex];
  const plate = root.querySelector<HTMLElement>('.con-parl__voting');
  const pr = plate?.getBoundingClientRect();
  const press = pr === undefined || pr.width < 2 ? undefined : {x: pr.left + pr.width / 2, y: pr.top + pr.height / 2};
  // Measure BEFORE the layout changes — the overview's rects are the FLIPs' departures.
  const before = measureVoteRects(root, {press, viewer: props.viewerColor, mode: 'browse'});
  killParliamentVoteMotion(root);
  f.voteSnapshot = undefined;
  // The mode always OPENS on the viewer's own reading — a subject left over from a previous
  // visit would greet the player with somebody else's number under their own delegate.
  resetSubject();
  f.sourceHold = undefined;
  f.sourceLeaving = undefined;
  f.sourceHoldCount = 0;
  f.sourceLeavingCount = 0;
  f.zone = 'voting';
  f.stage = 'vote';
  f.voteEntering = true;
  descendWorkspaceFrame('parliament', 'Voting', '');
  void nextTick(() => {
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
        flushOwedConfirm();
      },
    });
  });
}
/** B before the commit: the same phrase folded back — every object returns home, the focus is where it was. */
function closeVote(): void {
  if (!voteUp.value) {
    return;
  }
  const root = parliamentRootEl();
  const f = parliamentFlow;
  clearLanding();
  freezeParliamentFit(false);
  f.voteSnapshot = undefined;
  // Nothing was won here (a B before the commit, a refused press): no gain is owed a scene.
  f.accessExpected = undefined;
  disarmAccessToldOnStage();
  resetSubject();
  f.sourceHold = undefined;
  f.sourceLeaving = undefined;
  f.voteEntering = false;
  confirmOwed.value = undefined;
  foldWorkspaceFrame();
  setWorkspaceFramePhase('parliament', 'browse');
  if (root === undefined || sceneHandedOver.value) {
    f.stage = 'browse';
    restoreParliamentBody(root);
    return;
  }
  // Measure the VOTE layout before the teleport home, then let the slots
  // go home and animate them from where they were.
  killParliamentVoteMotion(root);
  const before = measureVoteRects(root, {viewer: props.viewerColor, mode: 'vote'});
  f.voteLeaving = true;
  f.stage = 'browse';
  void nextTick(() => {
    fitParliamentCards();
    playParliamentVoteLeave({
      root,
      viewer: props.viewerColor,
      before,
      done: () => {
        f.voteLeaving = false;
      },
    });
  });
}
/** The vote mode's own verbs: ◀ ▶ select, LB/RB move the SUBJECT, A sends, X inspects (B — the section's, folds back). */
function handleIntent(intent: GamepadIntent): void {
  // LB/RB — «ИГРОКИ»: the subject of the READING walks the row of seats, the
  // viewer's chip being its home. It is a side step, not a level: ◀ ▶ keep
  // their meaning, the selection keeps its card, and A keeps its delegate.
  if (intent.kind === 'press' && (intent.button === 'bumperL' || intent.button === 'bumperR')) {
    cycleSubject(intent.button === 'bumperR' ? 1 : -1);
    return;
  }
  if (intent.kind === 'nav') {
    if (intent.dir === 'left') {
      selectVoteSlot(parliamentFlow.slotIndex - 1);
    } else if (intent.dir === 'right') {
      selectVoteSlot(parliamentFlow.slotIndex + 1);
    }
    return;
  }
  const action = consoleActionOf(intent);
  if (action === 'inspect') {
    inspect();
  } else if (action === 'primary') {
    // A press DURING the entrance is the player's second A on the card they came in by — a decision, never
    // dropped: the entrance is hurried to its end and the vote goes out as it lands (`flushOwedConfirm`).
    // (The press that OPENED the mode never reaches here — the overview consumed it.)
    if (parliamentFlow.voteEntering) {
      const slot = voteSlot.value;
      if (slot !== undefined && parliamentFlow.stage === 'vote') {
        confirmOwed.value = slot.instance;
        hurryParliamentVoteEnter(parliamentRootEl());
      }
      return;
    }
    submitVote();
  }
}
/**
 * THE OWED CONFIRM lands with the entrance: the selection is still the card the press was made on and the mode
 * still stands at its vote — then it is exactly the A the player pressed, the same submit and the same refusal.
 */
function flushOwedConfirm(): void {
  const owed = confirmOwed.value;
  confirmOwed.value = undefined;
  if (owed === undefined || !voteUp.value || parliamentFlow.stage !== 'vote' || voteSlot.value?.instance !== owed) {
    return;
  }
  submitVote();
}
/**
 * THE INSPECTOR — X on the selected card. Inside the vote mode it opens
 * the viewer over ALL THREE cards (LB/RB browse them, the cursor follows)
 * and offers the A verb that sends the delegate to the card shown; a bill
 * standing or a delegate in flight binds the viewer to ONE card.
 */
function inspect(): void {
  const root = parliamentRootEl();
  const slots = props.view.slots;
  const selected = voteSlot.value;
  if (selected === undefined) {
    return;
  }
  if (parliamentFlow.stage !== 'vote') {
    // A bill standing or a delegate in flight belongs to ONE card: the
    // viewer reads that card alone, and nothing in it can move the
    // selection the transaction is bound to.
    const single: ParliamentInspectRequest = {kind: 'resolution', ids: [selected.resolutionId], index: 0, origin: () => slotFaceOf(root, selected.instance)};
    emit('inspect', single);
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
    onBrowse: (index) => selectVoteSlot(index),
    vote: {
      verbAt: (index) => voteVerbAt(index),
      execute: (index) => sendVoteFromInspector(index),
    },
  };
  emit('inspect', request);
}
/**
 * MOVE THE SUBJECT one seat along the LEDGER's own order (the viewer first,
 * then the model's) — the very row the panel prints, so the cursor and the
 * chips can never disagree. The walk WRAPS: the row is a ring of seats, not
 * a list with edges, and the viewer's own chip is always one step away.
 */
function cycleSubject(step: number): void {
  const order = voteLedger.value.map((chip) => chip.color);
  if (order.length < 2) {
    return;
  }
  const at = Math.max(0, order.indexOf(voteSubject.value ?? order[0]));
  const next = order[(at + step + order.length) % order.length];
  // The viewer's own seat is stored as «no subject»: one state for «this is my reading».
  parliamentFlow.voteSubject = next === props.viewerColor ? undefined : next;
}
/** The reading is the VIEWER's again — the mode's own boundaries (open, commit, close) and a seat that left the table. */
function resetSubject(): void {
  parliamentFlow.voteSubject = undefined;
}
/** Select the vote mode's card (the d-pad inside the mode, the viewer's paging). */
function selectVoteSlot(index: number): void {
  // The crumb stays «Голосование»: the selection is named by the surface, never by the head line.
  parliamentFlow.slotIndex = Math.max(0, Math.min(props.view.slots.length - 1, index));
}
/**
 * «Send the delegate» for the card at `index`, as THIS mode reads it — the
 * same option, source, price and blocked text its own confirm uses.
 */
function voteVerbAt(index: number): VoteVerbVm | undefined {
  const slot = props.view.slots[index];
  if (slot === undefined || parliamentFlow.stage !== 'vote') {
    return undefined;
  }
  const tile = props.voteTile;
  // A GRANT (live or staged) is the decision standing on this very screen:
  // what it offers is ITS prompt's parties, and the viewer's action window
  // is not its gate (`canVoteNow` — the mode's own confirm reads the same).
  const grant = props.bridge.grant;
  return voteVerbOf({
    participates: props.viewerParticipates,
    tile,
    refusalText: tile === undefined || tile.available ? '' : reasonText(tile.reason),
    offered: grant !== undefined || props.bridge.vote !== undefined,
    canActNow: grant !== undefined ? props.canVoteNow : props.canActNow,
    offeredParties: (grant ?? props.bridge.vote)?.model.parties,
    party: slot.party,
    turnText: translateText(offTurnReason(props.awaitingInput)),
    notOfferedText: translateText('This option is no longer offered'),
    door: grant === undefined ? undefined : (grant.staged === true ? 'card' : 'grant'),
  });
}
/**
 * The inspector's A, after the viewer has flown back into the card's slot:
 * the card it showed becomes the mode's selection and the mode's own
 * submit runs — the same snapshot, the same answer handling, the same
 * delegate flight. A refusal speaks through the same notice.
 */
function sendVoteFromInspector(index: number): void {
  if (parliamentFlow.stage !== 'vote') {
    return;
  }
  selectVoteSlot(index);
  submitVote();
}
// ── the submit (byte-identical to the live prompt) ─────────────────
function submitVote(): void {
  const slot = voteSlot.value;
  if (slot === undefined || parliamentFlow.stage !== 'vote') {
    return;
  }
  if (!props.canVoteNow) {
    emit('notice', voteBlockedText.value);
    return;
  }
  // A GRANT's cubes leave the RESERVE, however the bench reads otherwise (the lobby's cube is the free vote and stays).
  const grant = props.bridge.grant;
  const source = grant !== undefined ? 'reserve' : (props.benchSource === 'none' ? 'lobby' : props.benchSource);
  // THE COMMIT BOUNDARY is the viewer's own: the cube, the counters and «Делегат поставлен» are
  // about them, so the reading comes home before the beat that shows it.
  resetSubject();
  // Read BEFORE the snapshot stands (they switch to it the moment it does): the door's own facts, remembered
  // through the landing — the prompt that stated them is gone with the answer.
  const support = supportRow.value;
  const receipt = receiptChip.value;
  const byCard = cardDoor.value;
  // A decision of a SERIES (P70): which one, and whose — the mode stands through the rest of it.
  const series = grant !== undefined && grant.staged !== true ? grantSeriesKeyOf(grant.model) : undefined;
  // An ACTION's price on the RAIL (T07's 3 M€) is the commit's own token, flown before the cube; a card's resource
  // (TR15's data) is this mode's price token; a play's M€ is the payment's business.
  const railPrice = byCard && stagedDoor.value && props.stagedFlow === 'action' && receipt !== undefined && isStandardResource(receipt.icon);
  parliamentFlow.supportHeld = 0;
  parliamentFlow.supportLanded = 0;
  parliamentFlow.grantDegraded = '';
  parliamentFlow.voteSnapshot = {
    votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, winner: props.winningSlot?.instance, source,
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
  const access = props.view.viewer?.access.find((a) => a.party === slot.party);
  const reaches = access !== undefined && !access.hasEffect && access.delegates + (grant?.count ?? 1) >= effectDelegatesOf(access);
  parliamentFlow.accessExpected = reaches ? slot.party : undefined;
  if (reaches) {
    armAccessToldOnStage(slot.party);
  }
  // FROM THE PRESS TO THE FLOW'S END nothing but text, the confirm's state and the cube's flight may change:
  // the card fit is FROZEN (a re-fit under the flight jumped the scene it measured — § Б5).
  freezeParliamentFit(true);
  // The grant answers its own stand-alone prompt; the vote answers its branch of the action menu.
  const response = grant !== undefined ? grantResponse(props.bridge, slot.party) : voteResponse(props.bridge, slot.party);
  emit('send', {response, from: 'vote'});
}
/** The server answered while the BILL stood: the paid delegate lands — or the payment was refused / the prompt moved on. */
function answerWhilePaying(): void {
  if (landVote()) {
    return;
  }
  if (!paymentStands.value) {
    // The payment was refused / the prompt moved on without a delegate.
    closeVote();
    emit('flow-complete', 'vote');
  }
}
/** The server answered the vote's submit: the delegate LANDS, or the bill is raised, or nothing was placed. */
function answerAfterSubmit(): void {
  if (landVote()) {
    return;
  }
  if (paymentStands.value) {
    parliamentFlow.stage = 'paying';
    setWorkspaceFramePhase('parliament', 'committed');
    return;
  }
  // RE-ASKED — the answer placed nothing and the GRANT itself stands live (a staged tail the server
  // dropped as stale; a grant raised again): this very mode BECOMES that door, in place — the selection
  // is kept, B is «Свернуть», the crumb stays past the commit. Never a close followed by an open.
  const grant = props.bridge.grant;
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
    const me = props.playerView.thisPlayer;
    const committed = card !== undefined && (props.stagedFlow === 'action' ?
      me.actionsThisGeneration.includes(card) : me.tableau.some((c) => c.name === card));
    if (grant?.staged === true && card !== undefined && !committed) {
      return;
    }
    emit('flow-complete', 'vote');
    return;
  }
  closeVote();
  emit('flow-complete', 'vote');
}
/**
 * THE DELEGATE FLIGHT + LANDING. The vote's answer is in the model: the
 * viewer's newest delegate on the selected card is the one that just
 * arrived. Its cube LEAVES the place it came from (the bench's lobby socket
 * or the top of the reserve stack — real, measured places), flies to its
 * place on the card's ribbon and lands there; the counters tick on the
 * landing. Returns false when the model shows no new delegate (a refusal,
 * a paid vote still owing its payment) — the caller decides what that means.
 */
function landVote(): boolean {
  const slot = voteSlot.value;
  const me = props.viewerColor;
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
    Math.max(0, Math.min(support.gained, (props.view.parties.find((p) => p.party === support.party)?.support ?? support.current) - support.current));
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
  const landingHoldNow = beginAnimationHold('parliament-vote-landing', {
    maxHoldMs: 4000 + stagger + 900 * supportLanded + (priced ? 900 : 0),
    // THE CEILING ENDS THE LANDING, not only its count: the cubes of the phrase stand where the model has them and
    // the landed read finishes by its own hand (`finishLanding` — the access scene, the series, or the leave).
    expire: () => {
      if (landingHold !== landingHoldNow || parliamentFlow.stage !== 'landed') {
        return;
      }
      console.warn('[parliament] vote landing: outlived its ceiling — ended');
      settleLandingNow();
    },
  });
  landingHold = markRaw(landingHoldNow);
  f.landedSeqs = [];
  f.flightSeq = seqs[0];
  f.pendingSeqs = seqs.slice(1);
  // The bench keeps painting the source cubes until each proxy stands over
  // its own, and keeps its WORDS until each has visibly left.
  f.sourceHold = snap.source;
  f.sourceLeaving = snap.source;
  f.sourceHoldCount = seqs.length;
  f.sourceLeavingCount = seqs.length;
  void nextTick(() => {
    flyPriceThenDelegates(seqs, me);
  });
  return true;
}
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
function flyPriceThenDelegates(seqs: ReadonlyArray<number>, me: Color): void {
  const f = parliamentFlow;
  const snap = f.voteSnapshot;
  const receipt = snap?.receipt;
  // A landing already ENDED (its ceiling's recovery, a clear) launches nothing: the landing hold stands from the
  // landing's start to its read's end, so its presence is this run's own «still landing».
  const launch = () => {
    if (landingHold !== undefined) {
      flyDelegates(seqs, me);
    }
  };
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
      launchPriceToken(receipt, me, launch);
    }
  });
}
/** The price token's flight itself (PL-100) — the receipt → the reserve stack, the cube's launch on its absorption. */
function launchPriceToken(receipt: StagedReceipt, me: Color, launch: () => void): void {
  const f = parliamentFlow;
  // The receipt's icon — the place the resource LEAVES (the card it is spent off is parked under this step).
  // (Asked of the document: there is ONE Parliament.)
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
}
/**
 * THE GRANT'S CUBES — ONE PHRASE (P72 · ledger CZ; the class: every grant N > 1). They used to fly strictly in turn
 * (the touchdown of one launched the next — a grant of 2 was two whole flights of waiting); now they leave the
 * reserve as ONE gesture on `grantCubeSchedule`: each starts a beat after the one before it (law 12's rhythm), flies
 * its OWN arc into its OWN place on the ribbon, the reserve ticks on each DEPARTURE, the ribbon and the counter on
 * each TOUCHDOWN — and the read (the lead, «принимается») turns ONCE, after the last. One flight keeps its own
 * length (the cube's law, §8). The later launches ride the motion clock (`scheduleParliamentBeat`), killed with
 * the landing; nothing measurable / reduced motion — the cubes are simply there.
 */
function flyDelegates(seqs: ReadonlyArray<number>, color: Color): void {
  const f = parliamentFlow;
  const settleAll = () => {
    f.sourceHold = undefined;
    f.sourceLeaving = undefined;
    f.sourceHoldCount = 0;
    f.sourceLeavingCount = 0;
    f.flightSeq = undefined;
    f.pendingSeqs = [];
    f.landedSeqs = [...seqs];
    flySupport(seqs[seqs.length - 1] ?? 0);
  };
  if (seqs.length === 0) {
    beginLanding(0);
    return;
  }
  const root = parliamentRootEl();
  const reduced = root === undefined || typeof window === 'undefined' || consoleReducedMotionActive();
  const schedule = reduced || root === undefined ? [] : grantCubeSchedule(seqs.map((seq, i) => cubeDistance(root, seq, i, color)));
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
      flySupport(seqs[seqs.length - 1]);
    }
  };
  // THE RHYTHM IS THE STACK'S (law 12 — the reserve the eye reads steps down per figure ≥ 90 ms apart). A cube
  // launches on TWO gates: its own beat of the schedule AND the previous figure's ACTUAL leave from the stack
  // (`onLifted` — the reserve's count stepping down) plus the same stagger. On a healthy frame both fall together;
  // on a starved one (a 4K software frame of 150 ms) the first figure's leave is painted a frame late while a beat
  // timed from the phrase's start fires on time — the two steps read 57 ms apart (CI 2026-11-03). The chained gate
  // moves the next cube with the frame that showed its predecessor leave, so the interval is a fact, not a hope.
  const gates = seqs.map((_, i) => ({scheduled: i === 0, chained: i === 0, launched: false, leftStack: false}));
  const tryLaunch = (i: number) => {
    const gate = gates[i];
    if (gate.launched || !gate.scheduled || !gate.chained) {
      return;
    }
    gate.launched = true;
    launch(i);
  };
  const leftStack = (i: number) => {
    if (gates[i].leftStack) {
      return;
    }
    gates[i].leftStack = true;
    const next = i + 1;
    if (next >= seqs.length) {
      return;
    }
    grantBeats.push(scheduleParliamentBeat(schedule[next].startMs - schedule[i].startMs, () => {
      gates[next].chained = true;
      tryLaunch(next);
    }));
  };
  const launch = (i: number) => {
    const seq = seqs[i];
    if (parliamentFlow.stage !== 'landed') {
      return;
    }
    if (!flyOwnDelegate(seq, color, () => touched(seq), () => leftStack(i))) {
      // This cube cannot fly (nothing measurable): it is simply there — its source lets go of exactly one.
      releaseOneSource();
      leftStack(i);
      touched(seq);
    }
  };
  seqs.forEach((_, i) => {
    if (i === 0) {
      tryLaunch(0);
    } else {
      grantBeats.push(scheduleParliamentBeat(schedule[i].startMs, () => {
        gates[i].scheduled = true;
        tryLaunch(i);
      }));
    }
  });
}
/** One cube's source figure lets go (a phrase's other cubes may still be standing on the same stack). */
function releaseOneSource(): void {
  const f = parliamentFlow;
  f.sourceHoldCount = Math.max(0, f.sourceHoldCount - 1);
  f.sourceLeavingCount = Math.max(0, f.sourceLeavingCount - 1);
  if (f.sourceHoldCount === 0) {
    f.sourceHold = undefined;
  }
  if (f.sourceLeavingCount === 0) {
    f.sourceLeaving = undefined;
  }
}
/**
 * The base-to-base distance of cube `index`'s flight (screen px) — for the phrase's schedule only (each flight
 * re-measures its own ends at its launch): the reserve stack's `index`-th figure from the top (the ones above it
 * will have lifted by then), or the lobby's; into its own place on the ribbon. 0 when unmeasurable.
 */
function cubeDistance(root: HTMLElement, seq: number, index: number, color: Color): number {
  const stack = Array.from(root.querySelectorAll<HTMLElement>(`[data-parl-seat-reserve="${color}"] .con-parl__stack-cube .player-delegate`));
  const source = voteSource.value === 'lobby' ?
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
}
/**
 * THE NEUTRAL DELEGATES OF THE PARTY'S SUPPORT — second source, second addressee, AFTER the player's own
 * cube has landed: each leaves the COMMON SUPPLY on the bench (its count drops on the lift-off) and
 * lands on the next free place of the vote panel's support block (the place fills on the touchdown and
 * answers ONCE). One after another, the support scene's rhythm. No support to land → straight to the
 * landed read; nothing measurable → the places are simply filled and the miss is CONFESSED on the
 * section root (`data-parl-grant-degraded`), never silent.
 */
function flySupport(seq: number): void {
  const f = parliamentFlow;
  const support = f.voteSnapshot?.support;
  const root = parliamentRootEl();
  const count = support?.gained ?? 0;
  if (support === undefined || count <= 0 || root === undefined) {
    f.supportHeld = 0;
    beginLanding(seq);
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
      answerSupportPlace(placeEl);
      remaining--;
      if (remaining === 0) {
        beginLanding(seq);
      }
    }, {
      onLifted: () => {
        f.supportHeld = Math.max(0, f.supportHeld - 1);
      },
    });
    if (id !== undefined) {
      supportFlights.push(id);
    }
  }
}
/** The ONE place that received the cube answers, once (the plaque's own touchdown — law 11): ended by its own animationend. */
function answerSupportPlace(el: HTMLElement | null): void {
  if (el === null || consoleReducedMotionActive()) {
    return;
  }
  void nextTick(() => {
    el.classList.remove('con-pseal__support-place--landed');
    void el.offsetWidth;
    el.classList.add('con-pseal__support-place--landed');
    el.addEventListener('animationend', () => el.classList.remove('con-pseal__support-place--landed'), {once: true});
  });
}
/** The viewer's own delegate's flight, paced by its distance — `onLanded` is the caller's continuation (the next figure, or the landed read). */
function flyOwnDelegate(seq: number, color: Color, onLanded: () => void, onLeftStack?: () => void): boolean {
  const root = parliamentRootEl();
  const f = parliamentFlow;
  if (root === undefined || typeof window === 'undefined' || consoleReducedMotionActive()) {
    return false;
  }
  // The REAL places on the delegates zone, measured where they stand right
  // now (the zone has moved with the mode; nothing here remembers the
  // overview's coordinates).
  const fromLobby = voteSource.value === 'lobby';
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
  void nextTick(() => {
    const proxy = flightEl(id);
    if (proxy === null || proxy === undefined) {
      dropFlight(id);
      if (parliamentFlow.stage !== 'landed' || landingHold === undefined) {
        // Dropped with its landing (a clear, the ceiling's recovery): nothing is owed to a phrase that is over.
        return;
      }
      // This cube's source lets go of exactly ONE figure (a phrase's other cubes may still be standing on it).
      releaseOneSource();
      f.flightSeq = undefined;
      onLeftStack?.();
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
        // The stack's count has stepped down for THIS figure (the reserve the eye reads — `reserveCubes`).
        onLeftStack?.();
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
        cubesInAir.value = Math.max(0, cubesInAir.value - 1);
        if (cubesInAir.value === 0) {
          flightHold?.release();
          flightHold = undefined;
        }
        onLanded();
        probeTick(() => dropFlight(id));
      },
    });
    registerFlightHandle(id, handle);
    cubesInAir.value++;
    if (flightHold === undefined) {
      const flightHoldNow = beginAnimationHold('parliament-vote-flight', {
        maxHoldMs: 4000,
        // THE CEILING LANDS THE CUBES: every one still in the air is dropped WITH its touchdown (the handle settles
        // its lift, its leave and its landing — once), so the phrase goes on exactly as if they had arrived.
        expire: () => {
          if (flightHold !== flightHoldNow) {
            return;
          }
          console.warn('[parliament] vote flight: outlived its ceiling — ended');
          flightHold = undefined;
          cubesInAir.value = 0;
          dropFlightsWithPrefix('vote');
        },
      });
      flightHold = markRaw(flightHoldNow);
    }
  });
  return true;
}
function beginLanding(seq: number): void {
  // THE READ TURNS ONCE (P72 · CZ): the lead / «принимается» held their pre-vote reading through every touchdown
  // (`tallyShownOf` / `winningShownOf` read the snapshot while in flight) and turn HERE, after the last cube —
  // marked once when the lead became the viewer's.
  const snap = parliamentFlow.voteSnapshot;
  const slot = voteSlot.value;
  const me = props.viewerColor;
  parliamentFlow.leadTurned = snap !== undefined && slot !== undefined && me !== undefined && snap.leader !== me && slot.leader === me ?
    slot.instance : undefined;
  parliamentFlow.landedSeq = seq;
  if (!parliamentFlow.landedSeqs.includes(seq)) {
    parliamentFlow.landedSeqs = [...parliamentFlow.landedSeqs, seq];
  }
  parliamentFlow.pendingSeqs = [];
  flightHold?.release();
  flightHold = undefined;
  landingBeat?.kill();
  // The landed READ — a beat on the motion clock (never a wall-clock timer).
  landingBeat = scheduleParliamentBeat(VOTE_LANDING_MS, () => finishLanding());
}
function finishLanding(): void {
  landingBeat?.kill();
  landingBeat = undefined;
  if (parliamentFlow.stage !== 'landed') {
    clearLanding();
    return;
  }
  // The flow is over: the landed reading has been READ, and the WHOLE surface leaves as ONE motion — the
  // shell's ONE guarded conclusion pops the frame and the surface-motion director dissolves the root with
  // the vote layer, the cards and the zone inside it (v2, § Б5: a separate fade of the layer before the
  // frame left a frame with an empty body under a live crumb). The counters keep the landed reading
  // until the unmount (`landedSeq` stands); the fit stays frozen through the leave.
  // …UNLESS THIS DELEGATE WON A PARTY'S EFFECT: the hall plays that moment before the flow leaves (the access scene).
  const won = parliamentFlow.accessExpected;
  if (won !== undefined && props.view.viewer?.access.some((a) => a.party === won && a.hasEffect) === true) {
    playAccessScene(won);
    return;
  }
  landingHold?.release();
  landingHold = undefined;
  if (continueSeriesInPlace()) {
    return;
  }
  emit('flow-complete', 'vote');
}
/**
 * A SERIES OF GRANTS IS ONE VISIT (P70 Colonial Envoys — `grantSeries.ts`): the landed cube was decision k, and the
 * prompt standing NOW is decision k + 1 of the same giver. The flow does not end — nothing folds, nothing unfolds:
 * the mode returns to its selection ON THE SPOT (the cursor stays on the resolution the cube just landed on, the
 * forecast and the reserve read the new model), past the commit (B «Свернуть» parks the whole series; A from the
 * board brings back the same decision). Each decision keeps its own A — nothing is glued to the next.
 */
function continueSeriesInPlace(): boolean {
  const f = parliamentFlow;
  const next = props.bridge.grant;
  if (next === undefined || next.staged === true || !grantContinuesSeries(f.voteSnapshot?.series, next.model)) {
    return false;
  }
  clearLanding();
  f.voteSnapshot = undefined;
  f.accessExpected = undefined;
  f.accessParty = undefined;
  f.accessBeat = '';
  resetSubject();
  freezeParliamentFit(false);
  setWorkspaceFramePhase('parliament', 'committed');
  if (f.stage === 'access') {
    // The access scene let the vote layer go: the next decision is OPENED again in the same chamber (one phrase).
    f.stage = 'browse';
    void nextTick(() => {
      openVote({index: f.slotIndex});
      setWorkspaceFramePhase('parliament', 'committed');
    });
    return true;
  }
  f.stage = 'vote';
  return true;
}
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
function playAccessScene(party: ReduxParty): void {
  const f = parliamentFlow;
  f.accessParty = party;
  f.accessBeat = 'count';
  setWorkspaceFramePhase('parliament', 'executing');
  const accessHoldNow = beginAnimationHold('parliament-access-scene', {
    maxHoldMs: 9000,
    // THE CEILING ENDS THE SCENE by its own last beat (`accessDone`): the leave and the seal stop where they are and
    // the flow goes on (the series, or the leave) — never a frame standing at «executing».
    expire: () => {
      const f = parliamentFlow;
      if (accessHold !== accessHoldNow || f.accessParty === undefined || f.accessBeat === 'done') {
        return;
      }
      console.warn('[parliament] access scene: outlived its ceiling — ended');
      accessBeatHandle?.kill();
      accessBeatHandle = undefined;
      dropFlightsWithPrefix('access-seal', {silent: true});
      if (f.voteLeaving) {
        const root = parliamentRootEl();
        killParliamentVoteMotion(root);
        restoreParliamentBody(root);
        f.voteLeaving = false;
      }
      accessDone();
    },
  });
  accessHold = markRaw(accessHoldNow);
  landingHold?.release();
  landingHold = undefined;
  accessBeatHandle = scheduleParliamentBeat(ACCESS_COUNT_MS, () => accessReturn());
}
function accessReturn(): void {
  const f = parliamentFlow;
  if (f.accessParty === undefined) {
    return;
  }
  f.accessBeat = 'return';
  const root = parliamentRootEl();
  freezeParliamentFit(false);
  resetSubject();
  f.sourceHold = undefined;
  f.sourceLeaving = undefined;
  let flown = false;
  const fly = () => {
    if (!flown) {
      flown = true;
      accessFly();
    }
  };
  if (root === undefined || sceneHandedOver.value) {
    f.stage = 'access';
    restoreParliamentBody(root);
    void nextTick(fly);
    return;
  }
  // The same leave B plays (measure the vote layout, let the slots go home, animate them from where they were) —
  // into the scene's own stage, which the hall paints as the chamber with no cursor and which absorbs every press.
  killParliamentVoteMotion(root);
  const before = measureVoteRects(root, {viewer: props.viewerColor, mode: 'vote'});
  f.voteLeaving = true;
  f.stage = 'access';
  void nextTick(() => {
    fitParliamentCards();
    playParliamentVoteLeave({
      root,
      viewer: props.viewerColor,
      before,
      done: () => {
        f.voteLeaving = false;
        fly();
      },
    });
  });
  // A leave that never reports its end (nothing measurable) must not strand the scene.
  accessBeatHandle = scheduleParliamentBeat(ACCESS_RETURN_GUARD_MS, fly);
}
function accessFly(): void {
  const f = parliamentFlow;
  const party = f.accessParty;
  if (party === undefined) {
    return;
  }
  f.accessBeat = 'flight';
  void nextTick(() => {
    const root = parliamentRootEl();
    const seq = f.landedSeq;
    const from = root === undefined || seq === undefined ? undefined : placeFigureRect(root, `.con-parl__slot[data-instance] [data-seq="${seq}"]`);
    const to = rectOf(root?.querySelector(`.con-parl__effects-row[data-party="${party}"] .con-parl__effects-seal`));
    flyAccessSeal({from, to, emblemUrl: partyEmblemUrl(party), onLanded: () => accessLanded()});
  });
}
function accessLanded(): void {
  const f = parliamentFlow;
  if (f.accessParty === undefined || f.accessBeat === 'landed' || f.accessBeat === 'done') {
    return;
  }
  f.accessBeat = 'landed';
  accessBeatHandle?.kill();
  accessBeatHandle = scheduleParliamentBeat(ACCESS_READ_MS, () => accessDone());
}
function accessDone(): void {
  const f = parliamentFlow;
  if (f.accessParty === undefined) {
    return;
  }
  // The tile, the head and the counted delegates KEEP their landed reading through the leave (the surface leaves
  // frozen and whole — law 13); the flow's reset clears them with the rest of the flow.
  f.accessBeat = 'done';
  accessHold?.release();
  accessHold = undefined;
  disarmAccessToldOnStage();
  if (continueSeriesInPlace()) {
    return;
  }
  emit('flow-complete', 'vote');
}
/**
 * THE LANDING ENDS NOW (its hold's ceiling): every wait of the phrase is cut and every flight dropped SILENTLY (their
 * touchdowns would re-enter this very flow), the poses go where the model has them — every arrived cube on the
 * card, the sources let go, the support landed, the price absorbed — and the read turns and finishes at once.
 */
function settleLandingNow(): void {
  const f = parliamentFlow;
  grantBeats.forEach((beat) => beat.kill());
  grantBeats = [];
  cubesInAir.value = 0;
  dropFlightsWithPrefix('vote', {silent: true});
  supportFlights.forEach((id) => dropFlight(id, {silent: true}));
  supportFlights = [];
  dropFlightsWithPrefix('price', {silent: true});
  flightHold?.release();
  flightHold = undefined;
  const seqs = [...f.landedSeqs, ...f.pendingSeqs, ...(f.flightSeq === undefined ? [] : [f.flightSeq])];
  f.landedSeqs = Array.from(new Set(seqs));
  f.pendingSeqs = [];
  f.flightSeq = undefined;
  f.sourceHold = undefined;
  f.sourceLeaving = undefined;
  f.sourceHoldCount = 0;
  f.sourceLeavingCount = 0;
  f.supportHeld = 0;
  f.supportLanded = f.voteSnapshot?.support?.gained ?? f.supportLanded;
  if (f.priceStage !== 'none') {
    f.priceStage = 'landed';
  }
  const last = seqs.length === 0 ? (f.landedSeq ?? 0) : Math.max(...seqs);
  beginLanding(last);
  finishLanding();
}
function clearLanding(): void {
  landingBeat?.kill();
  landingBeat = undefined;
  grantBeats.forEach((beat) => beat.kill());
  grantBeats = [];
  cubesInAir.value = 0;
  // A TEARDOWN (the unmount, the series' next decision, a landing that found no stage): the flights go SILENTLY —
  // their touchdowns would re-enter the landing this very call is clearing.
  dropFlightsWithPrefix('vote', {silent: true});
  supportFlights.forEach((id) => dropFlight(id, {silent: true}));
  supportFlights = [];
  flightHold?.release();
  flightHold = undefined;
  landingHold?.release();
  landingHold = undefined;
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
  dropFlightsWithPrefix('price', {silent: true});
  f.priceStage = 'none';
  accessBeatHandle?.kill();
  accessBeatHandle = undefined;
  accessHold?.release();
  accessHold = undefined;
  dropFlightsWithPrefix('access-seal', {silent: true});
}

/**
 * A paid vote's BILL stands on a fresh mount (a reload, a restore from
 * the board home): the vote mode re-forms around it — the cards carried,
 * the counters at their pre-vote values, the payment in the mode's own
 * zone — with no press to animate from. Keyed on the server's marker.
 */
watch(() => votePayment.value, (meta: VotePaymentMeta | undefined): void => {
  if (meta === undefined || voteUp.value) {
    return;
  }
  const idx = props.view.slots.findIndex((s) => s.party === meta.party);
  if (idx === -1) {
    return;
  }
  const slot = props.view.slots[idx];
  const f = parliamentFlow;
  f.slotIndex = idx;
  f.zone = 'voting';
  f.voteSnapshot = {votes: slot.totalVotes, mine: slot.viewerVotes, leader: slot.leader, winning: slot.isWinning, winner: props.winningSlot?.instance, source: 'reserve', count: 1};
  f.stageBeforeSubmit = 'vote';
  f.stage = 'paying';
  descendWorkspaceFrame('parliament', 'Voting', 'Payment');
  setWorkspaceFramePhase('parliament', 'committed');
  void nextTick(() => {
    fitParliamentCards();
    freezeParliamentFit(true);
    parkParliamentBody(parliamentRootEl());
  });
}, {immediate: true});

onMounted(() => {
  // ARMED BEFORE THE FIRST RENDER (`armGrantVoteFlow` — a delegate grant
  // hosted inside another workspace): the section mounted straight into the
  // vote pose, so the entrance is played from here, FRESH — no overview to
  // recede, every carried object surfaces in place.
  if (parliamentFlow.stage === 'vote' && parliamentFlow.voteEntering) {
    playFreshEntrance();
  }
  if (typeof ResizeObserver !== 'undefined') {
    readingRoomObserver = new ResizeObserver(() => fitReading());
  }
  void nextTick(() => fitReading());
});
onUpdated(() => {
  // A new card, a new subject, a reading that changed: the reading re-seats in its frame (the frame never moves).
  fitReading();
});
onBeforeUnmount(() => {
  clearLanding();
  freezeParliamentFit(false);
  readingRoomObserver?.disconnect();
});
defineExpose({answerAfterSubmit, answerWhilePaying, closeVote, enterArmedVote, handleIntent, openVote});
</script>
