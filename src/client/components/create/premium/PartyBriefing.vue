<template>
  <div class="briefing-summary">
    <!-- Players -->
    <section class="briefing__section">
      <h3 class="briefing__label">
        <span v-i18n>Players</span>
        <span class="briefing__count">{{ participantCount }}</span>
      </h3>
      <ul class="briefing__players">
        <li v-for="(p, i) in players" :key="i" class="briefing__player" :class="{'briefing__player--missing': isMissing(i)}">
          <span class="briefing__player-cube" aria-hidden="true">
            <player-cube :color="p.color" :size="17" :glow="false" :shadow="false" :overlay-symbol="false" />
          </span>
          <span class="briefing__player-name">{{ displayName(i) }}</span>
          <span v-if="p.isCreator" class="briefing__creator" v-i18n>Creator</span>
          <span v-if="trEnabled" class="briefing__tr">+{{ p.trBoost }}</span>
        </li>
        <li v-if="marsBotMode" key="marsbot" class="briefing__player briefing__player--bot">
          <span class="briefing__player-cube briefing__bot-glyph" aria-hidden="true">
            <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg"><rect x="5" y="7.5" width="14" height="10" rx="2.4" stroke="currentColor" stroke-width="1.6"/><path d="M12 7.5 V4.4 M12 4.4 L14 3.2" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="9.2" cy="12" r="1.5" fill="currentColor"/><circle cx="14.8" cy="12" r="1.5" fill="currentColor"/><path d="M9 15.4 H15" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/></svg>
          </span>
          <span class="briefing__player-name">{{ $t('MarsBot') }}</span>
          <span class="briefing__bot-diff" v-i18n>{{ botDifficultyLabel }}</span>
        </li>
      </ul>
    </section>

    <!-- Map -->
    <section class="briefing__section">
      <h3 class="briefing__label" v-i18n>Map</h3>
      <div class="briefing__map">
        <span class="briefing__map-thumb" :style="{'--map-accent': mapAccent}">
          <premium-map-fingerprint :map-id="mapBoardId" :random="mapIsRandom" :accent="mapAccent" variant="thumb" />
        </span>
        <span class="briefing__map-name" v-i18n>{{ mapLabel }}</span>
      </div>
    </section>

    <!-- Expansions -->
    <section class="briefing__section">
      <h3 class="briefing__label" v-i18n>Expansions</h3>
      <transition-group tag="div" class="briefing__chips" name="briefing-chip">
        <span v-for="e in enabledExpansions" :key="e.id" class="briefing__exp-chip" :data-hint="$t(e.label)">
          <img class="briefing__exp-icon" :src="e.icon" :alt="$t(e.label)" />
        </span>
        <span v-if="enabledExpansions.length === 0" key="none" class="briefing__muted" v-i18n>Base only</span>
      </transition-group>
    </section>

    <!-- Active rules -->
    <section class="briefing__section">
      <h3 class="briefing__label" v-i18n>Game rules</h3>
      <div class="briefing__rules">
        <span v-for="r in activeRules" :key="r.id" class="briefing__rule-chip" v-i18n>{{ r.labelKey }}</span>
        <span v-if="activeRules.length === 0" class="briefing__muted" v-i18n>None</span>
      </div>
    </section>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Expansion} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';
import PlayerCube from '@/client/components/PlayerCube.vue';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import {createGameState, PremiumPlayerSlot, slotNameIssue, visiblePremiumRules} from './createGameState';
import {PREMIUM_EXPANSIONS, PremiumRuleMeta, botDifficultyMeta, expansionIcon, expansionLabelKey, mapMeta} from './createGameMeta';

export default defineComponent({
  name: 'PartyBriefing',
  components: {PlayerCube, PremiumMapFingerprint},
  computed: {
    players(): ReadonlyArray<PremiumPlayerSlot> {
      return createGameState.config.players;
    },
    marsBotMode(): boolean {
      return createGameState.config.gameMode === 'marsbot';
    },
    participantCount(): number {
      return this.players.length + (this.marsBotMode ? 1 : 0);
    },
    botDifficultyLabel(): string {
      return botDifficultyMeta(createGameState.config.botDifficulty).labelKey;
    },
    trEnabled(): boolean {
      return createGameState.config.rules.trBoostEnabled;
    },
    mapBoardId(): BoardName | undefined {
      return createGameState.config.mapMode === 'specific' ? createGameState.config.mapId : undefined;
    },
    mapIsRandom(): boolean {
      return createGameState.config.mapMode === 'random-all';
    },
    mapAccent(): string {
      return this.mapIsRandom ? mapMeta('random-all').accent : mapMeta(createGameState.config.mapId).accent;
    },
    mapLabel(): string {
      return this.mapIsRandom ? mapMeta('random-all').labelKey : mapMeta(createGameState.config.mapId).labelKey;
    },
    enabledExpansions(): Array<{id: Expansion, label: string, icon: string}> {
      return PREMIUM_EXPANSIONS
        .filter((e) => createGameState.config.selectedExpansions[e.id] === true)
        .map((e) => ({id: e.id, label: expansionLabelKey(e.id), icon: expansionIcon(e.id)}));
    },
    activeRules(): ReadonlyArray<PremiumRuleMeta> {
      const cfg = createGameState.config;
      return visiblePremiumRules(cfg).filter((r) => cfg.rules[r.id] === true);
    },
  },
  methods: {
    isMissing(i: number): boolean {
      const issue = slotNameIssue(i);
      return issue === 'empty' || issue === 'invalid';
    },
    displayName(i: number): string {
      const name = this.players[i].name.trim();
      return name !== '' ? name : this.$t('Player') + ' ' + (i + 1);
    },
  },
});
</script>
