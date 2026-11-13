<template>
  <div ref="rootEl" class="con-bidding"
       :class="{'con-bidding--embedded': embedded, 'con-bidding--revealing': revealing, 'con-bidding--done': bidding.done}"
       role="dialog" :aria-label="$t('Bidding')" data-bidding-stage :data-bidding-turn="turnSeat" :data-bidding-done="bidding.done ? 'yes' : undefined">
    <!--
      «ТОРГИ» — the BIDDING of the «Тендеры» reward mode (docs/CAMPAIGN_CONCESSIONS_DESIGN.md §6), hosted by the endgame
      workspace (its own scene after the ceremony) and by the campaign map (the same instance for a player who comes
      back later). ONE phrase on one stage:
        · the REGISTER stands at the left; the dealt lots arrive from it face-down, one after another, then TURN in
          place left to right — the first time anybody sees what is at stake (a one-shot cinematic, played ONCE per
          bidding on this client, never on a reload);
        · the PICK ORDER strip above the table: seat cubes in standings order with their place, a «жребий» tag inside
          every tie, the last place «без тендера» (nothing disappears — the one who gets nothing is said);
        · the picks go IN TURN: the turn seat wears a kant; the viewer's own pick is A on an open lot (X opens the lot
          in the ONE fullscreen viewer, its stamps as they stand — §16.6); a rival's and the bot's picks arrive by the
          campaign's push and are PRESENTED one by one — the lot receives the taker's stamp; the viewer never sees two
          things settle at once;
        · every state is MATERIAL: a kant, a stamp, a word — never a glow.
      The host owns the ONE command bar (the scene publishes its verbs through `tenderBiddingUi`) and routes the pad in
      through `handleIntent`. The server is the truth: `bidding` is the model's, the scene decides nothing.
    -->
    <div class="con-bidding__shade" aria-hidden="true"></div>
    <div class="con-bidding__stage">
      <ConsoleWsHead class="con-bidding__head" :root="root" :subject="missionLabel" subject-raw stage="Bidding" :committed="bidding.done" />

      <div class="con-bidding__order" data-bidding-order>
        <span class="con-bidding__order-cap">{{ $t('Pick order') }}</span>
        <span v-for="(entry, i) in orderRows" :key="entry.seat"
              class="con-bidding__seat"
              :class="{'con-bidding__seat--turn': entry.turn, 'con-bidding__seat--done': entry.done, 'con-bidding__seat--none': entry.none, 'con-bidding__seat--you': entry.you}"
              :data-bidding-seat="entry.seat" :data-bidding-lot="entry.lot ? 'yes' : undefined">
          <b class="con-bidding__seat-place">{{ i + 1 }}</b>
          <i class="con-bidding__seat-cube" :class="`player_bg_color_${entry.color}`" aria-hidden="true"></i>
          <span class="con-bidding__seat-name">{{ entry.name }}</span>
          <span v-if="entry.lot" class="con-bidding__seat-tag con-bidding__seat-tag--lot">{{ $t('Lot drawn') }}</span>
          <span v-else-if="entry.none" class="con-bidding__seat-tag">{{ $t('without a tender') }}</span>
        </span>
      </div>

      <div class="con-bidding__table">
        <div class="con-bidding__register" data-bidding-register>
          <div class="con-bidding__register-stack" aria-hidden="true">
            <i class="con-bidding__register-edge"></i><i class="con-bidding__register-edge"></i>
            <ConsoleTenderBack class="con-bidding__register-top" />
          </div>
          <span class="con-bidding__register-cap">{{ $t('Tender register') }}</span>
        </div>
        <div class="con-bidding__row" data-bidding-row>
          <div v-for="(card, i) in bidding.offer" :key="card.instance"
               class="con-bidding__slot" :class="slotClass(card, i)" :style="{'--i': i}"
               :data-bidding-card="card.instance" :data-bidding-kind="card.id"
               :data-bidding-taken="card.takenBy" :data-bidding-withdrawn="card.withdrawn ? 'yes' : undefined"
               @animationend="onSlotAnimationEnd($event, card, i)">
            <div class="con-bidding__flip">
              <ConsoleTenderBack class="con-bidding__back" />
              <ConsoleTenderCard class="con-bidding__face" :id="card.id" :state="cardState(card)" :owner="ownerOf(card)" :focused="cursor === i && !revealing" />
            </div>
          </div>
        </div>
      </div>

      <div class="con-bidding__foot">
        <span class="con-bidding__status" :class="{'con-bidding__status--yours': yourTurn && !revealing}" role="status" data-bidding-status>{{ statusText }}</span>
        <span v-if="error !== ''" class="con-bidding__error" data-bidding-error>{{ $t(error) }}</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef, watch} from 'vue';
