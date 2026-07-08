<template>
  <div class="mbr" :class="{'mbr--large': large}">
    <!-- ── minimal header: identity only (the game summary lives in the notification / journal) ── -->
    <header class="mbr__hero">
      <span class="mbr__glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </span>
      <span :class="'con-status__dot player_bg_color_' + review.botColor" aria-hidden="true"></span>
      <span class="mbr__botname">{{ botName }}</span>
      <span class="mbr__diff">{{ difficultyLabel }}</span>
      <span class="mbr__gen">{{ $t('Generation') }} {{ review.generation }}</span>
    </header>

    <!-- ── played card + service reveals (one horizontal strip) ── -->
    <section v-if="review.card !== undefined" class="mbr__card">
      <template v-if="review.card.kind === 'project'">
        <JournalCardChip class="mbr__card-chip" :name="review.card.name" />
        <div class="mbr__card-meta">
          <div class="mbr__card-kicker"><span v-i18n>Project card</span> · <span class="mbr__rule" v-i18n>Only the card tags are played</span></div>
          <div class="mbr__tags">
            <span v-for="(t, i) in review.card.tags" :key="i" class="mbr__tag" :class="{'mbr__tag--ignored': t.ignored}">
              <Tag :tag="t.tag" size="med" type="secondary" />
              <span v-if="t.ignored" class="mbr__tag-x" aria-hidden="true">⊘</span>
            </span>
          </div>
        </div>
      </template>
      <template v-else>
        <button type="button" class="mbr__bonus-chip" @click="openBonusZoom(review.card.id)" :title="$t('Full rules')">
          <span class="mbr__bonus-glyph" aria-hidden="true">◈</span>
          <span class="mbr__bonus-name">{{ $t(bonusName(review.card.id)) }}</span>
          <span class="mbr__bonus-zoom" aria-hidden="true">⤢</span>
        </button>
        <div class="mbr__card-meta">
          <div class="mbr__card-kicker" v-i18n>Bonus card</div>
          <!-- SHORT essence of what the card does (never the full rules — those live in fullscreen). -->
          <div class="mbr__card-essence">{{ bonusEssence(review.card.id) }}</div>
          <!-- The ONE resolved branch — never the card's full if/else rule text. -->
          <div v-if="review.card.branch !== undefined" class="mbr__branch">
            <span class="mbr__branch-label" v-i18n>Resolved branch</span>
            <span class="mbr__branch-value">{{ branchText(review.card.branch) }}</span>
          </div>
          <!-- A chained fallback card presented as part of THIS flow. -->
          <div v-if="review.card.secondaryCard !== undefined" class="mbr__branch mbr__branch--chain">
            <span class="mbr__branch-label" v-i18n>Drew another card</span>
            <button type="button" class="mbr__bonus-chip mbr__bonus-chip--sm" @click="openBonusZoom(review.card.secondaryCard)">
              <span class="mbr__bonus-name">{{ $t(bonusName(review.card.secondaryCard)) }}</span>
              <span class="mbr__bonus-zoom" aria-hidden="true">⤢</span>
            </button>
          </div>
          <div v-if="review.card.fate !== undefined" class="mbr__fate" :class="'mbr__fate--' + review.card.fate">
            <span class="mbr__fate-label" v-i18n>Card fate</span>
            <span class="mbr__fate-value" v-i18n>{{ fateLabel(review.card.fate) }}</span>
          </div>
        </div>
      </template>

      <!-- service (tie-break / pick) flips — never the played card -->
      <div v-if="review.technicalReveals.length > 0" class="mbr__tech-list">
        <div class="mbr__panel-label" v-i18n>Service reveal</div>
        <div v-for="(tr, i) in review.technicalReveals" :key="i" class="mbr__tech">
          <JournalCardChip :name="tr.name" />
          <span class="mbr__tech-reason" v-i18n>{{ techReason(tr.reason) }}</span>
        </div>
      </div>
    </section>

    <!-- ── the ONE cause → effect flow ── -->
    <section v-if="review.chains.length > 0" class="mbr__chains">
      <div v-for="(chain, ci) in review.chains" :key="ci" class="mbr__chain" :class="'mbr__chain--' + chain.cause.kind">
        <!-- SOURCE of the chain (never "icon → same icon") -->
        <div class="mbr__chain-head">
          <template v-if="chain.cause.kind === 'tag'">
            <span class="mbr__chain-kicker mbr__chain-kicker--tag" v-i18n>Card tag</span>
            <Tag :tag="chain.cause.tag" size="med" type="secondary" />
          </template>
          <template v-else-if="chain.cause.kind === 'bonus'">
            <span class="mbr__chain-kicker" v-i18n>Bonus card</span>
            <span class="mbr__chain-title">{{ $t(bonusName(chain.cause.id)) }}</span>
          </template>
          <template v-else-if="chain.cause.kind === 'trade'">
            <span class="mbr__chain-kicker" v-i18n>Colony trade</span>
            <span class="mbr__chain-title">{{ $t(bonusName(chain.cause.id)) }}</span>
          </template>
          <template v-else-if="chain.cause.kind === 'failed'">
            <span class="mbr__chain-kicker mbr__chain-kicker--warn" v-i18n>Failed action</span>
          </template>
          <template v-else-if="chain.cause.kind === 'delta'">
            <span class="mbr__chain-kicker" v-i18n>Hydronetwork</span>
          </template>
          <template v-else>
            <span class="mbr__chain-kicker" v-i18n>Consequences</span>
          </template>
        </div>

        <div class="mbr__lines">
          <div v-for="(line, li) in chain.lines" :key="li" class="mbr__line" :class="'mbr__line--d' + Math.min(3, line.depth)">
            <span v-if="line.depth > 1 && line.kind !== 'secondary-card'" class="mbr__ladder" aria-hidden="true">↳</span>

            <!-- Chained fallback card — its OWN effects nested as ONE flow -->
            <div v-if="line.kind === 'secondary-card'" class="mbr__secondary">
              <div class="mbr__secondary-head">
                <span class="mbr__secondary-kicker" v-i18n>Secondary card</span>
                <button type="button" class="mbr__bonus-chip mbr__bonus-chip--sm" @click="openBonusZoom(line.id)">
                  <span class="mbr__bonus-name">{{ $t(bonusName(line.id)) }}</span>
                  <span class="mbr__bonus-zoom" aria-hidden="true">⤢</span>
                </button>
              </div>
              <div class="mbr__secondary-lines">
                <div v-for="(sub, si) in line.lines" :key="si" class="mbr__line mbr__line--d1">
                  <BotReviewLineContent :line="sub" :players="players" />
                </div>
              </div>
            </div>

            <BotReviewLineContent v-else :line="line" :players="players" />
          </div>
        </div>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
