<template>
  <!-- THE WILD-RESOURCE CHOICE — ONE inner step for every «a standard resource OR a resource on a card» (P43 · ledger EO,
       extracted from the Venus bonus's inner pre-select, P89 · EM). A LEVEL of its host (the composer's `sub`), standing
       in the review's place: the card, the head, the bars and the rail never move; B goes back one level with the draft
       kept. ONE composition read off a SPECIFICATION (`wildChoiceInner.ts` · `WildChoiceSpec`), three zones top to
       bottom — the cursor's grid rows:
         · THE OR (only where the wild is a question here) — the shared variant grammar (`ConsoleVariantChoice`): «на
           карту» wears the printed «?» and the holders' faces, «стандартный ресурс» the six it may become; the chosen one
           the grammar's own seal and kant, a refused plate shown with its reason (never hidden);
         · ITS CONSEQUENCE — ONE SLOT that never changes height: the candidates on «a card»; on «a standard resource» a
           quiet line (Venus — the +1 joins the grid below) or, when the choice is EXCLUSIVE (P43), the grid itself, in
           the SAME cell — the two faces cross by opacity, never a reflow, never both at once;
         · THE STANDARD RESOURCES (Venus: always) — a FIXED grid of 2 rows × 3 (M€ · steel · titanium / plants · energy ·
           heat), a DIAL (LB/RB one unit, RT the rest, «Осталось / Разложено») or a RADIO at budget 1 (A chooses, no dial).
       Every state is a kant / a fill / a word (invariant 15); nothing reflows under the cursor. The Venus host keeps its
       historical hooks (`data-venus-*`) beside the shared ones (`data-wild-*`) — its stands read them. -->
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
      <div class="con-wildstep__zone-head">
        <span class="con-wildstep__zone-title" :class="{'con-wildstep__zone-title--quiet': wildChoice === undefined}">{{ $t(slotTitle) }}</span>
        <!-- The radio's grid needs no dial; the exclusive slot names its face in the head instead. -->
      </div>
      <div class="con-wildstep__slot" :class="{'con-wildstep__slot--grid': spec.exclusive}">
        <div class="con-wildstep__cards" :class="{'con-wildstep__face--off': wildChoice !== 'onCard'}" data-wild-face="cards"
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
        <!-- THE EXCLUSIVE GRID (P43): the radio of the six, in the slot's own cell. -->
        <div v-if="spec.exclusive" class="con-wildstep__face" :class="{'con-wildstep__face--off': wildChoice !== 'asStandard'}"
             data-wild-face="lanes" :aria-hidden="wildChoice === 'asStandard' ? undefined : 'true'">
          <div class="con-wildstep__grid" role="radiogroup" :aria-label="$t('Standard resources')">
            <div v-for="(key, li) in lanes" :key="key" class="con-wildstep__lane"
                 :class="{'con-wildstep__lane--focused': focus.zone === 'lane' && focus.index === li, 'con-wildstep__lane--filled': on(key) > 0}"
                 role="radio" :aria-checked="on(key) > 0 ? 'true' : 'false'"
                 :data-lane-resource="key" :data-lane-amount="on(key)">
              <i class="con-wildstep__lane-icon" :class="iconClass(key)" aria-hidden="true"></i>
              <span class="con-wildstep__lane-body">
                <span class="con-wildstep__lane-name">{{ $t(label(key)) }}</span>
                <span class="con-wildstep__lane-count">
                  <span>{{ stockOf(key) }}</span>
                  <span class="con-wildstep__arrow" aria-hidden="true">→</span>
                  <b>{{ stockOf(key) + radioGain }}</b>
                </span>
              </span>
              <span class="con-wildstep__lane-amount" :class="{'con-wildstep__lane-amount--zero': on(key) === 0}">+{{ radioGain }}</span>
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

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {CardModel} from '@/common/models/CardModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import ConsoleVariantChoice from '@/client/components/console/foundation/ConsoleVariantChoice.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {getCard} from '@/client/cards/ClientCardManifest';
import {LANE_LABELS} from '@/client/console/compositePrompts';
import {spreadOn} from '@/client/console/cardResourceDistribution';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {VariantChoiceOption} from '@/client/console/variantChoiceModel';
import {translateText} from '@/client/directives/i18n';
import {
  WILD_LANES, WILD_OPTIONS, WildChoiceSpec, WildFocus, WildKind, WildParts, wildAmount, wildComplete, wildLeft, wildOptionLive,
  wildShown,
} from '@/client/console/wildChoice/wildChoiceInner';

