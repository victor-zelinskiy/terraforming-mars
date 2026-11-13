<template>
  <div ref="root" class="con-deckpick"
       :class="{
         'con-ws': !embedded,
         'con-deckpick--embedded': embedded,
         'con-deckpick--sending': phase === 'sending',
         'con-deckpick--clearing': phase === 'clearing',
         'con-deckpick--play': playMode,
       }"
       :role="embedded ? 'group' : 'dialog'"
       :aria-label="askText"
       :data-flow="phase"
       :data-motion-surface="embedded ? undefined : 'deck-pick'">
    <div class="con-deckpick__frame con-ws-stage-frame" data-motion-panel ref="frameEl">
      <!-- STANDALONE ONLY. Embedded, the stage name is handed UP to the host's
           breadcrumb (`setWorkspaceOutcomePhase`) — a surface that titles
           itself inside somebody else's frame reads as a modal that arrived. -->
      <ConsoleWsHead v-if="!embedded"
                     root="Card draw"
                     emblem="cards"
                     :subject="sourceName"
                     :stage="stageKey"
                     :committed="committed" />

      <!-- The stage's own sentence + its live state, on ONE reserved row —
           the shared chassis every card result in a workspace wears. -->
      <ConsoleWsStageHead class="con-deckpick__head" :title="headTitle">
        <template #badges>
          <!-- A VERDICT (P45) counts no picks — its rows are the answer. -->
          <span v-if="verdictPrice === undefined" class="con-ws-stage-badge" :class="{'con-ws-stage-badge--ready': ready}">
            <span class="con-ws-stage-badge__icon resource_icon resource_icon--cards" aria-hidden="true"></span>
            <span class="con-ws-stage-badge__label">{{ $t('Selected') }}</span>
            <b class="con-ws-stage-badge__num">{{ picks.length }}/{{ bounds.max }}</b>
          </span>
        </template>
      </ConsoleWsStageHead>

      <!-- The cards themselves ride the SHARED card chassis (`.con-cards`),
           so slot sizing, the focus ring, the pick band and the status rail
           are the same objects the hand and the buy stage use. What this
           surface adds is only what is genuinely its own: the deck they come
           out of, and the fate of the ones not taken. -->
      <div class="con-cards con-deckpick__cards" :class="{'con-deckpick__cards--variant': variantStep !== undefined}">
        <div class="con-cards__strip con-ws-stage-row con-deckpick__row"
             :class="{'con-cards__strip--has-focus': entries.length > 0}"
             ref="row">
          <div v-for="(entry, i) in entries" :key="entry.name"
               class="con-cards__slot con-deckpick__slot"
               :data-zoom-slot="entry.name"
               :data-deckpick-slot="entry.name"
               ref="slots"
               :class="{
                 'con-cards__slot--focused': focusIdx === i && interactive,
                 'con-cards__slot--picked': isPicked(entry.name),
                 'con-cards__slot--dim': dimUnpicked && !isPicked(entry.name),
                 'con-deal-hold': slotHeld(entry.name),
                 'con-deckpick__slot--varhero': variantStep !== undefined && variantCard === entry.name,
               }">
            <Card :card="{name: entry.name}" :key="entry.name" lightweight />
            <span v-if="isPicked(entry.name)" class="con-cards__pickband con-cards__pickband--select" aria-hidden="true">
              ✓ {{ $t('Card selected') }}
            </span>
            <!-- A prelude that cannot resolve BURNS for 15 M€ — shown on the card BEFORE the press (invariant 4), as a
                 word on a plate, never a ring of light. Choosing it is legal: the verb on the command bar says it. -->
            <span v-if="playMode && burns(entry.name)" class="con-deckpick__burn" data-prelude-burns>
              {{ $t('Will fizzle') }} · +15 M€
            </span>
          </div>
        </div>

        <!-- STATUS, never a second command bar (the bottom bar is the ONE
             source of gamepad verbs). Always in layout so the fit engine
             measures a stable chrome and the row can never reflow. -->
        <!-- Held only while the cards are ARRIVING — a name and a verb there
             would point at a slot that is still empty. Past the commit the line
             is the opposite of a promise: it is what explains where the cards
             the player did NOT take are going, so it stays. -->
        <div class="con-cards__verdictbar con-ws-stage-status con-deckpick__status"
             :class="{'con-cards__verdictbar--held': !interactive && !committed}" role="status">
          <div class="con-cards__verdict-inner">
            <span v-if="!committed" class="con-cards__verdict-name" :key="focusedName">{{ focusedName === '' ? '' : $t(focusedName) }}</span>
            <span v-if="statusText !== ''" class="con-cards__verdict" :class="statusToneClass">{{ statusText }}</span>
            <!-- WHY it burns, when the card names it (P59 — the seat at the floor, its dot): never a burn without its cause. -->
            <span v-if="focusedBurnReason !== undefined" class="con-deckpick__burnwhy" data-prelude-burn-reason>
              <span v-if="focusedBurnReason.color !== undefined" :class="'con-status__dot player_bg_color_' + focusedBurnReason.color" aria-hidden="true"></span>
              {{ focusedBurnReason.text }}
            </span>
            <!-- WHOM THE PLAY HITS (P59 — every opponent, no choice): the victims with the server's `current → resulting`,
                 before the press (invariant 3). Read-only; the bar's verbs are untouched. -->
            <ConsoleTableImpact v-if="focusedTableImpact !== undefined" class="con-deckpick__tblimpact"
                                layout="line" :view="focusedTableImpact" />
            <!-- The focused card's FUTURE value in the shared draft voice —
                 informational beside the pick progress, never a gate (see
                 `focusedAvailability`). The shared one-line register, so the
                 wording/colours are the fullscreen panel's own. -->
            <ConsoleCardAvailabilityPanel v-if="focusedAvailability !== undefined"
                                          variant="line"
                                          class="con-deckpick__avail"
                                          :view="focusedAvailability"/>
          </div>
        </div>
      </div>

      <!-- THE VERDICT AFTER THE REVEAL (P45 Board of Directors · ledger ET): ONE prelude was drawn and the player decides
           what happens to it — two OUTCOME rows (play it for the printed price · let it go to the discard), each with its
           chips and its reason; A on a row is the decision AND the commit. A refused row is read, never taken; the one
           open outcome is marked and still pressed (no auto-answer). -->
      <!-- THE PRICE'S PAYMENT (P45 · PL-1562 — PICK-THEN-PAY IS ONE DECISION, P88's grammar): when the server WILL ask the
           price as a payment (Helion's heat — the marker's `payment`), A on «РАЗЫГРАТЬ» opens it IN the rows' place —
           the shared payment panel and contract; B one level back to the verdict; A pays and plays in ONE POST. -->
      <div v-if="payStage && payView !== undefined" class="con-deckpick__pay" data-deckpick-pay>
        <ConsolePaymentPanel :view="payView"
                             mode="expanded"
                             hint-mode="none"
                             :focus-unit="payFocusUnit"
                             :flash-nonce="payFlashNonce" />
      </div>
      <div v-else-if="verdictRows.length > 0" class="con-deckpick__verdict" data-deckpick-verdict role="listbox"
           :aria-label="$t('Prelude decision')">
        <div v-for="(row, i) in verdictRows" :key="row.key"
             class="con-deckpick__vrow"
             role="option"
             :aria-selected="verdictFocus === i"
             :data-verdict-row="row.key"
             :data-verdict-available="row.available ? 'true' : 'false'"
             :data-verdict-sole="row.sole ? 'true' : undefined"
             :class="{
               'con-deckpick__vrow--focused': verdictFocus === i && interactive,
               'con-deckpick__vrow--refused': !row.available,
               'con-deckpick__vrow--burns': row.burns,
             }">
          <span class="con-deckpick__vlabel">{{ $t(row.label) }}</span>
          <span class="con-deckpick__vdetail">{{ verdictText(row.detail) }}</span>
          <span v-if="row.chips.length > 0" class="con-deckpick__vchips">
            <span v-for="(chip, c) in row.chips" :key="c" class="con-deckpick__vchip" :data-verdict-chip="chip.kind">
              <span class="con-deckpick__vchip-icon" :class="chipIconClass(chip)" aria-hidden="true"></span>
              <span class="con-deckpick__vchip-num">{{ chip.from }} → {{ chip.to }}</span>
            </span>
          </span>
          <span v-if="row.reason !== undefined" class="con-deckpick__vreason" data-verdict-reason>{{ verdictText(row.reason) }}</span>
          <span v-if="row.sole" class="con-deckpick__vsole" data-verdict-sole-mark>{{ $t('The only outcome') }}</span>
        </div>
      </div>

      <!-- THE PRELUDE'S «ВАРИАНТ» STEP (P44 · ledger EQ) — a LAYER over the candidates (their slots keep their geometry,
           receded): RT on a prelude whose play is a choice opens it, A on a row chooses AND plays (ONE batch — the pick
           and the addressed answer), B returns to the candidates with the pick kept. The same component the start
           queue stands up — one step, two hosts. -->
      <transition name="con-start-firstact">
        <div v-if="variantStep !== undefined" class="con-deckpick__variant" data-deckpick-variant
             :style="variantLane !== undefined ? {'--con-dp-var-l': variantLane.left + 'px', '--con-dp-var-r': variantLane.right + 'px'} : undefined">
          <ConsolePreludeVariantStep :variant="variantStep" :focus="variantFocus" :forecast="candidatePreviews[variantStep.card]?.forecast" @pick="onVariantPick" />
        </div>
      </transition>

      <!-- THE PRELUDE DECK — the mid-game prelude pick's own source object (P91): the pile the cards come off, the
           discard the rest land on, the «РАЗЫГРАНО» seat the played prelude lands on. -->
      <ConsolePreludeDeck v-if="playMode"
                          class="con-deckpick__predeck"
                          :deck-count="shownDeckCount"
                          :discard-count="shownDiscardCount"
                          :played="seatedPrelude" />
    </div>

    <!-- (THE DEAL's bodies live in the APP-LEVEL `ConsoleDeckPickLayer` — a
         `position: fixed` proxy inside a TELEPORTED surface resolves against
         whatever ancestor happens to be animating, which is how the cards
         ended up flying in from the right edge instead of off the deck.) -->
  </div>
</template>

<script setup vapor lang="ts">
/*
 * THE DRAW & SELECT SURFACE. Standalone it is an ordinary workspace-band
 *       member (`con-ws` + `.con-ws-band()`); EMBEDDED it is the same instance
 *       teleported into its host's zone with the chrome stripped — one `embedded`
 *       prop, nothing else differs (the six-rule embed contract).
 *
 * (This comment opened the template; the template starts with its root now.)
 */

