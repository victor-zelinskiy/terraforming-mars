<template>
  <aside class="cm-launch">
    <span class="cm-launch__corner cm-launch__corner--tl" aria-hidden="true"></span>
    <span class="cm-launch__corner cm-launch__corner--tr" aria-hidden="true"></span>

    <h2 class="cm-launch__title">{{ $t('Launch briefing') }}</h2>

    <ConsoleScrollArea class="cm-launch__scroll" :fill="true" content-class="cm-launch__body">
      <!-- Crew summary -->
      <div class="cm-launch__block">
        <div class="cm-launch__label">{{ $t('Crew') }} <span class="cm-launch__count">{{ participantCount }}</span></div>
        <div class="cm-launch__chips">
          <span v-for="p in humanChips" :key="'h' + p.index" class="cm-chip">
            <span class="cm-chip__cube" :class="'player_bg_color_' + p.color" aria-hidden="true"></span>
            <span class="cm-chip__name" :class="{'cm-chip__name--missing': p.name === ''}">{{ p.name !== '' ? p.name : $t('Name not set') }}</span>
          </span>
          <span v-if="bot" class="cm-chip cm-chip--bot">
            <span class="cm-chip__bot" aria-hidden="true">⚙</span>
            <span class="cm-chip__name">{{ $t('MarsBot') }} · {{ $t(botDifficultyLabel) }}</span>
          </span>
        </div>
      </div>

      <!-- Map -->
      <div class="cm-launch__block">
        <div class="cm-launch__label">{{ $t('Map') }}</div>
        <div class="cm-launch__map">
          <span class="cm-launch__map-thumb" aria-hidden="true">
            <premium-map-fingerprint :map-id="mapBoardId" :random="mapRandom" :accent="mapAccent" variant="card" />
          </span>
          <span class="cm-launch__map-name">{{ $t(mapLabel) }}</span>
        </div>
      </div>

      <!-- Expansions -->
      <div class="cm-launch__block">
        <div class="cm-launch__label">{{ $t('Expansions') }}</div>
        <div v-if="enabledExpansions.length > 0" class="cm-launch__icons">
          <img v-for="e in enabledExpansions" :key="e.id" :src="icon(e.id)" :alt="$t(e.labelKey)" :title="$t(e.labelKey)" draggable="false" />
        </div>
        <div v-else class="cm-launch__none">{{ $t('Base game only') }}</div>
      </div>

      <!-- Rules -->
      <div class="cm-launch__block">
        <div class="cm-launch__label">{{ $t('Game rules') }}</div>
        <div v-if="activeRules.length > 0" class="cm-launch__rules">
          <span v-for="r in activeRules" :key="r.id" class="cm-launch__rule">{{ $t(r.labelKey) }}</span>
        </div>
        <div v-else class="cm-launch__none">{{ $t('None') }}</div>
      </div>

      <!-- Readiness -->
      <div class="cm-launch__block cm-launch__block--status">
        <template v-if="issues.length > 0">
          <div class="cm-launch__status cm-launch__status--blocked">
            <span class="cm-launch__status-glyph" aria-hidden="true">!</span>
            <span>{{ $t('Blocking issues') }}: {{ issues.length }}</span>
          </div>
          <div class="cm-issues">
            <div v-for="issue in issues" :key="issue.id" class="cm-issues__row">{{ $t(issue.textKey) }}</div>
          </div>
        </template>
        <div v-else class="cm-launch__status cm-launch__status--ready">
          <span class="cm-launch__status-dot" aria-hidden="true"></span>
          <span>{{ $t('Ready to launch') }}</span>
        </div>
        <div v-if="error !== ''" class="cm-launch__error">{{ $t(error) }}</div>
        <div v-if="restored" class="cm-launch__restored">
          <span>{{ $t('Restored your last settings') }}</span>
          <span class="cm-launch__restored-hint"><GamepadGlyph control="view" />{{ $t('Reset') }}</span>
        </div>
      </div>
    </ConsoleScrollArea>

    <button type="button" class="cm-launch__cta" :class="{'cm-launch__cta--ready': ready}" @click="$emit('launch')">
      <GamepadGlyph control="secondary" />
      <span>{{ $t(ready ? 'Launch the party' : 'Go to the first issue') }}</span>
    </button>
  </aside>
</template>

<script lang="ts">
/**
 * LAUNCH BRIEFING panel (console create, right column) — the live mission
 * readout: crew chips, map, expansions, rules, then the READINESS block
 * (blocking issues list OR the mint "ready to launch" plate) and the X-CTA.
 * Reads the shared create model directly; the root screen owns the actual
 * launch flow (X → confirm ceremony / jump-to-issue).
 */
import {defineComponent} from 'vue';
import {Color} from '@/common/Color';
import {createGameState, visiblePremiumRules} from '@/client/components/create/premium/createGameState';
import {
  LaunchIssue,
  botSeated,
  consoleCreateUi,
  launchIssues,
  launchReady,
  selectedMapKey,
} from '@/client/console/menu/consoleCreateModel';
import {
  PREMIUM_EXPANSIONS,
  PremiumExpansionMeta,
  botDifficultyMeta,
  expansionIcon,
  mapMeta,
} from '@/client/components/create/premium/createGameMeta';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {BoardName} from '@/common/boards/BoardName';
import {Expansion} from '@/common/cards/GameModule';

export default defineComponent({
  name: 'ConsoleLaunchPanel',
  components: {ConsoleScrollArea, GamepadGlyph, PremiumMapFingerprint},
  emits: ['launch'],
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
    participantCount(): number {
      return createGameState.config.players.length + (this.bot ? 1 : 0);
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
    activeRules(): ReadonlyArray<{id: string, labelKey: string}> {
      const config = createGameState.config;
      return visiblePremiumRules(config)
        .filter((meta) => config.rules[meta.id])
        .map((meta) => ({id: meta.id, labelKey: meta.labelKey}));
    },
    issues(): ReadonlyArray<LaunchIssue> {
      return launchIssues();
    },
    ready(): boolean {
      return launchReady();
    },
    error(): string {
      return createGameState.error;
    },
    restored(): boolean {
      return consoleCreateUi.restored;
    },
  },
  methods: {
    icon(id: Expansion): string {
      return expansionIcon(id);
    },
  },
});
</script>
