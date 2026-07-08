<template>
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
      <span class="mbr__cellbonus-cell" v-i18n>Cell</span>
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
</template>

<script lang="ts">
/**
 * Renders the CONTENT of ONE `BotReviewLine` (track movement / log / attack /
 * note). Extracted so the top-level chain AND a nested «Secondary card»
 * sub-block render lines identically — no duplicated markup. The `secondary-card`
 * kind is handled by the parent (BotTurnReviewBody), which recurses into this
 * component for the secondary's own lines.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {Log} from '@/common/logs/Log';
import {Color} from '@/common/Color';
import {TrackAction} from '@/common/automa/AutomaTypes';
import {MarsBotAttack} from '@/common/automa/MarsBotTurn';
import {BotReviewLine} from './botTurnReviewModel';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateTextWithParams} from '@/client/directives/i18n';
import {participantDisplayName} from './marsBotDisplay';
import {trackActionGlyph, trackActionLabel} from './marsBotView';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import Tag from '@/client/components/Tag.vue';

type CellGlyph = {iconClass: string, symbol: string};

export default defineComponent({
  name: 'BotReviewLineContent',
  components: {JournalTokenRenderer, Tag},
  props: {
    line: {type: Object as PropType<BotReviewLine>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
  },
  methods: {
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
