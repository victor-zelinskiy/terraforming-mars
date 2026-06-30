<template>
  <aside class="briefing">
    <span class="briefing__corner briefing__corner--tl" aria-hidden="true"></span>
    <span class="briefing__corner briefing__corner--tr" aria-hidden="true"></span>

    <h2 class="briefing__title" v-i18n>Party briefing</h2>

    <div class="briefing__body">
      <!-- Players -->
      <section class="briefing__section">
        <h3 class="briefing__label">
          <span v-i18n>Players</span>
          <span class="briefing__count">{{ players.length }}</span>
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

    <transition name="briefing-warn">
      <div v-if="warning !== ''" class="briefing__warning">
        <span class="briefing__warning-icon" aria-hidden="true">!</span>
        <span v-i18n>{{ warning }}</span>
      </div>
    </transition>

    <div class="briefing__actions">
      <div class="briefing__cta-wrap" :data-hint="ctaHint">
        <button
          type="button"
          class="briefing__cta"
          :class="{'briefing__cta--busy': creating}"
          :disabled="!canCreate || creating"
          @click="$emit('create')"
        >
          <span v-if="creating" class="briefing__spinner" aria-hidden="true"></span>
          <span v-i18n>{{ creating ? 'Creating' : 'Create game' }}</span>
        </button>
      </div>
      <div class="briefing__secondary">
        <button type="button" class="briefing__ghost" @click="$emit('back')"><span v-i18n>Back</span></button>
        <button type="button" class="briefing__ghost" @click="$emit('reset')"><span v-i18n>Reset</span></button>
      </div>
    </div>
  </aside>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {Expansion} from '@/common/cards/GameModule';
import {BoardName} from '@/common/boards/BoardName';
import PlayerCube from '@/client/components/PlayerCube.vue';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';
import {$t} from '@/client/directives/i18n';
import {createGameState, PremiumPlayerSlot, canCreateGame, firstBlocker, slotNameIssue} from './createGameState';
import {PREMIUM_EXPANSIONS, PREMIUM_RULES, PremiumRuleMeta, expansionIcon, expansionLabelKey, mapMeta} from './createGameMeta';

export default defineComponent({
  name: 'PartyBriefing',
  components: {PlayerCube, PremiumMapFingerprint},
  emits: ['create', 'back', 'reset'],
  computed: {
    players(): ReadonlyArray<PremiumPlayerSlot> {
      return createGameState.config.players;
    },
    trEnabled(): boolean {
      return createGameState.config.rules.trBoostEnabled;
    },
    creating(): boolean {
      return createGameState.creating;
    },
    canCreate(): boolean {
      return canCreateGame() && createGameState.error === '';
    },
    warning(): string {
      if (createGameState.error !== '') {
        return createGameState.error;
      }
      return firstBlocker();
    },
    ctaHint(): string {
      const blocker = firstBlocker();
      return this.canCreate ? '' : $t(blocker);
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
      return PREMIUM_RULES.filter((r) => {
        if (r.requiresExpansion !== undefined && cfg.selectedExpansions[r.requiresExpansion] !== true) {
          return false;
        }
        return cfg.rules[r.id] === true;
      });
    },
  },
  methods: {
    isMissing(i: number): boolean {
      const issue = slotNameIssue(i);
      return issue === 'empty' || issue === 'invalid';
    },
    displayName(i: number): string {
      const slot = this.players[i];
      const name = slot.name.trim();
      return name !== '' ? name : this.$t('Player') + ' ' + (i + 1);
    },
  },
});
</script>
