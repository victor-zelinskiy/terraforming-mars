<template>
  <!-- Pass -->
  <div v-if="step.kind === 'pass'" class="mb-step__row">
    <span class="mb-step__icon mb-step__icon--pass" aria-hidden="true">∥</span>
    <span v-i18n>The action deck is empty — MarsBot passes</span>
  </div>

  <!-- Reveal: a COMPACT card chip (hover preview / click fullscreen on
       desktop, X = Inspect on console) or the bonus card summary face.
       A full card render dominated the whole narration — the chip is the
       journal's own language for "a card". -->
  <div v-else-if="step.kind === 'reveal'" class="mb-step__row mb-step__row--reveal">
    <template v-if="step.card.kind === 'project'">
      <template v-if="step.message !== undefined">
        <span class="mb-step__tokens">
          <template v-for="(token, i) in tokensOf(step.message)" :key="i">
            <JournalTokenRenderer :token="token" :players="players" />
          </template>
        </span>
      </template>
      <template v-else>
        <span class="mb-step__verb" v-i18n>Revealed</span>
        <JournalCardChip :name="step.card.name" />
      </template>
    </template>
    <template v-else>
      <span class="mb-step__verb" v-i18n>Revealed a bonus card</span>
      <BonusCardFace class="mb-step__bonusface" :id="step.card.id" :ctx="ctx" :large="large" />
    </template>
  </div>

  <!-- One printed tag being processed -->
  <div v-else-if="step.kind === 'tag'" class="mb-step__row">
    <Tag :tag="step.tag" size="med" type="secondary" />
    <template v-if="step.ignored">
      <span class="mb-step__muted" v-i18n>tag of an unused expansion — ignored</span>
    </template>
    <template v-else>
      <span class="mb-step__arrow" aria-hidden="true">→</span>
      <span v-i18n>advances the track</span>
      <Tag v-if="step.targetTag !== undefined" :tag="step.targetTag" size="med" type="secondary" />
    </template>
  </div>

  <!-- A tracker moved (and possibly landed on an action icon) -->
  <div v-else-if="step.kind === 'advance'" class="mb-step__row">
    <Tag v-if="step.trackTag !== undefined" :tag="step.trackTag" size="med" type="secondary" />
    <span class="mb-step__pos">{{ step.from }} <span class="mb-step__arrow" aria-hidden="true">→</span> {{ step.to }}</span>
    <span v-if="step.action !== undefined" class="mb-step__action">
      <span class="mb-step__action-sep" aria-hidden="true">·</span>
      <span>{{ actionText(step.action) }}</span>
    </span>
  </div>

  <!-- Failed action: the reason + the M€ consolation, from the server log line -->
  <div v-else-if="step.kind === 'failed'" class="mb-step__row mb-step__row--failed">
    <span class="mb-step__icon mb-step__icon--failed" aria-hidden="true">!</span>
    <span class="mb-step__tokens">
      <template v-for="(token, i) in tokensOf(step.message)" :key="i">
        <JournalTokenRenderer :token="token" :players="players" />
      </template>
    </span>
  </div>

  <!-- A direct attack: WHO is hit + what actually came of it (before → after,
       or the honest zero outcome). Recorded for EVERY attack, so "did I lose
       anything?" is never left unanswered — even at 0 plants. -->
  <div v-else-if="step.kind === 'attack'" class="mb-step__row mb-step__row--attack">
    <span class="mb-atk__label" v-i18n>Target</span>
    <span class="mb-imp__who">
      <span class="mb-imp__dot" :class="'player_bg_color_' + step.attack.target" aria-hidden="true"></span>
      <span class="mb-imp__name">{{ targetName(step.attack.target) }}</span>
    </span>
    <span class="mb-imp__chips">
      <span class="mb-imp__chip" :class="attackTone(step.attack)">
        <span class="mb-imp__icon-frame" :class="{'mb-atk__icon-frame--pair': step.attack.resource === 'cube'}">
          <i v-for="icon in attackIcons(step.attack)" :key="icon" class="mb-imp__icon" :class="icon" aria-hidden="true"></i>
        </span>
        <span v-if="step.attack.before !== undefined && step.attack.after !== undefined" class="mb-imp__values">
          <span class="mb-imp__before">{{ step.attack.before }}</span>
          <span class="mb-imp__arrow" aria-hidden="true">→</span>
          <span class="mb-imp__after">{{ step.attack.after }}</span>
        </span>
        <span v-if="attackNote(step.attack) !== ''" class="mb-atk__note" v-i18n>{{ attackNote(step.attack) }}</span>
      </span>
    </span>
  </div>

  <!-- Any other public log line of the turn (tiles, TR, milestones, triggers) -->
  <div v-else-if="step.kind === 'log'" class="mb-step__row">
    <span class="mb-step__tokens">
      <template v-for="(token, i) in tokensOf(step.message)" :key="i">
        <JournalTokenRenderer :token="token" :players="players" />
      </template>
    </span>
  </div>

  <!-- Turn results: WHO was affected + every change as before → after -->
  <div v-else-if="step.kind === 'impact'" class="mb-step__row mb-step__row--impact">
    <span class="mb-imp__who" :class="{'mb-imp__who--bot': step.impact.targetIsBot}">
      <span class="mb-imp__dot" :class="'player_bg_color_' + step.impact.target" aria-hidden="true"></span>
      <span class="mb-imp__name">{{ targetName(step.impact.target) }}</span>
    </span>
    <span class="mb-imp__chips">
      <span
        v-for="(change, i) in step.impact.changes"
        :key="i"
        class="mb-imp__chip"
        :class="[changeTone(change), {'mb-imp__chip--production': change.scope === 'production'}]"
      >
        <span class="mb-imp__icon-frame" :class="{'mb-imp__icon-frame--production': change.scope === 'production'}">
          <i class="mb-imp__icon" :class="impactIconClass(change)" aria-hidden="true"></i>
        </span>
        <span class="mb-imp__values">
          <span class="mb-imp__before">{{ change.before }}</span>
          <span class="mb-imp__arrow" aria-hidden="true">→</span>
          <span class="mb-imp__after">{{ change.after }}</span>
        </span>
      </span>
    </span>
  </div>
