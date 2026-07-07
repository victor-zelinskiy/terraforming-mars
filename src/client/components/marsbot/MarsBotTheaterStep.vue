<template>
  <!-- Thinking beat -->
  <div v-if="step.kind === 'thinking'" class="mb-step__row mb-step__row--thinking">
    <span class="mb-step__dots" aria-hidden="true"><i></i><i></i><i></i></span>
    <span v-i18n>Drawing from the action deck</span>
  </div>

  <!-- Pass -->
  <div v-else-if="step.kind === 'pass'" class="mb-step__row">
    <span class="mb-step__icon mb-step__icon--pass" aria-hidden="true">∥</span>
    <span v-i18n>The action deck is empty — MarsBot passes</span>
  </div>

  <!-- Reveal: a project card face or a bonus card summary -->
  <div v-else-if="step.kind === 'reveal'" class="mb-step__row mb-step__row--reveal">
    <template v-if="step.card.kind === 'project'">
      <span class="mb-step__verb" v-i18n>Revealed</span>
      <span class="mb-step__cardwrap"><Card :card="{name: step.card.name}" :key="step.card.name" lightweight /></span>
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

  <!-- Any other public log line of the turn (tiles, TR, milestones, triggers) -->
  <div v-else-if="step.kind === 'log'" class="mb-step__row">
    <span class="mb-step__tokens">
      <template v-for="(token, i) in tokensOf(step.message)" :key="i">
        <JournalTokenRenderer :token="token" :players="players" />
      </template>
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
import {TrackAction} from '@/common/automa/AutomaTypes';
import {BonusCardContext} from '@/common/automa/BonusCardData';
import {translateTextWithParams} from '@/client/directives/i18n';
import {trackActionLabel} from './marsBotView';
import {TheaterStep} from './marsBotTheaterModel';
import BonusCardFace from './BonusCardFace.vue';
import JournalTokenRenderer from '@/client/components/journal/JournalTokenRenderer.vue';
import Tag from '@/client/components/Tag.vue';
import Card from '@/client/components/card/Card.vue';

export default defineComponent({
  name: 'MarsBotTheaterStep',
  components: {BonusCardFace, JournalTokenRenderer, Tag, Card},
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
      return Log.parse(message);
    },
    actionText(action: TrackAction): string {
      const label = trackActionLabel(action);
      return translateTextWithParams(label.message, label.params);
    },
  },
});
</script>
