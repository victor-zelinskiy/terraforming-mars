<template>
  <div class="con-wildstep" :class="{'con-wildstep--exclusive': spec.exclusive}"
       data-wild-inner :data-wild-focus-zone="focus.zone" :data-wild-focus-index="focus.index"
       :data-wild-complete="complete ? '' : undefined" :data-wild-choice="wildChoice"
       v-bind="venusAttrs({'data-venus-inner': '', 'data-venus-focus-zone': focus.zone, 'data-venus-focus-index': String(focus.index), 'data-venus-complete': complete ? '' : undefined})">
    <div class="con-wildstep__head" data-unfold-item>
      <span class="con-wildstep__title">{{ $t(head.title) }}</span>
      <span v-if="head.reading !== ''" class="con-wildstep__reading" data-wild-step v-bind="venusAttrs({'data-venus-step': ''})">{{ head.reading }}</span>
    </div>

    <!-- ── THE OR: where does the wild go? ── -->
    <section v-if="orShown" class="con-wildstep__zone" data-wild-or data-unfold-item v-bind="venusAttrs({'data-venus-wild': ''})">
      <div v-if="orTitle !== ''" class="con-wildstep__zone-head">
        <span class="con-wildstep__zone-title">{{ $t(orTitle) }}</span>
      </div>
      <ConsoleVariantChoice class="con-wildstep__or" :options="orOptions" layout="compare" :label="$t(orTitle || 'Choose')">
        <template #body="{option}">
          <span class="con-wildstep__opt">
            <!-- The plate's GLYPH says what it is (PL-1511): «on a card» the printed «?» (any card's own kind), «a standard
                 resource» the six it may become, in the grid's order. -->
            <i v-if="option.key === 'onCard'" class="con-wildstep__opt-wild" :class="wildIcon" aria-hidden="true" data-wild-glyph
               v-bind="venusAttrs({'data-venus-wild-glyph': ''})"></i>
            <span v-else class="con-wildstep__mosaic" aria-hidden="true" data-wild-standard-glyph
                  v-bind="venusAttrs({'data-venus-standard-glyph': ''})">
              <i v-for="key in lanes" :key="key" class="con-wildstep__mosaic-tile" :class="iconClass(key)"></i>
            </span>
            <span class="con-wildstep__opt-desc">{{ $t(optionDesc(option.key)) }}</span>
          </span>
        </template>
      </ConsoleVariantChoice>
    </section>

    <!-- ── ITS CONSEQUENCE — one slot, its faces in ONE grid cell (an opacity change, never a blink or a reflow) ── -->
    <section v-if="slotShown" class="con-wildstep__zone" data-wild-slot data-unfold-item v-bind="venusAttrs({'data-venus-cards': ''})">
      <!-- The slot names its face only where the OR above does not already say it (Venus: «на карту» under the 30 %
           finish). Exclusive (P43) — the chosen plate IS the slot's title one line above; a second head repeated it and
           took the very rows the candidates need. -->
      <div v-if="!spec.exclusive" class="con-wildstep__zone-head">
        <span class="con-wildstep__zone-title" :class="{'con-wildstep__zone-title--quiet': wildChoice === undefined}">{{ $t(slotTitle) }}</span>
      </div>
      <div class="con-wildstep__slot" :class="{'con-wildstep__slot--grid': spec.exclusive}" ref="slot"
           :style="slotH > 0 ? {height: slotH + 'px'} : undefined">
        <!-- THE HOST'S TARGET STEP (the owner, 2026-11-02 — eight holders in one line read as a strip of stamps): a host
             that walks the console's shared target selector (`ConsolePlayedTargetStep` — rows solved from this very box,
             near misses, the outcome tags, the rail under the cursor, X with the TARGET DOSSIER) hands it in here; the
             face's size is the slot's, measured. Without it the slot keeps its miniatures. -->
        <div v-if="$slots.cards !== undefined" class="con-wildstep__face con-wildstep__face--host"
             :class="{'con-wildstep__face--off': wildChoice !== 'onCard'}" data-wild-face="cards"
             :aria-hidden="wildChoice === 'onCard' ? undefined : 'true'">
          <slot name="cards" :width="slotW" :height="slotH" />
        </div>
        <!-- THE DOOR (the owner, 2026-11-03 — the Venus 30 % finish with thirteen holders in one strip): «on a card» is a
             level of its own (`nestedPick`). Here it is ONE row — the chosen card with its «current → resulting», or the
             ask with how many cards answer it; A enters the pick, where the console's target selector takes the whole
             column (pages, tags, X with the dossier). -->
        <div v-else-if="spec.nestedPick === true" class="con-wildstep__cards con-wildstep__cards--door"
             :class="{'con-wildstep__face--off': wildChoice !== 'onCard'}" data-wild-face="cards" data-wild-door
             :aria-hidden="wildChoice === 'onCard' ? undefined : 'true'">
          <div class="con-wildstep__card con-wildstep__card--door"
               :class="{'con-wildstep__card--focused': focus.zone === 'card', 'con-wildstep__card--chosen': doorCard !== undefined}"
               :data-wild-card="doorCard?.name" :data-chosen="doorCard !== undefined ? '' : undefined"
               v-bind="venusAttrs(doorCard !== undefined ? {'data-venus-card': doorCard.name} : {})">
            <template v-if="doorCard !== undefined">
              <span class="con-wildstep__card-mini" :data-composer-card="doorCard.name" aria-hidden="true">
                <ConsoleCardFaceLite v-if="doorCard.model !== undefined" :name="doorCard.name" :card="doorCard.model" lightweight />
                <ConsoleCardFaceLite v-else :name="doorCard.name" lightweight />
              </span>
              <span class="con-wildstep__card-body">
                <span class="con-wildstep__card-name">{{ $t(doorCard.name) }}</span>
                <span class="con-wildstep__card-count">
                  <i v-if="doorCard.icon !== ''" class="con-wildstep__card-icon" :class="doorCard.icon" aria-hidden="true"></i>
                  <span>{{ doorCard.count }}</span>
                  <span class="con-wildstep__arrow" aria-hidden="true">→</span>
                  <b>{{ doorCard.count + 1 }}</b>
                </span>
                <span v-if="doorCard.vp !== undefined" class="con-wildstep__card-vp" data-wild-card-vp>{{ $t('VP') }} {{ doorCard.vp.from }} → {{ doorCard.vp.to }}</span>
                <span v-if="cards.length === 1" class="con-wildstep__sole">{{ $t('The only target') }}</span>
              </span>
            </template>
            <template v-else>
              <span class="con-wildstep__door-fan" aria-hidden="true">
                <span v-for="(card, ci) in cards.slice(0, 3)" :key="card.name" class="con-wildstep__card-mini con-wildstep__door-face" :style="{'--k': String(ci)}">
                  <ConsoleCardFaceLite v-if="card.model !== undefined" :name="card.name" :card="card.model" lightweight />
                  <ConsoleCardFaceLite v-else :name="card.name" lightweight />
                </span>
              </span>
              <span class="con-wildstep__card-body">
                <span class="con-wildstep__card-name">{{ $t('Choose a card for the wild resource') }}</span>
                <span class="con-wildstep__card-count" data-wild-door-count>{{ doorCountText }}</span>
              </span>
            </template>
            <span v-if="cards.length > 1" class="con-wildstep__door-verb">
              <GamepadGlyph control="confirm" />{{ $t(doorCard !== undefined ? 'Change the card' : 'Choose') }}
            </span>
          </div>
        </div>
        <div v-else class="con-wildstep__cards" :class="{'con-wildstep__face--off': wildChoice !== 'onCard'}" data-wild-face="cards"
             :style="{'--wild-cards': String(Math.max(1, cards.length))}" :aria-hidden="wildChoice === 'onCard' ? undefined : 'true'">
          <div v-for="(card, ci) in cards" :key="card.name" class="con-wildstep__card"
               :class="{'con-wildstep__card--focused': focus.zone === 'card' && focus.index === ci,
                        'con-wildstep__card--chosen': chosenCard === card.name}"
               :data-wild-card="card.name" :data-chosen="chosenCard === card.name ? '' : undefined"
               v-bind="venusAttrs({'data-venus-card': card.name})">
            <span class="con-wildstep__card-mini" :data-composer-card="card.name" aria-hidden="true">
              <ConsoleCardFaceLite v-if="card.model !== undefined" :name="card.name" :card="card.model" lightweight />
              <ConsoleCardFaceLite v-else :name="card.name" lightweight />
            </span>
            <span class="con-wildstep__card-body">
              <span class="con-wildstep__card-name">{{ $t(card.name) }}</span>
              <span class="con-wildstep__card-count">
                <i v-if="card.icon !== ''" class="con-wildstep__card-icon" :class="card.icon" aria-hidden="true"></i>
                <span>{{ card.count }}</span>
                <span class="con-wildstep__arrow" aria-hidden="true">→</span>
                <b>{{ card.count + 1 }}</b>
              </span>
              <span v-if="card.vp !== undefined" class="con-wildstep__card-vp" data-wild-card-vp>{{ $t('VP') }} {{ card.vp.from }} → {{ card.vp.to }}</span>
              <span v-if="cards.length === 1" class="con-wildstep__sole">{{ $t('The only target') }}</span>
            </span>
          </div>
        </div>
        <!-- THE EXCLUSIVE GRID (P43): the radio of the six, in the slot's own cell. A SPEND (P50 · FC) reads every lane
             `stock → stock − N`; a lane the supply cannot pay stays on the grid, dimmed with its reason (a kant and a word,
             never hidden — invariant 2), and the cursor steps over it. -->
        <div v-if="spec.exclusive" class="con-wildstep__face" :class="{'con-wildstep__face--off': wildChoice !== 'asStandard'}"
             data-wild-face="lanes" :aria-hidden="wildChoice === 'asStandard' ? undefined : 'true'">
          <div class="con-wildstep__grid" role="radiogroup" :aria-label="$t('Standard resources')">
            <div v-for="(key, li) in lanes" :key="key" class="con-wildstep__lane"
                 :class="{'con-wildstep__lane--focused': focus.zone === 'lane' && focus.index === li, 'con-wildstep__lane--filled': on(key) > 0,
                          'con-wildstep__lane--off': laneOff(key) !== undefined}"
                 role="radio" :aria-checked="on(key) > 0 ? 'true' : 'false'" :aria-disabled="laneOff(key) !== undefined ? 'true' : undefined"
                 :data-lane-resource="key" :data-lane-amount="on(key)" :data-lane-mode="spend ? 'spend' : 'gain'"
                 :data-lane-off="laneOff(key) !== undefined ? '' : undefined">
              <i class="con-wildstep__lane-icon" :class="iconClass(key)" aria-hidden="true"></i>
              <span class="con-wildstep__lane-body">
                <span class="con-wildstep__lane-name">{{ $t(label(key)) }}</span>
                <span v-if="laneOff(key) !== undefined" class="con-wildstep__lane-reason" data-lane-reason>{{ $t(laneOff(key) ?? '') }}</span>
                <span v-else class="con-wildstep__lane-count">
                  <span>{{ stockOf(key) }}</span>
                  <span class="con-wildstep__arrow" aria-hidden="true">→</span>
                  <b>{{ spend ? stockOf(key) - radioGain : stockOf(key) + radioGain }}</b>
                </span>
              </span>
              <span class="con-wildstep__lane-amount" :class="{'con-wildstep__lane-amount--zero': on(key) === 0}">{{ spend ? '−' : '+' }}{{ radioGain }}</span>
            </div>
          </div>
        </div>
        <div v-else class="con-wildstep__note" :class="{'con-wildstep__face--off': wildChoice === 'onCard'}"
             :aria-hidden="wildChoice === 'onCard' ? 'true' : undefined" data-wild-note v-bind="venusAttrs({'data-venus-wild-note': ''})">
          <template v-if="wildChoice === 'asStandard'">{{ $t('+1 to the standard resources below') }}</template>
          <template v-else>{{ $t(askKey) }}</template>
        </div>
        <div v-if="spec.exclusive && wildChoice === undefined" class="con-wildstep__note con-wildstep__note--ask" data-wild-note>{{ $t(askKey) }}</div>
      </div>
    </section>

    <!-- ── THE STANDARD RESOURCES (not exclusive — the Venus base): a fixed 2 × 3 dial grid ── -->
    <section v-if="!spec.exclusive" class="con-wildstep__zone con-wildstep__zone--lanes" data-unfold-item
             data-wild-spread :data-wild-spread-amount="amount" :data-wild-spread-left="left"
             v-bind="venusAttrs({'data-venus-spread': '', 'data-venus-spread-amount': String(amount), 'data-venus-spread-left': String(left)})">
      <div class="con-wildstep__zone-head">
        <span class="con-wildstep__zone-title">{{ $t('Standard resources') }}</span>
        <!-- THE DIAL'S OWN PILLS (the payment rows' grammar — `.con-dial-pill()`): this zone is laid out with the
             bumpers; a pill at its limit goes grey-flat. -->
        <span v-if="spec.lanes === 'dial'" class="con-wildstep__dial" data-wild-dial-hint v-bind="venusAttrs({'data-venus-dial-hint': ''})">
          <span class="con-wildstep__pill" :class="{'con-wildstep__pill--off': !canDecrease}"><GamepadGlyph control="bumperL" /><span>−1</span></span>
          <span class="con-wildstep__pill" :class="{'con-wildstep__pill--off': !canIncrease}"><GamepadGlyph control="bumperR" /><span>+1</span></span>
          <span class="con-wildstep__pill" :class="{'con-wildstep__pill--off': !canIncrease}"><GamepadGlyph control="triggerR" /><span>{{ $t('The rest') }}</span></span>
        </span>
      </div>
      <div class="con-wildstep__grid" role="group" :aria-label="$t('Standard resources')">
        <div v-for="(key, li) in lanes" :key="key" class="con-wildstep__lane"
             :class="{'con-wildstep__lane--focused': focus.zone === 'lane' && focus.index === li, 'con-wildstep__lane--filled': on(key) > 0}"
             :data-lane-resource="key" :data-lane-amount="on(key)">
          <i class="con-wildstep__lane-icon" :class="iconClass(key)" aria-hidden="true"></i>
          <span class="con-wildstep__lane-body">
            <span class="con-wildstep__lane-name">{{ $t(label(key)) }}</span>
            <span class="con-wildstep__lane-count">
              <span>{{ stockOf(key) }}</span>
              <span class="con-wildstep__arrow" aria-hidden="true">→</span>
              <b>{{ stockOf(key) + on(key) }}</b>
            </span>
          </span>
          <span class="con-wildstep__lane-amount" :class="{'con-wildstep__lane-amount--zero': on(key) === 0}">+{{ on(key) }}</span>
        </div>
      </div>
      <div class="con-wildstep__status" :class="{'con-wildstep__status--done': left === 0}" data-lanes-status>
        <template v-if="left > 0">{{ $t('Left') }}: <b>{{ left }}</b></template>
        <template v-else>{{ $t('Laid out') }}: <b>{{ amount }}</b> ✓</template>
      </div>
    </section>
  </div>
