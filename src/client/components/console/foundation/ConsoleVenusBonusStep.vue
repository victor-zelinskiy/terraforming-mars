<template>
  <!-- THE VENUS BONUS — THE INNER PRE-SELECT (P89 · ledger EM — the owner, 2026-11-02). A LEVEL of the composer (its
       `sub`), standing in the review's place: the card, the head, the bars and the rail never move; B goes back one level
       with the draft kept, A on a laid-out lane confirms and leaves. ONE composition for every host (the play sheet, the
       blue action's setup, the colony trade's stage), three zones top to bottom — the cursor's grid rows
       (`venusBonusInner.ts`):
         · THE 30 % FINISH (only where it is really taken here, a card able to hold it) — an OR of two plates side by
           side: «Положить на карту» | «Ещё один стандартный ресурс», the chosen one sealed by a kant;
         · ITS CONSEQUENCE — one SLOT that never changes height: the candidates' faces («Положить на карту») when the
           wild goes onto a card, a quiet line «+1 к стандартным ресурсам ниже» when it joins them, the ask before either;
         · THE STANDARD RESOURCES — a FIXED grid of 2 rows × 3 (M€ · steel · titanium / plants · energy · heat): ↑↓ the
           row, ←→ the column, LB/RB one unit, RT the rest — the dial's own pills on the zone's head say so, the way the
           payment's rows do; «Осталось / Разложено» in one always-mounted status slot.
       Every state is a kant / a fill / a word (invariant 15); nothing reflows under the cursor. -->
  <div class="con-venusstep" data-venus-inner :data-venus-focus-zone="focus.zone" :data-venus-focus-index="focus.index"
       :data-venus-complete="complete ? '' : undefined">
    <div class="con-venusstep__head" data-unfold-item>
      <span class="con-venusstep__title">{{ $t('Venus bonus') }}</span>
      <span v-if="stepReading !== ''" class="con-venusstep__reading" data-venus-step>{{ stepReading }}</span>
    </div>

    <!-- ── THE 30 % FINISH: where does the wild go? ── -->
    <section v-if="wildShown" class="con-venusstep__zone" data-venus-wild data-unfold-item>
      <div class="con-venusstep__zone-head">
        <span class="con-venusstep__zone-title">{{ $t('Final step · 30 %') }}</span>
      </div>
      <div class="con-venusstep__or" role="radiogroup" :aria-label="$t('Final step · 30 %')">
        <template v-for="(opt, i) in wildOptions" :key="opt.key">
          <span v-if="i > 0" class="con-venusstep__or-word" aria-hidden="true">{{ $t('or') }}</span>
          <div class="con-venusstep__opt" role="radio" :aria-checked="wildChoice === opt.key ? 'true' : 'false'"
               :class="{'con-venusstep__opt--focused': focus.zone === 'wild' && focus.index === i,
                        'con-venusstep__opt--chosen': wildChoice === opt.key}"
               :data-venus-wild-option="opt.key" :data-chosen="wildChoice === opt.key ? '' : undefined">
            <span class="con-venusstep__opt-mark" aria-hidden="true">
              <i v-if="opt.key === 'onCard'" class="con-venusstep__opt-icon" :class="wildIcon"></i>
              <i v-else class="con-venusstep__opt-icon con-venusstep__opt-icon--any" :class="standardIcon"></i>
            </span>
            <span class="con-venusstep__opt-body">
              <span class="con-venusstep__opt-title">{{ $t(opt.title) }}</span>
              <span class="con-venusstep__opt-desc">{{ $t(opt.desc) }}</span>
            </span>
            <span class="con-venusstep__opt-seal" aria-hidden="true">✓</span>
          </div>
        </template>
      </div>
    </section>

    <!-- ── ITS CONSEQUENCE — one slot, three faces in ONE grid cell (an opacity change, never a blink or a reflow) ── -->
    <section v-if="wildShown" class="con-venusstep__zone" data-venus-cards data-unfold-item>
      <div class="con-venusstep__zone-head">
        <span class="con-venusstep__zone-title" :class="{'con-venusstep__zone-title--quiet': wildChoice !== 'onCard'}">{{ $t('Put it on a card') }}</span>
      </div>
      <div class="con-venusstep__slot">
        <div class="con-venusstep__cards" :class="{'con-venusstep__face--off': wildChoice !== 'onCard'}"
             :style="{'--venus-cards': String(Math.max(1, cards.length))}" :aria-hidden="wildChoice === 'onCard' ? undefined : 'true'">
          <div v-for="(card, ci) in cards" :key="card.name" class="con-venusstep__card"
               :class="{'con-venusstep__card--focused': focus.zone === 'card' && focus.index === ci,
                        'con-venusstep__card--chosen': chosenCard === card.name}"
               :data-venus-card="card.name" :data-chosen="chosenCard === card.name ? '' : undefined">
            <span class="con-venusstep__card-mini" :data-composer-card="card.name" aria-hidden="true">
              <ConsoleCardFaceLite v-if="card.model !== undefined" :name="card.name" :card="card.model" lightweight />
              <ConsoleCardFaceLite v-else :name="card.name" lightweight />
            </span>
            <span class="con-venusstep__card-body">
              <span class="con-venusstep__card-name">{{ $t(card.name) }}</span>
              <span class="con-venusstep__card-count">
                <i v-if="card.icon !== ''" class="con-venusstep__card-icon" :class="card.icon" aria-hidden="true"></i>
                <span>{{ card.count }}</span>
                <span class="con-venusstep__arrow" aria-hidden="true">→</span>
                <b>{{ card.count + (chosenCard === card.name ? 1 : 0) }}</b>
              </span>
              <span v-if="cards.length === 1" class="con-venusstep__sole">{{ $t('The only target') }}</span>
            </span>
          </div>
        </div>
        <div class="con-venusstep__note" :class="{'con-venusstep__face--off': wildChoice === 'onCard'}"
             :aria-hidden="wildChoice === 'onCard' ? 'true' : undefined" data-venus-wild-note>
          <template v-if="wildChoice === 'asStandard'">{{ $t('+1 to the standard resources below') }}</template>
          <template v-else>{{ $t('Choose where the 30 % bonus goes') }}</template>
        </div>
      </div>
    </section>

    <!-- ── THE STANDARD RESOURCES: a fixed 2 × 3 grid ── -->
    <section class="con-venusstep__zone con-venusstep__zone--lanes" data-unfold-item
             data-venus-spread :data-venus-spread-amount="amount" :data-venus-spread-left="left">
      <div class="con-venusstep__zone-head">
        <span class="con-venusstep__zone-title">{{ $t('Standard resources') }}</span>
        <!-- THE DIAL'S OWN PILLS (the payment rows' grammar — `.con-dial-pill()`): this zone is laid out with the
             bumpers; a pill at its limit goes grey-flat. -->
        <span class="con-venusstep__dial" data-venus-dial-hint>
          <span class="con-venusstep__pill" :class="{'con-venusstep__pill--off': !canDecrease}"><GamepadGlyph control="bumperL" /><span>−1</span></span>
          <span class="con-venusstep__pill" :class="{'con-venusstep__pill--off': !canIncrease}"><GamepadGlyph control="bumperR" /><span>+1</span></span>
          <span class="con-venusstep__pill" :class="{'con-venusstep__pill--off': !canIncrease}"><GamepadGlyph control="triggerR" /><span>{{ $t('The rest') }}</span></span>
        </span>
      </div>
      <div class="con-venusstep__grid" role="group" :aria-label="$t('Standard resources')">
        <div v-for="(key, li) in lanes" :key="key" class="con-venusstep__lane"
             :class="{'con-venusstep__lane--focused': focus.zone === 'lane' && focus.index === li, 'con-venusstep__lane--filled': on(key) > 0}"
             :data-lane-resource="key" :data-lane-amount="on(key)">
          <i class="con-venusstep__lane-icon" :class="iconClass(key)" aria-hidden="true"></i>
          <span class="con-venusstep__lane-body">
            <span class="con-venusstep__lane-name">{{ $t(label(key)) }}</span>
            <span class="con-venusstep__lane-count">
              <span>{{ stockOf(key) }}</span>
              <span class="con-venusstep__arrow" aria-hidden="true">→</span>
              <b>{{ stockOf(key) + on(key) }}</b>
            </span>
          </span>
          <span class="con-venusstep__lane-amount" :class="{'con-venusstep__lane-amount--zero': on(key) === 0}">+{{ on(key) }}</span>
        </div>
      </div>
      <div class="con-venusstep__status" :class="{'con-venusstep__status--done': left === 0}" data-lanes-status>
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
import {PlayerInputModel, VenusBonusPromptMeta} from '@/common/models/PlayerInputModel';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {getCard} from '@/client/cards/ClientCardManifest';
import {LANE_LABELS} from '@/client/console/compositePrompts';
import {spreadOn} from '@/client/console/cardResourceDistribution';
import {cardResourceKey} from '@/client/console/resourceTransfer/resourceTransferModel';
import {
  VENUS_SPREAD_LANES, VenusBonusParts, venusBonusMetaOf, venusSpreadAmount, venusStepReading, venusWildCandidates,
} from '@/client/console/venusBonus/venusBonusPreselect';
import {
  VENUS_WILD_OPTIONS, VenusInnerFocus, venusInnerCards, venusInnerComplete, venusInnerLeft, venusInnerWildShown,
} from '@/client/console/venusBonus/venusBonusInner';

