<template>
  <div ref="root" class="con-venusstep" :data-venus-level="picking ? 'pick' : 'step'">
    <Transition name="con-venusstep-level">
      <ConsoleWildChoiceStep v-show="!picking" class="con-venusstep__level"
                             :spec="spec" :parts="parts" :focus="focus" :stock="stock" venus
                             :head="{title: 'Venus bonus', reading: stepReading}" or-title="Final step · 30 %"
                             :candidates="candidates" :vp-box="vpBox" />
    </Transition>
    <Transition name="con-venusstep-level">
      <div v-if="picking && pickModel !== undefined" class="con-venusstep__level con-venusstep__pick" ref="pickZone"
           data-venus-pick :data-venus-pick-focused="pickFocusedName ?? ''">
        <!-- THE STEP'S OWN HEAD STAYS — «Бонус Венеры · Шкала Венеры a → b %» on both levels, so only the body changes
             one level deeper; the stage itself is the crumb's («… › БОНУС ВЕНЕРЫ · КАРТА»), the question the head's
             quiet tail. The selector therefore states no ask and no owner bar of its own (`hostStatesAsk`). -->
        <div class="con-wildstep__head con-venusstep__pick-head">
          <span class="con-wildstep__title">{{ $t('Venus bonus') }}</span>
          <span v-if="stepReading !== ''" class="con-wildstep__reading">{{ stepReading }}</span>
          <span class="con-venusstep__pick-ask">{{ $t('Choose a card for the wild resource') }}</span>
        </div>
        <ConsolePlayedTargetStep v-if="pickH > 0"
                                 ref="pickStep"
                                 :model="pickModel"
                                 :layout="pickLayout"
                                 :focus="pickFocusShown"
                                 :selection="{mode: 'single'}"
                                 :bandHeight="pickH"
                                 :lockedCard="parts.wild?.card ?? ''"
                                 hostStatesAsk />
      </div>
    </Transition>
  </div>
</template>

<script setup lang="ts">
/*
 * THE VENUS BONUS — THE INNER PRE-SELECT (P89 · ledger EM), standing on the SHARED wild-resource choice since P43
 *       (ledger EO — `ConsoleWildChoiceStep`, one composition for every «a standard resource OR a resource on a card»).
 *       This wrapper only states the bonus: its head («Бонус Венеры · Шкала Венеры a → b %»), the 30 % finish's title, the
 *       specification (`venusWildSpec` — the base always laid out, the OR only where it is really taken, the grid a dial)
 *       and the candidates' live models. Every host (the play sheet, the blue action's setup, the colony trade's stage)
 *       mounts THIS, so the three can never draw the bonus differently.
 *
 *       «НА КАРТУ» IS A LEVEL OF ITS OWN (the owner, 2026-11-03 — thirteen holders squeezed into one strip of stamps:
 *       «класть на карту делать ЕЩЁ ОДНИМ вложенным шагом, иначе мы не можем отдать достаточно свободного места»). In
 *       the step it is ONE door row; past the door (`focus.zone === 'pick'`) the step steps aside and the console's
 *       target selector takes the WHOLE column — pages, the outcome tags, X with the target dossier. The two levels are
 *       one layer stack (never a blink): the step releases in place, the pick unfolds from under it; B the same way back.
 *       The selector's cursor and boxes are this component's — a host forwards the d-pad (`pickNav`), the page turn
 *       (`pickTurn`), X (`pickInspect`) and reads A's answer off `pickFocused`.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

import {computed, nextTick, onBeforeUnmount, PropType, ref, useTemplateRef, watch} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {PlayerInputModel, VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import ConsoleWildChoiceStep from '@/client/components/console/foundation/ConsoleWildChoiceStep.vue';
import ConsolePlayedTargetStep from '@/client/components/console/played/ConsolePlayedTargetStep.vue';
import {VenusBonusParts, venusBonusMetaOf, venusStepReading, venusWildCandidates} from '@/client/console/venusBonus/venusBonusPreselect';
import {VenusInnerFocus, venusWildSpec} from '@/client/console/venusBonus/venusBonusInner';
import {buildVenusWildTargetModel} from '@/client/console/venusBonus/venusWildTargetStep';
import {WildChoiceSpec} from '@/client/console/wildChoice/wildChoiceInner';
import {
  PlayedTargetCell, PlayedTargetFocus, PlayedTargetLayout, PlayedTargetModel, PlayedTargetNavDir, findPlayedTargetFocus, planPlayedTargetLayout,
  playedTargetAt, reseatPlayedTargetFocus, stepPlayedTargetFocusVia, turnPlayedTargetPageVia,
} from '@/client/console/played/consolePlayedTargetModel';
import {openPlayedTargetZoom} from '@/client/console/played/playedTargetDossier';
import {getCard} from '@/client/cards/ClientCardManifest';
import {$t, translateText} from '@/client/directives/i18n';
import {conUiScale, consoleLayoutState} from '@/client/console/consoleLayoutProfile';
import {layoutTopWithin} from '@/client/console/layoutTop';

/** What a host may ask of the nested pick (the step's ref). */
export type VenusBonusStepApi = {
  pickNav(dir: PlayedTargetNavDir): void,
  pickTurn(delta: number): void,
  pickFocused(): CardName | undefined,
  pickInspect(): void,
};

