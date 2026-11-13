<template>
  <section class="con-colfocus__targetstage" ref="zone">
    <ConsolePlayedTargetStep v-if="focus !== undefined"
                             ref="targetStep"
                             :model="model"
                             :layout="layout"
                             :focus="focus"
                             :bandHeight="bandH"
                             :lockedCard="lockedCard" />
  </section>
</template>

<script setup vapor lang="ts">
/*
 * THE TRADE'S TARGET STEP — «куда положить награду» as a DEEPER LEVEL of the
 * trade's own stage. ONE host for every stage a trade composes on: the colony
 * focus stage (a reward / bonus that lands on a card — Titan's floaters) and
 * the fleet-dock stage (a dock whose reward lands on a card — TR27 Aurora
 * Station). It owns the step's room, the cursor over the SHARED played-card
 * selector (`ConsolePlayedTargetStep` — the very surface the blue-action and
 * play composers descend into) and the step's own grammar; the stage owns
 * WHEN it stands (`sub === 'targets'`) and what the answer means (a capture).
 *
 * The root keeps the colony stage's class on purpose: its box, its light pool
 * and its pose are one design in both stages (a stage positions the room).
 * No ask line of its own: the selector's contract header states the server's
 * ask and the target scope.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, onMounted, PropType, ref, useTemplateRef} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {NavDirection} from '@/client/gamepad/gamepadPollModel';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir,
  planPlayedTargetLayout, playedTargetAt,
  reseatPlayedTargetFocus, stepPlayedTargetFocus, stepPlayedTargetFocusVia, turnPlayedTargetPageVia, stepPlayedTargetOwner,
} from '@/client/console/played/consolePlayedTargetModel';
import {openPlayedTargetZoom} from '@/client/console/played/playedTargetDossier';
import {openTradeTargetFocus} from '@/client/console/colonyTrade/colonyTradeTargetStep';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {playColonyTargetStepEnter, playColonyTargetStepLeave} from '@/client/console/consoleColonyFocusMotion';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';

defineOptions({name: 'ConsoleTradeTargetStep'});
const props = defineProps({
  /** The selector's model of THIS step (`colonyTradeTargetStep.buildColonyTradeTargetModel`). */
  model: {type: Object as PropType<PlayedTargetModel>, required: true},
  /** The card already chosen for this step ('' = none) — the cursor lands on it and the selector marks it. */
  lockedCard: {type: String, default: ''},
});
const emit = defineEmits(['pick']);

const zone = useTemplateRef<HTMLElement>('zone');
const targetStep = useTemplateRef<{cells?: () => ReadonlyArray<PlayedTargetCell>} & {ensureFocusVisible?: () => void}>('targetStep');
/** Seeded from the ONE opening answer (`openTradeTargetFocus`) — the stage opens the step only when it exists. */
const focus = ref(openTradeTargetFocus(props.model, props.lockedCard) as PlayedTargetFocus | undefined);
const zoneW = ref(0);
const zoneH = ref(0);

const layout = computed((): PlayedTargetLayout => {
  return planPlayedTargetLayout({
    owners: props.model.owners,
    availW: zoneW.value > 0 ? zoneW.value : 900,
    ui: conUiScale(),
    handheld: consoleLayoutState.profile === 'handheld',
  });
});
/** The step's vertical budget — the zone IS the room (its own contract header and rail are part of the step). */
const bandH = computed((): number => {
  return Math.max(0, zoneH.value);
});

/**
 * THE STEP TAKES THE ROOM IT IS GIVEN — measured once it stands. CONTENT
 * box, not client box: a budget fed the zone's own padding solves cards for
 * room that does not exist — a hairline scroll rail and a cropped bottom row
 * at 4K.
 */
function measureZone(): void {
  const zoneNow = zone.value ?? undefined;
  if (zoneNow === undefined || zoneNow === null) {
    return;
  }
  const cs = getComputedStyle(zoneNow);
  zoneW.value = Math.max(0, zoneNow.clientWidth -
    (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0));
  zoneH.value = Math.max(0, zoneNow.clientHeight -
    (parseFloat(cs.paddingTop) || 0) - (parseFloat(cs.paddingBottom) || 0));
}
/** B — the step lets go in its own phrase, then the stage drops it (`done`). */
function close(done: () => void): void {
  const zoneNow = zone.value ?? undefined;
  if (zoneNow !== undefined && zoneNow !== null) {
    playColonyTargetStepLeave(zoneNow, done);
  } else {
    done();
  }
}
function nav(dir: NavDirection): void {
  const owners = props.model.owners;
  const focusNow = focus.value;
  if (focusNow === undefined || owners.length === 0) {
    return;
  }
  const map: Record<string, PlayedTargetNavDir | undefined> =
    {left: 'left', right: 'right', up: 'up', down: 'down'};
  const d = map[dir as string];
  if (d === undefined) {
    return;
  }
  const step = targetStep.value ?? undefined;
  const cells = step?.cells?.() ?? [];
  const next = cells.length > 0 ?
    stepPlayedTargetFocusVia(step, focusNow, d, cells) :
    stepPlayedTargetFocus(focusNow, d, owners, layout.value);
  if (next === undefined) {
    return; // an edge HOLDS — never a wrap, never a silent owner change
  }
  focus.value = next;
  targetStep.value?.ensureFocusVisible?.();
}
/** LB/RB — the owner axis, tabbed mode only (the shared grammar; a trade's targets are normally the viewer's own single group). */
function cycleOwner(delta: number): void {
  const owners = props.model.owners;
  const focusNow = focus.value;
  // A PAGED band: LB/RB turn its page where they walk nothing else.
  const turned = turnPlayedTargetPageVia(targetStep.value, focusNow, delta);
  if (turned !== undefined) {
    focus.value = turned;
    targetStep.value?.ensureFocusVisible?.();
    return;
  }
  if (focusNow === undefined || (layout.value.mode !== 'tabs' && layout.value.mode !== 'board') || owners.length < 2) {
    return;
  }
  const ownerId = stepPlayedTargetOwner(focusNow.ownerId, delta, owners);
  if (ownerId !== focusNow.ownerId) {
    focus.value = reseatPlayedTargetFocus({ownerId, index: 0}, owners) ?? focusNow;
  }
}
/**
 * A — the focused candidate is THE answer. The stage turns it into its
 * capture (the same `{type:'card', cards:[name]}` the batch always sent):
 * the selector is presentation, never a second source of truth.
 */
function confirm(): void {
  const candidate = playedTargetAt(focus.value, props.model.owners);
  if (candidate !== undefined) {
    emit('pick', candidate.cardName as CardName);
  }
}
/** X — the focused candidate fullscreen, lifting from its own slot (the console-wide «X inspects the current object»). */
function inspect(): void {
  const owners = props.model.owners;
  const candidate = playedTargetAt(focus.value, owners);
  if (candidate === undefined) {
    return;
  }
  // THE ONE DOOR — with the TARGET DOSSIER.
  openPlayedTargetZoom({model: props.model, cardName: candidate.cardName, getRoot: () => zone.value ?? undefined});
}

onMounted(() => {
  measureZone();
  const zoneNow = zone.value ?? undefined;
  if (zoneNow !== undefined && zoneNow !== null) {
    playColonyTargetStepEnter(zoneNow);
  }
});
defineExpose({close, confirm, cycleOwner, inspect, nav});
</script>