/*
 * @console-shared LIVE — console native stands on this file.
 *
 * «ПОСМОТРИ N КАРТ КОЛОДЫ, ОСТАВЬ K» — the ONE surface for the whole family
 * (Корпоративные архивы 7→2, Деловые контакты 4→2, Конкурс изобретений 3→1,
 * Nanotech Industries 3→2, Leavitt, the Delta science stage, the discard-pile
 * diggers). Routed off the server's `deckPickPrompt` marker, never a title.
 *
 * WHY IT IS NOT THE GENERIC CARD BROWSER. The browser's job is "point at a
 * card"; every card it offers already belongs to somebody, sits somewhere, and
 * stays there. These cards belong to nobody. They came off the deck a moment
 * ago FOR this decision, the picks become the player's hand and the rest are
 * discarded — three physical facts the browser has no way to state, so it
 * stated none of them: seven cards simply appeared, the deck never moved, and
 * the two kept cards teleported into the dock.
 *
 * So the surface owes a CAUSAL CHAIN, and that is all it adds over the shared
 * chassis it otherwise reuses wholesale:
 *
 *   the deck answers  →  N cards physically leave `.con-deckstack__pile`, each
 *                        on its own trajectory, into its own prepared slot
 *   the player picks  →  the ordinary console pick grammar (focus ring, band,
 *                        A toggles, the bar's confirm goes live at the bound)
 *   the picks LEAVE   →  they fly into the hand dock (`runHandIntake`), which
 *                        comes out of its compact pose to receive them
 *   only THEN         →  the cards left behind tumble away
 *
 * The last two are the reason `consoleDeckPick.ts` exists: the prompt ends at
 * the submit, and both beats live after it.
 *
 * HOST-AGNOSTIC. `embedded` strips exactly three things — the `con-ws` rail
 * marker, `ConsoleWsHead`, and the band geometry. Content, input, state and
 * the flight are untouched, which is what lets the same instance be teleported
 * into the start workspace's zone for a prelude and stand in its own band for a
 * card played from hand.
 *
 */