defineOptions({name: 'ConsoleVenusBonusStep'});
const props = defineProps({
  /** The step's own prompt model (`ActionPreviewStep` `venusBonus`). */
  input: {type: Object as PropType<PlayerInputModel>, required: true},
  parts: {type: Object as PropType<VenusBonusParts>, required: true},
  focus: {type: Object as PropType<VenusInnerFocus>, required: true},
  /** The player's stock per standard resource — «current → resulting». */
  stock: {type: Object as PropType<Partial<Record<string, number>>>, default: () => ({})},
  /** The viewer (the holders are theirs) — the dossier's «whose». */
  viewer: {type: Object as PropType<{name: string, color: string}>, default: () => ({name: '', color: 'viewer'})},
});

const pickZone = useTemplateRef<HTMLElement>('pickZone');
const pickStep = useTemplateRef<{cells?: () => ReadonlyArray<PlayedTargetCell>, ensureFocusVisible?: () => void}>('pickStep');
const root = useTemplateRef<HTMLElement>('root');
const pickFocusRaw = ref<PlayedTargetFocus | undefined>(undefined);
/** The pick's measured box — the column from its top to the band's foot (transform-free, `layoutTopWithin`). */
const pickW = ref(0);
const pickH = ref(0);
let stopObs: (() => void) | undefined;

const meta = computed((): VenusBonusPromptMeta | undefined => {
  return venusBonusMetaOf(props.input);
});
const stepReading = computed((): string => {
  return venusStepReading(meta.value);
});
const spec = computed((): WildChoiceSpec => {
  return meta.value === undefined ?
    {holders: [], amount: () => 0, exclusive: false, lanes: 'dial'} :
    venusWildSpec(meta.value);
});
const candidates = computed((): ReadonlyArray<CardModel> => {
  return venusWildCandidates(props.input) ?? [];
});
/** The server's per-candidate ПО move — the door and the selector read the same box. */
const vpBox = computed((): Partial<Record<string, {from: number, to: number}>> => {
  return meta.value?.wildCardVp ?? {};
});
const picking = computed((): boolean => {
  return props.focus.zone === 'pick';
});
/** The 30 % finish's holders as the console's ONE target selector (the live bonus's own builder). */
const pickModel = computed((): PlayedTargetModel | undefined => {
  const holders = spec.value.holders;
  const candidatesNow = candidates.value.filter((c) => holders.includes(c.name));
  if (candidatesNow.length === 0) {
    return undefined;
  }
  return buildVenusWildTargetModel({
    candidates: candidatesNow,
    players: [{name: props.viewer.name, color: props.viewer.color, tableau: candidatesNow.map((c) => ({name: c.name}))}],
    viewerColor: props.viewer.color,
    ask: translateText('Choose a card for the wild resource'),
    typeOf: (name) => getCard(name)?.type,
    resourceOf: (name) => getCard(name)?.resourceType,
    vpBox: meta.value?.wildCardVp,
  });
});
const pickLayout = computed((): PlayedTargetLayout => {
  return planPlayedTargetLayout({
    owners: pickModel.value?.owners ?? [],
    availW: pickW.value,
    ui: conUiScale(),
    handheld: consoleLayoutState.profile === 'handheld',
  });
});
const pickFocusShown = computed((): PlayedTargetFocus => {
  return reseatPlayedTargetFocus(pickFocusRaw.value, pickModel.value?.owners ?? []) ?? {ownerId: '', index: -1};
});
const pickFocusedName = computed((): CardName | undefined => {
  return playedTargetAt(pickFocusShown.value, pickModel.value?.owners ?? [])?.cardName;
});

