<template>
  <div class="mbr" :class="{'mbr--large': large}">
    <!-- ── HERO (full width) ── -->
    <header class="mbr__hero">
      <span class="mbr__glyph" aria-hidden="true">
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
      </span>
      <div class="mbr__hero-main">
        <div class="mbr__idline">
          <span :class="'con-status__dot player_bg_color_' + review.botColor" aria-hidden="true"></span>
          <span class="mbr__botname">{{ botName }}</span>
          <span class="mbr__diff">{{ difficultyLabel }}</span>
          <span class="mbr__gen">{{ $t('Generation') }} {{ review.generation }}</span>
        </div>
        <div class="mbr__verdict">{{ verdictText }}</div>
      </div>
      <div v-if="review.headlineChips.length > 0" class="mbr__chips">
        <span v-for="(chip, i) in review.headlineChips" :key="i" class="mbr__chip" :class="chipTone(chip)">
          <span class="mbr__chip-icon" :class="iconClassFor(chip.icon)" aria-hidden="true"></span>
          <span class="mbr__chip-text">{{ chip.text }}</span>
        </span>
      </div>
    </header>

    <div class="mbr__grid">
      <!-- ── LEFT RAIL: card + supporting facts ── -->
      <aside class="mbr__rail">
        <!-- Card -->
        <section v-if="review.card !== undefined" class="mbr__panel mbr__card">
          <template v-if="review.card.kind === 'project'">
            <div class="mbr__panel-label" v-i18n>Project card</div>
            <JournalCardChip class="mbr__card-chip" :name="review.card.name" />
            <p class="mbr__rule" v-i18n>Only the card tags are played</p>
            <div class="mbr__tags">
              <span v-for="(t, i) in review.card.tags" :key="i" class="mbr__tag" :class="{'mbr__tag--ignored': t.ignored}">
                <Tag :tag="t.tag" size="med" type="secondary" />
                <span v-if="t.ignored" class="mbr__tag-x" aria-hidden="true">⊘</span>
                <template v-else-if="t.trackTag !== undefined">
                  <span class="mbr__tag-arrow" aria-hidden="true">→</span>
                  <Tag :tag="t.trackTag" size="med" type="secondary" />
                </template>
              </span>
            </div>
          </template>
          <template v-else>
            <div class="mbr__panel-label" v-i18n>Bonus card</div>
            <BonusCardFace :id="review.card.id" :ctx="review.ctx" :large="large" />
            <div v-if="review.card.fate !== undefined" class="mbr__fate" :class="'mbr__fate--' + review.card.fate">
              <span class="mbr__fate-label" v-i18n>Card fate</span>
              <span class="mbr__fate-value" v-i18n>{{ fateLabel(review.card.fate) }}</span>
            </div>
          </template>
        </section>

        <!-- Bot result -->
        <section v-if="review.botResult !== undefined" class="mbr__panel">
          <div class="mbr__panel-label" v-i18n>MarsBot result</div>
          <div class="mbr__imp-chips">
            <span v-for="(c, ci) in review.botResult.changes" :key="ci" class="mbr__imp-chip" :class="changeTone(c)">
              <span class="mbr__chip-icon" :class="impactIcon(c)" aria-hidden="true"></span>
              <span class="mbr__vals">{{ c.before }}<span class="mbr__arrow" aria-hidden="true">→</span>{{ c.after }}</span>
            </span>
          </div>
        </section>

        <!-- On the board -->
        <section v-if="review.tiles.length > 0 || review.params.length > 0" class="mbr__panel">
          <div class="mbr__panel-label" v-i18n>On the board</div>
          <div v-for="(tile, i) in review.tiles" :key="'t' + i" class="mbr__tilerow">
            <span class="mbr__tile-name">{{ $t(tileLabel(tile.tileType)) }}</span>
            <button type="button" class="mbr__show" @click="$emit('peek', tile.spaceId)">
              <span class="mbr__show-pin" aria-hidden="true">◎</span><span v-i18n>Show on map</span>
            </button>
          </div>
          <div v-if="review.params.length > 0" class="mbr__params">
            <span v-for="(p, i) in review.params" :key="'p' + i" class="mbr__chip mbr__chip--neutral">
              <span class="mbr__chip-icon" :class="iconClassFor(p.icon)" aria-hidden="true"></span>
              <span class="mbr__chip-text">{{ paramText(p) }}</span>
            </span>
          </div>
        </section>

        <!-- Players affected -->
        <section v-if="review.playerImpacts.length > 0" class="mbr__panel">
          <div class="mbr__panel-label" v-i18n>Players affected</div>
          <div v-for="(imp, i) in review.playerImpacts" :key="i" class="mbr__improw">
            <span class="mbr__who">
              <span class="mbr__pdot" :class="'player_bg_color_' + imp.target" aria-hidden="true"></span>
              <span class="mbr__pname">{{ targetName(imp.target) }}</span>
            </span>
            <span class="mbr__imp-chips">
              <span v-for="(c, ci) in imp.changes" :key="ci" class="mbr__imp-chip" :class="changeTone(c)">
                <span class="mbr__chip-icon" :class="impactIcon(c)" aria-hidden="true"></span>
                <span class="mbr__vals">{{ c.before }}<span class="mbr__arrow" aria-hidden="true">→</span>{{ c.after }}</span>
              </span>
            </span>
          </div>
        </section>
      </aside>

      <!-- ── RIGHT: cause → effect chains (fills the width, packs into columns) ── -->
      <section v-if="review.chains.length > 0" class="mbr__chains-wrap">
        <div class="mbr__panel-label" v-i18n>What happened</div>
        <div class="mbr__chains">
          <div v-for="(chain, ci) in review.chains" :key="ci" class="mbr__chain" :class="'mbr__chain--' + chain.cause.kind">
            <div class="mbr__chain-head">
              <template v-if="chain.cause.kind === 'tag'">
                <span class="mbr__chain-kicker mbr__chain-kicker--tag" v-i18n>Card tag</span>
                <Tag :tag="chain.cause.tag" size="med" type="secondary" />
                <template v-if="chain.cause.trackTag !== undefined">
                  <span class="mbr__tag-arrow" aria-hidden="true">→</span>
                  <Tag :tag="chain.cause.trackTag" size="med" type="secondary" />
                </template>
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
              <div v-for="(line, li) in chain.lines" :key="li" class="mbr__line" :class="lineClass(line)">
                <!-- Card tag drove the track (calm) -->
                <template v-if="line.kind === 'track' && line.action === undefined">
                  <Tag v-if="line.trackTag !== undefined" :tag="line.trackTag" size="med" type="secondary" />
                  <span class="mbr__move">{{ line.from }}<span class="mbr__arrow" aria-hidden="true">→</span>{{ line.to }}</span>
                </template>
                <!-- A TRACK ACTION fired (distinct accent) -->
                <template v-else-if="line.kind === 'track'">
                  <span class="mbr__act-badge" aria-hidden="true">⚡</span>
                  <span class="mbr__act-kicker" v-i18n>Track action</span>
                  <Tag v-if="line.trackTag !== undefined" :tag="line.trackTag" size="med" type="secondary" />
                  <span class="mbr__move">{{ line.from }}<span class="mbr__arrow" aria-hidden="true">→</span>{{ line.to }}</span>
                  <span class="mbr__act-name">{{ actionText(line.action) }}</span>
                </template>
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
        </div>
      </section>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * «Разбор хода» — the shared, static, premium body both surfaces render (the
 * desktop overlay wraps it in modal chrome, the console fullscreen wraps it in
 * command-bar chrome). Reads the pre-built `BotTurnReview` and lays it out
 * WIDTH-FIRST: a full-width hero, a left rail of supporting facts (card /
 * result / board / players) and a wide right column of cause → effect chains
 * that pack into columns. A card-tag driving a track and a TRACK ACTION firing
 * read visually distinct (calm cyan vs an amber ⚡ row). Log lines reuse the
 * journal's token renderer; chips the shared resource-icon vocabulary.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {Log} from '@/common/logs/Log';
