<template>
  <div
    class="join-card"
    :class="{'join-card--new': isNew, 'join-card--ambiguous': game.ambiguous}"
  >
    <span class="join-card__accent" aria-hidden="true"></span>

    <header class="join-card__head">
      <span class="join-card__title">{{ game.name }}</span>
      <span class="join-card__gen">{{ generationLabel }}</span>
      <transition name="join-card-new-chip">
        <span v-if="isNew" class="join-card__new" v-i18n>New</span>
      </transition>
    </header>

    <div class="join-card__meta">
      <div class="join-card__map">
        <span class="join-card__map-label" v-i18n>Map</span>
        <span class="join-card__map-value capitalized" v-i18n>{{ game.boardName }}</span>
      </div>
      <div v-if="game.expansions.length > 0" class="join-card__expansions">
        <span
          v-for="e in game.expansions"
          :key="e"
          class="join-card__exp"
          :data-hint="expansionTitle(e)"
        >
          <img class="join-card__exp-icon" :src="iconUrl(e)" :alt="expansionTitle(e)" />
        </span>
      </div>
    </div>

    <div class="join-card__players">
      <span class="join-card__players-label">{{ playersLabel }}</span>
      <span
        v-for="(p, i) in game.players"
        :key="i"
        class="join-card__player"
        :class="{'join-card__player--you': p.isYou}"
      >
        <span class="join-card__player-cube" aria-hidden="true">
          <player-cube :color="p.color" :size="15" :glow="false" :shadow="false" :overlay-symbol="false" />
        </span>
        <span class="join-card__player-name">{{ p.name }}</span>
      </span>
    </div>

    <footer class="join-card__foot">
      <span class="join-card__age">{{ ageLabel }}</span>

      <!-- Ambiguous: two seats share the name, can't safely pick one. -->
      <div v-if="game.ambiguous" class="join-card__warn">
        <span class="join-card__warn-text" v-i18n>Cannot determine your seat here</span>
        <button type="button" class="join-card__ghost-btn" @click="$emit('edit-identity')">
          <span v-i18n>Change name</span>
        </button>
      </div>

      <!-- Colour conflict: desired colour already taken in this game. -->
      <div v-else-if="status === 'conflict'" class="join-card__warn">
        <span class="join-card__warn-text" v-i18n>Color is already used by another player</span>
        <button type="button" class="join-card__ghost-btn" @click="$emit('edit-identity')">
          <span v-i18n>Change color</span>
        </button>
        <button type="button" class="join-card__ghost-btn" @click="openWithoutOverride">
          <span v-i18n>Open with current color</span>
        </button>
      </div>

      <!-- Override / open error. -->
      <div v-else-if="status === 'error'" class="join-card__warn">
        <span class="join-card__warn-text" v-i18n>Could not update the player color</span>
        <button type="button" class="join-card__ghost-btn" @click="open">
          <span v-i18n>Retry</span>
        </button>
      </div>

      <!-- Normal action. -->
      <button
        v-else
        type="button"
        class="join-card__open-btn"
        data-gp-verb="Join game"
        :class="{'join-card__open-btn--busy': status === 'updating'}"
        :disabled="status === 'updating'"
        @click="open"
      >
        <span v-if="status === 'updating'" class="join-card__spinner" aria-hidden="true"></span>
        <span v-if="status !== 'updating'" class="gp-btn-glyph" aria-hidden="true"><GamepadGlyph control="confirm" /></span>
        <span v-i18n>{{ status === 'updating' ? 'Opening' : 'Join game' }}</span>
      </button>
    </footer>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {paths} from '@/common/app/paths';
import {navigateWithCurtain} from '@/client/console/loadingScreenState';
import {apiUrl} from '@/client/utils/runtimeConfig';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {JoinableGameSummary} from '@/common/models/JoinableGameModel';
import {PlayerColorOverrideResult} from '@/common/models/JoinableGameModel';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';
import {Expansion} from '@/common/cards/GameModule';
import {expansionIconUrl, expansionLabel} from '@/client/components/mainMenu/expansionMeta';
import PlayerCube from '@/client/components/PlayerCube.vue';

type OpenStatus = 'idle' | 'updating' | 'conflict' | 'error';

export default defineComponent({
  name: 'JoinGameCard',
  components: {PlayerCube, GamepadGlyph},
  props: {
    game: {type: Object as PropType<JoinableGameSummary>, required: true},
    isNew: {type: Boolean, default: false},
    // The cube colour the player chose in their identity — reconciled into the
    // game on open when it differs from their stored seat colour.
    desiredColor: {type: String as PropType<Color>, required: true},
  },
  emits: ['edit-identity'],
  data() {
    return {
      status: 'idle' as OpenStatus,
    };
  },
  computed: {
    generationLabel(): string {
      return translateTextWithParams('Generation ${0}', [String(this.game.generation)]);
    },
    playersLabel(): string {
      return translateTextWithParams('${0} players', [String(this.game.players.length)]);
    },
    ageLabel(): string {
      return this.relativeCreated(this.game.createdTimeMs);
    },
  },
  methods: {
    iconUrl(e: Expansion): string {
      return expansionIconUrl(e);
    },
    expansionTitle(e: Expansion): string {
      return translateText(expansionLabel(e));
    },
    relativeCreated(createdTimeMs: number): string {
      const diff = Math.max(0, Date.now() - createdTimeMs);
      const minutes = Math.floor(diff / 60000);
      if (minutes < 1) {
        return translateText('Created just now');
      }
      if (minutes < 60) {
        return translateTextWithParams('Created ${0} min ago', [String(minutes)]);
      }
      const hours = Math.floor(minutes / 60);
      if (hours < 24) {
        return translateTextWithParams('Created ${0} h ago', [String(hours)]);
      }
      const days = Math.floor(hours / 24);
      if (days === 1) {
        return translateText('Created yesterday');
      }
      return translateTextWithParams('Created ${0} d ago', [String(days)]);
    },
    async open(): Promise<void> {
      const you = this.game.you;
      if (you === undefined) {
        return;
      }
      // No colour change needed → open straight away.
      if (you.color === this.desiredColor) {
        this.go(you.id);
        return;
      }
      this.status = 'updating';
      try {
        const url = apiUrl(`${paths.API_GAME_PLAYER_COLOR}?id=${encodeURIComponent(you.id)}&color=${encodeURIComponent(this.desiredColor)}`);
        const res = await fetch(url, {method: 'POST'});
        const result = await res.json() as PlayerColorOverrideResult;
        if (result.status === 'updated' || result.status === 'noop') {
          this.go(you.id);
        } else if (result.status === 'conflict') {
          this.status = 'conflict';
        } else {
          this.status = 'error';
        }
      } catch {
        this.status = 'error';
      }
    },
    openWithoutOverride(): void {
      if (this.game.you !== undefined) {
        this.go(this.game.you.id);
      }
    },
    go(playerId: string): void {
      // The game boundary is a DELIBERATE full reload (clean per-game module
      // state); the premium curtain (P10) covers it seamlessly.
      navigateWithCurtain(`${paths.PLAYER}?id=${encodeURIComponent(playerId)}`, 'expedition');
    },
  },
});
</script>
