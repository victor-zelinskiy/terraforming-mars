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
        <BonusCardFace :id="review.card.id" :ctx="review.ctx" :large="large" />
        <div class="mbr__card-meta">
          <div class="mbr__card-kicker" v-i18n>Bonus card</div>
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
            <span v-if="line.depth > 1" class="mbr__ladder" aria-hidden="true">↳</span>

            <!-- TRACK MOVEMENT: capsule + from→to + mini-scale (+ reached-cell action) -->
            <div v-if="line.kind === 'track'" class="mbr__move" :class="{'mbr__move--action': line.action !== undefined}">
              <div class="mbr__move-top">
                <span class="mbr__capsule" :title="line.capsule.length > 1 ? $t('Composite track') : undefined">
                  <Tag v-for="(tag, ti) in line.capsule" :key="ti" :tag="tag" size="med" type="secondary" />
                </span>
                <span class="mbr__from-to">{{ line.from }}<span class="mbr__arrow" aria-hidden="true">→</span>{{ line.to }}</span>
              </div>
              <div v-if="line.cells.length > 0" class="mbr__scale">
                <span v-for="cell in line.cells" :key="cell.index" class="mbr__cell" :class="'mbr__cell--' + cell.state">
                  <i v-if="cellGlyph(cell.action).iconClass !== ''" class="mbr__cell-icon" :class="cellGlyph(cell.action).iconClass" aria-hidden="true"></i>
                  <span v-else-if="cellGlyph(cell.action).symbol !== ''" class="mbr__cell-sym" aria-hidden="true">{{ cellGlyph(cell.action).symbol }}</span>
                  <span v-else class="mbr__cell-dot" aria-hidden="true"></span>
                </span>
              </div>
              <div v-if="line.action !== undefined" class="mbr__cellbonus">
                <span class="mbr__act-badge" aria-hidden="true">⚡</span>
                <span class="mbr__cellbonus-cell" v-i18n>{{ cellLabel }}</span>
                <span class="mbr__cellbonus-idx">{{ line.to }}</span>
                <i v-if="cellGlyph(line.action).iconClass !== ''" class="mbr__cell-icon" :class="cellGlyph(line.action).iconClass" aria-hidden="true"></i>
                <span v-else class="mbr__cell-sym" aria-hidden="true">{{ cellGlyph(line.action).symbol }}</span>
                <span class="mbr__act-name">{{ actionText(line.action) }}</span>
              </div>
            </div>

            <!-- Log consequence -->
            <template v-else-if="line.kind === 'log'">
              <span v-if="line.labelKey !== undefined" class="mbr__cost-label" :class="{'mbr__cost-label--cost': line.tone === 'cost'}" v-i18n>{{ line.labelKey }}</span>
              <span class="mbr__tokens">
                <JournalTokenRenderer v-for="(token, ti) in tokensOf(line.message)" :key="ti" :token="token" :players="players" />
              </span>
            </template>

            <!-- Attack -->
            <template v-else-if="line.kind === 'attack'">
              <span class="mbr__who">
                <span class="mbr__pdot" :class="'player_bg_color_' + line.attack.target" aria-hidden="true"></span>
                <span class="mbr__pname">{{ targetName(line.attack.target) }}</span>
              </span>
              <span class="mbr__imp-chip" :class="attackTone(line.attack)">
                <span class="mbr__imp-icons">
                  <i v-for="icon in attackIcons(line.attack)" :key="icon" class="mbr__chip-icon" :class="icon" aria-hidden="true"></i>
                </span>
                <span v-if="line.attack.before !== undefined && line.attack.after !== undefined" class="mbr__vals">
                  {{ line.attack.before }}<span class="mbr__arrow" aria-hidden="true">→</span>{{ line.attack.after }}
                </span>
                <span v-if="attackNote(line.attack) !== ''" class="mbr__note" v-i18n>{{ attackNote(line.attack) }}</span>
              </span>
            </template>

            <!-- Note (ignored tag / skipped reward) -->
            <template v-else-if="line.kind === 'note'">
              <span class="mbr__notemark" aria-hidden="true">⊘</span>
              <span class="mbr__notetext" v-i18n>{{ line.noteKey }}</span>
            </template>
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
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {Log} from '@/common/logs/Log';
import {Color} from '@/common/Color';
import {TrackAction, BonusCardId} from '@/common/automa/AutomaTypes';
import {buildBonusCardView} from '@/common/automa/BonusCardData';
import {MarsBotAttack, MarsBotBonusFate} from '@/common/automa/MarsBotTurn';
import {BotReviewTechnicalReveal, BotTurnReview} from './botTurnReviewModel';