import {CampaignSeat} from '@/common/campaign/CampaignTypes';
import {BiddingModel} from '@/common/campaign/CampaignModel';
import {BiddingOfferCard, biddingPickerCount, biddingTurnSeat} from '@/common/campaign/tenders';
import {Color} from '@/common/Color';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import {ConsoleCommand} from '@/client/console/consoleCommandModel';
import {AnimationHold, beginAnimationHold} from '@/client/components/presentation/animationHold';
import {noteInputAbsorbed, registerInputAbsorber} from '@/client/console/inputAbsorb';
import {participantDisplayName} from '@/client/components/marsbot/marsBotDisplay';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import ConsoleWsHead from '@/client/components/console/foundation/ConsoleWsHead.vue';
import ConsoleTenderCard, {TenderCardState} from './ConsoleTenderCard.vue';
import ConsoleTenderBack from './ConsoleTenderBack.vue';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {tenderZoomEntry} from '@/client/components/card/cardZoomTypes';
import {
  biddingRevealPlayed, markBiddingRevealPlayed, tenderBiddingUi,
} from '@/client/console/campaign/tenderBiddingUi';

const REVEAL_ABSORBER = 'tender-bidding-reveal';

type OrderRow = {seat: number, name: string, color: Color, you: boolean, turn: boolean, done: boolean, none: boolean, lot: boolean};

defineOptions({name: 'ConsoleTenderBidding'});
const props = defineProps({
  bidding: {type: Object as PropType<BiddingModel>, required: true},
  seats: {type: Array as PropType<ReadonlyArray<CampaignSeat>>, required: true},
  youSeat: {type: Number as PropType<number | undefined>, default: undefined},
  /** «Миссия N» — the mission whose end this bidding closes (already in the player's language). */
  missionLabel: {type: String, required: true},
  /** The host's workspace root (i18n key). */
  root: {type: String, default: 'Campaign'},
  /** `campaignId:slot` — the reveal plays once per bidding on this client. */
  revealKey: {type: String, required: true},
  submitting: {type: Boolean, default: false},
  error: {type: String, default: ''},
  embedded: {type: Boolean, default: false},
});
const emit = defineEmits(['bid', 'back']);

