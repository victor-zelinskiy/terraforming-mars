<template>
  <div class="cm-overlay cm-overlay--launch" role="dialog" :aria-label="$t('Launch the party')">
    <div class="cm-overlay__card cm-overlay__card--launch">
      <div class="cm-launchc__kicker">{{ $t('Mission control') }}</div>
      <div class="cm-launchc__title">{{ $t('Launch the party') }}</div>

      <div class="cm-launchc__grid">
        <div class="cm-launchc__block">
          <div class="cm-launch__label">{{ $t('Crew') }}</div>
          <div class="cm-launch__chips">
            <span v-for="p in humanChips" :key="'h' + p.index" class="cm-chip">
              <span class="cm-chip__cube" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
              <span class="cm-chip__name">{{ p.name }}</span>
            </span>
            <span v-if="bot" class="cm-chip cm-chip--bot">
              <span class="cm-chip__bot" aria-hidden="true">⚙</span>
              <span class="cm-chip__name">{{ $t('MarsBot') }} · {{ $t(botDifficultyLabel) }}</span>
            </span>
          </div>
        </div>
        <div class="cm-launchc__block">
          <div class="cm-launch__label">{{ $t('Map') }}</div>
          <div class="cm-launch__map">
            <span class="cm-launch__map-thumb" aria-hidden="true">
              <premium-map-fingerprint :map-id="mapBoardId" :random="mapRandom" :accent="mapAccent" variant="card" />
            </span>
            <span class="cm-launch__map-name">{{ $t(mapLabel) }}</span>
          </div>
        </div>
        <div class="cm-launchc__block">
          <div class="cm-launch__label">{{ $t('Expansions') }}</div>
          <div v-if="enabledExpansions.length > 0" class="cm-launch__icons">
            <img v-for="e in enabledExpansions" :key="e.id" :src="icon(e.id)" :alt="$t(e.labelKey)" draggable="false" />
          </div>
          <div v-else class="cm-launch__none">{{ $t('Base game only') }}</div>
        </div>
      </div>

      <div v-if="error !== ''" class="cm-launch__error">{{ $t(error) }}</div>

      <div v-if="creating" class="cm-launchc__creating">
        <span class="cm-launchc__spinner" aria-hidden="true"></span>
        <span>{{ $t('Creating the game') }}…</span>
      </div>
      <div v-else class="cm-confirm__pad">
        <button type="button" class="cm-confirm__btn cm-confirm__btn--launch" @click="$emit('confirm')">
          <GamepadGlyph control="confirm" /><span>{{ $t('Launch') }}</span>
        </button>
        <button type="button" class="cm-confirm__btn" @click="$emit('cancel')">
          <GamepadGlyph control="back" /><span>{{ $t('Cancel') }}</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * LAUNCH CEREMONY (console create) — the final confirm overlay: the party at
 * a glance (crew / map / expansions), then ONE unambiguous context where
 * A = launch and B = cancel (the create request itself rides the shared
 * `submitPremiumCreateGame`, owned by the screen root). While creating, the
 * pad is swallowed by the root and the spinner owns the card.
 */
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {createGameState} from '@/client/components/create/premium/createGameState';
import {botSeated, selectedMapKey} from '@/client/console/menu/consoleCreateModel';
import {
  PREMIUM_EXPANSIONS,
  PremiumExpansionMeta,
  botDifficultyMeta,
  expansionIcon,
  mapMeta,
} from '@/client/components/create/premium/createGameMeta';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {BoardName} from '@/common/boards/BoardName';
import {Expansion} from '@/common/cards/GameModule';

export default defineComponent({
  name: 'ConsoleLaunchConfirm',
  components: {PremiumMapFingerprint, GamepadGlyph},
  emits: ['confirm', 'cancel'],
  computed: {
    humanChips(): ReadonlyArray<{index: number, name: string, color: Color}> {
      return createGameState.config.players.map((p, index) => ({index, name: p.name.trim(), color: p.color}));
    },
    bot(): boolean {
      return botSeated();
    },
    botDifficultyLabel(): string {
      return botDifficultyMeta(createGameState.config.botDifficulty).labelKey;
    },
    mapLabel(): string {
      return mapMeta(selectedMapKey()).labelKey;
    },
    mapAccent(): string {
      return mapMeta(selectedMapKey()).accent;
    },
    mapRandom(): boolean {
      return mapMeta(selectedMapKey()).random;
    },
    mapBoardId(): BoardName | undefined {
      const meta = mapMeta(selectedMapKey());
      return meta.random ? undefined : meta.id as BoardName;
    },
    enabledExpansions(): ReadonlyArray<PremiumExpansionMeta> {
      const selected = createGameState.config.selectedExpansions;
      return PREMIUM_EXPANSIONS.filter((e) => selected[e.id] === true);
    },
    creating(): boolean {
      return createGameState.creating;
    },
    error(): string {
      return createGameState.error;
    },
  },
  methods: {
    icon(id: Expansion): string {
      return expansionIcon(id);
    },
  },
});
</script>
