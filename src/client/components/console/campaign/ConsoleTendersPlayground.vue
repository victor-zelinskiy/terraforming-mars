<template>
  <div ref="root" class="con-tdpg" :class="{'con-tdpg--embedded': embedded}" data-tenders-playground>
    <header class="con-tdpg__head">
      <div class="con-tdpg__hints">
        <span class="con-tdpg__hint"><GamepadGlyph control="dpad" />{{ $t('Tender') }}</span>
        <span class="con-tdpg__hint"><GamepadGlyph control="secondary" />{{ $t('Inspect') }}</span>
        <span class="con-tdpg__hint"><GamepadGlyph control="triggerR" />{{ $t('Redeal') }}</span>
        <span class="con-tdpg__hint"><GamepadGlyph control="triggerL" />{{ $t(tableFocus ? 'Back to the catalog' : 'Play the table') }}</span>
        <span class="con-tdpg__hint"><GamepadGlyph control="inspect" />{{ $t('Seats') }}</span>
        <span class="con-tdpg__hint"><GamepadGlyph control="view" />{{ $t('Tenders per bidding') }}</span>
        <span class="con-tdpg__hint"><GamepadGlyph control="stickL" />{{ $t('Prelude expansion') }}</span>
      </div>
    </header>

    <!-- ── 1. THE CATALOG ── -->
    <section class="con-tdpg__section">
      <h2>{{ $t('Tender catalog') }} · {{ catalog.length }} <span class="con-tdpg__dim">{{ $t('Mission deck') }} · {{ deckSize }}</span></h2>
      <div class="con-tdpg__catalog" data-tdpg-catalog>
        <div v-for="(entry, i) in catalog" :key="entry.id"
             class="con-tdpg__slot"
             :class="{'con-tdpg__slot--cursor': i === cursor && !tableFocus, 'con-tdpg__slot--off': !applicable(entry.id)}"
             :data-tdpg-id="entry.id"
             @click="cursor = i">
          <div class="con-tdpg__slot-face" :data-zoom-slot="'tender:' + entry.id">
            <ConsoleTenderCard :id="entry.id" size="table" :focused="i === cursor && !tableFocus" />
          </div>
          <span class="con-tdpg__slot-meta">
            <b class="con-tdpg__code">№ {{ String(entry.lot).padStart(2, '0') }}</b>
            <span>{{ $t(tierKey(entry.id)) }}</span>
            <span class="con-tdpg__dim">{{ $t(windowKey(entry.id)) }}</span>
          </span>
          <span class="con-tdpg__slot-meta">
            <span>{{ $t('Bot priority') }} {{ entry.botPriority }}</span>
            <span v-if="!applicable(entry.id)" class="con-tdpg__off">{{ $t('Needs the Prelude expansion') }}</span>
          </span>
        </div>
      </div>
    </section>

    <!-- ── 2. THE DOCUMENT — sizes and states ── -->
    <section class="con-tdpg__section" v-if="selected !== undefined">
      <h2>{{ $t('Card sizes') }} · {{ $t(selected.nameKey) }}</h2>
      <div class="con-tdpg__row" data-tdpg-sizes>
        <div class="con-tdpg__cell" data-tdpg-size="table">
          <ConsoleTenderCard :id="selected.id" size="table" />
          <span class="con-tdpg__label">{{ $t('Table size') }}</span>
        </div>
        <div class="con-tdpg__cell" data-tdpg-size="reader">
          <ConsoleTenderCard :id="selected.id" size="reader" />
          <span class="con-tdpg__label">{{ $t('Reader') }}</span>
        </div>
        <div class="con-tdpg__cell con-tdpg__cell--plaque" data-tdpg-size="plaque">
          <ConsoleTenderCard :id="selected.id" size="plaque" />
          <span class="con-tdpg__label">{{ $t('Plaque') }}</span>
        </div>
      </div>
      <h3>{{ $t('States') }}</h3>
      <div class="con-tdpg__row" data-tdpg-states>
        <div v-for="st in STATES" :key="st.key" class="con-tdpg__cell" :data-tdpg-state="st.key">
          <ConsoleTenderCard :id="selected.id" size="table" :state="st.state" :owner="st.owner" :focused="st.focused" />
          <span class="con-tdpg__label">{{ $t(st.label) }}</span>
        </div>
      </div>
    </section>

    <!-- ── 3. THE DEAL — the simulated mission deck and the real bidding scene ── -->
    <section class="con-tdpg__section">
      <h2>{{ $t('The deal') }}</h2>
      <div class="con-tdpg__controls" data-tdpg-controls>
        <span class="con-tdpg__control"><span class="con-tdpg__ckey">{{ $t('Seats') }}</span><b data-tdpg-seats>{{ seatCount }}</b></span>
        <span class="con-tdpg__control"><span class="con-tdpg__ckey">{{ $t('Tenders per bidding') }}</span><b :data-tdpg-offer="offerRule">{{ $t(offerLabel) }}</b><span class="con-tdpg__dim">{{ offerNumbers }}</span></span>
        <span class="con-tdpg__control"><span class="con-tdpg__ckey">{{ $t('Prelude expansion') }}</span><b data-tdpg-preludes>{{ preludes ? '✓' : '—' }}</b></span>
        <span class="con-tdpg__control"><span class="con-tdpg__ckey">{{ $t('Deal seed') }}</span><b data-tdpg-seed>{{ seed }}</b></span>
        <span class="con-tdpg__control"><span class="con-tdpg__ckey">{{ $t('Decisive on the table') }}</span><b data-tdpg-decisive>{{ decisiveCount }}</b></span>
      </div>
      <div class="con-tdpg__table" :class="{'con-tdpg__table--focus': tableFocus}" data-tdpg-table :data-tdpg-table-focus="tableFocus ? 'yes' : undefined">
        <ConsoleTenderBidding v-if="bidding !== undefined"
                              ref="scene"
                              :key="dealSeq"
                              :bidding="{...bidding, yourTurn: yourTurn}"
                              :seats="seats"
                              :you-seat="0"
                              :mission-label="missionLabel"
                              :reveal-key="'playground:' + dealSeq"
                              root="Playground"
                              embedded
                              @bid="onBid" />
      </div>
    </section>
  </div>
