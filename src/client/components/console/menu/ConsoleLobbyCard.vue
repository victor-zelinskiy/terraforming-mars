<template>
  <button
    type="button"
    class="cm-lcard cm-game"
    :class="rootClasses"
    :data-lobby-card="view.kind"
    :data-lobby-tone="view.state.tone"
    :style="{'--map-accent': accent}"
    @click="$emit('activate')"
    @mousemove="$emit('hover')"
  >
    <!-- THE BOARD — the same miniature the campaign's mission cards draw (PremiumMapFingerprint, SVG of the real
         layout): a game is recognised by its board before its name is read. -->
    <span class="cm-lcard__map" aria-hidden="true">
      <PremiumMapFingerprint :map-id="view.board" variant="card" :accent="accent" :reveal="reveal" :reveal-delay-ms="revealDelayMs" />
    </span>

    <span class="cm-lcard__body">
      <span v-if="kickerText !== ''" class="cm-lcard__kicker" :class="{'cm-game__campaign': view.kind === 'game'}">{{ kickerText }}</span>
      <span class="cm-lcard__name cm-game__name">{{ view.name }}</span>

      <span class="cm-lcard__chips">
        <span class="cm-lcard__state" :class="'cm-lcard__state--' + view.state.tone" data-lobby-state>
          <span class="cm-lcard__state-mark" aria-hidden="true"></span>{{ stateText }}
        </span>
        <span v-if="view.isNew" class="cm-lcard__new cm-game__new">{{ $t('New') }}</span>
        <span v-if="view.hostLabel !== undefined" class="cm-lcard__host cm-game__lanhost">{{ view.hostLabel }}</span>
      </span>
      <span v-if="view.note !== undefined" class="cm-lcard__note">{{ textOf(view.note) }}</span>

      <!-- THE ROUTE (a campaign): one node per mission, the current one lit — the map's own grammar, in small. -->
      <span v-if="view.progress !== undefined" class="cm-lcard__route cm-camp__rail" aria-hidden="true">
        <span v-for="(m, k) in view.progress" :key="k" class="cm-lcard__node cm-camp__seg" :class="['cm-lcard__node--' + m, 'cm-camp__seg--' + m]">
          <span class="cm-lcard__node-num">{{ k + 1 }}</span>
        </span>
      </span>

      <span class="cm-lcard__meta">
        <template v-if="view.generation !== undefined">
          <span class="cm-lcard__gen">{{ $t('Generation') }} {{ view.generation }}</span>
          <span class="cm-lcard__dot" aria-hidden="true">·</span>
        </template>
        <span class="cm-lcard__board">{{ boardLabel }}</span>
        <template v-if="view.titlePoints !== undefined">
          <span class="cm-lcard__dot" aria-hidden="true">·</span>
          <span class="cm-lcard__tp">{{ titlePointsText }}</span>
        </template>
      </span>

      <span class="cm-lcard__crew cm-game__crew">
        <span
          v-for="p in view.crew"
          :key="p.color + p.name"
          class="cm-lcard__member cm-game__player"
          :class="{'cm-game__player--you': p.isYou, 'cm-game__player--active': p.isActive}"
        >
          <span v-if="p.isActive" class="cm-game__pturn" aria-hidden="true"></span>
          <span class="cm-lcard__cube cm-game__pcube" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
          <span class="cm-lcard__pname cm-game__pname">{{ p.name }}</span>
          <span v-if="p.champion" class="cm-lcard__crown" aria-hidden="true">♛</span>
          <span v-if="p.isYou" class="cm-lcard__you cm-game__ptag">{{ $t('You') }}</span>
        </span>
      </span>

      <span class="cm-lcard__foot">
        <!-- The age leads: the list is sorted by it, so it is what explains the order. -->
        <span class="cm-lcard__age cm-game__age">{{ age }}</span>
        <span v-if="expansions.length > 0" class="cm-lcard__exp cm-game__exp">
          <!-- No native title tooltip (banned): the pad has no hover, alt carries a11y. -->
          <img v-for="e in expansions.slice(0, 9)" :key="e.id" :src="e.url" :alt="$t(e.label)" draggable="false" />
          <span v-if="expansions.length > 9" class="cm-lcard__exp-more cm-game__exp-more">+{{ expansions.length - 9 }}</span>
        </span>
      </span>
    </span>
  </button>
</template>

<script setup vapor lang="ts">
/**
 * ONE CARD of the pregame showcase (TR68 «ПРЕДИГРОВОЕ — ЭТО ВИТРИНА»): a game or a campaign shown as an OBJECT —
 * its board miniature, its name in the hero voice (never cut while the card has room), one state chip by form and
 * colour, the generation, the crew with whose turn it is, the expansions and its age. The view is the pure
 * `lobbyCardModel`; the host owns the cursor and every verb (the card renders zero controller hints). The legacy
 * `.cm-game__*` hooks ride the same nodes, so the lobby's e2e contracts read the card as they read the row.
 */
import {computed, PropType} from 'vue';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import {LobbyCardView, LobbyText} from '@/client/console/menu/lobbyCardModel';
import {mapLabelKey, mapMeta} from '@/client/components/create/premium/createGameMeta';
import {expansionIconUrl, expansionLabel} from '@/client/components/mainMenu/expansionMeta';
import {Expansion} from '@/common/cards/GameModule';
import {$t, translateTextWithParams} from '@/client/directives/i18n';

defineOptions({name: 'ConsoleLobbyCard'});
const props = defineProps({
  view: {type: Object as PropType<LobbyCardView>, required: true},
  cursor: {type: Boolean, default: false},
  /** The age label — the screen's ONE clock (`lobbyState.nowMs`), never a per-card timer. */
  age: {type: String, default: ''},
  reveal: {type: Boolean, default: false},
  revealDelayMs: {type: Number, default: 0},
});
defineEmits(['activate', 'hover']);

const rootClasses = computed((): Record<string, boolean> => {
  return {
    'cm-lcard--cursor': props.cursor,
    'cm-game--cursor': props.cursor,
    'cm-lcard--campaign': props.view.kind === 'campaign',
    'cm-camp': props.view.kind === 'campaign',
    'cm-camp--archived': props.view.kind === 'campaign' && props.view.archived,
    'cm-lcard--archived': props.view.archived,
    'cm-lcard--refused': !props.view.enterable,
    'cm-game--disabled': !props.view.enterable,
    'cm-game--lan': props.view.hostLabel !== undefined,
  };
});
const accent = computed((): string => {
  return mapMeta(props.view.board).accent;
});
const boardLabel = computed((): string => {
  return $t(mapLabelKey(props.view.board));
});
const kickerText = computed((): string => {
  return props.view.kicker === undefined ? '' : props.view.kicker.map((part) => textOf(part)).join(' · ');
});
const stateText = computed((): string => {
  return textOf(props.view.state);
});
const titlePointsText = computed((): string => {
  return translateTextWithParams('Title Points: ${0}', [String(props.view.titlePoints ?? 0)]);
});
const expansions = computed((): ReadonlyArray<{id: Expansion, url: string, label: string}> => {
  return props.view.expansions.map((e) => ({id: e, url: expansionIconUrl(e), label: expansionLabel(e)}));
});
function textOf(text: LobbyText): string {
  return text.params !== undefined && text.params.length > 0 ? translateTextWithParams(text.key, [...text.params]) : $t(text.key);
}
</script>