import {Color} from '@/common/Color';
import {TileType} from '@/common/TileType';
import {TrackAction, BonusCardId} from '@/common/automa/AutomaTypes';
import {buildBonusCardView} from '@/common/automa/BonusCardData';
import {MarsBotAttack, MarsBotBonusFate, MarsBotImpactChange} from '@/common/automa/MarsBotTurn';
import {BotReviewChip, BotReviewLine, BotReviewParam, BotTurnReview} from './botTurnReviewModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {participantDisplayName} from './marsBotDisplay';
import {DIFFICULTY_LABEL, trackActionLabel} from './marsBotView';
import BonusCardFace from './BonusCardFace.vue';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import Tag from '@/client/components/Tag.vue';

const TILE_LABEL: Partial<Record<TileType, string>> = {
  [TileType.OCEAN]: 'Ocean',
  [TileType.GREENERY]: 'Greenery',
  [TileType.CITY]: 'City',
};

const FATE_LABEL: Record<MarsBotBonusFate, string> = {
  destroyed: 'Destroyed this turn',
  discarded: 'Discarded',
  recurring: 'Returns to the deck',
};

export default defineComponent({
  name: 'BotTurnReviewBody',
  components: {BonusCardFace, JournalTokenRenderer, JournalCardChip, Tag},
  props: {
    review: {type: Object as PropType<BotTurnReview>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    /** TV-readable sizing (console). */
    large: {type: Boolean, default: false},
  },
  emits: ['peek'],
  computed: {
    botName(): string {
      return participantDisplayName({name: this.review.botName, isMarsBot: true});
    },
    difficultyLabel(): string {
      return translateText(DIFFICULTY_LABEL[this.review.difficulty]);
    },
    verdictText(): string {
      return translateTextWithParams(this.review.verdict.key, this.review.verdict.params);
    },
  },
  methods: {
    iconClassFor,
    bonusName(id: BonusCardId): string {
      return buildBonusCardView(id, this.review.ctx).name;
    },
    tileLabel(tileType: TileType): string {
      return TILE_LABEL[tileType] ?? 'Special tile';
    },
    fateLabel(fate: MarsBotBonusFate): string {
      return FATE_LABEL[fate];
    },
    paramText(p: BotReviewParam): string {
      const suffix = p.icon === 'temperature' ? '°' : (p.icon === 'oxygen' || p.icon === 'venus') ? '%' : '';
      return `${p.before}${suffix}→${p.after}${suffix}`;
    },
    /** The visual role of a chain line — drives the tag-move vs track-action split. */
    lineClass(line: BotReviewLine): string {
      const depthClass = `mbr__line--d${Math.min(3, line.depth)}`;
      let role: string;
      if (line.kind === 'track') {
        role = line.action !== undefined ? 'mbr__line--action' : (line.depth >= 2 ? 'mbr__line--cascade' : 'mbr__line--move');
      } else if (line.depth >= 2) {
        role = 'mbr__line--consequence';
      } else {
        role = 'mbr__line--' + line.kind;
      }
      return `${role} ${depthClass}`;
    },
    chipTone(chip: BotReviewChip): string {
      if (chip.neutral === true) {
        return 'mbr__chip--neutral';
      }
      if (chip.text.startsWith('+')) {
        return 'mbr__chip--gain';
      }
      if (chip.text.startsWith('−')) {
        return 'mbr__chip--loss';
      }
      return '';
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
    impactIcon(change: MarsBotImpactChange): string {
      return iconClassFor(change.resource === 'tr' ? 'tr' : change.resource);
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
    changeTone(change: MarsBotImpactChange): string {
      if (change.after < change.before) {
        return 'mbr__imp-chip--loss';
      }
      return change.after > change.before ? 'mbr__imp-chip--gain' : '';
    },
  },
});
</script>
