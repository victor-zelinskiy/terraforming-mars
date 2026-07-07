<template>
  <aside class="info-panel" :style="accentStyle">
    <div class="info-panel__head">
      <span class="info-panel__icon" aria-hidden="true">
        <img v-if="info.kind === 'expansion'" class="info-panel__icon-img" :src="expansionIconSrc" :alt="$t(title)" />
        <span v-else-if="info.kind === 'map'" class="info-panel__map">
          <premium-map-fingerprint :map-id="mapBoardId" :random="mapIsRandom" :accent="mapAccent" variant="thumb" />
        </span>
        <span v-else v-html="glyph"></span>
      </span>
      <span class="info-panel__kicker" v-i18n>{{ category }}</span>
      <span v-if="statusChip !== ''" class="info-panel__status" :class="statusClass" v-i18n>{{ statusChip }}</span>
    </div>

    <transition name="info-fade" mode="out-in">
      <div :key="transitionKey" class="info-panel__content">
        <h3 class="info-panel__title" v-i18n>{{ title }}</h3>
        <p class="info-panel__desc" v-i18n>{{ desc }}</p>
        <p v-if="botNote !== ''" class="info-panel__note" v-i18n>{{ botNote }}</p>
      </div>
    </transition>
  </aside>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {BoardName} from '@/common/boards/BoardName';
import {createGameState, InfoFocus} from './createGameState';
import {
  BOT_SUPPORTED_MODULES_KEY, PREMIUM_EXPANSIONS, PREMIUM_RULES, botDifficultyMeta, expansionIcon, expansionLabelKey, mapMeta,
} from './createGameMeta';
import PremiumMapFingerprint from '@/client/components/create/premium/PremiumMapFingerprint.vue';

const GLYPH_PLAYERS = '<svg viewBox="0 0 24 24" fill="none"><circle cx="9" cy="9" r="3.4" stroke="currentColor" stroke-width="1.6"/><path d="M3.5 19 C3.5 15 6 13 9 13 C12 13 14.5 15 14.5 19" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/><circle cx="17" cy="10" r="2.6" stroke="currentColor" stroke-width="1.4"/><path d="M15.5 15 C19 14.6 21 17 21 19" stroke="currentColor" stroke-width="1.4" stroke-linecap="round"/></svg>';
const GLYPH_DEFAULT = '<svg viewBox="0 0 24 24" fill="none"><path d="M12 3 L20 7.5 V16.5 L12 21 L4 16.5 V7.5 Z" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.6"/></svg>';
const RULE_GLYPH: Record<string, string> = {
  draft: '<svg viewBox="0 0 24 24" fill="none"><rect x="3.5" y="6" width="9" height="13" rx="1.6" stroke="currentColor" stroke-width="1.6"/><path d="M12.5 8 H19 M12.5 11 H19 M12.5 14 H17" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  dice: '<svg viewBox="0 0 24 24" fill="none"><rect x="4" y="4" width="16" height="16" rx="3" stroke="currentColor" stroke-width="1.6"/><circle cx="9" cy="9" r="1.4" fill="currentColor"/><circle cx="15" cy="15" r="1.4" fill="currentColor"/><circle cx="12" cy="12" r="1.4" fill="currentColor"/></svg>',
  shuffle: '<svg viewBox="0 0 24 24" fill="none"><path d="M4 7 H8 L16 17 H20 M16 14 L20 17 L16 20" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  tr: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8.5" stroke="currentColor" stroke-width="1.6"/><path d="M9 9 H15 M12 9 V16" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  venus: '<svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="9" r="5" stroke="currentColor" stroke-width="1.6"/><path d="M12 14 V21 M9 18 H15" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
};

