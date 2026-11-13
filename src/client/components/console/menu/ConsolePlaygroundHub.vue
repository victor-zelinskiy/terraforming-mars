<template>
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
      <!-- The Turmoil Redux resolutions stand is INTERACTIVE (a catalog cursor,
           the influence / context / winner controls): it gets the pad first
           through the stand's `padTarget`, and hands scroll / sections / B back. -->
      <ConsolePlaygroundStand
        v-else-if="open === 'redux-resolutions'"
        ref="stand"
        titleKey="Redux resolutions showcase"
        :padTarget="reduxStandTarget"
        @close="open = undefined"
      >
        <ConsoleResolutionsPlayground ref="reduxPg" embedded />
      </ConsolePlaygroundStand>
      <!-- The campaign TENDERS stand is interactive too (the catalog cursor, the simulated deal, the real bidding scene). -->
      <ConsolePlaygroundStand
        v-else-if="open === 'campaign-tenders'"
        ref="stand"
        titleKey="Tenders showcase"
        :padTarget="tendersStandTarget"
        @close="open = undefined"
      >
        <ConsoleTendersPlayground ref="tendersPg" embedded />
      </ConsolePlaygroundStand>
    </Teleport>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * PLAYGROUND HUB — the admin-only «Полигон» menu overlay. A LIST of visual
 * dev stands (today: the premium-card showcase; the registry below is where
 * the next stand becomes one row). Picking a row opens the stand FULLSCREEN
 * over the menu in the shared ConsolePlaygroundStand chassis; B returns to
 * this list, B again returns to the menu.
 *
 * Pad ownership mirrors ConsoleAdminRollback: the menu forwards every intent
 * to `handleIntent` while this overlay is up; a fullscreen stand gets them
 * forwarded one level deeper.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, ref, useTemplateRef} from 'vue';
import {$t} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex} from '@/client/console/consoleRouter';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsolePlaygroundStand from '@/client/components/console/menu/ConsolePlaygroundStand.vue';
// Async: every showcase pulls its own catalog machinery — the menu must not
// pay that weight until an admin actually opens the stand. The five lazy bindings live in a MODULE (a wrapper keeps
// the component it resolved — declared here it would be created anew with every mount of the hub): see the note in
// consolePlaygroundHubAsync.ts.
import {
  PremiumCardsPlayground,
  PlayerCubePlayground,
  CardLorePlayground,
  ConsoleResolutionsPlayground,
  ConsoleTendersPlayground,
} from '@/client/components/console/menu/consolePlaygroundHubAsync';

type StandId = 'premium-cards' | 'player-cubes' | 'card-lore' | 'redux-resolutions' | 'campaign-tenders';
type StandRow = {id: StandId, labelKey: string, subKey: string, glyph: string};

defineOptions({name: 'ConsolePlaygroundHub'});
const emit = defineEmits(['close']);

const stand = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('stand');
const reduxPg = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('reduxPg');
const tendersPg = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('tendersPg');
const cursor = ref(0);
const open = ref<StandId | undefined>(undefined);
const stands = computed((): ReadonlyArray<StandRow> => {
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
    {
      id: 'redux-resolutions',
      labelKey: 'Redux resolutions showcase',
      subKey: 'Every catalogued resolution: the face, the inspector, the influence-scaled payout and the shared recipient picker',
      glyph: '⚖',
    },
    {
      id: 'campaign-tenders',
      labelKey: 'Tenders showcase',
      subKey: 'Every tender of the Committee: the certificate at its sizes and states, the fullscreen viewer, a simulated Register deal and the real bidding scene',
      glyph: '§',
    },
  ];
});

/** The resolutions stand's pad target — the slotted showcase (resolved late: it mounts async). */
function reduxStandTarget(): {handleIntent?: (intent: GamepadIntent) => boolean} | undefined {
  return reduxPg.value ?? undefined;
}
/** The tenders stand's pad target — the same late resolution. */
function tendersStandTarget(): {handleIntent?: (intent: GamepadIntent) => boolean} | undefined {
  return tendersPg.value ?? undefined;
}
function openAt(i: number): void {
  cursor.value = i;
  const stand = stands.value[i];
  if (stand !== undefined) {
    open.value = stand.id;
  }
}
function handleIntent(intent: GamepadIntent): boolean {
  // A fullscreen stand owns the pad while it is up.
  if (open.value !== undefined) {
    const standNow = stand.value;
    return standNow?.handleIntent?.(intent) ?? true;
  }
  const action = consoleActionOf(intent);
  if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
    cursor.value = stepIndex(cursor.value, intent.dir === 'down' ? 1 : -1, stands.value.length);
    return true;
  }
  if (action === 'primary') {
    openAt(cursor.value);
    return true;
  }
  if (action === 'back') {
    emit('close');
    return true;
  }
  return true;
}

defineExpose({handleIntent});
</script>