</template>

<script setup vapor lang="ts">
/*
 * TENDERS — the playground stand («Полигон» → «Витрина тендеров», the owner 2026-11-08: «полигон тендеров для осмотра
 * в дев режиме»). One instrument for every tender of the Committee and the ones after it:
 *   1. THE CATALOG as it ships (`TENDER_CATALOG` + `tenderMeta` — nothing hand-drawn): every certificate at the
 *      table size with its tier, window, lot and the bot's denial rank; X opens the SAME fullscreen viewer the game
 *      opens (`tenderZoomEntry`), LB/RB there browse the catalog.
 *   2. THE DOCUMENT of the selected tender at the three sizes the game paints (table · reader · plaque) and in EVERY
 *      STATE the game stamps it with (open · under the cursor · taken by a seat · withdrawn · executed · bought back).
 *   3. THE DEAL — a simulated MISSION DECK: seats 2…5, the campaign's OFFER RULE (all · all but the last · all but
 *      two), the Prelude expansion on or off (the applicability), a seed; the table is dealt by the SAME pure engine
 *      the server runs (`dealTenderOffer`: one card of every applicable kind shuffled afresh, random but for one
 *      decisive per table), and the REAL bidding scene (`ConsoleTenderBidding`) plays it: the deck deals and turns the lots, the
 *      places pick in turn (You are seat 0 — A takes on your turn; the other humans and the bot pick by the denial
 *      order, presented one by one), the last place is said «без тендера». RT redeals with the next seed.
 * Pad: ◀ ▶ the catalog cursor · X the viewer · RT redeal · LT the table takes the pad (◀ ▶ / A / X go to the scene;
 * LT again returns) · Y seats · View the offer rule · L3 the Prelude expansion · LB/RB the stand's sections · B back.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, ref, useTemplateRef} from 'vue';
import {useFlowScope} from '@/client/console/session/useFlowScope';
import {Color} from '@/common/Color';
import {CampaignSeat} from '@/common/campaign/CampaignTypes';
import {
  BiddingState, CAMPAIGN_TENDER_OFFERS, CampaignTenderOffer, TENDER_CATALOG, TENDER_IDS, TenderDef, TenderId,
  biddingOfferSize, biddingOpenCards, biddingPickers, biddingTurnSeat, botTenderPick, effectiveTenderOffer, tenderDef,
} from '@/common/campaign/tenders';
import {SeededRandom} from '@/common/utils/Random';
import {advanceBots, applyBid, biddingOrder, dealTenderOffer, openBidding} from '@/server/campaign/tenderBidding';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {stepIndex} from '@/client/console/consoleRouter';
import {openConsoleCardZoom} from '@/client/console/consoleCardZoom';
import {tenderZoomEntry} from '@/client/components/card/cardZoomTypes';
import {TenderCardState, TenderMeta, tenderMeta, tenderTierKey, tenderWindowKey} from '@/client/console/campaign/tenderMeta';
import {campaignTenderOfferLabel} from '@/client/console/menu/consoleCreateModel';
import {$t, translateTextWithParams} from '@/client/directives/i18n';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleTenderCard from './ConsoleTenderCard.vue';
import ConsoleTenderBidding from './ConsoleTenderBidding.vue';

type CatalogEntry = TenderMeta & Pick<TenderDef, 'tier' | 'botPriority' | 'needsPreludes'>;

type StateRow = {key: string, label: string, state: TenderCardState, owner?: {name: string, color: Color}, focused?: boolean};

/** The synthetic table — You first (the viewer), two more humans and the bot; a table of N takes the first N. */
const SEAT_POOL: ReadonlyArray<CampaignSeat> = [
  {seat: 0, kind: 'human', name: 'You', color: 'blue', trBoost: 0},
  {seat: 1, kind: 'human', name: 'Bruno', color: 'red', trBoost: 0},
  {seat: 2, kind: 'bot', name: 'MarsBot', color: 'green', trBoost: 0},
  {seat: 3, kind: 'human', name: 'Dana', color: 'yellow', trBoost: 0},
  {seat: 4, kind: 'human', name: 'Eiko', color: 'purple', trBoost: 0},
];