type CardView = {name: CardName, model: CardModel | undefined, count: number, icon: string};

export default defineComponent({
  name: 'ConsoleVenusBonusStep',
  components: {ConsoleCardFaceLite, GamepadGlyph},
  props: {
    /** The step's own prompt model (`ActionPreviewStep` `venusBonus`). */
    input: {type: Object as PropType<PlayerInputModel>, required: true},
    parts: {type: Object as PropType<VenusBonusParts>, required: true},
    focus: {type: Object as PropType<VenusInnerFocus>, required: true},
    /** The player's stock per standard resource — «current → resulting». */
    stock: {type: Object as PropType<Partial<Record<string, number>>>, default: () => ({})},
  },
  computed: {
    meta(): VenusBonusPromptMeta | undefined {
      return venusBonusMetaOf(this.input);
    },
    stepReading(): string {
      return venusStepReading(this.meta);
    },
    wildShown(): boolean {
      return this.meta !== undefined && venusInnerWildShown(this.meta);
    },
    wildOptions() {
      return VENUS_WILD_OPTIONS;
    },
    wildChoice(): 'onCard' | 'asStandard' | undefined {
      return this.parts.wild?.wild;
    },
    chosenCard(): CardName | undefined {
      return this.parts.wild?.wild === 'onCard' ? this.parts.wild.card : undefined;
    },
    /** The candidates — kept on screen (faded) when the wild joins the standard resources, so the slot never re-lays. */
    cards(): ReadonlyArray<CardView> {
      const meta = this.meta;
      if (meta === undefined) {
        return [];
      }
      const names = venusInnerCards(meta, {...this.parts, wild: {wild: 'onCard'}});
      const models = venusWildCandidates(this.input);
      return names.map((name) => {
        const model = models?.find((c) => c.name === name);
        const resource = getCard(name)?.resourceType;
        return {name, model, count: model?.resources ?? 0, icon: resource === undefined ? '' : iconClassFor(cardResourceKey(String(resource)))};
      });
    },
    /** The wild's own glyph on «on a card»: the kind of the first candidate (a card resource), else none. */
    wildIcon(): string {
      return this.cards[0]?.icon ?? '';
    },
    standardIcon(): string {
      return iconClassFor('megacredits');
    },
    lanes(): ReadonlyArray<string> {
      return VENUS_SPREAD_LANES;
    },
    amount(): number {
      return this.meta === undefined ? 0 : venusSpreadAmount(this.meta, this.parts);
    },
    left(): number {
      return this.meta === undefined ? 0 : venusInnerLeft(this.meta, this.parts);
    },
    complete(): boolean {
      return this.meta !== undefined && venusInnerComplete(this.meta, this.parts);
    },
    focusedLaneKey(): string | undefined {
      return this.focus.zone === 'lane' ? VENUS_SPREAD_LANES[this.focus.index] : undefined;
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