type CardView = {name: CardName, model: CardModel | undefined, count: number, icon: string, vp?: {from: number, to: number}};

export default defineComponent({
  name: 'ConsoleWildChoiceStep',
  components: {ConsoleCardFaceLite, ConsoleVariantChoice, GamepadGlyph},
  props: {
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
  },
  computed: {
    orShown(): boolean {
      return wildShown(this.spec);
    },
    /** The slot stands with the OR (Venus) — P43's slot is the whole answer under its OR. */
    slotShown(): boolean {
      return this.orShown;
    },
    wildChoice(): WildKind | undefined {
      return this.parts.wild?.wild;
    },
    chosenCard(): CardName | undefined {
      return this.parts.wild?.wild === 'onCard' ? this.parts.wild.card : undefined;
    },
    askKey(): string {
      return this.spec.exclusive ? 'Choose: on a card or a standard resource' : 'Choose where the 30 % bonus goes';
    },
    slotTitle(): string {
      if (!this.spec.exclusive) {
        return 'Put it on a card';
      }
      return this.wildChoice === 'asStandard' ? 'Standard resource' : 'Put it on a card';
    },
    orOptions(): Array<VariantChoiceOption> {
      return WILD_OPTIONS.map((opt, i) => {
        const live = wildOptionLive(this.spec, opt.key);
        const selected = this.wildChoice === opt.key;
        const reason = !live && opt.key === 'onCard' ? this.spec.or?.onCardOff : undefined;
        return {
          key: opt.key,
          state: {focused: this.focus.zone === 'wild' && this.focus.index === i, selected, off: !live},
          title: translateText(this.titles[opt.key] ?? opt.title),
          ...(reason !== undefined ? {reason: translateText(reason)} : {}),
          attrs: {
            'data-wild-option': opt.key,
            'data-chosen': selected ? '' : undefined,
            ...(this.venus ? {'data-venus-wild-option': opt.key} : {}),
          },
        };
      });
    },
    /** The candidates — kept on screen (faded) when the wild goes elsewhere, so the slot never re-lays. */
    cards(): ReadonlyArray<CardView> {
      return this.spec.holders.map((name) => {
        const model = this.candidates.find((c) => c.name === name);
        const fromServer = this.resourceByCard[name];
        const resource = getCard(name)?.resourceType;
        const iconKey = fromServer ?? (resource === undefined ? undefined : cardResourceKey(String(resource)));
        const vp = this.vpBox[name];
        return {
          name, model, count: model?.resources ?? 0, icon: iconKey === undefined ? '' : iconClassFor(iconKey),
          ...(vp !== undefined && vp.from !== vp.to ? {vp: {from: vp.from, to: vp.to}} : {}),
        };
      });
    },
    /** «On a card» is the WILD resource — the card faces' printed «?» (`wild`), whatever kind the chosen card keeps. */
    wildIcon(): string {
      return iconClassFor('wild');
    },
    lanes(): ReadonlyArray<string> {
      return WILD_LANES;
    },
    amount(): number {
      return wildAmount(this.spec, this.parts);
    },
    /** What a chosen radio lane gains — the exclusive grid's «+N» on every lane (the reading of the choice to come). */
    radioGain(): number {
      return this.spec.amount('asStandard');
    },
    left(): number {
      return wildLeft(this.spec, this.parts);
    },
    complete(): boolean {
      return wildComplete(this.spec, this.parts);
    },
    focusedLaneKey(): string | undefined {
      return this.focus.zone === 'lane' ? WILD_LANES[this.focus.index] : undefined;
    },
    canDecrease(): boolean {
      const key = this.focusedLaneKey;
      return key !== undefined && this.on(key) > 0;
    },
    canIncrease(): boolean {
      return this.focusedLaneKey !== undefined && this.left > 0;
    },
  },
  methods: {
    venusAttrs(attrs: Record<string, string | undefined>): Record<string, string | undefined> {
      return this.venus ? attrs : {};
    },
    optionDesc(key: string): string {
      return this.descs[key as WildKind] ?? WILD_OPTIONS.find((o) => o.key === key)?.desc ?? '';
    },
    on(key: string): number {
      return spreadOn(this.parts.spread ?? {}, key);
    },
    stockOf(key: string): number {
      return this.stock[key] ?? 0;
    },
    label(key: string): string {
      return LANE_LABELS[key] ?? key;
    },
    iconClass(key: string): string {
      return iconClassFor(key);
    },
  },
});
</script>
