<template>
  <!--
    PLAYGROUND HUB — the admin-only «Полигон» menu overlay. A LIST of visual
    dev stands (today: the premium-card showcase; the registry below is where
    the next stand becomes one row). Picking a row opens the stand FULLSCREEN
    over the menu in the shared ConsolePlaygroundStand chassis; B returns to
    this list, B again returns to the menu.

    Pad ownership mirrors ConsoleAdminRollback: the menu forwards every intent
    to `handleIntent` while this overlay is up; a fullscreen stand gets them
    forwarded one level deeper.
  -->
  <div class="cm-overlay" role="dialog" :aria-label="$t('Playground')">
    <div class="cm-overlay__card">
      <div class="cm-overlay__head">
        <div class="cm-overlay__title">{{ $t('Playground') }}</div>
      </div>
      <div class="cm-pg__list">
        <button
          v-for="(stand, i) in stands"
          :key="stand.id"
          type="button"
          class="cm-pg__row"
          :class="{'cm-pg__row--cursor': i === cursor}"
          @click="openAt(i)"
          @mousemove="cursor = i"
        >
          <span class="cm-pg__glyph" aria-hidden="true">{{ stand.glyph }}</span>
          <span class="cm-pg__text">
            <span class="cm-pg__label">{{ $t(stand.labelKey) }}</span>
            <span class="cm-pg__sub">{{ $t(stand.subKey) }}</span>
          </span>
        </button>
      </div>
      <div class="cm-overlay__foot">
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t('Open') }}</span>
        <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
      </div>
    </div>

    <!-- The open stand — fullscreen, teleported out of the menu's stacking
         context (the overlay dim must not grey it). -->
    <Teleport to="body">
      <ConsolePlaygroundStand
        v-if="open === 'premium-cards'"
        ref="stand"
        titleKey="Premium cards showcase"
        @close="open = undefined"
      >
        <PremiumCardsPlayground embedded />
      </ConsolePlaygroundStand>
      <ConsolePlaygroundStand
        v-else-if="open === 'player-cubes'"
        ref="stand"
        titleKey="Player cubes showcase"
        sectionSelector=".cube-playground__section-head"
        @close="open = undefined"
      >
        <PlayerCubePlayground embedded />
      </ConsolePlaygroundStand>
      <ConsolePlaygroundStand
        v-else-if="open === 'card-lore'"
        ref="stand"
        titleKey="Card lore showcase"
        sectionSelector=".lore-playground__caption"
        @close="open = undefined"
      >
        <CardLorePlayground embedded />
      </ConsolePlaygroundStand>
    </Teleport>
  </div>
</template>

<script lang="ts">
import {defineComponent, defineAsyncComponent} from 'vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex} from '@/client/console/consoleRouter';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsolePlaygroundStand from '@/client/components/console/menu/ConsolePlaygroundStand.vue';

// Async: every showcase pulls its own catalog machinery — the menu must not
// pay that weight until an admin actually opens the stand.
const PremiumCardsPlayground = defineAsyncComponent(() => import('@/client/components/premiumCard/PremiumCardsPlayground.vue'));
const PlayerCubePlayground = defineAsyncComponent(() => import('@/client/components/PlayerCubePlayground.vue'));
const CardLorePlayground = defineAsyncComponent(() => import('@/client/components/card/CardLorePlayground.vue'));

type StandId = 'premium-cards' | 'player-cubes' | 'card-lore';
type StandRow = {id: StandId, labelKey: string, subKey: string, glyph: string};

export default defineComponent({
  name: 'ConsolePlaygroundHub',
  components: {GamepadGlyph, ConsolePlaygroundStand, PremiumCardsPlayground, PlayerCubePlayground, CardLorePlayground},
  emits: ['close'],
  data() {
    return {
      cursor: 0,
      open: undefined as StandId | undefined,
    };
  },
  computed: {
    stands(): ReadonlyArray<StandRow> {
      return [
        {
          id: 'premium-cards',
          labelKey: 'Premium cards showcase',
          subKey: 'The visual acceptance surface of the premium card renderer',
          glyph: '❏',
        },
        {
          id: 'player-cubes',
          labelKey: 'Player cubes showcase',
          subKey: 'Every colour and size of the premium player cube',
          glyph: '⬢',
        },
        {
          id: 'card-lore',
          labelKey: 'Card lore showcase',
          subKey: 'Archive-entry text states of the fullscreen viewer',
          glyph: '✎',
        },
      ];
    },
  },
  methods: {
    openAt(i: number): void {
      this.cursor = i;
      const stand = this.stands[i];
      if (stand !== undefined) {
        this.open = stand.id;
      }
    },
    handleIntent(intent: GamepadIntent): boolean {
      // A fullscreen stand owns the pad while it is up.
      if (this.open !== undefined) {
        const stand = this.$refs.stand as {handleIntent?: (intent: GamepadIntent) => boolean} | undefined;
        return stand?.handleIntent?.(intent) ?? true;
      }
      const action = consoleActionOf(intent);
      if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
        this.cursor = stepIndex(this.cursor, intent.dir === 'down' ? 1 : -1, this.stands.length);
        return true;
      }
      if (action === 'primary') {
        this.openAt(this.cursor);
        return true;
      }
      if (action === 'back') {
        this.$emit('close');
        return true;
      }
      return true;
    },
  },
});
</script>