/** A rival's pick lands a beat after the turn reaches them — the push's arrival, staged. */
const RIVAL_PICK_MS = 1100;

defineOptions({name: 'ConsoleTendersPlayground'});
defineProps({
  embedded: {type: Boolean, default: false},
});

const flow = useFlowScope('console-tenders-playground');
// The stand's root element — the catalog's slots the fullscreen viewer lifts its cards out of are looked up inside it.
const root = useTemplateRef<HTMLElement>('root');
// The template's `ref="scene"` — the real bidding scene, read for the one member the stand forwards the pad to. The
// stand had a METHOD of the same name beside it; one scope here, so the template ref keeps the key's name and the
// method stands under a name of its own (`hostedScene`).
const scene = useTemplateRef<{handleIntent?: (intent: GamepadIntent) => boolean}>('scene');
const cursor = ref(0);
const seatCount = ref(3);
const offerRule = ref<CampaignTenderOffer>('minusOne');
const preludes = ref(true);
const seed = ref(1);
const dealSeq = ref(0);
const bidding = ref<BiddingState | undefined>(undefined);
/** The table owns the pad (◀ ▶ / A / X go to the scene). */
const tableFocus = ref(false);
let cancelRival = (() => {}) as () => void;
const STATES = [
  {key: 'open', label: 'Open lot', state: 'open'},
  {key: 'focused', label: 'Under the cursor', state: 'open', focused: true},
  {key: 'taken', label: 'Taken', state: 'taken', owner: {name: 'Bruno', color: 'red'}},
  {key: 'withdrawn', label: 'Withdrawn', state: 'withdrawn'},
  {key: 'executed', label: 'Executed', state: 'executed'},
  {key: 'cashed', label: 'Bought back', state: 'cashed'},
] as ReadonlyArray<StateRow>;
const catalog = computed((): ReadonlyArray<CatalogEntry> => {
  // The kinds a mission deck holds — one card of each.
  return TENDER_IDS.map((id) => {
    const def = TENDER_CATALOG[id];
    return {...tenderMeta(id), tier: def.tier, botPriority: def.botPriority, needsPreludes: def.needsPreludes};
  });
});
const selected = computed((): CatalogEntry | undefined => {
  return catalog.value[cursor.value];
});
const seats = computed((): ReadonlyArray<CampaignSeat> => {
  return SEAT_POOL.slice(0, seatCount.value);
});
/** The mission deck under the current applicability — one card of every applicable kind. */
const deckSize = computed((): number => {
  return TENDER_IDS.filter((id) => applicable(id)).length;
});
const offerLabel = computed((): string => {
  return campaignTenderOfferLabel(effectiveTenderOffer(offerRule.value, seatCount.value));
});
const offerNumbers = computed((): string => {
  const rule = effectiveTenderOffer(offerRule.value, seatCount.value);
  return `${biddingOfferSize(seatCount.value, rule)} · ${biddingPickers(seatCount.value, rule)} / ${seatCount.value}`;
});
const missionLabel = computed((): string => {
  return translateTextWithParams('Mission ${0}', ['1']);
});
const yourTurn = computed((): boolean => {
  return bidding.value !== undefined && !bidding.value.done && biddingTurnSeat(bidding.value) === 0;
});
const decisiveCount = computed((): number => {
  return (bidding.value?.offer ?? []).filter((c) => tenderDef(c.id).tier === 'decisive').length;
});
function tierKey(id: TenderId): string {
  return tenderTierKey(id);
}
function windowKey(id: TenderId): string {
  return tenderWindowKey(id);
}
/** The applicability as the server reads it for a campaign with / without the Prelude expansion. */
function applicable(id: TenderId): boolean {
  return preludes.value || !TENDER_CATALOG[id].needsPreludes;
}
function clearRival(): void {
  cancelRival();
}
/** A fresh table: the mission deck shuffled by the seed, dealt by the server's own engine, the order a lot of the seed. */
function deal(): void {
  clearRival();
  const rng = new SeededRandom((seed.value * 0.6180339887) % 1);
  const applicableNow = (id: TenderId) => applicable(id);
  const rule = effectiveTenderOffer(offerRule.value, seatCount.value);
  const offer = dealTenderOffer(biddingOfferSize(seatCount.value, rule), 0, applicableNow, rng);
  // The standings: a seeded shuffle of the seats — You land anywhere in the order.
  const standings = seats.value.map((s, i) => ({seat: s.seat, place: i + 1, score: 0, megaCredits: 0, corporations: [], tiedWith: []}));
  for (let i = standings.length - 1; i > 0; i--) {
    const j = rng.nextInt(i + 1);
    [standings[i], standings[j]] = [standings[j], standings[i]];
  }
  standings.forEach((s, i) => {
    s.place = i + 1;
  });
  const {order, lots} = biddingOrder(standings, rng);
  dealSeq.value++;
  bidding.value = advanceBots(openBidding(0, offer, order, lots, biddingPickers(seatCount.value, rule)), (seat) => seats.value[seat]?.kind === 'bot');
  armRival();
}
/** A rival human's pick arrives a beat after their turn — the catalog's denial order, like the bot's. */
function armRival(): void {
  clearRival();
  const b = bidding.value;
  if (b === undefined || b.done) {
    return;
  }
  const turn = biddingTurnSeat(b);
  if (turn === undefined || turn === 0 || seats.value[turn]?.kind !== 'human') {
    return;
  }
  cancelRival = flow.after(RIVAL_PICK_MS, 'the rival\'s pick arrives', () => {
    const live = bidding.value;
    if (live === undefined || live.done || biddingTurnSeat(live) !== turn) {
      return;
    }
    const pick = botTenderPick(biddingOpenCards(live));
    if (pick !== undefined) {
      apply(applyBid(live, turn, pick.instance));
    }
  });
}
function apply(next: BiddingState): void {
  bidding.value = advanceBots(next, (seat) => seats.value[seat]?.kind === 'bot');
  armRival();
}
/** The scene's A on your turn. */
function onBid(instance: string): void {
  const b = bidding.value;
  if (b === undefined || b.done || biddingTurnSeat(b) !== 0) {
    return;
  }
  try {
    apply(applyBid(b, 0, instance));
  } catch (e) {
    // The engine's own refusal (out of turn / not on the table) — the stand shows nothing more.
  }
}
/** X on the catalog: the viewer over the whole catalog, the selected first. */
function openFullscreen(): void {
  const list = catalog.value.map((e) => tenderZoomEntry(e.id));
  const rootNow = root.value;
  openConsoleCardZoom(list, cursor.value, undefined, undefined, {
    contextLabel: 'Tender catalog',
    origin: {
      kind: 'physical',
      resolve: (i) => {
        const e = catalog.value[i];
        return e !== undefined ? rootNow?.querySelector<HTMLElement>(`[data-tdpg-id="${e.id}"] [data-zoom-slot]`) ?? null : null;
      },
      onBrowse: (i) => {
        cursor.value = i;
      },
    },
  });
}
function hostedScene(): {handleIntent?: (intent: GamepadIntent) => boolean} | undefined {
  return scene.value ?? undefined;
}
function handleIntent(intent: GamepadIntent): boolean {
  // The table owns ◀ ▶ / A / X while it has the pad; LT hands it back; everything else stays the stand's.
  if (intent.kind === 'press' && intent.button === 'triggerL') {
    tableFocus.value = !tableFocus.value;
    return true;
  }
  if (tableFocus.value && (intent.kind === 'nav' || (intent.kind === 'press' && (intent.button === 'confirm' || intent.button === 'secondary')))) {
    if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
      return false; // the stand scrolls
    }
    return hostedScene()?.handleIntent?.(intent) ?? true;
  }
  if (intent.kind === 'nav' && (intent.dir === 'left' || intent.dir === 'right')) {
    cursor.value = stepIndex(cursor.value, intent.dir === 'right' ? 1 : -1, catalog.value.length);
    return true;
  }
  if (intent.kind !== 'press') {
    return false;
  }
  if (intent.button === 'stickL') {
    preludes.value = !preludes.value;
    deal();
    return true;
  }
  switch (consoleActionOf(intent)) {
  case 'inspect':
    openFullscreen();
    return true;
  case 'nextTab':
    seed.value++;
    deal();
    return true;
  case 'fullscreen':
    seatCount.value = seatCount.value >= SEAT_POOL.length ? 2 : seatCount.value + 1;
    deal();
    return true;
  case 'reset': {
    const at = CAMPAIGN_TENDER_OFFERS.indexOf(offerRule.value);
    offerRule.value = CAMPAIGN_TENDER_OFFERS[(at + 1) % CAMPAIGN_TENDER_OFFERS.length];
    deal();
    return true;
  }
  default:
    return false;
  }
}

deal();

defineExpose({handleIntent});
</script>