// The scene's root element — the lots the fullscreen viewer lifts out of their slots are looked up inside it. The key
// and the const are `rootEl`: `root` is taken here, by the PROP that names the host's workspace root.
const rootEl = useTemplateRef<HTMLElement>('rootEl');
const cursor = ref(0);
const revealing = ref(false);
/** Picks already PRESENTED here (instances) — a taken lot not in it is a pick still to be shown. */
const shown = ref(new Set<string>());
/** The lot whose taking plays right now. */
const presenting = ref<string | undefined>(undefined);
const queue = ref<Array<string>>([]);
let hold: AnimationHold | undefined;
let absorbOff: (() => void) | undefined;
const turnSeat = computed((): number | undefined => {
  return biddingTurnSeat(props.bidding);
});
const yourTurn = computed((): boolean => {
  return !props.bidding.done && turnSeat.value !== undefined && turnSeat.value === props.youSeat;
});
const orderRows = computed((): Array<OrderRow> => {
  const pickers = biddingPickerCount(props.bidding);
  return props.bidding.order.map((seat, i) => {
    const s = props.seats.find((x) => x.seat === seat);
    return {
      seat,
      name: s === undefined ? '' : participantDisplayName({name: s.name, isMarsBot: s.kind === 'bot'}),
      color: s?.color ?? ('neutral' as Color),
      you: seat === props.youSeat,
      turn: !props.bidding.done && i === props.bidding.pointer,
      done: i < props.bidding.pointer,
      none: i >= pickers,
      lot: props.bidding.lots.some((l) => l.seats.includes(seat)),
    };
  });
});
const focusedCard = computed((): BiddingOfferCard | undefined => {
  return props.bidding.offer[cursor.value];
});
const focusedOpen = computed((): boolean => {
  const card = focusedCard.value;
  return card !== undefined && card.takenBy === undefined && card.withdrawn !== true;
});
const turnName = computed((): string => {
  const seat = turnSeat.value;
  const s = seat === undefined ? undefined : props.seats.find((x) => x.seat === seat);
  return s === undefined ? '' : participantDisplayName({name: s.name, isMarsBot: s.kind === 'bot'});
});
const statusText = computed((): string => {
  if (revealing.value) {
    return translateText('The Register deals the table…');
  }
  if (props.bidding.done) {
    return translateText('The bidding is over');
  }
  if (yourTurn.value) {
    return translateText('Your pick');
  }
  return translateTextWithParams('${0} is picking…', [turnName.value]);
});
/** The verbs the host's ONE bar renders. */
const commands = computed((): Array<ConsoleCommand> => {
  if (revealing.value) {
    // A swallowed window is DECLARED — a disabled status, never an empty list.
    return [{control: 'confirm', label: 'Take the tender', enabled: false}];
  }
  const cmds: Array<ConsoleCommand> = [];
  if (props.bidding.offer.length > 1) {
    cmds.push({control: 'dpadH', label: 'Choose'});
  }
  if (yourTurn.value) {
    cmds.push({control: 'confirm', label: 'Take the tender', enabled: focusedOpen.value && !props.submitting, highlight: true});
  }
  if (props.bidding.offer.length > 0) {
    cmds.push({control: 'secondary', label: 'Inspect the tender'});
  }
  cmds.push({control: 'back', label: 'Minimize', priority: 5});
  return cmds;
});
function cardState(card: BiddingOfferCard): TenderCardState {
  if (card.withdrawn === true) {
    return 'withdrawn';
  }
  // A lot being presented keeps its open look until its stamp lands.
  return card.takenBy !== undefined && shown.value.has(card.instance) ? 'taken' : 'open';
}
function ownerOf(card: BiddingOfferCard): {name: string, color: Color} | undefined {
  if (card.takenBy === undefined || !shown.value.has(card.instance)) {
    return undefined;
  }
  const s = props.seats.find((x) => x.seat === card.takenBy);
  return s === undefined ? undefined : {name: participantDisplayName({name: s.name, isMarsBot: s.kind === 'bot'}), color: s.color};
}
function slotClass(card: BiddingOfferCard, i: number): Record<string, boolean> {
  return {
    'con-bidding__slot--reveal': revealing.value,
    'con-bidding__slot--taking': presenting.value === card.instance,
    'con-bidding__slot--taken': card.takenBy !== undefined && shown.value.has(card.instance),
    'con-bidding__slot--withdrawn': card.withdrawn === true,
    'con-bidding__slot--focused': cursor.value === i && !revealing.value,
  };
}
function onSlotAnimationEnd(event: AnimationEvent, card: BiddingOfferCard, i: number): void {
  if (event.animationName === 'con-tender-flip' && i === props.bidding.offer.length - 1) {
    endReveal();
    return;
  }
  if (event.animationName === 'con-tender-taking' && presenting.value === card.instance) {
    shown.value.add(card.instance);
    presenting.value = undefined;
    pump();
  }
}
/** The reveal is over (its own last turn, the ceiling, the unmount) — idempotent. */
function endReveal(): void {
  if (!revealing.value) {
    return;
  }
  revealing.value = false;
  tenderBiddingUi.revealing = false;
  hold?.release();
  hold = undefined;
  enqueueNewPicks();
}
function enqueueNewPicks(): void {
  for (const card of props.bidding.offer) {
    if (card.takenBy !== undefined && !shown.value.has(card.instance) &&
        presenting.value !== card.instance && !queue.value.includes(card.instance)) {
      queue.value.push(card.instance);
    }
  }
  pump();
}
/** One presentation at a time — the next pick plays after the previous stamp landed; reduced motion lands at once. */
function pump(): void {
  if (revealing.value || presenting.value !== undefined) {
    return;
  }
  const next = queue.value.shift();
  if (next === undefined) {
    return;
  }
  if (consoleReducedMotionActive()) {
    shown.value.add(next);
    pump();
    return;
  }
  presenting.value = next;
}
/**
 * X — the table in the ONE fullscreen viewer (§16.6): every lot with its stamps as they stand (taken by a seat,
 * withdrawn), the focused one first, lifted out of its own slot; LB/RB keep the table's cursor in lockstep.
 */
