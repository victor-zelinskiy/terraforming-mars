<template>
  <div class="cm-stand" role="dialog" :aria-label="$t(titleKey)">
    <div class="cm-stand__head">
      <span class="cm-stand__kicker">{{ $t('Playground') }}</span>
      <span class="cm-stand__title">{{ $t(titleKey) }}</span>
    </div>
    <ConsoleScrollArea ref="scroll" class="cm-stand__scroll">
      <div ref="body" class="cm-stand__body">
        <slot />
      </div>
    </ConsoleScrollArea>
    <!-- ONE command line on screen: the stand's hints yield while the fullscreen inspector holds the footer (P-27). -->
    <div v-show="zoom.card === undefined" class="cm-stand__foot">
      <span class="cm-stand__hint"><GamepadGlyph control="stickR" />{{ $t('Scroll') }}</span>
      <span class="cm-stand__hint"><GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />{{ $t('Sections') }}</span>
      <span v-if="sectionTitle !== ''" class="cm-stand__section">{{ sectionTitle }}</span>
      <span class="cm-stand__hint cm-stand__hint--right"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * CONSOLE-NATIVE PLAYGROUND STAND — the fullscreen chassis every dev
 * showcase renders inside. The showcase content itself stays a plain
 * document (the premium-cards showcase is a long reference sheet, not a
 * game surface); what makes it console-native lives HERE: the ONE
 * ConsoleScrollArea (no native scrollbar — console rule), pad-driven
 * scrolling, section jumps, and a foot bar that speaks glyphs, never
 * button literals.
 *
 * Two hosts, one component:
 *  - the main-menu Playground hub (admin-only) forwards pad intents via
 *    `handleIntent` — the hub owns the pad while its overlay is up;
 *  - the `?premiumCardsPlayground` deep link (App) mounts it `standalone`,
 *    where it installs its own pre-game pad pipe (installMenuPad) and B
 *    exits to the main menu. The deep link stays because e2e/visual
 *    verification scripts drive the showcase by URL.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {onBeforeUnmount, onMounted, PropType, ref, useTemplateRef} from 'vue';
import {$t} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {installMenuPad} from '@/client/console/menu/consoleMenuPad';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';
import {consoleCardZoom} from '@/client/console/consoleCardZoom';

/** One d-pad step / held-stick tick of scroll, in px. */
const SCROLL_STEP = 220;

defineOptions({name: 'ConsolePlaygroundStand'});
const props = defineProps({
  titleKey: {
    type: String,
    required: true,
  },
  /**
   * Deep-link mode (`?premiumCardsPlayground`): no hub above to forward
   * pad intents, so the stand claims the pre-game pad slot itself.
   */
  standalone: {
    type: Boolean,
    required: false,
    default: false,
  },
  /** What counts as a section header for LB/RB jumps (h2 by default;
   *  a showcase with its own header markup passes its selector). */
  sectionSelector: {
    type: String,
    required: false,
    default: 'h2',
  },
  /**
   * An INTERACTIVE showcase (one with a cursor of its own — the resolutions
   * stand) gets the pad FIRST: the host resolves the slotted component and
   * the stand forwards every intent to its `handleIntent`; what it declines
   * (returns false) falls through to the stand's own scroll / sections / B.
   */
  padTarget: {
    type: Function as PropType<(() => {handleIntent?: (intent: GamepadIntent) => boolean} | undefined) | undefined>,
    required: false,
    default: undefined,
  },
});
const emit = defineEmits(['close']);

const scroll = useTemplateRef<{rootEl: HTMLElement | null, scrollByPx: (dy: number) => void, ensureVisible: (el: Element | null, margin?: number) => void, scrollToStart: () => void}>('scroll');
const body = useTemplateRef<HTMLElement>('body');
/** The fullscreen inspector's state — the stand's hint line yields to its footer. */
const zoom = consoleCardZoom;
let offPad: (() => void) | undefined;
/** Title of the section the viewport top currently sits in. */
const sectionTitle = ref('');
const sectionIdx = ref(0);

/** Section anchors = the showcase's own headers — no registry to drift. */
function sections(): Array<HTMLElement> {
  const bodyNow = body.value;
  return bodyNow === null ? [] : Array.from(bodyNow.querySelectorAll(props.sectionSelector));
}
function scrollApi(): {scrollByPx: (dy: number) => void, ensureVisible: (el: Element | null, margin?: number) => void, scrollToStart: () => void} | undefined {
  return scroll.value ?? undefined;
}
function jumpSection(dir: 1 | -1): void {
  const sectionsNow = sections();
  if (sectionsNow.length === 0) {
    return;
  }
  sectionIdx.value = Math.max(0, Math.min(sectionsNow.length - 1, sectionIdx.value + dir));
  const target = sectionsNow[sectionIdx.value];
  // Land the header at the viewport top. ConsoleScrollArea's contract
  // forbids scrollIntoView (it may walk into outer containers) — compute
  // the delta against the scroll area's own box and drive its API.
  const scrollEl = scroll.value?.rootEl ?? undefined;
  if (scrollEl !== undefined) {
    const delta = target.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top - 16;
    scrollApi()?.scrollByPx(delta);
  }
  sectionTitle.value = target.textContent?.trim() ?? '';
}
function refreshSectionTitle(): void {
  const first = sections()[sectionIdx.value];
  sectionTitle.value = first?.textContent?.trim() ?? '';
}
function handleIntent(intent: GamepadIntent): boolean {
  const action = consoleActionOf(intent);
  // An interactive showcase answers first; B always stays the stand's.
  if (action !== 'back') {
    const target = props.padTarget?.();
    if (target?.handleIntent?.(intent) === true) {
      return true;
    }
  }
  if (action === 'back') {
    emit('close');
    return true;
  }
  if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
    scrollApi()?.scrollByPx(intent.dir === 'down' ? SCROLL_STEP : -SCROLL_STEP);
    return true;
  }
  if (intent.kind === 'scroll') {
    // dy is a per-frame deflection (−1…1) — scaled to pixels.
    scrollApi()?.scrollByPx(intent.dy * 24 * conUiScale());
    return true;
  }
  if (intent.kind === 'press' && intent.button === 'bumperL') {
    jumpSection(-1);
    return true;
  }
  if (intent.kind === 'press' && intent.button === 'bumperR') {
    jumpSection(1);
    return true;
  }
  // Swallow everything else — nothing under the stand should react.
  return true;
}

onMounted(() => {
  if (props.standalone) {
    offPad = installMenuPad((intent) => handleIntent(intent), {ownsStick: true});
  }
  refreshSectionTitle();
});
onBeforeUnmount(() => {
  offPad?.();
});
defineExpose({handleIntent});
</script>