const FATE_LABEL: Record<MarsBotBonusFate, string> = {
  destroyed: 'Destroyed this turn',
  discarded: 'Discarded',
  recurring: 'Returns to the deck',
};
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {participantDisplayName} from './marsBotDisplay';
import {DIFFICULTY_LABEL, trackActionGlyph, trackActionLabel} from './marsBotView';
import BonusCardFace from './BonusCardFace.vue';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import Tag from '@/client/components/Tag.vue';

type CellGlyph = {iconClass: string, symbol: string};

export default defineComponent({
  name: 'BotTurnReviewBody',
  components: {BonusCardFace, JournalTokenRenderer, JournalCardChip, Tag},
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
    cellLabel(): string {
      return translateText('Cell');
    },
  },
  methods: {
    bonusName(id: BonusCardId): string {
      return buildBonusCardView(id, this.review.ctx).name;
    },
    fateLabel(fate: MarsBotBonusFate | undefined): string {
      return fate !== undefined ? FATE_LABEL[fate] : '';
    },
    techReason(reason: BotReviewTechnicalReveal['reason']): string {
      return reason === 'tiebreak' ? 'to break a tie' : 'to pick a tile';
    },
    /** A mini-scale cell's glyph — an icon sprite where one exists, else a symbol. */
    cellGlyph(action: TrackAction | undefined): CellGlyph {
      if (action === undefined) {
        return {iconClass: '', symbol: ''};
      }
      const g = trackActionGlyph(action);
      switch (g.kind) {
      case 'advance': return {iconClass: '', symbol: '↻'};
      case 'tr': return {iconClass: 'resource_icon resource_icon--rating', symbol: ''};
      case 'tag': return {iconClass: '', symbol: '↦'};
      case 'param': return {iconClass: 'mb-ico mb-ico--' + g.icon, symbol: ''};
      case 'tile': return {iconClass: 'mb-ico mb-ico--' + g.tile, symbol: ''};
      case 'floater': return {iconClass: 'mb-ico mb-ico--floater', symbol: ''};
      case 'ma': return {iconClass: '', symbol: g.which === 'milestone' ? '🏆' : '🏅'};
      }
    },
    actionText(action: TrackAction | undefined): string {
      if (action === undefined) {
        return '';
      }
      const label = trackActionLabel(action);
      return translateTextWithParams(label.message, label.params);
    },
    tokensOf(message: LogMessage | undefined): Array<string | LogMessageData> {
      if (message === undefined) {
        return [];
      }
      return Log.parse({message: this.$t(message.message), data: message.data});
    },
    targetName(color: Color): string {
      const player = this.players.find((p) => p.color === color);
      return player !== undefined ? participantDisplayName(player) : color;
    },
    attackIcons(attack: MarsBotAttack): Array<string> {
      if (attack.resource === 'cube') {
        return ['card-resource card-resource-animal', 'card-resource card-resource-microbe'];
      }
      return [iconClassFor(attack.resource)];
    },
    attackTone(attack: MarsBotAttack): string {
      return attack.outcome === 'hit' ? 'mbr__imp-chip--loss' : 'mbr__imp-chip--calm';
    },
    attackNote(attack: MarsBotAttack): string {
      switch (attack.outcome) {
      case 'hit': return '';
      case 'nothing-to-lose': return 'Nothing to lose';
      case 'protected': return 'Resources are protected';
      case 'target-chooses': return 'Chooses what to lose';
      }
    },
  },
});
</script>