</template>

<script setup lang="ts">
/*
 * THE WILD-RESOURCE CHOICE — ONE inner step for every «a standard resource OR a resource on a card» (P43 · ledger EO,
 * extracted from the Venus bonus's inner pre-select, P89 · EM). A LEVEL of its host (the composer's `sub`), standing
 * in the review's place: the card, the head, the bars and the rail never move; B goes back one level with the draft
 * kept. ONE composition read off a SPECIFICATION (`wildChoiceInner.ts` · `WildChoiceSpec`), three zones top to
 * bottom — the cursor's grid rows:
 *   · THE OR (only where the wild is a question here) — the shared variant grammar (`ConsoleVariantChoice`): «на
 *     карту» wears the printed «?» and the holders' faces, «стандартный ресурс» the six it may become; the chosen one
 *     the grammar's own seal and kant, a refused plate shown with its reason (never hidden);
 *   · ITS CONSEQUENCE — ONE SLOT that never changes height: the candidates on «a card»; on «a standard resource» a
 *     quiet line (Venus — the +1 joins the grid below) or, when the choice is EXCLUSIVE (P43), the grid itself, in
 *     the SAME cell — the two faces cross by opacity, never a reflow, never both at once;
 *   · THE STANDARD RESOURCES (Venus: always) — a FIXED grid of 2 rows × 3 (M€ · steel · titanium / plants · energy ·
 *     heat), a DIAL (LB/RB one unit, RT the rest, «Осталось / Разложено») or a RADIO at budget 1 (A chooses, no dial).
 * Every state is a kant / a fill / a word (invariant 15); nothing reflows under the cursor. The Venus host keeps its
 * historical hooks (`data-venus-*`) beside the shared ones (`data-wild-*`) — its stands read them.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, onBeforeUnmount, onMounted, PropType, ref, useTemplateRef} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleVariantChoice from '@/client/components/console/foundation/ConsoleVariantChoice.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {getCard} from '@/client/cards/ClientCardManifest';
import {LANE_LABELS} from '@/client/console/compositePrompts';
import {spreadOn} from '@/client/console/cardResourceDistribution';
import {layoutTopWithin} from '@/client/console/layoutTop';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {$t, translateText, translateTextWithParams} from '@/client/directives/i18n';
import {
  WILD_LANES, WILD_OPTIONS, WildChoiceSpec, WildFocus, WildKind, WildParts, wildAmount, wildComplete, wildLaneOff, wildLeft, wildOptionLive,
  wildShown,
} from '@/client/console/wildChoice/wildChoiceInner';

type CardView = {name: CardName, model: CardModel | undefined, count: number, icon: string, vp?: {from: number, to: number}};

defineOptions({name: 'ConsoleWildChoiceStep'});
const props = defineProps({
  spec: {type: Object as PropType<WildChoiceSpec>, required: true},
  parts: {type: Object as PropType<WildParts>, required: true},
  focus: {type: Object as PropType<WildFocus>, required: true},
  /** The step's head: its title (an i18n key) and its reading (already a string). */
  head: {type: Object as PropType<{title: string, reading: string}>, required: true},
  /** The OR's zone title (an i18n key) — empty: the plates speak alone. */
  orTitle: {type: String, default: ''},
  /** The plates' second lines per option (i18n keys) — the host's own words. */
  descs: {type: Object as PropType<Partial<Record<WildKind, string>>>, default: () => ({})},
  /** The plates' titles per option (i18n keys) — the host's own words. */
  titles: {type: Object as PropType<Partial<Record<WildKind, string>>>, default: () => ({})},
  /** The candidates' live models (the server's), for their faces and «current → resulting». */
  candidates: {type: Array as PropType<ReadonlyArray<CardModel>>, default: () => []},
  /** The VP a +1 moves per candidate (the server's `vpBox`) — «ПО a → b» under a scoring card. */
  vpBox: {type: Object as PropType<Partial<Record<string, {from: number, to: number}>>>, default: () => ({})},
  /** The kind each candidate takes (the server's `cardResourceByCard`), else the manifest's. */
  resourceByCard: {type: Object as PropType<Partial<Record<string, string>>>, default: () => ({})},
  /** The player's stock per standard resource — «current → resulting». */
  stock: {type: Object as PropType<Partial<Record<string, number>>>, default: () => ({})},
  /** The Venus host: its historical hooks ride beside the shared ones. */
  venus: {type: Boolean, default: false},
});

