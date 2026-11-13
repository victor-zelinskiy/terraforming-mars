<template>
  <section ref="root" class="con-extdraw"
           :class="{'con-ws': !embedded, 'con-extdraw--embedded': embedded}"
           :aria-label="effectLine"
           :data-flow="phase"
           :data-motion-surface="embedded ? undefined : 'external-draw'">
    <ConsoleWsHead v-if="!embedded"
                   class="con-extdraw__head"
                   root="Card draw"
                   emblem="cards"
                   :subject="effectCardName"
                   :stage="stageKey"
                   :committed="true" />
    <div class="con-extdraw__frame" data-motion-panel ref="frameEl">

      <!-- THE CAUSE — what happened, why, and who set it off. Two calm lines:
           the initiator's act (their chip + the trigger card) and the effect's
           own promise. Constant through the whole take. EMBEDDED, the host's
           crumb already names the flow and the carrier card stands beside the
           row: the promise folds into the ONE status line below (a second
           plate inside a stage read as a modal that had arrived). -->
      <div v-if="!embedded" class="con-extdraw__cause" role="note">
        <!-- WHO set it off — a card cause only. An enacted resolution has no
             initiator: nobody did this to the player, the law did, and an
             empty player chip would invent an actor. -->
        <div v-if="cardCause !== undefined" class="con-extdraw__cause-line">
          <span class="con-extdraw__actor" :class="'player_color_' + initiatorColor">
            <span class="con-extdraw__actor-dot" :class="'player_bg_color_' + initiatorColor" aria-hidden="true"></span>
            {{ initiatorName }}
          </span>
          <span class="con-extdraw__cause-text">{{ causeLine }}</span>
        </div>
        <div class="con-extdraw__cause-line con-extdraw__cause-line--effect">{{ effectLine }}</div>
      </div>

      <!-- THE SOURCE SEAT — the effect card, the SAME dock every decision
           surface parks its origin in. L3 lifts this very card fullscreen. -->
      <div class="con-extdraw__source" data-embed-source-slot>
        <console-source-dock :view="sourceView" compact />
      </div>

      <!-- THE CARDS — the shared card chassis. The row is STABLE for the whole
           flight of a taken card (its seat stays, hidden under the proxy), and
           re-lays itself out only AFTER the card has landed in the dock: the
           taken seat leaves, the rest FLIP to their new berths — the one
           pattern every other card surface of the console speaks (no ghost). -->
      <div class="con-cards con-extdraw__cards">
        <div class="con-cards__strip con-ws-stage-row con-extdraw__row"
             :class="{'con-cards__strip--has-focus': remaining.length > 0}"
             ref="row">
          <div v-for="(entry, i) in entries" :key="entry.name"
               class="con-cards__slot con-extdraw__slot"
               :data-zoom-slot="entry.name"
               :data-extdraw-slot="entry.name"
               ref="slots"
               :class="{
                 'con-cards__slot--focused': focusIdx === i && interactive && !entry.taken,
                 'con-extdraw__slot--taken': entry.taken,
                 'con-deal-hold': slotHeld(entry.name),
               }">
            <Card :card="{name: entry.name}" :key="entry.name" lightweight />
          </div>
        </div>

        <!-- STATUS, never a second command bar: the focused card's name, the
             take progress and the shared availability line. Always in layout. -->
        <div class="con-cards__verdictbar con-ws-stage-status con-extdraw__status"
             :class="{'con-cards__verdictbar--held': !interactive}" role="status">
          <div class="con-cards__verdict-inner">
            <span class="con-cards__verdict-name" :key="focusedName">{{ focusedName === '' ? '' : $t(focusedName) }}</span>
            <span v-if="causeText !== ''" class="con-extdraw__status-cause">{{ causeText }}</span>
            <span class="con-cards__verdict con-cards__verdict--ok">{{ progressText }}</span>
            <ConsoleCardAvailabilityPanel v-if="focusedAvailability !== undefined"
                                          variant="line"
                                          class="con-extdraw__avail"
                                          :view="focusedAvailability"/>
          </div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup vapor lang="ts">
/*
 * «ДОБОР КАРТ» — the mandatory take of an EXTERNAL draw. A WORKSPACE
 *       SCREEN of the ordinary family (WORKSPACE_KINDS 'external-draw'): the
 *       stage band + the one stage-surface material, `ConsoleWsHead` as the
 *       only header — never a centred plate (a modal look on a locked screen
 *       is exactly the wrong statement). The player walked in through the
 *       mandatory announce, and the take is the only way out.
 *
 *       HOST-AGNOSTIC (the embed contract, rule 1): with `embedded` the shell
 *       chrome goes — the frame plate and the `ConsoleWsHead` belong to the
 *       host, which already names the flow in ITS crumb. An ENACTED
 *       RESOLUTION's draw (Turmoil Redux — Climate Research) is hosted exactly
 *       that way, inside the Parliament's enactment stage: same instance, same
 *       logic, same input path, one level deeper.
 *
 * `data-motion-surface` is part of what `embedded` STRIPS, exactly like the
 *       frame and the head: the surface-motion director gives every surface that
 *       carries it an owner's claim on the ONE shared `.con-shade`, and an
 *       embedded step taking that claim dims its own host — the whole Parliament
 *       (crumb, carried card, readings and this take) went dark behind itself.
 *
 * (This comment opened the template; the template starts with its root now.)
 */

