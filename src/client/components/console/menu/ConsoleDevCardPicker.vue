<template>
  <div ref="root" class="cm-overlay cm-devcards" role="dialog" :aria-label="$t('Guaranteed cards')">
    <div class="cm-overlay__card cm-overlay__card--wide">
      <div class="cm-overlay__title">
        <span class="cm-devcards__devtag" aria-hidden="true">DEV</span>
        {{ $t('Guaranteed cards') }}
        <span v-if="crumb !== ''" class="cm-devcards__crumb">› {{ crumb }}</span>
      </div>

      <!-- ── PICKED: what the deal is rigged with ───────────────────────── -->
      <template v-if="view === 'picked'">
        <div class="cm-devcards__lede">{{ $t('These cards go on top of the decks, so the starting choice contains them. Picking any of them also makes you the first player, who is dealt first.') }}</div>
        <ConsoleScrollArea ref="scroll" class="cm-devcards__scroll">
          <div class="cm-devcards__list">
            <button
              type="button"
              class="cm-drow cm-drow--add"
              :class="{'cm-drow--cursor': pickedCursor === 0}"
              @click="openModules()"
              @mousemove="pickedCursor = 0"
            >
              <span class="cm-drow__name">＋ {{ $t('Add card') }}</span>
            </button>
            <button
              v-for="(entry, i) in picked"
              :key="entry.name"
              type="button"
              class="cm-drow"
              :class="[themeClass(entry.type), {'cm-drow--cursor': pickedCursor === i + 1}]"
              @click="removeAt(i)"
              @mousemove="pickedCursor = i + 1"
            >
              <span class="cm-drow__dot" aria-hidden="true"></span>
              <span class="cm-drow__name">{{ entry.title }}</span>
              <span class="cm-drow__type">{{ $t(typeLabelKey(entry.type)) }}</span>
            </button>
            <div v-if="picked.length === 0" class="cm-devcards__empty">{{ $t('No cards picked — the deal stays random.') }}</div>
          </div>
        </ConsoleScrollArea>
        <div class="cm-overlay__foot">
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t(pickedCursor === 0 ? 'Add card' : 'Remove') }}</span>
          <span v-if="picked.length > 0 && pickedCursor > 0" class="cm-overlay__foot-hint"><GamepadGlyph control="secondary" />{{ $t('Inspect') }}</span>
          <span v-if="picked.length > 0" class="cm-overlay__foot-hint"><GamepadGlyph control="view" />{{ $t('Clear all') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Done') }}</span>
        </div>
      </template>

      <!-- ── MODULES: level 1 ───────────────────────────────────────────── -->
      <template v-else-if="view === 'modules'">
        <ConsoleScrollArea ref="scroll" class="cm-devcards__scroll">
          <div class="cm-devcards__list">
            <button
              v-for="(m, i) in modules"
              :key="m.id"
              type="button"
              class="cm-drow cm-drow--module"
              :class="{'cm-drow--cursor': moduleCursor === i}"
              @click="openModule(i)"
              @mousemove="moduleCursor = i"
            >
              <span class="cm-drow__name">{{ $t(m.labelKey) }}</span>
              <span v-if="!m.enabled" class="cm-drow__off">{{ $t('Expansion is off') }}</span>
              <span class="cm-drow__count">
                <span v-if="m.chosen > 0" class="cm-drow__count-on">{{ m.chosen }}</span>
                <span class="cm-drow__count-total">{{ m.total }}</span>
              </span>
            </button>
          </div>
        </ConsoleScrollArea>
        <div class="cm-overlay__foot">
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t('Open') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
        </div>
      </template>

      <!-- ── CARDS: level 2 ─────────────────────────────────────────────── -->
      <template v-else>
        <ConsoleScrollArea ref="scroll" class="cm-devcards__scroll">
          <div class="cm-devcards__list">
            <template v-for="(row, i) in cardRows" :key="row.key">
              <div v-if="row.kind === 'header'" class="cm-devcards__group">
                <span class="cm-devcards__group-name">{{ $t(row.labelKey) }}</span>
                <span class="cm-devcards__group-count">{{ row.count }}</span>
              </div>
              <button
                v-else
                type="button"
                class="cm-drow"
                :class="[themeClass(row.entry.type), {'cm-drow--cursor': cardCursor === i, 'cm-drow--chosen': row.entry.chosen, 'cm-drow--gated': gateText(row.entry.name) !== ''}]"
                :data-dev-gate="gateOf(row.entry.name)"
                @click="toggleAt(i)"
                @mousemove="cardCursor = i"
              >
                <span class="cm-drow__dot" aria-hidden="true"></span>
                <span class="cm-drow__name">{{ row.entry.title }}</span>
                <!-- A GATED card is shown, marked with the module it waits for, and refused (never hidden). -->
                <span v-if="gateText(row.entry.name) !== ''" class="cm-drow__off">{{ gateText(row.entry.name) }}</span>
                <span v-if="row.entry.chosen" class="cm-drow__mark" aria-hidden="true">✓</span>
              </button>
            </template>
          </div>
        </ConsoleScrollArea>
        <div class="cm-overlay__foot">
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="confirm" />{{ $t(currentCardChosen ? 'Remove' : 'Add') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="secondary" />{{ $t('Inspect') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />{{ $t('Card type') }}</span>
          <span class="cm-overlay__foot-hint"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
        </div>
      </template>
    </div>

    <!-- Fullscreen inspect (X) renders through the ONE `consoleCardZoom`
         pipeline — served pre-game by the App-level ConsoleMenuZoomHost
         (console chrome, choreography and the pad carve-out are its job).
         The picker stays mounted underneath, so toggles made in fullscreen
         are reflected in the list without losing its cursor or scroll. -->
  </div>
</template>

<script setup lang="ts">
/**
 * CONSOLE-NATIVE DEV CARD PICKER — the «Тестовый режим» sub-setting.
 *
 * Deliberately a UTILITY, not a premium surface: plain rows, no card faces, no
 * cinematics. It exists so an e2e run or a feature check can guarantee a card
 * in the starting choice instead of re-rolling the deal.
 *
 * Three levels, one overlay:
 *   PICKED  — what is currently rigged (A = add / remove, Y = remove, View = clear)
 *   MODULES — the fork's playable module scope (GUARANTEED_MODULES)
 *   CARDS   — that module's cards, grouped by type, alphabetical by the
 *             LOCALIZED title; A toggles, LB/RB jump between type groups.
 *
 * X inspects the cursored card fullscreen — the console-wide inspect verb —
 * through the ONE `consoleCardZoom` module (served pre-game by the App-level
 * ConsoleMenuZoomHost, whose pad carve-out runs before this handler).
 *
 * Host-routed pad intents via `handleIntent`, mirroring ConsoleAdminRollback.
 */
import {computed, nextTick, onBeforeUnmount, ref, useTemplateRef} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardType} from '@/common/cards/CardType';
import {Expansion, GameModule} from '@/common/cards/GameModule';
import {CardModel} from '@/common/models/CardModel';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex, stepSelectable} from '@/client/console/consoleRouter';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {closeConsoleCardZoom, consoleCardZoom, openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {createGameState} from '@/client/components/create/premium/createGameState';
import {
  GUARANTEED_MODULES,
  GuaranteedCardEntry,
  GuaranteedPickRow,
  clearGuaranteedCards,
  guaranteedChosenEntries,
  guaranteedGateOf,
  guaranteedModuleCounts,
  guaranteedNames,
  guaranteedPickRows,
  guaranteedThemeOf,
  guaranteedTypeLabelKey,
  removeGuaranteedCard,
  toggleGuaranteedCard,
} from '@/client/components/create/premium/devGuaranteedCards';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import {expansionLabelKey} from '@/client/components/create/premium/createGameMeta';

type PickerView = 'picked' | 'modules' | 'cards';

/** ◄ / ► page step through a long card list. */
const PAGE_ROWS = 10;

defineOptions({name: 'ConsoleDevCardPicker'});
const emit = defineEmits(['close']);

const scroll = useTemplateRef<{ensureVisible?: (el: Element | null) => void}>('scroll');
const root = useTemplateRef<HTMLElement>('root');
const view = ref('picked' as PickerView);
const pickedCursor = ref(0);
const moduleCursor = ref(0);
const cardCursor = ref(0);
const module = ref('base' as GameModule);
/** True while the shared fullscreen viewer was opened FROM this picker. */
const zoomOpenedHere = ref(false);

const picks = computed(() => {
  return createGameState.config.guaranteedCards;
});
const chosenNames = computed((): ReadonlySet<CardName> => {
  return guaranteedNames(picks.value);
});
const picked = computed((): ReadonlyArray<GuaranteedCardEntry> => {
  return guaranteedChosenEntries(picks.value);
});
const modules = computed((): ReadonlyArray<{id: GameModule, labelKey: string, total: number, chosen: number, enabled: boolean}> => {
  const selected = createGameState.config.selectedExpansions;
  const chosen = chosenNames.value;
  return GUARANTEED_MODULES.map((m) => ({
    ...m,
    ...guaranteedModuleCounts(m.id, chosen),
    // Base is always in; an expansion that is OFF still works (the server
    // adds a guaranteed card to the pool), but the dev should see it.
    enabled: m.id === 'base' || selected[m.id as keyof typeof selected] === true,
  }));
});
const cardRows = computed((): ReadonlyArray<GuaranteedPickRow> => {
  return guaranteedPickRows(module.value, chosenNames.value);
});
/** Row-parallel selectability — headers are walked past, never landed on. */
const cardSelectable = computed((): ReadonlyArray<boolean> => {
  return cardRows.value.map((row) => row.kind === 'card');
});
const currentEntry = computed((): GuaranteedCardEntry | undefined => {
  const row = cardRows.value[cardCursor.value];
  return row !== undefined && row.kind === 'card' ? row.entry : undefined;
});
const currentCardChosen = computed((): boolean => {
  return currentEntry.value?.chosen === true;
});
const crumb = computed((): string => {
  if (view.value === 'modules') {
    return $t('Add card');
  }
  if (view.value === 'cards') {
    const meta = GUARANTEED_MODULES.find((m) => m.id === module.value);
    return meta === undefined ? '' : $t(meta.labelKey);
  }
  return '';
});

/** The expansion this card's deal waits for (not selected in the creator), or undefined. */
function gateOf(name: CardName): Expansion | undefined {
  return guaranteedGateOf(name, createGameState.config.selectedExpansions);
}
/** «Требует «Венера»» — the gate in words; '' for a dealable card. */
function gateText(name: CardName): string {
  const gate = gateOf(name);
  return gate === undefined ? '' : translateTextWithParams('Requires ${0}', [$t(expansionLabelKey(gate))]);
}
function typeLabelKey(type: CardType): string {
  return guaranteedTypeLabelKey(type);
}
function themeClass(type: CardType): string {
  const theme = guaranteedThemeOf(type);
  return theme === undefined ? '' : `cm-drow--${theme}`;
}
// ── Input ────────────────────────────────────────────────────────────
/** Host-routed pad intents. Always consumes — this overlay is modal. */
function handleIntent(intent: GamepadIntent): boolean {
  // While the shared fullscreen viewer is open, its HOST owns the pad
  // (the pre-game carve-out runs before this handler) — swallow defensively.
  if (consoleCardZoom.card !== undefined) {
    return true;
  }
  // No `secondary` override: X keeps its DEFAULT meaning here — the
  // console-wide inspect verb — rather than the create screen's «Запуск».
  const action = consoleActionOf(intent);
  switch (view.value) {
  case 'picked': return handlePickedIntent(intent, action);
  case 'modules': return handleModulesIntent(intent, action);
  default: return handleCardsIntent(intent, action);
  }
}
function handlePickedIntent(intent: GamepadIntent, action: string | undefined): boolean {
  const rows = picked.value.length + 1;
  if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
    pickedCursor.value = stepIndex(pickedCursor.value, intent.dir === 'down' ? 1 : -1, rows);
    keepCursorVisible();
    return true;
  }
  if (action === 'primary') {
    if (pickedCursor.value === 0) {
      openModules();
    } else {
      removeAt(pickedCursor.value - 1);
    }
    return true;
  }
  if (action === 'fullscreen') {
    // Y — the create screen's established «удалить» verb.
    if (pickedCursor.value > 0) {
      removeAt(pickedCursor.value - 1);
    }
    return true;
  }
  if (action === 'inspect') {
    const entry = picked.value[pickedCursor.value - 1];
    if (entry !== undefined) {
      openZoom(picked.value.map((e) => e.name), pickedCursor.value - 1);
    }
    return true;
  }
  if (action === 'reset') {
    clearGuaranteedCards(picks.value);
    pickedCursor.value = 0;
    return true;
  }
  if (action === 'back') {
    emit('close');
  }
  return true;
}
function handleModulesIntent(intent: GamepadIntent, action: string | undefined): boolean {
  if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
    moduleCursor.value = stepIndex(moduleCursor.value, intent.dir === 'down' ? 1 : -1, modules.value.length);
    keepCursorVisible();
    return true;
  }
  if (action === 'primary') {
    openModule(moduleCursor.value);
    return true;
  }
  if (action === 'back') {
    view.value = 'picked';
    keepCursorVisible();
  }
  return true;
}
function handleCardsIntent(intent: GamepadIntent, action: string | undefined): boolean {
  if (intent.kind === 'nav') {
    if (intent.dir === 'up' || intent.dir === 'down') {
      cardCursor.value = stepSelectable(cardCursor.value, intent.dir === 'down' ? 1 : -1, cardSelectable.value);
      keepCursorVisible();
      return true;
    }
    // ◄ ► page through a long list without holding the stick.
    const step = intent.dir === 'right' ? PAGE_ROWS : -PAGE_ROWS;
    const target = stepIndex(cardCursor.value, step, cardRows.value.length);
    cardCursor.value = stepSelectable(target, 0, cardSelectable.value);
    keepCursorVisible();
    return true;
  }
  if (action === 'primary') {
    toggleAt(cardCursor.value);
    return true;
  }
  if (action === 'inspect') {
    const names = cardRows.value.flatMap((row) => row.kind === 'card' ? [row.entry.name] : []);
    const at = names.indexOf(currentEntry.value?.name as CardName);
    if (at >= 0) {
      openZoom(names, at);
    }
    return true;
  }
  if (action === 'prevSection' || action === 'nextSection') {
    jumpGroup(action === 'nextSection' ? 1 : -1);
    return true;
  }
  if (action === 'back') {
    view.value = 'modules';
    keepCursorVisible();
  }
  return true;
}
// ── Navigation ───────────────────────────────────────────────────────
function openModules(): void {
  view.value = 'modules';
  keepCursorVisible();
}
function openModule(i: number): void {
  const meta = modules.value[i];
  if (meta === undefined) {
    return;
  }
  moduleCursor.value = i;
  module.value = meta.id;
  view.value = 'cards';
  // Land on the first real card, never on a group heading.
  cardCursor.value = stepSelectable(0, 0, cardSelectable.value);
  keepCursorVisible();
}
/** LB / RB — jump to the previous/next card-TYPE group heading. */
function jumpGroup(step: 1 | -1): void {
  const rows = cardRows.value;
  const headers = rows.flatMap((row, i) => row.kind === 'header' ? [i] : []);
  if (headers.length === 0) {
    return;
  }
  const currentGroup = headers.filter((i) => i <= cardCursor.value).length - 1;
  const next = Math.min(headers.length - 1, Math.max(0, currentGroup + step));
  cardCursor.value = stepSelectable(headers[next], 1, cardSelectable.value);
  keepCursorVisible();
}
function keepCursorVisible(): void {
  void nextTick(() => {
    const scrollNow = scroll.value ?? undefined;
    scrollNow?.ensureVisible?.(root.value?.querySelector('.cm-drow--cursor') ?? null);
  });
}
// ── Picks ────────────────────────────────────────────────────────────
function toggleAt(i: number): void {
  const row = cardRows.value[i];
  if (row === undefined || row.kind !== 'card') {
    return;
  }
  cardCursor.value = i;
  // A gated card is refused — unless it is already chosen (taking it back is always allowed).
  if (!row.entry.chosen && gateOf(row.entry.name) !== undefined) {
    return;
  }
  toggleGuaranteedCard(picks.value, row.entry.name);
}
function removeAt(i: number): void {
  const entry = picked.value[i];
  if (entry === undefined) {
    return;
  }
  removeGuaranteedCard(picks.value, entry.name);
  pickedCursor.value = Math.min(pickedCursor.value, picked.value.length);
}
// ── Fullscreen inspect — the ONE console zoom pipeline ───────────────
/**
 * X opens the SHARED fullscreen viewer via `consoleCardZoom`; the
 * App-level ConsoleMenuZoomHost serves presentation + input. The rows
 * here are plain LIST rows (no card face on screen), so the origin is
 * TEXTUAL — the inspector rise, never a fake lift out of a text row.
 * A in fullscreen toggles the pick through the select bridge.
 */
function openZoom(names: ReadonlyArray<CardName>, at: number): void {
  const list = names.map((name) => ({name} as CardModel));
  if (list[at] === undefined) {
    return;
  }
  zoomOpenedHere.value = true;
  openConsoleCardZoom(list, at, {
    isSelected: (name) => chosenNames.value.has(name),
    toggle: (name) => {
      if (!chosenNames.value.has(name) && gateOf(name) !== undefined) {
        return;
      }
      toggleGuaranteedCard(picks.value, name);
      if (view.value === 'picked') {
        pickedCursor.value = Math.min(pickedCursor.value, picked.value.length);
      }
    },
  }, undefined, {
    contextLabel: 'Guaranteed cards',
    origin: {kind: 'textual'},
  });
}

onBeforeUnmount(() => {
  // Leaving with the viewer still up: close the module viewer we opened —
  // the mounted zoom host observes the clear and unwinds its own state.
  if (zoomOpenedHere.value && consoleCardZoom.card !== undefined) {
    closeConsoleCardZoom();
  }
  zoomOpenedHere.value = false;
});
defineExpose({handleIntent});
</script>