function seatPick(): void {
  const owners = pickModel.value?.owners ?? [];
  const chosen = props.parts.wild?.card;
  const first = owners.flatMap((o) => o.candidates.map((c, index) => ({o, c, index}))).find((x) => x.c.blocked === undefined);
  pickFocusRaw.value = (chosen !== undefined ? findPlayedTargetFocus(chosen, owners) : undefined) ??
    (first !== undefined ? {ownerId: first.o.id, index: first.index} : undefined);
}
/** The pick's room: from its own top to the band's foot, minus every bottom padding between (the P43 slot's rule). */
function measurePick(): void {
  const zone = pickZone.value ?? undefined;
  const band = zone?.closest<HTMLElement>('[data-ws-band]') ?? null;
  if (zone === undefined || zone === null) {
    return;
  }
  pickW.value = Math.max(0, Math.floor(zone.clientWidth));
  if (band === null) {
    return;
  }
  let inset = 0;
  for (let el = zone.parentElement; el !== null && el !== band; el = el.parentElement) {
    const cs = getComputedStyle(el);
    inset += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
  }
  const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
  const room = Math.floor(band.offsetHeight - layoutTopWithin(zone, band) - inset - 0.4 * rem);
  if (Math.abs(room - pickH.value) > 1) {
    pickH.value = Math.max(9 * rem, room);
  }
}
function armPickMeasure(): void {
  measurePick();
  const zone = pickZone.value ?? undefined;
  const band = zone?.closest<HTMLElement>('[data-ws-band]') ?? undefined;
  if (zone === undefined || typeof ResizeObserver === 'undefined') {
    return;
  }
  stopObs?.();
  const obs = new ResizeObserver(() => measurePick());
  [zone, band].filter((el): el is HTMLElement => el !== undefined && el !== null).forEach((el) => obs.observe(el));
  stopObs = () => obs.disconnect();
}
// ── THE HOST'S DOOR INTO THE PICK (`VenusBonusStepApi`) ─────────────────
/** The d-pad: the selector's own boxes (a page's edge turns it). */
function pickNav(dir: PlayedTargetNavDir): void {
  const focus = reseatPlayedTargetFocus(pickFocusRaw.value, pickModel.value?.owners ?? []);
  if (focus === undefined) {
    return;
  }
  const step = pickStep.value ?? undefined;
  const next = stepPlayedTargetFocusVia(step, focus, dir, step?.cells?.() ?? []);
  if (next !== undefined) {
    pickFocusRaw.value = next;
    step?.ensureFocusVisible?.();
  }
}
/** LB / RB — the band's page. */
function pickTurn(delta: number): void {
  const turned = turnPlayedTargetPageVia(pickStep.value, pickFocusShown.value, delta);
  if (turned !== undefined) {
    pickFocusRaw.value = turned;
    pickStep.value?.ensureFocusVisible?.();
  }
}
/** A's answer — the focused candidate when it may be chosen (never a near miss). */
function pickFocused(): CardName | undefined {
  const candidate = playedTargetAt(pickFocusShown.value, pickModel.value?.owners ?? []);
  return candidate === undefined || candidate.blocked !== undefined || candidate.stand !== undefined ? undefined : candidate.cardName;
}
/** X — the focused card fullscreen, its TARGET DOSSIER beside it. */
function pickInspect(): void {
  const model = pickModel.value;
  const name = pickFocusedName.value;
  if (model !== undefined && name !== undefined) {
    openPlayedTargetZoom({model, cardName: name, getRoot: () => root.value ?? undefined});
  }
}

/** Entering the pick seats its cursor (on the chosen card, else the first choosable one) and measures its box. */
watch(() => picking.value, (on: boolean) => {
  if (!on) {
    stopObs?.();
    stopObs = undefined;
    return;
  }
  seatPick();
  void nextTick(() => armPickMeasure());
}, {immediate: true});

onBeforeUnmount(() => {
  stopObs?.();
});
defineExpose({pickFocused, pickInspect, pickNav, pickTurn});
</script>