/**
 * «Разбор хода» — the shared, static body both surfaces render. ONE premium
 * cause → effect flow: minimal identity header (the game summary lives in the
 * notification / journal, never duplicated here) → the played card + any
 * SERVICE flips → per-source chains. Each track movement reads
 * SOURCE (chain header) → TRACK CAPSULE → from→to → MINI-SCALE → reached-cell
 * action → consequences, so "this card tag advanced this track" is unmistakable
 * and a card tag driving its own-tag track never shows a mute "icon → same icon".
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {BonusCardId} from '@/common/automa/AutomaTypes';
import {buildBonusCardView} from '@/common/automa/BonusCardData';
import {MarsBotBonusFate} from '@/common/automa/MarsBotTurn';
import {BotReviewTechnicalReveal, BotTurnReview} from './botTurnReviewModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {participantDisplayName} from './marsBotDisplay';
import {DIFFICULTY_LABEL} from './marsBotView';
import {openBonusCardZoom} from './bonusCardZoomState';
import BotReviewLineContent from './BotReviewLineContent.vue';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import Tag from '@/client/components/Tag.vue';

const FATE_LABEL: Record<MarsBotBonusFate, string> = {
  destroyed: 'Destroyed this turn',
  discarded: 'Discarded',
  recurring: 'Returns to the deck',
};

export default defineComponent({
  name: 'BotTurnReviewBody',
  components: {BotReviewLineContent, JournalCardChip, Tag},
  props: {
    review: {type: Object as PropType<BotTurnReview>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    /** TV-readable sizing (console). */
    large: {type: Boolean, default: false},
  },
  computed: {
    botName(): string {
      return participantDisplayName({name: this.review.botName, isMarsBot: true});
    },
    difficultyLabel(): string {
      return translateText(DIFFICULTY_LABEL[this.review.difficulty]);
    },
  },
  methods: {
    bonusName(id: BonusCardId): string {
      return buildBonusCardView(id, this.review.ctx).name;
    },
    /** A SHORT essence of a bonus card's effect (its primary line) — never the full rules. */
    bonusEssence(id: BonusCardId): string {
      const line = buildBonusCardView(id, this.review.ctx).lines[0];
      return line !== undefined ? translateTextWithParams(line.text, [...(line.params ?? [])]) : '';
    },
    openBonusZoom(id: BonusCardId): void {
      openBonusCardZoom(id, this.review.ctx);
    },
    branchText(branch: {key: string, params?: ReadonlyArray<string>}): string {
      return translateTextWithParams(branch.key, [...(branch.params ?? [])]);
    },
    fateLabel(fate: MarsBotBonusFate | undefined): string {
      return fate !== undefined ? FATE_LABEL[fate] : '';
    },
    techReason(reason: BotReviewTechnicalReveal['reason']): string {
      return reason === 'tiebreak' ? 'to break a tie' : 'to pick a tile';
    },
  },
});
</script>