const slot = useTemplateRef<HTMLElement>('slot');
/** The slot's measured box — the exclusive slot grows to the column's foot (no scroll), the host's step solves its rows off it. */
const slotW = ref(0);
const slotH = ref(0);
let stopObs: (() => void) | undefined;

const orShown = computed((): boolean => {
  return wildShown(props.spec);
});
/**
 * The slot stands with the OR (Venus) — P43's slot is the whole answer under its OR; an exclusive step with no OR
 * (P49's dial-bound resource) IS its slot — the radio grid alone.
 */
const slotShown = computed((): boolean => {
  return orShown.value || props.spec.exclusive;
});
const wildChoice = computed((): WildKind | undefined => {
  return props.parts.wild?.wild;
});
const chosenCard = computed((): CardName | undefined => {
  return props.parts.wild?.wild === 'onCard' ? props.parts.wild.card : undefined;
});
const askKey = computed((): string => {
  return props.spec.exclusive ? 'Choose: on a card or a standard resource' : 'Choose where the 30 % bonus goes';
});
const slotTitle = computed((): string => {
  if (!props.spec.exclusive) {
    return 'Put it on a card';
  }
  return wildChoice.value === 'asStandard' ? 'Standard resource' : 'Put it on a card';
});
const orOptions = computed((): Array<VariantChoiceOption> => {
  return WILD_OPTIONS.map((opt, i) => {
    const live = wildOptionLive(props.spec, opt.key);
    const selected = wildChoice.value === opt.key;
    const reason = !live && opt.key === 'onCard' ? props.spec.or?.onCardOff : undefined;
    return {
      key: opt.key,
      state: {focused: props.focus.zone === 'wild' && props.focus.index === i, selected, off: !live},
      title: translateText(props.titles[opt.key] ?? opt.title),
      ...(reason !== undefined ? {reason: translateText(reason)} : {}),
      attrs: {
        'data-wild-option': opt.key,
        'data-chosen': selected ? '' : undefined,
        ...(props.venus ? {'data-venus-wild-option': opt.key} : {}),
      },
    };
  });
});
/** The candidates — kept on screen (faded) when the wild goes elsewhere, so the slot never re-lays. */
const cards = computed((): ReadonlyArray<CardView> => {
  return props.spec.holders.map((name) => {
    const model = props.candidates.find((c) => c.name === name);
    const fromServer = props.resourceByCard[name];
    const resource = getCard(name)?.resourceType;
    const iconKey = fromServer ?? (resource === undefined ? undefined : cardResourceKey(String(resource)));
    const vp = props.vpBox[name];
    return {
      name, model, count: model?.resources ?? 0, icon: iconKey === undefined ? '' : iconClassFor(iconKey),
      ...(vp !== undefined && vp.from !== vp.to ? {vp: {from: vp.from, to: vp.to}} : {}),
    };
  });
});
/** The door's card (a nested pick): the chosen holder, or none yet. */
const doorCard = computed((): CardView | undefined => {
  const chosen = chosenCard.value;
  return chosen === undefined ? undefined : cards.value.find((c) => c.name === chosen);
});
/** «Карт на выбор: 13» — how many holders answer the door. */
const doorCountText = computed((): string => {
  return translateTextWithParams('Cards to choose from: ${0}', [String(cards.value.length)]);
});
/** «On a card» is the WILD resource — the card faces' printed «?» (`wild`), whatever kind the chosen card keeps. */
const wildIcon = computed((): string => {
  return iconClassFor('wild');
});
const lanes = WILD_LANES;
const amount = computed((): number => {
  return wildAmount(props.spec, props.parts);
});
/** What a chosen radio lane gains — the exclusive grid's «+N» on every lane (the reading of the choice to come). */
const radioGain = computed((): number => {
  return props.spec.amount('asStandard');
});
/** A SPEND step (P50 · FC): the lanes read what LEAVES. */
const spend = computed((): boolean => {
  return props.spec.mode === 'spend';
});
const left = computed((): number => {
  return wildLeft(props.spec, props.parts);
});
const complete = computed((): boolean => {
  return wildComplete(props.spec, props.parts);
});
const focusedLaneKey = computed((): string | undefined => {
  return props.focus.zone === 'lane' ? WILD_LANES[props.focus.index] : undefined;
});
const canDecrease = computed((): boolean => {
  const key = focusedLaneKey.value;
  return key !== undefined && on(key) > 0;
});
const canIncrease = computed((): boolean => {
  return focusedLaneKey.value !== undefined && left.value > 0;
});