</template>

<script lang="ts">
/**
 * One theater step — shared by the desktop overlay and the console band so
 * the narration can never diverge between the two modes. Log lines reuse the
 * journal's token renderer (cards/spaces/players render as the same premium
 * chips as everywhere else); the failed/pass/reveal steps carry their own
 * server log line so nothing is narrated twice.
 */
import {defineComponent, PropType} from 'vue';
import {PublicPlayerModel} from '@/common/models/PlayerModel';
import {LogMessage} from '@/common/logs/LogMessage';
import {LogMessageData} from '@/common/logs/LogMessageData';
import {Log} from '@/common/logs/Log';
import {Color} from '@/common/Color';
import {TrackAction} from '@/common/automa/AutomaTypes';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {MarsBotAttack, MarsBotImpactChange} from '@/common/automa/MarsBotTurn';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateTextWithParams} from '@/client/directives/i18n';
import {participantDisplayName} from './marsBotDisplay';
import {trackActionLabel} from './marsBotView';
import {TheaterStep} from './marsBotTheaterModel';
import BonusCardFace from './BonusCardFace.vue';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import JournalCardChip from '@/client/components/journal/JournalCardChip.vue';
import Tag from '@/client/components/Tag.vue';

export default defineComponent({
  name: 'MarsBotTheaterStep',
  components: {BonusCardFace, JournalTokenRenderer, JournalCardChip, Tag},
  props: {
    step: {type: Object as PropType<TheaterStep>, required: true},
    players: {type: Array as PropType<ReadonlyArray<PublicPlayerModel>>, required: true},
    /** The expansion context — resolves the bonus-card face for THIS game. */
    ctx: {type: Object as PropType<BonusCardContext>, required: true},
    /** TV-readable sizing (console). */
    large: {type: Boolean, default: false},
  },
  methods: {
    tokensOf(message: LogMessage | undefined): Array<string | LogMessageData> {
      if (message === undefined) {
        return [];
      }
      // Translate the TEMPLATE before parsing (exactly like JournalEntry) —
      // the tokens stay chips, only the string segments get localized.
      const e = {
        message: this.$t(message.message),
        data: message.data,
      };
      return Log.parse(e);
    },
    actionText(action: TrackAction): string {
      const label = trackActionLabel(action);
      return translateTextWithParams(label.message, label.params);
    },
    targetName(color: Color): string {
      const player = this.players.find((p) => p.color === color);
      return player !== undefined ? participantDisplayName(player) : color;
    },
    impactIconClass(change: MarsBotImpactChange): string {
      return iconClassFor(change.resource === 'tr' ? 'tr' : change.resource);
    },
    attackIcons(attack: MarsBotAttack): Array<string> {
      // 'cube' is the composite "highest-scoring animal/microbe" demand —
      // both icons name the pair, no invented single glyph.
      if (attack.resource === 'cube') {
        return ['card-resource card-resource-animal', 'card-resource card-resource-microbe'];
      }
      return [iconClassFor(attack.resource)];
    },
    attackTone(attack: MarsBotAttack): string {
      return attack.outcome === 'hit' ? 'mb-imp__chip--loss' : 'mb-imp__chip--calm';
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
        return 'mb-imp__chip--loss';
      }
      return change.after > change.before ? 'mb-imp__chip--gain' : '';
    },
  },
});
</script>
