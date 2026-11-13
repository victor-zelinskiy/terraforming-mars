<template>
  <div ref="root" class="con-drafttray"
       :class="{'con-drafttray--table': tableView}"
       role="status">
    <!-- The PILE is the tray's anchor and renders FIRST: flight targets are
         measured off its slots, and the wait/processing captions mount
         BELOW it — nothing can shift a slot under a mid-flight proxy. -->
    <div v-if="entries.length > 0"
         class="con-drafttray__pile"
         :class="{'con-drafttray__pile--pulse': pulsing, 'con-drafttray__pile--complete': setComplete}">
      <div class="con-drafttray__head">
        <span class="con-drafttray__label">{{ $t(setComplete ? 'Draft set complete' : 'DRAFTED CARDS') }}</span>
        <span class="con-drafttray__count">{{ entries.length }}</span>
        <span v-if="waiting" class="con-drafttray__hint"><GamepadGlyph control="secondary" /><span>{{ $t('Inspect') }}</span></span>
      </div>
      <!-- transition-group: appending a slot re-packs the CENTRED stack, and
           without FLIP every settled card teleports half a step sideways on
           the very frame a pick lands (the reported «ячейки дрожат»). The
           move class glides them instead; the new slot itself enters held
           (no enter animation — its proxy lands on it). -->
      <transition-group tag="div" name="con-tray"
                        class="con-drafttray__stack"
                        :class="{'con-drafttray__stack--dense': entries.length > 6}">
        <div v-for="(entry, idx) in entries" :key="entry.name + '-' + idx"
             class="con-drafttray__slot"
             :style="{zIndex: idx + 1}"
             :class="{'con-deal-hold': isHeld(entry.name), 'con-drafttray__slot--landed': justLanded[entry.name] === true}"
             :data-tray-slot="entry.name">
          <Card :card="entry.card" :key="entry.name" lightweight />
        </div>
      </transition-group>
    </div>

    <!-- The calm wait banner (the draftWait serving surface — leak detector). -->
    <div v-if="waiting" class="con-draftwait">
      <span class="con-draftwait__pulse" aria-hidden="true"></span>
      <span class="con-draftwait__text">
        <span class="con-draftwait__title">{{ $t('Waiting for draft cards') }}</span>
        <span class="con-draftwait__sub">{{ $t('Your pick is locked — waiting for the other players.') }}</span>
      </span>
    </div>
    <!-- The honest slow-server readout after a landed pick. -->
    <div v-else-if="processing" class="con-drafttray__processing">
      <span class="con-draftwait__pulse" aria-hidden="true"></span>
      <span>{{ $t('Processing selection…') }}</span>
    </div>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * THE DRAFT TRAY — the ONE persistent "selected cards area" of the draft
 * (top-centre, ON THE TABLE, under the task modal). Picked cards fly
 * hero-style INTO its slots (consoleDraftTray.ts owns the beats); during
 * the wait it hosts the calm banner; at the draft→research transition
 * the whole pile RISES into the research row.
 *
 * Pointer-inert (the pad grammar lives in the shell / task host). Slots
 * carry `data-tray-slot` — the flight directors land on them; a HELD slot
 * (proxy still flying above) hides via the shared `.con-deal-hold` rule,
 * Vue-managed (patch-proof), and reveals on the slot's own 160ms fade.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {$t} from '@/client/directives/i18n';
import Card from '@/client/components/card/CardFace.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {
  draftTrayState, isTraySlotHeld, registerTraySlotResolver, trayDisplayCards,
} from '@/client/console/cardDeal/consoleDraftTray';
import {useFlowScope} from '@/client/console/session/useFlowScope';

defineOptions({name: 'ConsoleDraftTray'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  /** The optional-repick wait state (the shell's draftWaitActive). */
  waiting: {type: Boolean, default: false},
});

const flow = useFlowScope('draft-tray');
// The tray's root element — the slots the flight directors land on are looked up inside it.
const root = useTemplateRef<HTMLElement>('root');
const pulsing = ref(false);
let cancelPulse = (() => {}) as () => void;
/** Per-slot one-shot settle accent (a landing accents ITSELF —
 *  the whole-pile pulse is reserved for set-complete). */
const justLanded = ref<Record<string, boolean>>({});
const landCancels = {} as Record<string, () => void>;
const serverDrafted = computed((): ReadonlyArray<CardModel> => {
  return props.playerView.draftedCards ?? [];
});
/** The rendered pile: the frozen scene snapshot, else server + optimistic.
 *  Server models are preferred (cost badges etc.); an optimistic /
 *  scene-frozen name degrades to a bare manifest render. */
const entries = computed((): Array<{name: CardName, card: CardModel | {name: CardName}}> => {
  const names = trayDisplayCards(serverDrafted.value.map((c) => c.name));
  return names.map((name) => ({
    name,
    card: serverDrafted.value.find((c) => c.name === name) ?? {name},
  }));
});
const processing = computed((): boolean => {
  return draftTrayState.processing;
});
const setComplete = computed((): boolean => {
  return draftTrayState.setComplete;
});
const tableView = computed((): boolean => {
  return draftTrayState.tableView;
});
function isHeld(name: CardName): boolean {
  return isTraySlotHeld(name);
}
function resolveSlot(name: CardName): HTMLElement | null {
  const rootNow = root.value;
  if (rootNow === null || typeof rootNow.querySelector !== 'function') {
    return null;
  }
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
  return rootNow.querySelector<HTMLElement>(`[data-tray-slot="${esc}"]`);
}

/** A touchdown settles ITS OWN slot (scale 1.05 → 1, one-shot). */
watch(() => draftTrayState.lastLand, (land: {n: number, name: string}) => {
  const name = land.name;
  if (name === '') {
    return;
  }
  landCancels[name]?.();
  delete justLanded.value[name];
  void nextTick(() => {
    justLanded.value[name] = true;
    landCancels[name] = flow.after(consoleMotionMs(300), 'a tray slot\'s landing accent reads', () => {
      delete justLanded.value[name];
      delete landCancels[name];
    });
  });
});
/** One-shot pile pulse — the set-complete beat only. */
watch(() => draftTrayState.pulseNonce, () => {
  cancelPulse();
  pulsing.value = false;
  void nextTick(() => {
    pulsing.value = true;
    cancelPulse = flow.after(consoleMotionMs(260), 'the tray\'s set-complete pulse reads', () => {
      pulsing.value = false;
    });
  });
});

onMounted(() => {
  registerTraySlotResolver((name) => resolveSlot(name));
});
onBeforeUnmount(() => {
  registerTraySlotResolver(undefined);
});
</script>