/**
 * THE SLOT'S BOX. Exclusive (P43): the slot takes the column down to the BAND's foot — the candidates get every row
 * the column has, the grid face stands at its top, and nothing scrolls. Measured the way the target selector measures
 * itself: the band's bottom minus every bottom padding / border between the slot and the band — never the scroll
 * viewport's height (content-sized, it reports back whatever the slot last came out as: the slot collapsed to its
 * floor and the selector, sized off the band, was cut in half). Venus keeps its natural slot (its grid follows).
 */
function measureSlot(): void {
  const slotNow = slot.value;
  if (slotNow === null) {
    return;
  }
  if (props.spec.exclusive) {
    const band = slotNow.closest<HTMLElement>('[data-ws-band]');
    if (band !== null) {
      let inset = 0;
      for (let el = slotNow.parentElement; el !== null && el !== band; el = el.parentElement) {
        const cs = getComputedStyle(el);
        inset += (parseFloat(cs.paddingBottom) || 0) + (parseFloat(cs.borderBottomWidth) || 0);
      }
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) || 16;
      // In LAYOUT, never a client rect: measured during the rows' entrance the slot read lower than it stands and
      // kept a stale, short height once the motion ended (the selector's second row did not stand — P43 at 4K).
      const room = band.offsetHeight - layoutTopWithin(slotNow, band) - inset - 0.4 * rem;
      const next = Math.max(9 * rem, Math.floor(room));
      if (Math.abs(next - slotH.value) > 1) {
        slotH.value = next;
      }
    }
  }
  slotW.value = Math.max(0, Math.floor(slotNow.clientWidth));
}
function venusAttrs(attrs: Record<string, string | undefined>): Record<string, string | undefined> {
  return props.venus ? attrs : {};
}
function optionDesc(key: string): string {
  return props.descs[key as WildKind] ?? WILD_OPTIONS.find((o) => o.key === key)?.desc ?? '';
}
/** Why a lane is refused (an i18n key), or undefined. */
function laneOff(key: string): string | undefined {
  return wildLaneOff(props.spec, key);
}
function on(key: string): number {
  return spreadOn(props.parts.spread ?? {}, key);
}
function stockOf(key: string): number {
  return props.stock[key] ?? 0;
}
function label(key: string): string {
  return LANE_LABELS[key] ?? key;
}
function iconClass(key: string): string {
  return iconClassFor(key);
}

onMounted(() => {
  measureSlot();
  // The band is the box the slot's room is read off (see `measureSlot`); the slot itself for its width.
  const host = slot.value?.closest<HTMLElement>('[data-ws-band]') ?? undefined;
  const slotNow = slot.value;
  const targets = [host, slotNow].filter((el): el is HTMLElement => el !== undefined && el !== null);
  if (targets.length > 0 && typeof ResizeObserver !== 'undefined') {
    const obs = new ResizeObserver(() => measureSlot());
    targets.forEach((el) => obs.observe(el));
    stopObs = () => obs.disconnect();
  }
});
onBeforeUnmount(() => {
  stopObs?.();
});
</script>