export default defineComponent({
  name: 'CreateInfoPanel',
  components: {PremiumMapFingerprint},
  computed: {
    info(): InfoFocus {
      return createGameState.info;
    },
    transitionKey(): string {
      const i = this.info;
      return i.kind + ('id' in i ? ':' + String(i.id) : '');
    },
    category(): string {
      switch (this.info.kind) {
      case 'expansion': return 'Expansion';
      case 'map': return 'Map';
      case 'rule': return 'Rule';
      case 'players': return 'Players';
      case 'mode': return 'Game mode';
      // The kicker sits under v-i18n — use the translatable ROLE, never the
      // proper name (the i18n tool rejects a key that equals its own text).
      case 'bot': return 'Automa opponent';
      default: return 'Briefing';
      }
    },
    title(): string {
      const i = this.info;
      switch (i.kind) {
      case 'expansion': return expansionLabelKey(i.id);
      case 'map': return mapMeta(i.id).labelKey;
      case 'rule': return PREMIUM_RULES.find((r) => r.id === i.id)?.labelKey ?? '';
      case 'players': return 'Party players';
      case 'mode': return 'Game mode';
      case 'bot': return botDifficultyMeta(i.difficulty).labelKey;
      default: return 'Mission setup';
      }
    },
    desc(): string {
      const i = this.info;
      switch (i.kind) {
      case 'expansion': return PREMIUM_EXPANSIONS.find((e) => e.id === i.id)?.descKey ?? '';
      case 'map': return mapMeta(i.id).descKey;
      case 'rule': return PREMIUM_RULES.find((r) => r.id === i.id)?.descKey ?? '';
      case 'players': return 'Enter each player\'s name and cube colour. The first player is you, the creator.';
      case 'mode': return 'Play with other people, or solo against MarsBot — the official Automa opponent that runs itself.';
      case 'bot': return botDifficultyMeta(i.difficulty).descKey;
      default: return 'Hover or focus any option to see what it does, then create the game.';
      }
    },
    /** MarsBot focus: the supported-module note under the difficulty text. */
    botNote(): string {
      return this.info.kind === 'bot' ? BOT_SUPPORTED_MODULES_KEY : '';
    },
    statusChip(): string {
      const i = this.info;
      if (i.kind === 'expansion') {
        return createGameState.config.selectedExpansions[i.id] === true ? 'Enabled' : 'Disabled';
      }
      if (i.kind === 'rule') {
        return createGameState.config.rules[i.id] ? 'Enabled' : 'Disabled';
      }
      if (i.kind === 'map') {
        const c = createGameState.config;
        const selected = i.id === 'random-all' ? c.mapMode === 'random-all' : (c.mapMode === 'specific' && c.mapId === i.id);
        return selected ? 'Selected' : '';
      }
      return '';
    },
    statusClass(): string {
      if (this.statusChip === 'Enabled' || this.statusChip === 'Selected') {
        return 'info-panel__status--on';
      }
      if (this.statusChip === 'Disabled') {
        return 'info-panel__status--off';
      }
      return '';
    },
    glyph(): string {
      const i = this.info;
      if (i.kind === 'rule') {
        const icon = PREMIUM_RULES.find((r) => r.id === i.id)?.icon ?? 'draft';
        return RULE_GLYPH[icon] ?? GLYPH_DEFAULT;
      }
      if (i.kind === 'players') {
        return GLYPH_PLAYERS;
      }
      return GLYPH_DEFAULT;
    },
    expansionIconSrc(): string {
      return this.info.kind === 'expansion' ? expansionIcon(this.info.id) : '';
    },
    mapBoardId(): BoardName | undefined {
      return this.info.kind === 'map' && this.info.id !== 'random-all' ? (this.info.id as BoardName) : undefined;
    },
    mapIsRandom(): boolean {
      return this.info.kind === 'map' && this.info.id === 'random-all';
    },
    mapAccent(): string {
      return this.info.kind === 'map' ? mapMeta(this.info.id).accent : '240,168,80';
    },
    accentStyle(): Record<string, string> {
      return {'--info-accent': this.info.kind === 'map' ? mapMeta(this.info.id).accent : '240, 168, 80'};
    },
  },
});
</script>