function openTableZoom(): void {
  const offer = props.bidding.offer;
  if (offer.length === 0) {
    return;
  }
  const list = offer.map((c) => tenderZoomEntry(c.id, {instance: c.instance, state: cardState(c), owner: ownerOf(c)}));
  const root = rootEl.value;
  openConsoleCardZoom(list, Math.min(Math.max(cursor.value, 0), list.length - 1), undefined, undefined, {
    contextLabel: 'Bidding',
    origin: {
      kind: 'physical',
      resolve: (i) => {
        const c = offer[i];
        return c !== undefined ? root?.querySelector<HTMLElement>(`[data-bidding-card="${CSS.escape(c.instance)}"]`) ?? null : null;
      },
      onBrowse: (i) => {
        cursor.value = i;
      },
    },
  });
}
/** The host routes pad intents here. Returns true when consumed. */
function handleIntent(intent: GamepadIntent): boolean {
  if (revealing.value) {
    noteInputAbsorbed(REVEAL_ABSORBER);
    return true;
  }
  if (intent.kind === 'nav') {
    const n = props.bidding.offer.length;
    if (n > 0 && (intent.dir === 'left' || intent.dir === 'right')) {
      const step = intent.dir === 'left' ? -1 : 1;
      cursor.value = Math.max(0, Math.min(n - 1, cursor.value + step));
    }
    return true;
  }
  const action = consoleActionOf(intent, {});
  switch (action) {
  case 'primary':
    if (yourTurn.value && focusedOpen.value && !props.submitting && focusedCard.value !== undefined) {
      emit('bid', focusedCard.value.instance);
    }
    return true;
  case 'inspect':
    openTableZoom();
    return true;
  case 'back':
    emit('back');
    return true;
  default:
    return true;
  }
}

watch(() => commands.value, (cmds: ReadonlyArray<ConsoleCommand>): void => {
  tenderBiddingUi.commands = cmds;
}, {immediate: true, deep: true});
// A pick that arrived (the viewer's own answer, a rival's push, the bot's instant pick) is PRESENTED — in turn.
watch(() => props.bidding.offer, (): void => {
  enqueueNewPicks();
}, {deep: true});
// The cursor rests on an OPEN lot once the turn is the viewer's.
watch(() => yourTurn.value, (mine: boolean): void => {
  if (mine && !focusedOpen.value) {
    const open = props.bidding.offer.findIndex((c) => c.takenBy === undefined && c.withdrawn !== true);
    if (open >= 0) {
      cursor.value = open;
    }
  }
});

// The decision is taken BEFORE the first render: the first painted frame already wears the reveal (never a
// face-up frame before the deal), and a settled mount stands every past pick stamped from its first frame.
const playsReveal = !props.bidding.done && props.bidding.offer.length > 0 &&
  !biddingRevealPlayed(props.revealKey) && !consoleReducedMotionActive();
if (playsReveal) {
  markBiddingRevealPlayed(props.revealKey);
  revealing.value = true;
  tenderBiddingUi.revealing = true;
  // The owner's own end is the last lot's turn; the ceiling's expiry runs the same door.
  hold = beginAnimationHold('tender-bidding-reveal', {expire: () => endReveal()});
} else {
  // Settled: every pick already made stands presented.
  for (const card of props.bidding.offer) {
    if (card.takenBy !== undefined) {
      shown.value.add(card.instance);
    }
  }
  // A played reveal with no cinematic (reduced motion / a return) still counts as seen.
  if (!props.bidding.done && props.bidding.offer.length > 0) {
    markBiddingRevealPlayed(props.revealKey);
  }
}
if (yourTurn.value && !focusedOpen.value) {
  const open = props.bidding.offer.findIndex((c) => c.takenBy === undefined && c.withdrawn !== true);
  cursor.value = Math.max(0, open);
}

onMounted(() => {
  absorbOff = registerInputAbsorber(REVEAL_ABSORBER, () => revealing.value);
});
onBeforeUnmount(() => {
  absorbOff?.();
  absorbOff = undefined;
  endReveal();
  tenderBiddingUi.commands = [];
});

defineExpose({handleIntent});
</script>