import {computed, markRaw, nextTick, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {probeTick} from '@/client/console/probeTick';
import {beginCeilingWait} from '@/client/console/waitGraph/ceilingWait';
import Card from '@/client/components/card/CardFace.vue';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleWsStageHead from '@/client/components/console/foundation/ConsoleWsStageHead.vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import {Message} from '@/common/logs/Message';
import {DeckPickPlayPrice, DeckPickPromptMeta, SelectCardModel, SelectPaymentModel} from '@/common/models/PlayerInputModel';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {$t, translateMessage, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import type {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {setPanelCommands, clearPanelCommands} from '@/client/console/consolePanelUi';
import {conUiScale} from '@/client/console/consoleLayoutProfile';
import {sourceSeatReservePx, wsStageLayout, wsStageLayoutStyle} from '@/client/console/consoleWsStageLayout';
import {stepHandGrid} from '@/client/components/console/consoleHandGrid';
import {nearestInDirection} from '@/client/console/consoleStartNav';
import {handSelectPicksValid} from '@/client/components/console/consoleHandSelectModel';
import {runBatchArrival, settleBatchProxiesOnto, BatchArrivalHandle} from '@/client/console/consoleBatchArrivalMotion';
import {holdDeckDisplay, releaseDeckDisplay} from '@/client/console/consoleDeckDisplay';
import {runHandIntake, handDockReachable} from '@/client/console/handDock/handDeliveryDirector';
import {applyDiscardExit} from '@/client/console/cardDeal/cardExitDirector';
import {openConsoleCardZoom, slotZoomOrigin} from '@/client/console/consoleCardZoom';
import {availabilityContextFor, buildCardAvailability, CardAvailabilityView} from '@/client/console/cardAvailability';
import ConsoleCardAvailabilityPanel from '@/client/components/console/ConsoleCardAvailabilityPanel.vue';
import ConsolePreludeDeck from '@/client/components/console/deckPick/ConsolePreludeDeck.vue';
import {runCardTransfer} from '@/client/console/cardDeal/cardExitDirector';
import {armPlayedHero, isPlayedHeroActive, playedHeroState} from '@/client/console/played/consolePlayedHero';
import {preludePickBurns, preludePickPreview, preludeRewardsOf, PRELUDE_SEAT_SELECTOR} from '@/client/console/deckPick/preludePick';
import ConsoleTableImpact from '@/client/components/console/foundation/ConsoleTableImpact.vue';
import {TableImpactView, tableImpactOfPreview, tableImpactView} from '@/client/console/tableImpact/tableImpactModel';
import {displayNameForColor} from '@/client/components/marsbot/marsBotDisplay';
import {Color} from '@/common/Color';
import ConsolePreludeVariantStep from '@/client/components/console/foundation/ConsolePreludeVariantStep.vue';
import {
  firstAvailableRow, PreludeVariant, preludePreStepStage, preludeVariantAnswer, preludeVariantOf, preludeVariantRowOf, preludeVariantStepResponses,
  stepVariantFocus,
} from '@/client/console/preludeVariant/preludeVariantModel';
import {ActionPreview} from '@/common/models/ActionPreviewModel';
import {startQueueFxLane, StartQueueFxLane} from '@/client/console/startQueueLayout';
import {InputResponse} from '@/common/inputs/InputResponse';
import {armPreludeBurn, flyPreludeBurn, preludeBurnOwed, releasePreludeBurn} from '@/client/console/deckPick/preludeBurnReward';
import {beginPreludePlayChain} from '@/client/console/deckPick/preludePlayChain';
import {
  buildPaymentView, dialLaneCount, editableRows, initialCounts, megacreditsAvailable, paymentCovers, paymentFromCounts,
  PaymentLane, paymentLanes, PaymentView,
} from '@/client/console/paymentPlan';
import {SpendableResource} from '@/common/inputs/Spendable';
import {addressed} from '@/common/inputs/preselectAddress';
import {paymentResponse} from '@/client/console/taskResponses';
import ConsolePaymentPanel from '@/client/components/console/ConsolePaymentPanel.vue';
import {initialVerdictFocus, preludePriceBill, preludeVerdictOf, PreludeVerdictChip, preludeVerdictRows, PreludeVerdictRow, stepVerdictFocus} from '@/client/console/deckPick/preludeVerdict';
import {ResourceTransferSpec} from '@/client/console/resourceTransfer/resourceTransferModel';
import {promptSourceView, PromptSourceView} from '@/client/console/promptSource';
import {cardsResponse} from '@/client/console/taskResponses';
import {markWorkspaceOutcomeArrivalDone, setWorkspaceOutcomePhase, workspaceOutcomeArrivalFlown, workspaceOutcomeState, workspaceSourceZoomOrigin} from '@/client/console/consoleWorkspaceOutcome';
import {
  armDeckPickFlight, beginDeckPickChoosing, beginDeckPickClearing, beginDeckPickDeal,
  beginDeckPickSend, clearDeckPickFlight, deckPickProxyEls, deckPickState, disownDeckPickDeal,
  endDeckPickCommit, markBatchDealt, rollbackDeckPickCommit, saveDeckPickDraft,
  shouldDealBatch, takeDeckPickDraft,
} from '@/client/console/deckPick/consoleDeckPick';
import {motionMs} from '@/client/components/motion/motionTokens';
import {span} from '@/client/console/session/sessionWaits';
import {useFlowScope} from '@/client/console/session/useFlowScope';

/** Bounded retry while the row has no layout yet (JSDOM / mid-reload). */
const FIT_RETRIES = 20;

/** How long a slow server is given to answer before an unchanged prompt is
 *  read as a refusal. Generous next to the ~1.6 s of beats it follows, and
 *  short enough that a genuine refusal gives the screen back promptly. */
const REFUSAL_GRACE_MS = 1500;

/** The read beat between the pick LIFTING off its slot and the rest starting to tumble (PL-207) — one thing at a
 *  time for the eye, never the whole intake tail. Motion-scaled by `applyDiscardExit`. */
const REST_AFTER_LIFT_MS = 220;

function asElements(ref: unknown): Array<HTMLElement> {
  return Array.isArray(ref) ? (ref as Array<HTMLElement>).filter((el) => el instanceof HTMLElement) : [];
}

function textOf(v: string | Message | undefined): string {
  if (v === undefined) {
    return '';
  }
  return typeof v === 'string' ? translateText(v) : translateMessage(v);
}

defineOptions({name: 'ConsoleDeckPick'});
const props = defineProps({
  playerView: {type: Object as PropType<PlayerViewModel>, required: true},
  /** Teleported into a host workspace's zone → no shell of its own. */
  embedded: {type: Boolean, default: false},
});
const emit = defineEmits(['submit', 'submit-batch', 'defer']);

// `flowScope`, not `flow`: this component's `flow` is the deck pick's module state (the alias below), and one scope
// holds one binding of a name.
const flowScope = useFlowScope('deck-pick');
// The candidates' slots — a string ref inside the row's `v-for`, so an ARRAY of the slots that stand.
const slots = useTemplateRef<Array<HTMLElement>>('slots');
const row = useTemplateRef<HTMLElement>('row');
const frameEl = useTemplateRef<HTMLElement>('frameEl');
// The surface's root element (the template's `ref="root"`) — its parent is the HOST'S zone the fit observes, and the
// slots, the stage chrome and the prelude deck's piles are looked up inside it.
const root = useTemplateRef<HTMLElement>('root');
const focusIdx = ref(0);
const picks = ref<Array<CardName>>([]);
/** The deal is on screen — the app-level layer holds the bodies. */
const flyOn = ref(false);
/** Names still owned by a proxy (the real slot stays held under it). */
const held = ref(new Set<string>());
let handle: BatchArrivalHandle | undefined;
/** The identity of the deal THIS surface started (its ceiling's handover is ours only while we stand). */
const dealSeq = ref(0);
/** Blocks a duplicate submit between the press and the response. */
const submitting = ref(false);
const fitRetries = ref(0);
/**
 * THE SNAPSHOT TAKEN AT THE COMMIT.
 *
 * The prompt dies at the submit — `waitingFor` names the next one (or
 * nothing) before the picks have moved a pixel — so a row rendered
 * straight off the model would delete all seven cards on the very frame
 * the flight was supposed to start from them. The surface holds itself
 * mounted for those beats (`consoleDeckPick.committing`); this is what it
 * holds itself mounted AROUND.
 */
const frozen = ref<{
  entries: Array<{name: CardName}>,
  bounds: {min: number, max: number},
  source: PromptSourceView | undefined,
  play: boolean,
  /** Which of the candidates BURN (the verdict read at the commit — the prompt dies with the submit). */
  burning: Array<CardName>,
  /** The verdict's price (P45), frozen with the rest — the rows stand through the exit. */
  verdict: DeckPickPlayPrice | undefined,
  /** The verdict's rows AS PRESSED — their chips read the wallet of the press, never the one the answer moved. */
  verdictRows: Array<PreludeVerdictRow>,
} | undefined>(undefined);
/** THE VERDICT's cursor (P45): 0 = play it, 1 = discard it. */
const verdictFocus = ref(0);
/** THE PRICE'S PAYMENT stands (P45 · PL-1562) — the shared payment's counts, its cursor and its flash. */
const payStage = ref(false);
const payCounts = ref<Partial<Record<SpendableResource, number>>>({});
const payFocus = ref(0);
const payFlashNonce = ref(0);
/** The payment the commit sent (the bill's rows — Helion's heat leaves the heat row). */
const paidWith = ref<Readonly<Record<string, number | undefined>> | undefined>(undefined);
/** THE PRELUDE DECK'S NUMBERS AS PRESENTED (P91) — held while bodies are still moving, else the server's. */
const heldDeckCount = ref<number | undefined>(undefined);
const heldDiscardCount = ref<number | undefined>(undefined);
/** The prelude standing on the «РАЗЫГРАНО» seat (shown once the hero hands it over). */
const seatedPrelude = ref<CardName | undefined>(undefined);
/** The prompt identity the prelude commit was made on (the exit waits for the server to move off it). */
const frozenKey = ref('');
/** The on-play rewards of each candidate (the server's own preview), for the hero's reward beat. */
const candidateRewards = ref<Record<string, ReadonlyArray<ResourceTransferSpec>>>({});
/** The candidates' play previews (P44) — the «ВАРИАНТ» step's rows. */
const candidatePreviews = ref<Record<string, ActionPreview>>({});
/** The prelude whose «ВАРИАНТ» step stands, the cursor's row, the branch POSITION chosen (undefined = none yet). */
const variantCard = ref<CardName | undefined>(undefined);
const variantFocus = ref(0);
const variantChosen = ref<number | undefined>(undefined);
/** The lane beside the chosen prelude the step stands in (`startQueueFxLane` over the frame). */
const variantLane = ref<StartQueueFxLane | undefined>(undefined);
/** Re-fit when the HOST's box changes, not merely when the window does.
 *  The zone this surface lives in is a host's zone: the start
 *  workspace's queue recedes and its column grows AFTER the mount, and a
 *  fit that only ever ran on that first tick left the row solved against
 *  a box that no longer existed — seven cards laid out for a band that
 *  had since changed size, half of them off screen. */
let ro: ResizeObserver | undefined;
/** The deck pick's module state (`consoleDeckPick.ts`) under the name this script reads it by — reactive by itself. */
const flow = deckPickState;

const model = computed((): SelectCardModel | undefined => {
  const wf = props.playerView.waitingFor;
  return wf?.type === 'card' && wf.deckPickPrompt !== undefined ? (wf as SelectCardModel) : undefined;
});
const meta = computed((): DeckPickPromptMeta | undefined => {
  return model.value?.deckPickPrompt;
});
/** THE MID-GAME PRELUDE PICK (P91 WG Project): the pick is PLAYED, never kept — the same surface, its own exit. */
const playMode = computed((): boolean => {
  return frozen.value !== undefined ? frozen.value.play : meta.value?.mode === 'play';
});
const shownDeckCount = computed((): number => {
  return heldDeckCount.value ?? props.playerView.game.preludeDeckSize ?? 0;
});
const shownDiscardCount = computed((): number => {
  return heldDiscardCount.value ?? props.playerView.game.preludeDiscardSize ?? 0;
});
/** The chosen candidate burns (the verb on RT names it). */
const pickBurns = computed((): boolean => {
  const pick = picks.value[0];
  return pick !== undefined && burns(pick);
});
/** The candidates as the SERVER currently states them. */
const liveEntries = computed((): Array<{name: CardName}> => {
  return (model.value?.cards ?? []).map((c) => ({name: c.name}));
});
/** What the row actually renders: the frozen set past the commit, the live
 *  one before it. One computed, so nothing downstream has to know. */
const entries = computed((): Array<{name: CardName}> => {
  return frozen.value?.entries ?? liveEntries.value;
});
const bounds = computed((): {min: number, max: number} => {
  if (frozen.value !== undefined) {
    return frozen.value.bounds;
  }
  const m = meta.value;
  if (verdictPrice.value !== undefined) {
    // A VERDICT is «0 or 1» — and `max 0` is real (the play is refused): never lifted to 1.
    return {min: 0, max: Math.max(0, m?.max ?? 0)};
  }
  return {min: m?.min ?? 1, max: Math.max(1, m?.max ?? 1)};
});
/** THE VERDICT AFTER THE REVEAL (P45): the marker's price, or undefined (P91's «choose 1 of N» stands). */
const verdictPrice = computed((): DeckPickPlayPrice | undefined => {
  return frozen.value !== undefined ? frozen.value.verdict : preludeVerdictOf(meta.value);
});
/** The price's payment the server WILL ask (the marker's `payment` — Helion's heat), or undefined (paid in M€). */
const verdictPayment = computed((): SelectPaymentModel | undefined => {
  return verdictPrice.value !== undefined && frozen.value === undefined ? meta.value?.payment : undefined;
});
const payLanes = computed((): Array<PaymentLane> => {
  const model = verdictPayment.value;
  return model === undefined ? [] : paymentLanes(model, props.playerView.thisPlayer);
});
const payCost = computed((): number => {
  return verdictPrice.value?.megacredits ?? 0;
});
const payView = computed((): PaymentView | undefined => {
  if (verdictPayment.value === undefined) {
    return undefined;
  }
  return buildPaymentView({cost: payCost.value, lanes: payLanes.value, counts: payCounts.value, mcAvailable: megacreditsAvailable(props.playerView.thisPlayer)});
});
const payFocusUnit = computed((): string | undefined => {
  const v = payView.value;
  return v === undefined ? undefined : editableRows(v)[payFocus.value]?.unit;
});
const payReady = computed((): boolean => {
  return paymentCovers(payCost.value, payLanes.value, payCounts.value, megacreditsAvailable(props.playerView.thisPlayer));
});
/** The two outcome rows — off the marker (`price`, `max`) and the server's burn verdict, never re-derived. */
const verdictRows = computed((): Array<PreludeVerdictRow> => {
  if (frozen.value !== undefined) {
    return frozen.value.verdictRows;
  }
  const price = verdictPrice.value;
  const card = entries.value[0]?.name;
  if (price === undefined || card === undefined) {
    return [];
  }
  return preludeVerdictRows(price, {megacredits: props.playerView.thisPlayer.megacredits, max: bounds.value.max, burns: burns(card)});
});
/** The whole prompt is answered by taking EXACTLY this many. */
const exact = computed((): boolean => {
  return bounds.value.min === bounds.value.max;
});
const ready = computed((): boolean => {
  if (verdictPrice.value !== undefined) {
    // The verdict's answer is the ROW; either row is a whole answer (`[]` or the card).
    return true;
  }
  return handSelectPicksValid(bounds.value, picks.value.length);
});
/** The flow's phase, as the module sees it — one source for the class, the
 *  input gate and the command bar. */
const phase = computed((): string => {
  return flow.phase;
});
/** May the player act? Not while cards are still arriving, and never past
 *  the commit — `sending` / `clearing` are beats, not destinations. */
const interactive = computed((): boolean => {
  return phase.value === 'choosing' && !submitting.value;
});
/** Past the commit boundary — the header dresses the stage calmly. */
const committed = computed((): boolean => {
  return phase.value === 'sending' || phase.value === 'clearing';
});
/** At the pick ceiling the unpicked cards calm down: the decision is made,
 *  and the remaining candidates are no longer offers. */
const dimUnpicked = computed((): boolean => {
  return picks.value.length >= bounds.value.max && bounds.value.max > 1;
});
const focusedName = computed((): string => {
  return entries.value[focusIdx.value]?.name ?? '';
});
/** The LIVE server model for one candidate — the strip renders name-only
 *  synthetics, but reasons/cost live on the prompt's own cards. `undefined`
 *  past the commit (the prompt has moved on — nothing is being decided). */
const liveModelFor = computed((): (name: string) => CardModel | undefined => {
  const cards = model.value?.cards;
  return (name) => cards?.find((c) => c.name === name);
});
/**
 * The focused card's availability — the SHARED model in the keep voice
 * ('deck-keep' → draft): «оставь K из N» is the same «for later» decision
 * as a draft pick, and the player deserves the amber/red requirement
 * trajectory before choosing which cards die. Informational only: it
 * never gates a pick, and it goes quiet the moment the player may no
 * longer act (arriving cards / past the commit — the same window the
 * name line already respects).
 */
/** The focused prelude's victims — a play that hits every opponent shows them before the press (P59). */
const focusedTableImpact = computed((): TableImpactView | undefined => {
  if (!playMode.value || !interactive.value || committed.value || focusedName.value === '' || variantStep.value !== undefined) {
    return undefined;
  }
  const name = focusedName.value as CardName;
  if (burns(name)) {
    return undefined; // a burn hits nobody — the reason speaks instead
  }
  const players = props.playerView.players;
  return tableImpactView(tableImpactOfPreview(candidatePreviews.value[name]), (color: Color) => displayNameForColor(players, color));
});
/** The focused burning prelude's NAMED cause (the server's outlook reason), with its seat when it names one. */
const focusedBurnReason = computed((): {text: string, color?: Color} | undefined => {
  if (!playMode.value || !interactive.value || committed.value || focusedName.value === '' || !burns(focusedName.value as CardName)) {
    return undefined;
  }
  const outlook = liveModelFor.value(focusedName.value)?.preludeOutlook;
  const reason = outlook?.state === 'noEffect' ? outlook.reason : undefined;
  if (reason === undefined) {
    return undefined;
  }
  return {text: translateTextWithParams(reason.message, [...(reason.params ?? [])]), ...(reason.seat !== undefined ? {color: reason.seat.color} : {})};
});
const focusedAvailability = computed((): CardAvailabilityView | undefined => {
  if (!interactive.value || committed.value || focusedName.value === '' || playMode.value) {
    // A prelude played at once has no «for later» — its verdict is the burn mark on its face and the status line.
    return undefined;
  }
  const context = availabilityContextFor('deck-keep');
  if (context === undefined) {
    return undefined;
  }
  return buildCardAvailability({reasons: liveModelFor.value(focusedName.value)?.unplayableReasons, easing: liveModelFor.value(focusedName.value)?.requirementEasing}, context);
});
const sourceView = computed((): PromptSourceView | undefined => {
  return frozen.value !== undefined ? frozen.value.source : promptSourceView(model.value);
});
/** The crumb's subject when this surface stands on its own — the card that
 *  turned the deck over. Embedded, the HOST names it (its own source card
 *  is already on screen beside the row). */
const sourceName = computed((): string => {
  return sourceView.value?.card ?? '';
});
/** The stage segment, handed UP while embedded. One word: the root already
 *  says «ДОБОР КАРТ», so the tail must not echo its noun. */
/** The «ВАРИАНТ» step standing over the candidates (P44), or undefined. */
const variantStep = computed((): PreludeVariant | undefined => {
  const card = variantCard.value;
  return card === undefined || !playMode.value ? undefined : preludeVariantOf(card, candidatePreviews.value[card]);
});
const stageKey = computed((): string => {
  if (playMode.value) {
    // «… › ВЫБОР ПРОЛОГА» → «… › ПРОЛОГ»: the tail only moves forward. A verdict (P45) reads «› ВЕРДИКТ»
    // until the press; a played one moves on to «› ПРОЛОГ», a discard stays on its verdict.
    if (verdictPrice.value !== undefined) {
      if (committed.value) {
        return picks.value.length > 0 ? 'Prelude' : 'Verdict';
      }
      return payStage.value ? 'Payment' : (variantStep.value !== undefined ? preludePreStepStage(variantStep.value) : 'Verdict');
    }
    return committed.value ? 'Prelude' : (variantStep.value !== undefined ? preludePreStepStage(variantStep.value) : 'Prelude choice');
  }
  switch (phase.value) {
  case 'dealing': return 'Drawing cards…';
  case 'sending': return 'Received';
  case 'clearing': return 'Received';
  default: return 'Selection';
  }
});
/** The stage's own sentence. The SERVER title wins («Оставьте себе 2
 *  карт(ы)») — it is the precise ask, phrased by the rule that asked. */
const askText = computed((): string => {
  if (verdictPrice.value !== undefined) {
    return translateText('Play the drawn prelude, or discard it');
  }
  if (playMode.value) {
    return translateTextWithParams('Choose 1 of ${0} preludes to play', [String(entries.value.length)]);
  }
  const server = textOf(model.value?.title);
  if (server !== '') {
    return server;
  }
  return exact.value ?
    translateTextWithParams('Keep ${0} of the drawn cards', [String(bounds.value.max)]) :
    translateTextWithParams('Keep up to ${0} of the drawn cards', [String(bounds.value.max)]);
});
const headTitle = computed((): string => {
  if (phase.value === 'dealing') {
    return translateText(meta.value?.origin === 'discard' ? 'From the discard pile' : playMode.value ? 'From the prelude deck' : 'Drawing cards…');
  }
  if (committed.value && playMode.value) {
    if (verdictPrice.value !== undefined && picks.value.length === 0) {
      return translateText('The prelude is discarded');
    }
    return translateText(pickBurns.value ? 'The prelude burns' : 'The prelude is played');
  }
  if (committed.value) {
    return translateTextWithParams('Taken into hand: ${0}', [String(flow.kept)]);
  }
  return askText.value;
});
/** What the status rail says — one line, always in layout. */
const statusText = computed((): string => {
  if (phase.value === 'dealing') {
    return translateTextWithParams(playMode.value ? 'Preludes from the deck: ${0}' : 'Cards from the deck: ${0}', [String(entries.value.length)]);
  }
  if (committed.value && verdictPrice.value !== undefined) {
    return translateText(picks.value.length > 0 ? 'The price is paid first' : 'To the prelude discard pile');
  }
  if (committed.value) {
    return translateText(playMode.value ? 'The other preludes go to the discard pile' : 'The rest is discarded');
  }
  if (verdictPrice.value !== undefined) {
    // The rows below already say each outcome and its refusal — the rail never repeats them (a state with nothing
    // to add renders nothing).
    return '';
  }
  if (playMode.value) {
    // The FOCUSED candidate's fate in one line — what the face cannot print.
    if (focusedName.value !== '' && burns(focusedName.value as CardName)) {
      return translateText('Cannot resolve now: burns, and you gain 15 M€');
    }
    return translateText(picks.value.length > 0 ? 'Selection complete' : 'Played at once; the rest go to the discard pile');
  }
  const left = bounds.value.max - picks.value.length;
  if (left > 0) {
    return exact.value ?
      translateTextWithParams('Choose ${0} more', [String(left)]) :
      translateTextWithParams('You may take ${0} more', [String(left)]);
  }
  return translateText('Selection complete');
});
const statusToneClass = computed((): Record<string, boolean> => {
  return {
    'con-cards__verdict--ok': !ready.value && !committed.value,
    'con-cards__verdict--picked': ready.value || committed.value,
  };
});
/** The prompt IDENTITY — a change is a genuinely new server ask. Built
 *  structurally (never the translated title, which i18n rewrites in place). */
const promptKey = computed((): string => {
  const m = meta.value;
  // Deliberately off the LIVE model, never the frozen snapshot: this key's
  // whole job is to notice the server moving on, and a frozen one never
  // would.
  return `${liveEntries.value.map((e) => e.name).join('|')}#${m?.min ?? 0}-${m?.max ?? 0}${m?.price !== undefined ? '$' + m.price.megacredits : ''}`;
});
const footCommands = computed((): Array<ConsoleCommand> => {
  if (!interactive.value) {
    // A beat in flight absorbs the pad by construction — advertising a
    // verb the surface will swallow is worse than advertising none.
    return [];
  }
  // The SAME grammar the card browser uses, so the family reads as one
  // screen: A toggles a pick, X inspects the focused card, RT commits the
  // set, L3 opens the source, B minimizes. A single-keep prompt answers on
  // the A press itself (there is no set to commit), so RT is not offered.
  const picked = isPicked(focusedName.value as CardName);
  // THE «ВАРИАНТ» STEP (P44): A chooses the row AND plays the prelude; B returns to the candidates, the pick kept.
  if (variantStep.value !== undefined) {
    return [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: variantStep.value.kind === 'resource' ? 'Play with this resource' : 'Play this variant',
        enabled: variantStep.value.rows[variantFocus.value]?.available === true},
      {control: 'secondary', label: 'Inspect'},
      {control: 'back', label: 'Back'},
    ];
  }
  if (verdictPrice.value !== undefined && payStage.value) {
    // THE PRICE'S PAYMENT (PL-1562): the shared payment contract; B one level back to the verdict.
    const cmds: Array<ConsoleCommand> = [
      {control: 'dpad', label: 'Navigate'},
      {control: 'bumperL', label: '−1'}, {control: 'bumperR', label: '+1'},
      {control: 'triggerR', label: 'MAX'},
      {control: 'confirm', label: 'Pay', enabled: payReady.value, priority: 0},
    ];
    if (sourceView.value?.inspectable === true) {
      cmds.push({control: 'stickL', label: 'Source', priority: 1});
    }
    cmds.push({control: 'back', label: 'Back'});
    return cmds;
  }
  if (verdictPrice.value !== undefined) {
    // THE VERDICT (P45): A on a row decides AND commits — the verb names the row (a burn named as one).
    const row = verdictRows.value[verdictFocus.value];
    const cmds: Array<ConsoleCommand> = [
      {control: 'dpad', label: 'Navigate'},
      {
        control: 'confirm',
        label: row?.key === 'discard' ? 'Discard' : (row?.burns === true ? 'Burn for 15 M€' : 'Play now'),
        enabled: row?.available === true,
      },
      {control: 'secondary', label: 'Inspect'},
    ];
    if (sourceView.value?.inspectable === true) {
      cmds.push({control: 'stickL', label: 'Source', priority: 1});
    }
    cmds.push({control: 'back', label: 'Minimize'});
    return cmds;
  }
  if (playMode.value) {
    // A prelude is PLAYED — A chooses, RT commits; the verb names a burn (the press is the confirmation).
    const cmds: Array<ConsoleCommand> = [
      {control: 'dpad', label: 'Navigate'},
      {control: 'confirm', label: picked ? 'Deselect' : 'Select'},
      {control: 'secondary', label: 'Inspect'},
    ];
    if (sourceView.value?.inspectable === true) {
      cmds.push({control: 'stickL', label: 'Source', priority: 1});
    }
    cmds.push({control: 'triggerR', label: pickBurns.value ? 'Burn for 15 M€' : 'Play now', enabled: ready.value, priority: 0});
    cmds.push({control: 'back', label: 'Minimize'});
    return cmds;
  }
  const single = exact.value && bounds.value.max === 1;
  const cmds: Array<ConsoleCommand> = [
    {control: 'dpad', label: 'Navigate'},
    {
      control: 'confirm',
      label: single ? 'Select' : (picked ? 'Deselect' : 'Select'),
      enabled: picked || picks.value.length < bounds.value.max,
    },
    {control: 'secondary', label: 'Inspect'},
  ];
  // Console-wide grammar: L3 opens the SOURCE that produced what is on
  // screen. Offered EMBEDDED too — the host shows the card, but showing is
  // not reading: the whole point of the seat is that this draw came from
  // that card, and the player must be able to open it without leaving.
  // (It was suppressed here while the reveal beside it offered it, so the
  // same verb existed on one step of the flow and not the next.)
  if (sourceView.value?.inspectable === true) {
    cmds.push({control: 'stickL', label: 'Source', priority: 1});
  }
  if (!single) {
    // The COMMIT verb is discoverable nowhere else, so it is the last
    // droppable standing when the bar has to shed hints for fit.
    cmds.push({control: 'triggerR', label: 'Confirm', enabled: ready.value, priority: 0});
  }
  // B = MINIMIZE, always. Embedded it minimizes THE HOSTING WORKSPACE —
  // the documented verb for a nested step, and the very same thing the
  // start scene's own B does one level up, so the button never changes
  // meaning as the player descends. (It was withheld here on the theory
  // that a full-bleed host has nowhere to go; but the host itself offers
  // «B СВЕРНУТЬ», so all withholding it achieved was a step where B
  // silently did nothing.)
  cmds.push({control: 'back', label: 'Minimize'});
  return cmds;
});

function isPicked(name: CardName | string): boolean {
  return picks.value.includes(name as CardName);
}
/** A real card is HELD while a proxy stands over it (Vue-managed, so a
 *  patch can never resurrect it under the flying copy). */
function slotHeld(name: CardName): boolean {
  return held.value.has(name);
}
// ── THE DEAL ────────────────────────────────────────────────────────
/**
 * N cards come off the deck. The row is FIT FIRST (a batch that launched
 * against a pre-fit geometry would land off its own targets), then the
 * proxies are measured and handed to the shared director.
 */
function startDeal(): void {
  handle?.kill();
  handle = undefined;
  // ADOPT, NEVER RE-DEAL — two distinct reasons, one behaviour:
  //  · the HOST's own execution beat already pulled these cards off the
  //    pile at confirm (the hand-play door): they are standing in these
  //    very slots under the host's landed proxies;
  //  · this BATCH has already been dealt by a previous mount of this very
  //    surface (collapse → reopen of the hosting workspace, an inspect
  //    round trip, a duplicate render of the same server ask). The deal is
  //    the presentation of a NEW batch, exactly once — keyed on the
  //    batch's own identity in MODULE state, never on the mount.
  // Dealing anyway meant cards flying off a deck they had already left.
  const hostFlew = props.embedded && workspaceOutcomeArrivalFlown();
  if (hostFlew || !shouldDealBatch(promptKey.value)) {
    flyOn.value = false;
    held.value.clear();
    // Through `deal` all the same, so a previous commit's bookkeeping is
    // reset exactly as it is on every other path — the phase simply does
    // not linger there, because the cards have already landed.
    beginDeckPickDeal();
    beginDeckPickChoosing();
    markBatchDealt(promptKey.value);
    // The parked table state of THIS batch comes back with it: the draft
    // picks and the cursor survive the round trip to the board.
    const draft = takeDeckPickDraft(promptKey.value);
    if (draft !== undefined) {
      picks.value = draft.picks.filter((n) => entries.value.some((e) => e.name === n));
      focusIdx.value = Math.min(Math.max(0, draft.focusIdx), Math.max(0, entries.value.length - 1));
    }
    // A batch-identity adopt owns its arrival gate (nothing else will open
    // it); a HOST-flown adopt must NOT — the host's handoff opens it, and
    // opening early would uncover cards its proxies still stand over.
    if (!hostFlew) {
      markWorkspaceOutcomeArrivalDone();
    }
    scheduleFit();
    return;
  }
  // BOUNDED (R13): a landing that never comes ends at the deal's ceiling through the surface's own handover.
  dealSeq.value = beginDeckPickDeal(() => handOverDealAtCeiling());
  const names = entries.value.map((e) => e.name);
  held.value = new Set<string>(names);
  if (typeof window === 'undefined') {
    flyOn.value = false;
    held.value.clear();
    beginDeckPickChoosing();
    return;
  }
  flyOn.value = true;
  // The bodies are the APP-LEVEL layer's; we only name the faces.
  armDeckPickFlight(names);
  // FREEZE the HUD deck counter at its pre-draw value: the server's answer
  // has already decremented it, so without this the number changes before
  // anything has physically left the pile — the opposite of the causal
  // story the beat exists to tell. Released as the first card separates.
  //
  // ONLY for a deck-sourced reveal. A discard-pile digger never touched the
  // deck, and inflating the counter for it would invent a draw that did not
  // happen — a worse lie than the one this is fixing.
  if (playMode.value) {
    // THE PRELUDE DECK is this surface's own object: its number is held at the pre-draw value and ticks card by
    // card as each one leaves its pile — the project deck's HUD counter is never touched (it drew nothing).
    heldDeckCount.value = (props.playerView.game.preludeDeckSize ?? 0) + names.length;
    prefetchRewards(names);
  } else if (meta.value?.origin !== 'discard') {
    holdDeckDisplay(props.playerView.game.deckSize + names.length);
  }
  void nextTick(() => {
    fitRow();
    void nextTick(() => launchDeal());
  });
}
function launchDeal(): void {
  if (!flyOn.value || handle !== undefined) {
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
  // The faces exist from the first frame (the prompt carries them), so the
  // batch opens IN FLIGHT — a post-landing flip here would be a bug.
  // The PRELUDE pick deals off its own deck object (never the HUD's project pile — `from`), its count ticking per card.
  const pile = playMode.value ? (root.value?.querySelector<HTMLElement>('[data-prelude-pile]') ?? null) : null;
  const pileRect = pile?.getBoundingClientRect();
  handle = runBatchArrival({
    cards, slots: slotsNow,
    mode: 'in-flight-reveal',
    from: pileRect !== undefined && pileRect.width > 4 ?
      {rect: {left: pileRect.left, top: pileRect.top, width: pileRect.width, height: pileRect.height}, kind: 'card'} :
      undefined,
    onCardPeeled: () => {
      if (heldDeckCount.value !== undefined) {
        heldDeckCount.value = Math.max(props.playerView.game.preludeDeckSize ?? 0, heldDeckCount.value - 1);
      }
    },
    onDeparted: () => releaseDeckDisplay(),
    onSettled: () => {
      handle = undefined;
      handOffDeal();
    },
  });
}
/** HANDOFF: reveal the real cards UNDER the proxies, remove the proxies on
 *  the next frame. Never a cross-fade (the copies are identical, so a fade
 *  can only expose what differs) and never hide-then-reveal (a blank frame). */
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
/**
 * THE DEAL'S CEILING fired (R13): the flight never reported its landing. The deal ends where it stands — the
 * arrival is stopped, the real cards show in their slots (the proxies go with the layer), the cursor opens.
 */
function handOverDealAtCeiling(): void {
  handle?.kill();
  handle = undefined;
  finishDeal();
}
function finishDeal(): void {
  flyOn.value = false;
  clearDeckPickFlight();
  held.value.clear();
  releaseDeckDisplay();
  heldDeckCount.value = undefined;
  // THIS batch's deal has physically played — a later remount of the same
  // server ask adopts a settled table instead of re-dealing it.
  markBatchDealt(promptKey.value);
  // The claim's ARRIVAL gate is ours to open: this surface flew the batch,
  // so nothing else is going to say the cards have landed. Left closed it
  // would sit on the 5 s backstop while a fully interactive stage waited
  // for permission it had already earned.
  markWorkspaceOutcomeArrivalDone();
  // One last verify: the host's own return choreography (a queue receding,
  // a shelf settling) can finish AFTER the batch has landed, and the row
  // must end up solved against the box it actually got — solved NOW, before
  // the cursor opens (TR58): a refit in the frame the ring arrives read as
  // every card changing size under a ring that was just coming in.
  fitRow();
  // …and the cursor opens one painted frame AFTER the handoff — its own beat,
  // on the settled row (`beginDeckPickChoosing` is what makes a card focused).
  const key = promptKey.value;
  probeTick(() => {
    if (promptKey.value === key) {
      beginDeckPickChoosing();
    }
  });
}
// ── FIT ─────────────────────────────────────────────────────────────
function scheduleFit(): void {
  fitRetries.value = 0;
  void nextTick(() => fitRow());
}
/**
 * ONE geometry engine, shared with every other card stage in a workspace
 * (`consoleWsStageLayout`): the gap is an OUTPUT solved together with the
 * zoom, so a focused card's ring can never grow over its neighbour, and a
 * batch of seven wraps into a deliberate two-row composition instead of
 * only shrinking.
 */
function fitRow(): void {
  const rowNow = row.value ?? undefined;
  if (rowNow === null || rowNow === undefined || entries.value.length === 0) {
    return;
  }
  // ⚠️ RESET THE ENGINE'S OWN OUTPUTS BEFORE MEASURING. The wrap cap is a
  // `max-width` on this very row, so a second fit would measure the width
  // the FIRST fit chose — narrower room, more rows, a narrower cap, and so
  // on. Same rule as the zoom reset beside it: an engine never reads its
  // own output.
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
  // THE SOURCE SEAT'S SAFE ZONE. The host parks a compact source card at
  // the left of its zone, and the card group is CENTRED — so reserving the
  // seat's width on BOTH sides is what guarantees the margin can never be
  // smaller than the seat. No z-index, no overlap: the two simply never
  // occupy the same space, in any phase, at any focus scale.
  //
  // Read here rather than expressed as row padding on purpose: the profile
  // ladders re-declare the row's `padding` shorthand, so an inset that rode
  // it silently vanished on the TV profile — and the source card then sat
  // on top of the first revealed card.
  //
  // MEASURED off the real seat, never read from the custom property that
  // declares it: `getPropertyValue('--x')` returns the token UNRESOLVED,
  // and this one is a `calc(...)` — `parseFloat` gives NaN, the fallback
  // gives 0, and the reserve silently disappears. (`cssLengthPx` covers
  // plain `rem`/`px`, which is why the trap survives it.) The seat is on
  // screen; asking it is both simpler and honest at any profile.
  const reserve = sourceReservePx();
  const layout = wsStageLayout({
    availW: rowNow.clientWidth - padX - reserve * 2,
    // ⚠️ NEVER `row.clientHeight`. The row is `flex: 1` inside a frame that
    // the HOST sizes, so in a host whose zone lets its content grow, the
    // row's height is partly its OWN content — feeding it back in makes the
    // engine solve against its own output: a bigger zoom grows the row,
    // which buys a bigger zoom, until seven cards are laid out for a band
    // twice the size of the one on screen and half of them hang off it.
    // (Adding a ResizeObserver is what turned that latent circularity into
    // a reliable overflow, which is the honest way it should have failed.)
    //
    // The FRAME is the bounded box — the host's zone caps it — so the
    // budget is the frame's inner height minus this stage's own chrome,
    // measured, never enumerated.
    availH: Math.max(200 * ui, rowBudgetPx() - padY),
    slotW, slotH, n: entries.value.length, ui,
    rowGapPx: parseFloat(cs.rowGap) || undefined,
    // The WRAP CAP is a `max-width` on the ROW, so it may only carry the
    // row's OWN padding. The seat reserve is a virtual margin, not padding:
    // folding it in here made the cap wider than the shape it caps, and a
    // seven-card group planned as 4 + 3 broke as 5 + 2.
    padXPx: padX,
  });
  const style = wsStageLayoutStyle(layout);
  Object.entries(style).forEach(([k, v]) => rowNow.style.setProperty(k, v));
}
/**
 * THE SOURCE SEAT'S WIDTH PLUS BREATHING ROOM, or 0 when no seat is shown.
 *
 * The host parks a compact source card at the left of its zone; the card
 * group is centred, so reserving this on BOTH sides is what guarantees the
 * group's margin can never be narrower than the seat. Spatial separation
 * by construction — not a z-index, not an overlap the eye forgives.
 */
function sourceReservePx(): number {
  // ONE definition, shared with the drawn reveal (`sourceSeatReservePx`):
  // both stages present inside the same host zones, and two copies of this
  // arithmetic is exactly how one of them ends up cropping.
  return sourceSeatReservePx(conUiScale());
}
/**
 * The height the ROW may actually spend — the frame's inner box minus the
 * chrome that shares the column with it (the stage head, the status line
 * and the frame's own padding + gaps). Every term is MEASURED off the real
 * elements, so a profile that re-tunes any of them needs no change here.
 */
function rowBudgetPx(): number {
  const frame = frameEl.value ?? undefined;
  if (frame === null || frame === undefined) {
    return 0;
  }
  const fcs = window.getComputedStyle(frame);
  let budget = frame.clientHeight -
    (parseFloat(fcs.paddingTop) || 0) - (parseFloat(fcs.paddingBottom) || 0);
  const rootNow = root.value ?? undefined;
  for (const sel of ['.con-wshead', '.con-deckpick__head', '.con-deckpick__status', '.con-deckpick__verdict', '.con-deckpick__pay']) {
    const el = rootNow?.querySelector<HTMLElement>(sel) ?? null;
    if (el !== null) {
      const ecs = window.getComputedStyle(el);
      budget -= el.offsetHeight +
        (parseFloat(ecs.marginTop) || 0) + (parseFloat(ecs.marginBottom) || 0);
    }
  }
  // The column gaps between those siblings (frame gap + `.con-cards` gap).
  const cards = rootNow?.querySelector<HTMLElement>('.con-deckpick__cards') ?? null;
  budget -= parseFloat(fcs.rowGap) || 0;
  budget -= cards === null ? 0 : (parseFloat(window.getComputedStyle(cards).rowGap) || 0);
  return budget;
}
// ── INPUT ───────────────────────────────────────────────────────────
function handleIntent(intent: GamepadIntent): void {
  if (!interactive.value) {
    return; // a beat in flight absorbs the pad — no double submit possible
  }
  // THE «ВАРИАНТ» STEP owns the pad while it stands (P44): ↑↓ walk the rows, A (or RT) chooses and plays, B back.
  if (variantStep.value !== undefined) {
    if (intent.kind === 'nav') {
      variantFocus.value = stepVariantFocus(variantStep.value, variantFocus.value, intent.dir === 'down' || intent.dir === 'right' ? 1 : -1);
      return;
    }
    const verb = consoleActionOf(intent);
    if (verb === 'primary' || verb === 'nextTab') {
      onVariantPick(variantFocus.value);
    } else if (verb === 'back') {
      variantCard.value = undefined;
    } else if (verb === 'inspect') {
      inspectFocused();
    }
    return;
  }
  if (payStage.value) {
    handlePayIntent(intent);
    return;
  }
  if (verdictPrice.value !== undefined && verdictRows.value.length > 0) {
    // THE VERDICT (P45): the cursor walks the OUTCOMES (one card, two rows); A on a row decides and commits.
    if (intent.kind === 'nav') {
      verdictFocus.value = stepVerdictFocus(verdictRows.value, verdictFocus.value, intent.dir === 'down' || intent.dir === 'right' ? 1 : -1);
      return;
    }
    if (intent.kind === 'press' && intent.button === 'stickL') {
      inspectSource();
      return;
    }
    const verb = consoleActionOf(intent);
    if (verb === 'primary') {
      chooseVerdictRow(verdictFocus.value);
    } else if (verb === 'inspect') {
      inspectFocused();
    } else if (verb === 'back') {
      emit('defer');
    }
    return;
  }
  if (intent.kind === 'nav') {
    move(intent.dir);
    return;
  }
  // L3 — the SOURCE card fullscreen. A raw button read: the stick presses
  // carry no default semantic action by design.
  if (intent.kind === 'press' && intent.button === 'stickL') {
    inspectSource();
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'primary': // A — toggle the focused card's pick
    toggleFocused();
    return;
  case 'inspect': // X — the console-wide fullscreen inspect
    inspectFocused();
    return;
  case 'nextTab': // RT — commit the set
    confirm();
    return;
  case 'back': // B — minimize (embedded: the HOSTING workspace folds)
    emit('defer');
    return;
  default:
    return;
  }
}
/**
 * PHYSICAL navigation — measured off the real slots, never an index.
 *
 * The last row of a wrapped group is CENTRED (4 + 3 puts the three under
 * the middle of the four), so a column-preserving index stepper sends the
 * cursor to a card that is visibly not the one below it.
 * `nearestInDirection` is the fork's shared answer to exactly that
 * question — the start wizard's own grid already navigates by it.
 *
 * The index stepper stays as the fallback for the frames before layout
 * (and for JSDOM), never as the normal path.
 */
function move(dir: 'up' | 'down' | 'left' | 'right'): void {
  const rects = asElements(slots.value)
    .map((el) => el.getBoundingClientRect())
    .filter((r) => r.width > 4)
    .map((r) => ({left: r.left, top: r.top, width: r.width, height: r.height}));
  if (rects.length === entries.value.length) {
    const next = nearestInDirection(rects, focusIdx.value, dir);
    if (next >= 0) {
      focusIdx.value = next;
    }
    return;
  }
  const rowNow = row.value ?? undefined;
  const perRow = Math.max(1, parseInt(
    rowNow?.style.getPropertyValue('--con-ws-stage-per-row') || String(entries.value.length), 10) ||
    entries.value.length);
  focusIdx.value = stepHandGrid(focusIdx.value, dir, entries.value.length, perRow);
}
/** THE PRICE'S PAYMENT (PL-1562): ↑↓ a source, ←→ / LB RB ±1, RT the source's MAX, A pays and plays, B back. */
function handlePayIntent(intent: GamepadIntent): void {
  if (intent.kind === 'nav') {
    const rows = payView.value === undefined ? 0 : editableRows(payView.value).length;
    if (intent.dir === 'up' || intent.dir === 'down') {
      payFocus.value = Math.min(Math.max(0, rows - 1), Math.max(0, payFocus.value + (intent.dir === 'down' ? 1 : -1)));
    } else {
      dialPay(intent.dir === 'right' ? 1 : -1);
    }
    return;
  }
  if (intent.kind === 'press' && intent.button === 'stickL') {
    inspectSource();
    return;
  }
  switch (consoleActionOf(intent)) {
  case 'prevSection':
    dialPay(-1);
    return;
  case 'nextSection':
    dialPay(1);
    return;
  case 'nextTab':
    dialPay('max');
    return;
  case 'primary':
    if (payReady.value) {
      confirm();
    }
    return;
  case 'back':
    leavePay();
    return;
  default:
    return;
  }
}
function dialPay(step: number | 'max'): void {
  const unit = payFocusUnit.value;
  const lane = payLanes.value.find((l) => l.unit === unit);
  if (lane === undefined) {
    return;
  }
  const current = payCounts.value[lane.unit] ?? 0;
  const next = dialLaneCount(payCost.value, lane, payLanes.value, payCounts.value, step);
  if (next !== current) {
    payCounts.value = {...payCounts.value, [lane.unit]: next};
    payFlashNonce.value += 1;
  }
}
function enterPay(): void {
  // The chosen branch (P44's «ВАРИАНТ») is KEPT (`variantChosen`); its layer gives the stage to the payment.
  variantCard.value = undefined;
  payStage.value = true;
  payCounts.value = initialCounts(payCost.value, payLanes.value, megacreditsAvailable(props.playerView.thisPlayer));
  payFocus.value = 0;
}
/** B from the payment: one level back — the verdict, its cursor on «РАЗЫГРАТЬ», nothing sent, no branch kept. */
function leavePay(): void {
  payStage.value = false;
  payCounts.value = {};
  picks.value = [];
  variantChosen.value = undefined;
}
/** A on a verdict row (P45): the play — through the ordinary commit (the «ВАРИАНТ» step first when the prelude's play
 *  is a choice) — or the discard (`[]`). A refused row is read, never taken. */
function chooseVerdictRow(index: number): void {
  const row = verdictRows.value[index];
  const card = entries.value[0]?.name;
  if (row === undefined || card === undefined || !row.available) {
    return;
  }
  verdictFocus.value = index;
  picks.value = row.key === 'play' ? [card] : [];
  confirm();
  if (!submitting.value && variantCard.value === undefined && !payStage.value) {
    picks.value = [];
  }
}
function verdictText(text: {key: string, params: ReadonlyArray<string>}): string {
  return text.params.length > 0 ? translateTextWithParams(text.key, [...text.params]) : translateText(text.key);
}
function chipIconClass(chip: PreludeVerdictChip): string {
  return chip.kind === 'megacredits' ?
    'resource_icon resource_icon--megacredits' :
    'con-deckpick__vchip-icon--card';
}
function toggleFocused(): void {
  const name = focusedName.value as CardName;
  if (name === '') {
    return;
  }
  const at = picks.value.indexOf(name);
  if (at >= 0) {
    picks.value.splice(at, 1);
    return;
  }
  if (playMode.value) {
    // ONE prelude is played: A moves the choice; RT is the press that plays (or burns) it.
    picks.value = [name];
    return;
  }
  if (picks.value.length >= bounds.value.max) {
    // At the ceiling A does nothing rather than silently swapping a pick
    // the player cannot see leaving — the status rail already says how
    // many are owed, and deselect is on the same button.
    return;
  }
  picks.value.push(name);
  // A prompt that takes EXACTLY ONE card is answered by the press itself:
  // asking for a second confirmation of a decision with no second step is
  // the ceremony the console removes everywhere else.
  if (exact.value && bounds.value.max === 1) {
    confirm();
  }
}
/** X = the CURRENT object (console-wide grammar). The card is a visible
 *  tile, so it lifts physically out of its slot and dives back into it —
 *  the stage is never unmounted, so the picks and the focus survive. */
/** The fullscreen viewer's pick bridge — same rule as the strip's A. */
function toggleByName(name: CardName): void {
  const at = entries.value.findIndex((e) => e.name === name);
  if (at >= 0) {
    focusIdx.value = at;
    toggleFocused();
  }
}
function inspectFocused(): void {
  // The FULL live models where the prompt still carries them (reasons for
  // the availability panel; the frozen post-commit browse degrades to the
  // name synthetics honestly — nothing is being decided there).
  const cards = entries.value.map((e) => liveModelFor.value(e.name) ?? ({name: e.name} as CardModel));
  if (cards.length === 0) {
    return;
  }
  openConsoleCardZoom(cards, focusIdx.value, {
    isSelected: (name) => isPicked(name),
    toggle: (name) => toggleByName(name),
  }, undefined, {
    origin: slotZoomOrigin(
      () => root.value ?? undefined,
      (i) => entries.value[i]?.name ?? '',
      (i) => {
        focusIdx.value = i;
      }),
    // «Оставь K из N» is a for-later decision — the keep voice.
    availability: availabilityContextFor('deck-keep'),
  });
}
/**
 * L3 = the SOURCE that produced what is on screen — read-only (no select
 * bridge, so it can never answer the prompt).
 *
 * The card is a REAL object on screen while embedded (the host's source
 * seat), so the viewer LIFTS THAT ONE rather than opening a second copy
 * beside it — the console's physicality rule. Standalone there is no seat
 * and the viewer degrades to its textual entrance by itself.
 */
function inspectSource(): void {
  const card = sourceView.value?.inspectable === true ? sourceView.value.card : undefined;
  if (card === undefined) {
    return;
  }
  const model = props.playerView.thisPlayer.tableau.find((c) => c.name === card) ?? {name: card};
  openConsoleCardZoom([model as CardModel], 0, undefined, undefined, {
    contextLabel: 'Card draw',
    statusLabel: 'Source',
    // ONE resolver for every host that offers L3 Источник — the same one
    // the reveal uses, so the card lifts out of whichever seat is holding
    // it and its slot is held empty for the trip.
    origin: workspaceSourceZoomOrigin(String(card)),
  });
}
// ── THE COMMIT ──────────────────────────────────────────────────────
/**
 * CONFIRM — and then the whole point of the surface.
 *
 * The submit goes out FIRST (the server works while the cards travel, so
 * the latency hides inside a beat the player wanted to watch), but the
 * surface holds itself down across the round trip: `waitingFor` names the
 * next prompt long before anything has reached the dock, and unmounting
 * there is exactly what made the old flow read as a teleport.
 *
 * Order is the causality the player is owed:
 *   picks LEAVE and land in the dock  →  the rest is no longer needed.
 */
function confirm(): void {
  if (!ready.value || submitting.value || !interactive.value) {
    return;
  }
  const kept = [...picks.value];
  // THE «ВАРИАНТ» STEP (P44): a prelude whose play is a CHOICE is never played on RT straight — the step opens over
  // the candidates first; its row's A comes back here with the branch chosen. A burning prelude has nothing to choose.
  const played = kept[0];
  if (playMode.value && played !== undefined && variantChosen.value === undefined && !burns(played) &&
      preludeVariantOf(played, candidatePreviews.value[played]) !== undefined) {
    const variant = preludeVariantOf(played, candidatePreviews.value[played]);
    variantFocus.value = variant === undefined ? 0 : firstAvailableRow(variant);
    const frame = frameEl.value ?? undefined;
    const hero = asElements(slots.value).find((el) => el.getAttribute('data-deckpick-slot') === played);
    if (frame !== undefined && frame !== null && hero !== undefined) {
      const fr = frame.getBoundingClientRect();
      const remPx = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      variantLane.value = startQueueFxLane(fr, hero.getBoundingClientRect(), remPx, fr.width > 0 ? frame.offsetWidth / fr.width : 1);
    }
    variantCard.value = played;
    return;
  }
  // THE PRICE'S PAYMENT (PL-1562): a play whose price the server WILL ask stands its payment first — the same press
  // returns here with the counts in hand (`payStage`), and the pick and the payment leave in ONE POST.
  if (verdictPayment.value !== undefined && played !== undefined && !payStage.value) {
    enterPay();
    return;
  }
  submitting.value = true;
  // The payment is read FIRST — the price's bill (armed below, with the hero) flies the rows it was paid from.
  const payment = payStage.value ? payResponse() : undefined;
  // FREEZE FIRST, submit second. The order is the whole point: the response
  // can land in the same tick, and the row must already be reading from a
  // snapshot when it does.
  frozen.value = {
    entries: [...entries.value],
    bounds: {...bounds.value},
    source: sourceView.value,
    play: playMode.value,
    burning: entries.value.map((e) => e.name).filter((name) => burns(name)),
    verdict: verdictPrice.value,
    verdictRows: verdictRows.value,
  };
  if (frozen.value.play) {
    frozenKey.value = promptKey.value;
    armPreludePlay(kept[0]);
  }
  // Synchronous with the submit — no frame exists in which the prompt is
  // gone and the hold is not yet up.
  beginDeckPickSend(kept.length);
  // THE CHOSEN BRANCH RIDES THE PICK (P44): ONE POST — the pick's answer + the addressed answer of the prelude's
  // `or` (`deferredInputBatch` lands it on the card's own question once the server asks it).
  const answer = variantAnswer(played);
  variantCard.value = undefined;
  variantChosen.value = undefined;
  // …and the price's payment (PL-1562), ADDRESSED to the payment the server raises behind the pick (its `cause` is the
  // source card) — a foreign question that jumps the queue never consumes it.
  if (answer !== undefined || payment !== undefined) {
    emit('submit-batch', [cardsResponse(kept), ...(payment !== undefined ? [payment] : []), ...(answer !== undefined ? [answer] : [])]);
  } else {
    emit('submit', cardsResponse(kept));
  }
  payStage.value = false;
  void runOutgoing(kept);
}
async function runOutgoing(kept: ReadonlyArray<CardName>): Promise<void> {
  const key = promptKey.value;
  if (frozen.value?.play === true) {
    try {
      await runPreludeExit(kept[0]);
    } finally {
      await awaitPromptMoved(key);
      endOutgoing(key);
    }
    return;
  }
  try {
    // THE REST LEAVE WHILE THE PICK IS IN THE AIR (PL-207). Sequenced on the pick's LANDING, the cards nobody took
    // stood still for the whole intake tail — the hover for the server's answer, the dock's touchdown and settle:
    // ≈ 0.7 s at 4K of a finished choice read as a pause («В руку взято: 1» over four cards going nowhere). The
    // order the eye reads is kept — the pick LIFTS off its slot first (the intake's staging seam), one read beat
    // later the rest start tumbling — and the surface still waits for BOTH beats to end.
    let clearing: Promise<void> | undefined;
    const startClearing = (delayMs: number): Promise<void> => {
      if (clearing === undefined) {
        beginDeckPickClearing();
        clearing = clearRest(kept, delayMs);
      }
      return clearing;
    };
    // THE RESULT OUTLIVES ITS SURFACE (PL-212 — the owner's decision 2026-10-12). The surface used to wait for the
    // WHOLE intake — the hover for the answer, the arc, the dock's touchdown and settle — and only then let the
    // workspace go: ≈ 1.3 s at 4K of one card in the air over an empty zone (TR46's tail probe). The picks fly in the
    // APP-LEVEL delivery layer (`runHandIntake` — the dock's held multiset owns them from the lift), so the surface
    // owes them nothing once they have LIFTED off their slots: it releases when the pick is up and the rest have
    // left, and the workspace folds UNDER the flight into the dock. A run with nothing to lift (no dock on screen,
    // no slot) releases on its own end, as before.
    let markLifted: () => void = () => {};
    let failLifted: (err: unknown) => void = () => {};
    const lifted = new Promise<void>((resolve, reject) => {
      markLifted = resolve;
      failLifted = reject;
    });
    const intake = sendToHand(kept, () => {
      markLifted();
      void startClearing(REST_AFTER_LIFT_MS);
    });
    // The intake runs on after the release; its own end belongs to the dock (never an unhandled rejection here).
    intake.catch(() => undefined);
    // Released by the lift — or by the intake's own end (its failure included) when nothing lifts.
    intake.then(() => markLifted(), (err: unknown) => failLifted(err));
    await lifted;
    await startClearing(0);
  } finally {
    // A REFUSED submit must not leave the player inside a beat that will
    // never finish. The honest signal is the prompt itself: if the server
    // is still asking the very same question after the beats AND after a
    // bounded grace for a slow answer, the move did not happen — roll the
    // flow back to `choosing` (the surface is still mounted by the ordinary
    // gate) instead of unmounting a screen that is still owed an answer.
    await awaitPromptMoved(key);
    endOutgoing(key);
  }
}
/** The commit's end: rolled back on a refusal (the same question still stands), released otherwise. */
function endOutgoing(key: string): void {
  releasePreludeBurn('deck-pick-ended');
  frozen.value = undefined;
  heldDiscardCount.value = undefined;
  if (model.value !== undefined && promptKey.value === key) {
    picks.value = [];
    focusIdx.value = 0;
    submitting.value = false;
    seatedPrelude.value = undefined;
    held.value.clear();
    rollbackDeckPickCommit();
  } else {
    endDeckPickCommit();
    // A NEW BATCH ON THE SAME SURFACE (P91 — New Partner played out of the pick raises a pick of its own): the
    // surface stayed mounted across the commit, so the identity watcher returned early while the snapshot owned
    // the screen. The new batch is dealt now, off the same deck object — never inherited picks over cards that
    // were never dealt.
    if (model.value !== undefined) {
      picks.value = [];
      focusIdx.value = 0;
      submitting.value = false;
      held.value.clear();
      if (entries.value.length > 0) {
        startDeal();
      }
    }
  }
}
// ── THE PRELUDE PLAY (P91) ──────────────────────────────────────────
/** Is this candidate a prelude that cannot resolve now — it burns for 15 M€ (the server's verdict, never re-derived). */
function burns(name: CardName): boolean {
  if (frozen.value !== undefined) {
    return frozen.value.burning.includes(name);
  }
  return preludePickBurns(liveModelFor.value(name)?.preludeOutlook);
}
/** The candidates' own on-play rewards, from the server's preview — fetched while the player reads the cards. */
function prefetchRewards(names: ReadonlyArray<CardName>): void {
  // ONE batch's answers — a new deal asks again (the state a nested pick is asked in is not the first one's).
  candidateRewards.value = {};
  candidatePreviews.value = {};
  variantCard.value = undefined;
  variantChosen.value = undefined;
  const viewer = props.playerView.id;
  for (const name of names) {
    void preludePickPreview(viewer, name).then((preview) => {
      if (preview !== undefined) {
        candidatePreviews.value = {...candidatePreviews.value, [name]: preview};
      }
      const rewards = preludeRewardsOf(name, preview, 0);
      if (rewards !== undefined && rewards.length > 0) {
        candidateRewards.value = {...candidateRewards.value, [name]: rewards};
      }
    });
  }
}
/** A on a «ВАРИАНТ» row: a takeable row is the CHOICE and the PLAY — its rewards re-read, the pick committed. */
function onVariantPick(index: number): void {
  const card = variantCard.value;
  const row = variantStep.value?.rows[index];
  if (card === undefined || row === undefined) {
    return;
  }
  variantFocus.value = index;
  if (!row.available) {
    return; // a refused row is read, never taken
  }
  variantChosen.value = row.choice;
  const rewards = preludeRewardsOf(card, candidatePreviews.value[card], row.position, preludeVariantStepResponses(row));
  const next = {...candidateRewards.value};
  if (rewards !== undefined && rewards.length > 0) {
    next[card] = rewards;
  } else {
    delete next[card];
  }
  candidateRewards.value = next;
  confirm();
  if (!submitting.value && !payStage.value) {
    variantChosen.value = undefined; // refused (not ready / not interactive) — the step stands for the next A
  }
}
/** The price's payment, addressed to its asker (the verdict's source card, role `payment`); the bill reads its rows. */
function payResponse(): InputResponse {
  const mc = megacreditsAvailable(props.playerView.thisPlayer);
  const payment = paymentFromCounts(payCost.value, payLanes.value, payCounts.value, mc);
  paidWith.value = {...payment} as Record<string, number>;
  const source = meta.value?.source;
  return addressed(paymentResponse(payment), source === undefined ? undefined : {source, role: 'payment'});
}
/** The chosen branch's addressed answer, or undefined (nothing chosen / nothing to choose). */
function variantAnswer(card: CardName | undefined): InputResponse | undefined {
  if (card === undefined || variantChosen.value === undefined) {
    return undefined;
  }
  const preview = candidatePreviews.value[card];
  const row = preview === undefined ? undefined : preludeVariantRowOf(preludeVariantOf(card, preview), variantChosen.value);
  return preview === undefined || row === undefined ? undefined : preludeVariantAnswer(preview, row);
}
/**
 * ARMED IN THE PRESS, before the submit (the start's `armStartHero` shape): the prelude lifts out of ITS SLOT and
 * lands on the deck object's «РАЗЫГРАНО» seat — the hero scene the transport plays on the answer, paying from the
 * landed card's printed icons. A burning prelude arms nothing: it never reaches the table.
 */
function armPreludePlay(chosen: CardName | undefined): void {
  if (chosen === undefined) {
    return;
  }
  heldDiscardCount.value = props.playerView.game.preludeDiscardSize ?? 0;
  const price = verdictPrice.value;
  if (burns(chosen)) {
    // PL-1469: the 15 M€ are this card's — the answer that pays them is held on the rail for a token off its face.
    // A verdict's burn (P45) is charged its price in the same answer: a known move of the burn's check.
    armPreludeBurn(chosen, price === undefined ? 0 : (paidWith.value?.megacredits ?? price.megacredits));
    return;
  }
  // PL-1467: what the prelude asks next is a step of THIS hand's flow — a board step included (the hand yields
  // to the board and comes back if the flow still owes it).
  // …in the workspace this pick stands in: the hand (P91) or «ДЕЙСТВИЯ КАРТ» (P45's verdict — the action's claim).
  beginPreludePlayChain(chosen, props.embedded && workspaceOutcomeState.host === 'card-actions' ? 'card-actions' : 'hand');
  const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(chosen) : chosen.replace(/"/g, '\\"');
  armPlayedHero(chosen, false, {
    manualTableOpen: false,
    host: 'workspace',
    sourceSelector: `.con-deckpick [data-deckpick-slot="${esc}"] :is(.card-container, .pcard)`,
    targetSelector: PRELUDE_SEAT_SELECTOR,
    rewards: candidateRewards.value[chosen],
    // THE VERDICT'S PRICE LEAVES FIRST (P45 · PL-099 / PL-104): off the M€ row into the source's printed «12 M€».
    ...(price !== undefined ? {bill: preludePriceBill(price, candidateRewards.value[chosen], paidWith.value)} : {}),
    sourceFace: {lightweight: true},
    landingFace: {lightweight: true, model: 'none'},
  });
}
/**
 * THE PRELUDE EXIT, in the order the eye reads it: the two not played go to the deck object's discard (the count
 * ticking on each touchdown), the played one lifts out of its slot onto the seat (the transport's hero scene), or —
 * a burn — stays in its slot under its burn mark and goes to the discard last. The surface stands until the hero
 * scene has finished paying from the seat.
 */
async function runPreludeExit(chosen: CardName | undefined): Promise<void> {
  beginDeckPickClearing();
  const burnt = chosen !== undefined && burns(chosen);
  const rest = entries.value.map((e) => e.name).filter((name) => name !== chosen);
  await Promise.all(rest.map((name, i) => discardPrelude(name, i * 90)));
  if (burnt && chosen !== undefined) {
    // PL-1469 — THE BURN PAYS FROM THE CARD: the answer's 15 M€ wait on the rail (seeded in the apply block); one
    // token is born on the burnt card's face where it stands, the row ticks on the touchdown; only then does the
    // card follow the others to the discard.
    await until(() => preludeBurnOwed() || model.value === undefined || promptKey.value !== frozenKey.value, 4000, {id: 'deck-pick:prompt-left', what: 'the server moving off the pick'});
    if (preludeBurnOwed()) {
      const face = slotEl(chosen)?.querySelector<HTMLElement>(':is(.pcard, .card-container)') ?? slotEl(chosen) ?? undefined;
      await flyPreludeBurn(face !== undefined ? {el: face, fx: 0.5, fy: 0.5} : undefined);
    }
    await discardPrelude(chosen, 0);
    return;
  }
  if (chosen !== undefined) {
    // The hero hands the card over to the seat at its commit — the seat paints it from then on.
    await until(() => playedHeroState.card !== chosen || playedHeroState.revealed || !isPlayedHeroActive(), 6000, {id: 'deck-pick:hero-revealed', what: 'the chosen card revealed by the play scene'});
    seatedPrelude.value = chosen;
    held.value.add(chosen);
    await until(() => !isPlayedHeroActive() || playedHeroState.card !== chosen, 12000, {id: 'deck-pick:hero-done', what: 'the play scene of the chosen card done'});
  }
}
/** One prelude to the deck object's discard — from its slot, face up (the pile is public), the count on contact. */
async function discardPrelude(name: CardName, delayMs: number): Promise<void> {
  const from = slotEl(name);
  if (from === null) {
    heldDiscardCount.value = Math.min(props.playerView.game.preludeDiscardSize ?? 0, (heldDiscardCount.value ?? 0) + 1);
    return;
  }
  if (delayMs > 0) {
    await span(motionMs(delayMs));
  }
  await runCardTransfer({
    name,
    from,
    resolveTo: () => root.value?.querySelector<HTMLElement>('[data-prelude-discard]') ?? null,
    holdFrom: true,
    onLift: () => held.value.add(name),
    onTouchdown: () => {
      const live = props.playerView.game.preludeDiscardSize;
      const next = (heldDiscardCount.value ?? 0) + 1;
      heldDiscardCount.value = live !== undefined ? Math.min(Math.max(live, next), next) : next;
    },
  });
}
/** Bounded wait for a condition (the hero's own state) — never a fixed sleep standing in for it. */
function until(cond: () => boolean, maxMs: number, wait: {id: string, what: string}): Promise<void> {
  if (cond() || typeof window === 'undefined') {
    return Promise.resolve();
  }
  // A wait that has to wait is a node of the wait graph; its ceiling ending it is said (`ceilingWait.ts`).
  const node = beginCeilingWait({id: wait.id, owner: 'deckPick', what: wait.what, maxMs});
  return new Promise<void>((resolve) => {
    const deadline = Date.now() + maxMs;
    const tick = () => {
      if (cond()) {
        node.met();
        resolve();
        return;
      }
      if (Date.now() > deadline) {
        node.ceiling();
        resolve();
        return;
      }
      probeTick(tick);
    };
    probeTick(tick);
  });
}
/** Wait (bounded) for the server to move off `key`. Resolves at once when
 *  it already has — the common case, since the answer normally lands long
 *  before the cards reach the dock. */
function awaitPromptMoved(key: string): Promise<void> {
  if (model.value === undefined || promptKey.value !== key || typeof window === 'undefined') {
    return Promise.resolve();
  }
  // The wait has to wait: a node of the wait graph, its grace ending it said (`ceilingWait.ts`).
  const wait = beginCeilingWait({
    id: 'deck-pick:prompt-moved', owner: 'ConsoleDeckPick', what: 'the server moving off the answered prompt', maxMs: motionMs(REFUSAL_GRACE_MS), target: 'server',
  });
  return new Promise<void>((resolve) => {
    let done = false;
    let cancelGrace: () => void = () => {};
    let forgetGone: () => void = () => {};
    const finish = () => {
      if (!done) {
        done = true;
        stop();
        cancelGrace();
        forgetGone();
        resolve();
      }
    };
    const stop = watch(
      () => model.value === undefined || promptKey.value !== key,
      (moved: boolean) => {
        if (moved) {
          wait.met();
          finish();
        }
      });
    // PACING, not a guarantee: the grace's end is SAID (the ceiling line), so it must not come due when the surface
    // leaves — there the wait is abandoned silently and whoever awaits it goes on (the scope's own cleanup).
    cancelGrace = flowScope.after(motionMs(REFUSAL_GRACE_MS), 'the server moving off the answered prompt', () => {
      wait.ceiling();
      finish();
    });
    forgetGone = flowScope.defer(() => {
      wait.end();
      finish();
    });
  });
}
/**
 * The picks physically become the player's hand. `runHandIntake` owns the
 * whole ownership handoff — it holds each name in the dock's own held
 * multiset from the moment it leaves, so the card is never in two places,
 * and it takes a dock-accent lease that brings the dock out of its compact
 * pose to receive them.
 */
async function sendToHand(kept: ReadonlyArray<CardName>, onLifted?: () => void): Promise<void> {
  if (!handDockReachable()) {
    return; // no dock on screen (a cinematic covers it) — never a ghost flight
  }
  const entries = kept
    .map((name) => {
      const el = slotEl(name);
      return el === null ? undefined : {name, el};
    })
    .filter((e): e is {name: CardName, el: HTMLElement} => e !== undefined);
  if (entries.length === 0) {
    return;
  }
  // `onStaged` — every proxy stands over its slot, the originals hidden: the pick has LEFT the row (PL-207).
  await runHandIntake(entries, {mode: entries.length > 1 ? 'stack' : 'cascade', onStaged: onLifted});
}
/**
 * The CLEAN-UP beat: the cards nobody took drift away and fade — the
 * project's own «rejected cards» motion, on the REAL slots (a proxy for a
 * card that is simply being thrown away would be ceremony).
 *
 * AWAITED TO ITS REAL END: `applyDiscardExit` resolves when the LAST
 * rejected card's animation has actually finished — this beat is a term
 * of the commit hold (`deckPickHolding`), which is a term of the scene
 * lease, so releasing it on a fixed budget while the dissolve still
 * played is exactly how the NEXT batch got the scene over cards that
 * were still saying goodbye (the 20260830201630 frame).
 */
async function clearRest(kept: ReadonlyArray<CardName>, delayMs = 0): Promise<void> {
  const rest = entries.value
    .filter((e) => !kept.includes(e.name))
    .map((e) => slotEl(e.name))
    .filter((el): el is HTMLElement => el !== null);
  if (rest.length === 0) {
    return;
  }
  await applyDiscardExit(rest, {stepMs: 28, delayMs});
}
function slotEl(name: CardName): HTMLElement | null {
  // `?? undefined`: the ref is `null` before the mount and once the surface has left — the commit's own beats run on
  // past either, and a slot that is not there is this function's `null`.
  const rootNow = root.value ?? undefined;
  if (rootNow === undefined || typeof rootNow.querySelector !== 'function') {
    return null;
  }
  const key = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ?
    CSS.escape(name) : name.replace(/"/g, '\\"');
  return rootNow.querySelector<HTMLElement>(`[data-deckpick-slot="${key}"]`);
}

watch(() => promptKey.value, (): void => {
  if (frozen.value !== undefined) {
    // The server moved on WHILE our own outgoing beats are still playing
    // (the normal case). The snapshot owns the screen until they finish;
    // re-dealing here would yank the cards out mid-flight.
    return;
  }
  picks.value = [];
  focusIdx.value = 0;
  submitting.value = false;
  verdictFocus.value = initialVerdictFocus(verdictRows.value);
  payStage.value = false;
  payCounts.value = {};
  paidWith.value = undefined;
  if (entries.value.length > 0) {
    startDeal();
  }
}, {immediate: true});
watch(() => footCommands.value, (cmds: Array<ConsoleCommand>): void => {
  setPanelCommands('deckPick', cmds);
}, {immediate: true, deep: true});
/** The stage name goes UP to the host's breadcrumb, never onto a kicker
 *  of our own. Retracted the moment we stop being embedded. */
watch(() => stageKey.value, (key: string): void => {
  if (props.embedded) {
    setWorkspaceOutcomePhase(key);
  }
}, {immediate: true});
watch(() => props.embedded, (on: boolean): void => {
  setWorkspaceOutcomePhase(on ? stageKey.value : '');
});
watch(() => entries.value.length, (): void => {
  scheduleFit();
});

onMounted((): void => {
  scheduleFit();
  // The HOST'S ZONE, never anything this surface can grow — observing our own
  // box would re-arm the fit from its own result.
  const box = root.value?.parentElement ??
    (frameEl.value ?? undefined);
  if (box !== null && box !== undefined && typeof ResizeObserver === 'function') {
    const roNow = markRaw(new ResizeObserver(() => scheduleFit()));
    roNow.observe(box);
    ro = roNow;
  }
});
onBeforeUnmount((): void => {
  // PARK THE TABLE, not the answer: an unanswered batch keeps its draft
  // picks and cursor in module state, so the collapse → reopen round trip
  // restores the same selection instead of a cleared one.
  if (phase.value === 'choosing' && !submitting.value && model.value !== undefined) {
    saveDeckPickDraft(promptKey.value, picks.value, focusIdx.value);
  }
  clearPanelCommands('deckPick');
  releasePreludeBurn('deck-pick-unmounted');
  if (props.embedded) {
    setWorkspaceOutcomePhase('');
  }
  handle?.kill();
  handle = undefined;
  // The deal's ceiling may not hand over into a torn-down tree — it only lets the flow go (R13).
  disownDeckPickDeal(dealSeq.value);
  clearDeckPickFlight();
  releaseDeckDisplay();
  ro?.disconnect();
  ro = undefined;
});
// The shell's pad router hands the pad to this surface through the registry (`surfaces.at('deckPick')`) — its one reach.
defineExpose({handleIntent});
</script>