/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ДОБОР КАРТЫ» — the mandatory take of cards an EXTERNAL effect drew for the
 * viewer (Solar Logistics on a foreign space event — human or MarsBot —
 * Sponsored Academies' «all opponents draw»). Routed off the server's
 * `externalDrawPrompt` marker, never a title.
 *
 * WHAT THE SURFACE OWES (the reason it is not the generic card browser and not
 * the fullscreen reveal): the player was interrupted by somebody else's action,
 * so the screen must answer WHAT they are getting, WHY, and WHO set it off —
 * and then let them take the cards through the ordinary physical grammar:
 *
 *   the deck answers   →  N cards leave `.con-deckstack__pile` into their slots
 *                         (the same shared arrival the deck pick plays)
 *   A takes ONE        →  submit [card] + the card flies into the hand dock
 *                         (`runHandIntake`); its seat stays as a quiet ghost,
 *                         so the row never re-flows mid-flight
 *   B takes ALL        →  submit the rest + the stack intake
 *   the LAST take      →  the prompt ends; the shell folds the workspace once
 *                         the flight lands (`externalDrawHolding`)
 *
 * NON-MINIMIZABLE BY CONSTRUCTION: no `defer` emit, `taskMinimizable` answers
 * false, and B is «Забрать все» (hidden for a single card) — never «назад».
 * Input during a take is absorbed BY PHASE (`sending`), so a held button or a
 * double press cannot take twice; each server response re-arms the submission
 * (the decision-surface-rearm contract).
 */
import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {gsap} from 'gsap';
import Card from '@/client/components/card/CardFace.vue';
import {resolutionZoomEntry} from '@/client/components/card/cardZoomTypes';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {
  ExternalDrawCause, ExternalDrawTakeMeta, externalDrawCardCause, externalDrawResolutionCause,
} from '@/common/models/ExternalDrawPromptModel';
import {SelectCardModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {Color} from '@/common/Color';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {sourceSeatReservePx, wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import {stepHandGrid} from '@/client/components/console/consoleHandGrid';
import {nearestInDirection} from '@/client/console/consoleStartNav';
import {runBatchArrival, settleBatchProxiesOnto, ArrivalOrigin, BatchArrivalHandle} from '@/client/console/consoleBatchArrivalMotion';
import {findPrintedCardsIcon} from '@/client/console/consoleActionCommitMotion';
import {runHandIntake, handDockReachable} from '@/client/console/handDock/handDeliveryDirector';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {availabilityContextFor, buildCardAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';
import {PromptSourceView, promptSourceView} from '@/client/console/promptSource';
import {cardsResponse} from '@/client/console/taskResponses';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {workspaceSourceZoomOrigin} from '@/client/console/consoleWorkspaceOutcome';
import {
  armDeckPickFlight, clearDeckPickFlight, deckPickProxyEls,
} from '@/client/console/deckPick/consoleDeckPick';
import {
  beginExternalDrawDeal, beginExternalDrawReady, beginExternalDrawSend,
  endExternalDrawSend, externalDrawIntakeKey, externalDrawState, externalDrawTakeOf,
  markIntakeDealt, rollbackExternalDrawSend, shouldDealIntake,
} from '@/client/console/externalDraw/consoleExternalDraw';
import {motionMs} from '@/client/components/motion/motionTokens';
import {beginCeilingWait} from '@/client/console/waitGraph/ceilingWait';
import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';
import {useFlowScope} from '@/client/console/session/useFlowScope';
// `console-source-dock` is the lazy binding of `asyncComponents.ts` (async on purpose: it renders the real premium card
// face, and a static import of that chain zeroes a unit spec) — see the note there.
import {ConsoleSourceDock} from '@/client/components/asyncComponents';

/** Bounded retry while the row has no layout yet (JSDOM / mid-reload). */
const FIT_RETRIES = 20;

/** How long a slow server may take before an unchanged prompt reads as a
 *  refusal (the deck-pick constant, same reasoning). */
const REFUSAL_GRACE_MS = 1500;

/** The survivors' FLIP after a landing — a calm re-seat, never a jump. */
const REFLOW_FLIP_MS = 240;

type SlotEntry = {name: CardName, taken: boolean};

function asElements(ref: unknown): Array<HTMLElement> {
  return Array.isArray(ref) ? (ref as Array<HTMLElement>).filter((el) => el instanceof HTMLElement) : [];
}

/** A take beat in flight (`sending`), the surface not yet ready — every verb absorbed (the input-absorb ledger). */
const EXTERNAL_DRAW_ABSORBER = 'external-draw-beat';

defineOptions({name: 'ConsoleExternalDrawWorkspace'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  /**
   * Rendered INSIDE another workspace's zone (the embed contract): the host
   * owns the plate and the crumb, so this surface draws content only. One
   * prop, never a per-flavour switch.
   */
  embedded: {type: Boolean, default: false},
});
const emit = defineEmits(['submit']);

// `flowScope`, not `flow`: this component's `flow` is the external draw's module state (the alias below).
const flowScope = useFlowScope('external-draw-workspace');
const slots = useTemplateRef<Array<HTMLElement>>('slots');
const row = useTemplateRef<HTMLElement>('row');
const frameEl = useTemplateRef<HTMLElement>('frameEl');
const root = useTemplateRef<HTMLElement>('root');
const focusIdx = ref(0);
/** The input-absorb ledger's registration of the beat gate (`inputAbsorb.ts`). */
let absorbOff: (() => void) | undefined;
/** The STABLE slot list for the whole batch (ghosts included). */
const slotsList = ref<Array<SlotEntry>>([]);
/** Names still owned by an arrival proxy (real slot held under it). */
const held = ref(new Set<string>());
let handle: BatchArrivalHandle | undefined;
/** Blocks a duplicate submit between the press and the response. */
const submitting = ref(false);
const fitRetries = ref(0);
let ro: ResizeObserver | undefined;
/** The external draw's module state (reactive by itself), under the name the script reads it by. */
const flow = externalDrawState;
/**
 * THE SURFACE LEFT WITH ITS QUESTION (RX40): set in `beforeUnmount`. A take's beats outlive the surface (the
 * cards fly in the app-level layer), but a watcher dies with its component — so «did the prompt move?» is
 * answered by the unmount itself, and every waiter on it is released at once.
 */
const unmounting = ref(false);
const goneWaiters: Array<() => void> = [];

const view = computed((): PlayerViewModel => {
  return props.playerView;
});
const model = computed((): SelectCardModel | undefined => {
  const wf = view.value.waitingFor;
  return wf?.type === 'card' && wf.externalDrawPrompt !== undefined ? (wf as SelectCardModel) : undefined;
});
const meta = computed((): ExternalDrawTakeMeta | undefined => {
  return externalDrawTakeOf(view.value.waitingFor);
});
const intakeKey = computed((): string => {
  const m = meta.value;
  return m === undefined ? '' : externalDrawIntakeKey(m);
});
/** Cards still awaiting the take, as the SERVER states them. */
const remaining = computed((): Array<CardName> => {
  return (model.value?.cards ?? []).map((c) => c.name);
});
/** The rendered slots — the stable batch order, ghosts included. */
const entries = computed((): Array<SlotEntry> => {
  return slotsList.value;
});
const phase = computed((): string => {
  return flow.phase;
});
const interactive = computed((): boolean => {
  return phase.value === 'ready' && !submitting.value && meta.value !== undefined;
});
/** The card-granted cause, when that is what this is. */
const cardCause = computed((): Extract<ExternalDrawCause, {kind: 'card'}> | undefined => {
  const m = meta.value;
  return m === undefined ? undefined : externalDrawCardCause(m);
});
/** The RESOLUTION-granted cause (Turmoil Redux), when that is what this is. */
const resolutionCause = computed((): Extract<ExternalDrawCause, {kind: 'resolution'}> | undefined => {
  const m = meta.value;
  return m === undefined ? undefined : externalDrawResolutionCause(m);
});
/** The crumb's SUBJECT — the card whose effect granted, or the resolution. */
const effectCardName = computed((): string => {
  return cardCause.value?.effectCard ?? resolutionCause.value?.resolution ?? '';
});
const initiatorColor = computed((): Color | '' => {
  return cardCause.value?.initiator ?? '';
});
const initiatorName = computed((): string => {
  return displayNameForColor(view.value.players, cardCause.value?.initiator);
});
/** The initiator's ACT — «разыграл(а) карту X». The trigger card is the
 *  card that ACTIVATED the effect; for an initiator-owned effect card the
 *  effect card itself is what they played. */
const causeLine = computed((): string => {
  const cause = cardCause.value;
  if (cause === undefined) {
    return '';
  }
  const played = cause.triggerCard ?? (cause.effectCardOwner === 'initiator' ? cause.effectCard : undefined);
  return played !== undefined ?
    translateTextWithParams('played ${0}', [translateText(played)]) :
    translateText('took an action');
});
/** The effect's own promise — whose rule grants, and how much. */
const effectLine = computed((): string => {
  const m = meta.value;
  if (m === undefined) {
    return '';
  }
  const card = cardCause.value;
  if (card === undefined) {
    // The RESOLUTION's draw: the political phase is the cause, so the line
    // states the rule's promise — the source plate beside it (face, code,
    // L3) is what names the resolution.
    return translateTextWithParams('The enacted resolution draws ${0} card(s) for you', [String(m.count)]);
  }
  return card.effectCardOwner === 'you' ?
    translateTextWithParams('Your ${0} effect: take ${1} card(s)', [translateText(card.effectCard), String(m.count)]) :
    translateTextWithParams('${0}: you receive ${1} card(s)', [translateText(card.effectCard), String(m.count)]);
});
const sourceView = computed((): PromptSourceView => {
  // The server's own source marker first (a resolution draw carries the
  // resolution's face and code through it); the card cause is the fallback.
  return promptSourceView(view.value.waitingFor) ??
    {card: cardCause.value?.effectCard, kindKey: 'Card', inspectable: cardCause.value !== undefined};
});
const stageKey = computed((): string => {
  return phase.value === 'dealing' ? 'Drawing cards…' : 'Intake';
});
const focusedName = computed((): string => {
  const entry = entries.value[focusIdx.value];
  return entry === undefined || entry.taken ? '' : entry.name;
});
const liveModelFor = computed((): (name: string) => CardModel | undefined => {
  const cards = model.value?.cards;
  return (name) => cards?.find((c) => c.name === name);
});
/** The focused card's future value — the shared model in the take voice.
 *  Informational only; it never gates the take. */
const focusedAvailability = computed((): CardAvailabilityView | undefined => {
  if (!interactive.value || focusedName.value === '') {
    return undefined;
  }
  const context = availabilityContextFor('draw-take');
  if (context === undefined) {
    return undefined;
  }
  return buildCardAvailability({reasons: liveModelFor.value(focusedName.value)?.unplayableReasons, easing: liveModelFor.value(focusedName.value)?.requirementEasing}, context);
});
/** The take's PROGRESS («Заберите карты: 6» / «Взято 1 из 6») — STATE, the
 *  rail's one pill, kept whole under width pressure. */
const progressText = computed((): string => {
  const m = meta.value;
  if (phase.value === 'dealing') {
    return translateTextWithParams('Cards from the deck: ${0}', [String(entries.value.length)]);
  }
  if (phase.value === 'sending' || m === undefined) {
    return translateText('Taking the card…');
  }
  const total = m.count;
  const taken = total - remaining.value.length;
  return taken > 0 ?
    translateTextWithParams('Taken: ${0} of ${1}', [String(taken), String(total)]) :
    (total > 1 ?
      translateTextWithParams('Take ${0} cards', [String(total)]) :
      translateText('Take the card'));
});
/** The embedded rail's CAUSE («Принятая резолюция берёт для вас 6 карт»):
 *  the standalone surface states it in its own cause block, so the embedded
 *  one may not say less — but it is context the kicker and the source plate
 *  already frame, so on the rail it is its OWN member and the FIRST to yield
 *  width (an ellipsis inside its box), never folded into the state pill. */
const causeText = computed((): string => {
  return props.embedded && effectLine.value !== '' ? effectLine.value : '';
});
const footCommands = computed((): Array<ConsoleCommand> => {
  if (!interactive.value) {
    // A beat in flight absorbs the pad by construction — advertising a
    // verb the surface will swallow is worse than advertising none.
    return [];
  }
  const cmds: Array<ConsoleCommand> = [];
  if (remaining.value.length > 1) {
    cmds.push({control: 'dpad', label: 'Navigate'});
  }
  cmds.push({control: 'confirm', label: 'Collect the card', priority: 0});
  cmds.push({control: 'secondary', label: 'Inspect'});
  if (sourceView.value.inspectable) {
    cmds.push({control: 'stickL', label: 'Source', priority: 1});
  }
  // B = «Забрать все» — ONLY while more than one card is owed. For a
  // single take the button does nothing and, per the contract, promises
  // nothing (no false «close» affordance on a locked workspace).
  if (remaining.value.length > 1) {
    cmds.push({control: 'back', label: 'Collect all', priority: 1});
  }
  return cmds;
});
/** The prompt IDENTITY — a change is the server moving on (a re-issued
 *  remainder, the next intake, or the end). Structural, never the title. */
const promptKey = computed((): string => {
  return `${intakeKey.value}#${remaining.value.join('|')}`;
});

function slotHeld(name: CardName): boolean {
  return held.value.has(name);
}
// ── SLOTS: one stable layout for the whole batch ────────────────────
/**
 * Reconcile the stable slot list against the server's remaining set. A
 * NEW intake rebuilds the list and plays the deal; a re-issued remainder
 * only marks the missing names as ghosts (their seats stay), so the row
 * the player aimed at is the row that stays.
 */
function reconcileSlots(): void {
  const m = meta.value;
  if (m === undefined) {
    return; // the prompt ended — the shell is folding us; keep the last frame.
  }
  const key = intakeKey.value;
  const remainingNow = new Set(remaining.value);
  const knownBatch = !shouldDealIntake(key) &&
    slotsList.value.length > 0 &&
    remaining.value.every((n) => slotsList.value.some((s) => s.name === n));
  if (knownBatch) {
    for (const slot of slotsList.value) {
      slot.taken = !remainingNow.has(slot.name);
    }
    focusNextRemaining();
    // NO refit: a ghost keeps its seat at full size, so the row's shape —
    // every input of the fit — is unchanged. The fit resets its own
    // outputs before it measures (a forced layout, twice), and this
    // reconcile runs on the take's answer, i.e. mid-flight: it was ~18 ms
    // of main thread (×4 on a Deck-class CPU) stolen from the card on its
    // way to the hand. A real size change still refits (ResizeObserver).
    return;
  }
  // A NEW batch (first open, a second intake, a reload re-entry): the
  // remaining cards ARE the batch — cards taken before a reload are in
  // the hand already and honestly leave no ghost.
  slotsList.value = remaining.value.map((name) => ({name, taken: false}));
  focusIdx.value = 0;
  startDeal(key);
}
function focusNextRemaining(): void {
  const current = entries.value[focusIdx.value];
  if (current !== undefined && !current.taken) {
    return;
  }
  const next = entries.value.findIndex((e, i) => !e.taken && i >= focusIdx.value);
  focusIdx.value = next !== -1 ? next : Math.max(0, entries.value.findIndex((e) => !e.taken));
}
// ── THE DEAL (the deck answers) ─────────────────────────────────────
function startDeal(key: string): void {
  handle?.kill();
  handle = undefined;
  if (!shouldDealIntake(key)) {
    // Adopted (a raced re-render of the same intake): no re-deal.
    beginExternalDrawReady();
    scheduleFit();
    return;
  }
  markIntakeDealt(key);
  beginExternalDrawDeal();
  const names = slotsList.value.map((s) => s.name);
  held.value = new Set<string>(names);
  if (typeof window === 'undefined') {
    held.value.clear();
    beginExternalDrawReady();
    return;
  }
  // The bodies live in the app-level deck-pick flight layer — the same
  // physical event («cards leave the deck pile into a workspace stage»),
  // the same stage, deliberately shared.
  armDeckPickFlight(names);
  void nextTick(() => {
    fitRow();
    void nextTick(() => launchDeal());
  });
}
function launchDeal(): void {
  if (handle !== undefined) {
    return;
  }
  const proxies = deckPickProxyEls();
  const slotsNow = asElements(slots.value);
  const cards = proxies
    .map((proxy) => ({proxy, flip: proxy.querySelector<HTMLElement>('.con-deal-proxy__flip')}))
    .filter((c): c is {proxy: HTMLElement, flip: HTMLElement} => c.flip !== null);
  if (cards.length === 0 || slotsNow.length === 0) {
    finishDeal();
    return;
  }
  // The faces are known (the prompt carries them) — the batch opens IN
  // FLIGHT, the classic draw reveal.
  handle = runBatchArrival({
    cards, slots: slotsNow,
    mode: 'in-flight-reveal',
    // «ОДНО ДЕЙСТВИЕ — ОДИН ЗАБОР» Ф5: the cards leave the CAUSE's own place — the effect card (or the enacted
    // resolution's face) standing in the source seat, from its printed draw icon where it has one. The deck
    // already answered at the trigger (the server drew then); only a seat that is not painted degrades to it.
    from: dealOrigin(),
    onSettled: () => {
      handle = undefined;
      handOffDeal();
    },
  });
}
/** The source seat's face as painted — the origin of the deal (undefined → the deck). */
function dealOrigin(): ArrivalOrigin | undefined {
  const rootNow = root.value ?? undefined;
  const seat = rootNow?.querySelector<HTMLElement>('.con-extdraw__source .con-src__card') ?? null;
  if (seat === null) {
    return undefined;
  }
  const icon = findPrintedCardsIcon(seat) ?? seat;
  const rect = icon.getBoundingClientRect();
  return rect.width > 2 && rect.height > 2 ? {rect, kind: 'card'} : undefined;
}
function handOffDeal(): void {
  const slotsNow = asElements(slots.value);
  const proxies = deckPickProxyEls();
  if (proxies.length === 0) {
    finishDeal();
    return;
  }
  settleBatchProxiesOnto({
    pairs: proxies.map((proxy, i) => ({
      proxy,
      target: slotsNow[i]?.querySelector<HTMLElement>(':is(.card-container, .pcard)') ?? slotsNow[i],
    })),
    onDone: () => {
      held.value.clear();
      finishDeal();
    },
  });
}
function finishDeal(): void {
  clearDeckPickFlight();
  held.value.clear();
  beginExternalDrawReady();
  scheduleFit();
}
// ── FIT (the shared stage geometry engine) ──────────────────────────
function scheduleFit(): void {
  fitRetries.value = 0;
  void nextTick(() => fitRow());
}
function fitRow(): void {
  const rowNow = row.value ?? undefined;
  if (rowNow === null || rowNow === undefined || entries.value.length === 0) {
    return;
  }
  rowNow.style.setProperty('--con-cards-zoom', '1');
  rowNow.style.setProperty('--con-ws-stage-rowmax', '100%');
  const probe = rowNow.children[0] as HTMLElement | undefined;
  const slotW = probe?.offsetWidth ?? 0;
  const slotH = probe?.offsetHeight ?? 0;
  if (slotW <= 0 || slotH <= 0) {
    if (fitRetries.value < FIT_RETRIES) {
      fitRetries.value++;
      flowScope.afterFrame('the row gets its layout', () => fitRow());
    }
    return;
  }
  fitRetries.value = 0;
  const cs = window.getComputedStyle(rowNow);
  const padX = (parseFloat(cs.paddingLeft) || 0) + (parseFloat(cs.paddingRight) || 0);
  const padY = (parseFloat(cs.paddingTop) || 0) + (parseFloat(cs.paddingBottom) || 0);
  const ui = conUiScale();
  const reserve = sourceSeatReservePx(ui);
  const layout = wsStageLayout({
    availW: rowNow.clientWidth - padX - reserve * 2,
    availH: Math.max(200 * ui, rowBudgetPx() - padY),
    slotW, slotH, n: entries.value.length, ui,
    rowGapPx: parseFloat(cs.rowGap) || undefined,
    padXPx: padX,
  });
  const style = wsStageLayoutStyle(layout);
  Object.entries(style).forEach(([k, v]) => rowNow.style.setProperty(k, v));
}
function rowBudgetPx(): number {
  const frame = frameEl.value ?? undefined;
  if (frame === null || frame === undefined) {
    return 0;
  }
  const fcs = window.getComputedStyle(frame);
  let budget = frame.clientHeight -
    (parseFloat(fcs.paddingTop) || 0) - (parseFloat(fcs.paddingBottom) || 0);
  const rootNow = root.value ?? undefined;
  // The head sits OUTSIDE the frame now (the screen chassis) — the frame's
  // own height already excludes it, so only the frame's inner chrome is
  // subtracted here.
  for (const sel of ['.con-extdraw__cause', '.con-extdraw__status']) {
    const el = rootNow?.querySelector<HTMLElement>(sel) ?? null;
    if (el !== null) {
      const ecs = window.getComputedStyle(el);
      budget -= el.offsetHeight +
        (parseFloat(ecs.marginTop) || 0) + (parseFloat(ecs.marginBottom) || 0);
    }
  }
  const cards = rootNow?.querySelector<HTMLElement>('.con-extdraw__cards') ?? null;
  budget -= parseFloat(fcs.rowGap) || 0;
  budget -= cards === null ? 0 : (parseFloat(window.getComputedStyle(cards).rowGap) || 0);
  return budget;
}
// ── INPUT ───────────────────────────────────────────────────────────
function handleIntent(intent: GamepadIntent): void {
  if (!interactive.value) {
    noteInputAbsorbed(EXTERNAL_DRAW_ABSORBER);
    return; // a beat in flight absorbs the pad — no double take possible
  }
  if (intent.kind === 'nav') {
    move(intent.dir);
    return;
  }
  // L3 — the SOURCE card fullscreen (console-wide grammar).
  if (intent.kind === 'press' && intent.button === 'stickL') {
    inspectSource();
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'primary': // A — take the focused card
    takeFocused();
    return;
  case 'inspect': // X — the console-wide fullscreen inspect
    inspectFocused();
    return;
  case 'back': // B — take ALL (multi only; for a single card it is silent)
    if (remaining.value.length > 1) {
      takeAll();
    }
    return;
  default:
    return;
  }
}
function move(dir: 'up' | 'down' | 'left' | 'right'): void {
  const els = asElements(slots.value);
  const rects = els
    .map((el) => el.getBoundingClientRect())
    .map((r) => ({left: r.left, top: r.top, width: r.width, height: r.height}));
  const step = (from: number): number => {
    if (rects.length === entries.value.length && rects.every((r) => r.width > 4)) {
      return nearestInDirection(rects, from, dir);
    }
    const rowNow = row.value ?? undefined;
    const perRow = Math.max(1, parseInt(
      rowNow?.style.getPropertyValue('--con-ws-stage-per-row') || String(entries.value.length), 10) ||
      entries.value.length);
    return stepHandGrid(from, dir, entries.value.length, perRow);
  };
  // Ghost seats stay in layout but are NOT stops — walk past them,
  // bounded by the batch size so a fully-ghosted row cannot spin.
  let next = step(focusIdx.value);
  let guard = entries.value.length;
  while (guard-- > 0 && next >= 0 && next !== focusIdx.value && entries.value[next]?.taken) {
    next = step(next);
  }
  if (next >= 0 && !entries.value[next]?.taken) {
    focusIdx.value = next;
  }
}
// ── THE TAKE ────────────────────────────────────────────────────────
/** A — take the focused card: submit + fly it into the dock. */
function takeFocused(): void {
  const name = focusedName.value as CardName;
  if (name === '' || !remaining.value.includes(name)) {
    return;
  }
  take([name]);
}
/** B — take everything still owed, in batch order. */
function takeAll(): void {
  const rest = entries.value.filter((e) => !e.taken).map((e) => e.name)
    .filter((n) => remaining.value.includes(n));
  if (rest.length === 0) {
    return;
  }
  take(rest);
}
function take(names: ReadonlyArray<CardName>): void {
  if (submitting.value || !interactive.value) {
    return;
  }
  submitting.value = true;
  // Synchronous with the submit — no frame exists in which the prompt has
  // moved on and the hold is not yet up (the shell's close watcher reads
  // `externalDrawHolding` before folding the frame).
  beginExternalDrawSend(names);
  emit('submit', cardsResponse([...names]));
  void runTakeBeats(names);
}
async function runTakeBeats(names: ReadonlyArray<CardName>): Promise<void> {
  const key = promptKey.value;
  try {
    await flyToHand(names);
  } finally {
    await awaitPromptMoved(key);
    // An unmounted surface is a question the server has moved past (the last take answered) — never a refusal:
    // waiting for a dead watcher read every final take as REFUSED after the grace, and held `committing` (every
    // gate that asks it — the frame's close, the sitting's receipt) for the whole 1.5 s.
    if (!unmounting.value && meta.value !== undefined && promptKey.value === key) {
      // The server is still asking the very same question: the take was
      // REFUSED. The cards come back into play — never a sealed beat.
      // `runHandIntake` held the SOURCE hidden (`con-deal-hold`) for the
      // flight; the seat is still here, so the hold is lifted by hand.
      for (const name of names) {
        slotEl(name)?.classList.remove('con-deal-hold');
      }
      submitting.value = false;
      rollbackExternalDrawSend(names);
    } else {
      // LANDED: the taken seats leave the row now, AFTER the touchdown, and
      // the rest FLIP to their new berths (the deck pick's own law — a
      // reflow under a flight the player is watching is the one thing the
      // stable row existed to prevent; a ghost seat was never needed).
      if (!unmounting.value) {
        settleTaken(names);
      }
      endExternalDrawSend();
    }
  }
}
/**
 * THE ROW AFTER A LANDING: the taken seats are removed, the fit re-solves
 * for the cards that remain, and every survivor travels from the rect it
 * had to the rect it now has (a FLIP on the slot, transform only, cleared
 * at rest). Reduced motion re-lays out in place. The LAST take has no
 * survivors: the surface leaves with the prompt.
 */
function settleTaken(names: ReadonlyArray<CardName>): void {
  const survivors = slotsList.value.filter((e) => !names.includes(e.name));
  if (survivors.length === slotsList.value.length) {
    return;
  }
  const before = new Map<string, DOMRect>();
  for (const el of asElements(slots.value)) {
    const name = el.getAttribute('data-extdraw-slot');
    if (name !== null && survivors.some((e) => e.name === name)) {
      before.set(name, el.getBoundingClientRect());
    }
  }
  // THE FOCUS FOLLOWS THE CARD, not the index: the reconcile has already moved the cursor onto the
  // next untaken card of the OLD list, so re-reading the same index over the shortened list would
  // skip one card (measured: A taken from [A, B, C] → the cursor landed on C, and a stub server that
  // takes in its own order then left the row with no focusable card at all).
  const focusedName = slotsList.value[focusIdx.value]?.name;
  const removedBefore = slotsList.value.slice(0, focusIdx.value).filter((e) => names.includes(e.name)).length;
  slotsList.value = survivors;
  const kept = focusedName === undefined ? -1 : survivors.findIndex((e) => e.name === focusedName);
  focusIdx.value = kept >= 0 ? kept : Math.min(Math.max(0, focusIdx.value - removedBefore), Math.max(0, survivors.length - 1));
  focusNextRemaining();
  void nextTick(() => {
    fitRow();
    if (consoleReducedMotionActive() || typeof window === 'undefined') {
      return;
    }
    const duration = motionMs(REFLOW_FLIP_MS) / 1000;
    for (const el of asElements(slots.value)) {
      const name = el.getAttribute('data-extdraw-slot');
      const from = name === null ? undefined : before.get(name);
      if (from === undefined || from.width < 2) {
        continue;
      }
      const to = el.getBoundingClientRect();
      if (to.width < 2) {
        continue;
      }
      const dx = from.left - to.left;
      const dy = from.top - to.top;
      const scale = from.width / to.width;
      if (Math.abs(dx) < 0.5 && Math.abs(dy) < 0.5 && Math.abs(scale - 1) < 0.005) {
        continue;
      }
      // The slot's own focus transform (the ring's scale) rides a CSS
      // transition; the FLIP travels on the slot's inline transform with
      // that transition switched off for its span (`--reflow`), so the
      // two never fight over one property.
      el.classList.add('con-extdraw__slot--reflow');
      // `transformOrigin` is an inline style of its own: left behind, the
      // focus ring's CSS scale grew the survivor from its top-left corner
      // and the card stood 12 px right of centre. Both props go together.
      gsap.fromTo(el, {x: dx, y: dy, scale, transformOrigin: '0 0'}, {
        x: 0, y: 0, scale: 1, duration, ease: 'power2.out', clearProps: 'transform,transformOrigin',
        onComplete: () => el.classList.remove('con-extdraw__slot--reflow'),
        onInterrupt: () => {
          gsap.set(el, {clearProps: 'transform,transformOrigin'});
          el.classList.remove('con-extdraw__slot--reflow');
        },
      });
    }
  });
}
function awaitPromptMoved(key: string): Promise<void> {
  if (unmounting.value || meta.value === undefined || promptKey.value !== key || typeof window === 'undefined') {
    return Promise.resolve();
  }
  // The wait has to wait: a node of the wait graph, its grace ending it said (`ceilingWait.ts`).
  const wait = beginCeilingWait({
    id: 'external-draw:prompt-moved', owner: 'ConsoleExternalDrawWorkspace', what: 'the server moving off the answered prompt',
    maxMs: motionMs(REFUSAL_GRACE_MS), target: 'server',
  });
  return new Promise<void>((resolve) => {
    let done = false;
    const finish = () => {
      if (!done) {
        done = true;
        stop();
        cancelGrace();
        resolve();
      }
    };
    const stop = watch(
      () => meta.value === undefined || promptKey.value !== key,
      (moved: boolean) => {
        if (moved) {
          wait.met();
          finish();
        }
      });
    // PACING: the grace's end is SAID (the ceiling line) — a surface that leaves lets the wait go silently
    // (`goneWaiters`, below), never through this timer.
    const cancelGrace = flowScope.after(motionMs(REFUSAL_GRACE_MS), 'the server moving off the answered prompt', () => {
      wait.ceiling();
      finish();
    });
    goneWaiters.push(() => {
      wait.end();
      finish();
    });
  });
}
async function flyToHand(names: ReadonlyArray<CardName>): Promise<void> {
  if (!handDockReachable()) {
    return; // no dock on screen — never a ghost flight
  }
  const entries = names
    .map((name) => {
      const el = slotEl(name);
      return el === null ? undefined : {name, el};
    })
    .filter((e): e is {name: CardName, el: HTMLElement} => e !== undefined);
  if (entries.length === 0) {
    return;
  }
  // `aimAhead`: a take is free — nothing on the answer can withhold the
  // card — so the arc leaves on time instead of hovering over the seat
  // until the server has answered (the hang a slow CPU made visible).
  await runHandIntake(entries, {mode: entries.length > 1 ? 'stack' : 'cascade', aimAhead: true});
}
function slotEl(name: CardName): HTMLElement | null {
  const rootNow = root.value ?? undefined;
  if (rootNow === undefined || typeof rootNow.querySelector !== 'function') {
    return null;
  }
  const key = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
  return rootNow.querySelector<HTMLElement>(`[data-extdraw-slot="${key}"] :is(.card-container, .pcard)`) ??
    rootNow.querySelector<HTMLElement>(`[data-extdraw-slot="${key}"]`);
}
// ── INSPECTION ──────────────────────────────────────────────────────
/** X = the CURRENT card fullscreen — read-only (no select bridge: a take
 *  is a physical commitment, never something a zoom press does). */
function inspectFocused(): void {
  const live = entries.value.filter((e) => !e.taken);
  if (live.length === 0) {
    return;
  }
  const focusIn = Math.max(0, live.findIndex((e) => e.name === focusedName.value));
  const cards = live.map((e) => liveModelFor.value(e.name) ?? ({name: e.name} as CardModel));
  openConsoleCardZoom(cards, focusIn, undefined, undefined, {
    origin: slotZoomOrigin(
      () => root.value ?? undefined,
      (i) => live[i]?.name ?? '',
      (i) => {
        const at = entries.value.findIndex((e) => e.name === live[i]?.name);
        if (at >= 0) {
          focusIdx.value = at;
        }
      }),
    availability: availabilityContextFor('draw-take'),
  });
}
/**
 * L3 = the SOURCE — the effect card lifts out of its seat; an ENACTED
 * RESOLUTION's draw (Turmoil Redux) opens the resolution's own inspector
 * (party column, rules, standing) over the carrier card on the host's
 * stage — `resolutionZoomEntry`, never `{name: card}` (a resolution is
 * not a CardName; the old branch read `sourceView.card`, which a
 * resolution source never has, and the verb did nothing).
 */
function inspectSource(): void {
  if (!sourceView.value.inspectable) {
    return;
  }
  const resolution = sourceView.value.resolution;
  if (resolution !== undefined) {
    openConsoleCardZoom([resolutionZoomEntry(resolution)], 0, undefined, undefined, {
      statusLabel: 'Source',
      origin: workspaceSourceZoomOrigin('resolution:' + resolution),
    });
    return;
  }
  const card = sourceView.value.card;
  if (card === undefined) {
    return;
  }
  const model = view.value.thisPlayer.tableau.find((c) => c.name === card) ?? {name: card};
  openConsoleCardZoom([model as CardModel], 0, undefined, undefined, {
    contextLabel: 'Card draw',
    statusLabel: 'Source',
    origin: workspaceSourceZoomOrigin(String(card)),
  });
}

watch(() => promptKey.value, (): void => {
  // EVERY server answer re-arms the submission (the rearm contract) —
  // two takes ride one persistent instance, and a stuck `submitting`
  // is a visible button that swallows every A.
  submitting.value = false;
  if (flow.phase === 'sending') {
    endExternalDrawSend();
  }
  reconcileSlots();
}, {immediate: true});
watch(() => footCommands.value, (cmds: Array<ConsoleCommand>): void => {
  setPanelCommands('externalDraw', cmds);
}, {immediate: true, deep: true});
watch(() => entries.value.length, (): void => {
  scheduleFit();
});

onMounted((): void => {
  absorbOff = registerInputAbsorber(EXTERNAL_DRAW_ABSORBER, () => !unmounting.value && !interactive.value, {scope: 'all'});
  scheduleFit();
  const box = root.value?.parentElement ??
    (frameEl.value ?? undefined);
  if (box !== null && box !== undefined && typeof ResizeObserver === 'function') {
    const roNow = markRaw(new ResizeObserver(() => scheduleFit()));
    roNow.observe(box);
    ro = roNow;
  }
});
onBeforeUnmount((): void => {
  absorbOff?.();
  unmounting.value = true;
  goneWaiters.splice(0).forEach((release) => release());
  clearPanelCommands('externalDraw');
  handle?.kill();
  handle = undefined;
  clearDeckPickFlight();
  ro?.disconnect();
  ro = undefined;
});
defineExpose({handleIntent});
</script>
