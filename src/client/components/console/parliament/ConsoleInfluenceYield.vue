<template>
  <!--
    INFLUENCE → RESULT (Turmoil Redux) — the ONE graphic block for an effect
    that scales with influence, wherever a surface needs it: the vote
    surface's own-effect block, the fullscreen inspector's footer, the
    recipient picker's source dock, the results scene, the playground.

    Two tiers, one hierarchy. THE FORMULA is the card's constant rule, drawn
    in the card's own vocabulary («1 [animal] / [influence] · every player»),
    small and steady. THE READING is the player's own number for the context
    the surface is in — «[influence] 3 → +3 [animal]» — large, and captioned
    by WHICH question it answers (current influence · if you win the vote ·
    this payout · received). Two readings may stand side by side (the
    estimate and the «if you win» forecast); a forecast that changes nothing
    is never drawn. No player → the formula alone, no invented number.

    ONE NUMBER (`oneNumber`) — the vote panel's law: the forecast is not a
    second plate but a SUFFIX of the estimate («+1 if you win · step 3»,
    `winSuffixesOf`), every effect's plate stands on ONE line, and the
    block's host supplies the caption (its kicker), so the plates print none.

    THE LEVY (the Budgets — «lose 10 M€» FIRST): a card that TAKES before it
    pays reads as ONE line, in the printed order, with the day's balance at
    its end — «[−10 M€] → [inputs] → +7 M€ = −3 M€». The levy stands at the
    HEAD of the plate of the payout in its own currency (`levy.payout`), the
    net at its tail; a short seat's levy prints what would be taken «of 10».
    A production part beside it carries its HORIZON («pays from the next
    generation»): today's pocket and next generation's income are never one
    sum. A FLAT part («+4 M€ production», a rate of 0 per influence) prints
    its base alone — no inputs cluster claims the influence bought it.

    Nothing here computes: the numbers arrive from `influenceYieldModel.ts`
    (the client reading of the common `scaledAmount`), the icons are the
    console's own sprite families, the influence badge is the same asset the
    card face prints.
  -->
  <div class="con-iyield" :class="['con-iyield--' + size, {'con-iyield--reference': readings.length === 0, 'con-iyield--parts': groups.length > 1, 'con-iyield--onenum': oneNumber}]" data-influence-yield>
    <span v-if="kicker !== undefined" class="con-iyield__kicker">{{ $t(kicker) }}</span>
    <!-- A LEVY with no payout in its currency to net against stands alone, first — the printed order. -->
    <div v-if="levy !== undefined && levyAlone" class="con-iyield__group con-iyield__group--levy" data-yield-effect="levy">
      <div class="con-iyield__readings">
        <div class="con-iyield__reading con-iyield__reading--levy" :data-yield-context="levy.context" data-yield-levy-alone>
          <span class="con-iyield__levy" :class="{'con-iyield__levy--short': levy.short}" data-yield-levy :data-yield-levy-paid="levy.paid" :data-yield-levy-owed="levy.owed">
            <b>−{{ levy.paid }}</b><i class="con-iyield__unit" :class="levyUnitClass"></i>
            <small v-if="levy.short" class="con-iyield__levy-of">{{ ofText(levy.owed) }}</small>
          </span>
          <span v-if="captions && levy.note !== undefined" class="con-iyield__caption">{{ $t(levy.note) }}</span>
        </div>
      </div>
    </div>
    <div v-for="group in groups" :key="group.effect.id" class="con-iyield__group" :data-yield-effect="group.effect.id">
      <!-- A SEQUENTIAL part states its own rule: «1 [card] / 3 [heat
           production]» — the divisor and the TOTAL it divides, never the
           influence (which is already inside that total). -->
      <div v-if="(formula || group.readings.length === 0) && group.effect.sequel !== undefined" class="con-iyield__formula" aria-hidden="true">
        <b class="con-iyield__num">1</b>
        <i class="con-iyield__unit" :class="unitClassOf(group.effect)"></i>
        <span class="con-iyield__slash">/</span>
        <b class="con-iyield__num">{{ group.effect.sequel.per }}</b>
        <i class="con-iyield__unit" :class="totalClassOf(group.effect)"></i>
        <span class="con-iyield__who">{{ $t('For every player') }}</span>
      </div>
      <!-- A FLAT part states its base alone: «+4 [M€ production] · every player» — no rate per influence. -->
      <div v-else-if="(formula || group.readings.length === 0) && isFlat(group.effect)" class="con-iyield__formula" data-yield-flat aria-hidden="true">
        <b class="con-iyield__num">+{{ group.effect.base }}</b>
        <i class="con-iyield__unit" :class="unitClassOf(group.effect)"></i>
        <span class="con-iyield__who" :class="{'con-iyield__who--winner': group.effect.recipient === 'winner'}">
          {{ $t(group.effect.recipient === 'winner' ? 'Winner of the vote' : 'For every player') }}
        </span>
      </div>
      <div v-else-if="formula || group.readings.length === 0" class="con-iyield__formula" :data-yield-count-rate="group.effect.count?.per" aria-hidden="true">
        <!-- A COUNTED term at its OWN rate («2 [unit] / [city*] + 1 [unit] / [influence]» —
             Colonization Funding): both rates are stated, or the row would promise the
             influence's rate for the count. -->
        <template v-if="countGlyphOf(group.effect) !== undefined && group.effect.count?.per !== group.effect.perInfluence">
          <b class="con-iyield__num">{{ group.effect.count?.per }}</b>
          <i class="con-iyield__unit" :class="unitClassOf(group.effect)"></i>
          <span class="con-iyield__slash">/</span>
          <PremiumCountGlyph class="con-iyield__glyph" :glyph="countGlyphOf(group.effect)!" />
          <span class="con-iyield__plus">+</span>
        </template>
        <b class="con-iyield__num">{{ group.effect.perInfluence }}</b>
        <i class="con-iyield__unit" :class="unitClassOf(group.effect)"></i>
        <span class="con-iyield__slash">/</span>
        <!-- A COUNTED term sharing the rate («1 [unit] / [counted object] + [influence]»):
             the counted object is exactly what the face prints — the card glyph
             for a card count, the printed tag medallion for a tag count, the city
             tile with its spark for a board count. -->
        <template v-if="countGlyphOf(group.effect) !== undefined && group.effect.count?.per === group.effect.perInfluence">
          <PremiumCountGlyph class="con-iyield__glyph" :glyph="countGlyphOf(group.effect)!" />
          <span class="con-iyield__plus">+</span>
        </template>
        <i class="con-iyield__inf"></i>
        <span v-if="group.effect.cap !== undefined" class="con-iyield__cap">{{ capText(group.effect) }}</span>
        <span class="con-iyield__who" :class="{'con-iyield__who--winner': group.effect.recipient === 'winner'}">
          {{ $t(group.effect.recipient === 'winner' ? 'Winner of the vote' : 'For every player') }}
        </span>
      </div>
      <div v-if="group.readings.length > 0" class="con-iyield__readings">
        <div v-for="y in group.readings" :key="y.context"
             class="con-iyield__reading"
             :class="['con-iyield__reading--' + y.context, {'con-iyield__reading--skipped': y.skipped !== undefined, 'con-iyield__reading--max': atCap(y)}]"
             :data-yield-context="y.context"
             :data-yield-influence="y.influence"
             :data-yield-count="y.count"
             :data-yield-metric="y.countedMetric?.value"
             :data-yield-uncapped="y.uncapped"
             :data-yield-max="atCap(y) ? 'true' : undefined"
             :data-yield-amount="y.amount"
             :data-yield-total-before="y.total?.before"
             :data-yield-total-after="y.total?.after"
             :data-yield-delivered="y.delivered"
             :data-yield-skipped="y.skipped"
             :data-yield-net="levyOn(group, y) ? netOf(y) : undefined">
          <!-- THE LEVY at the HEAD of the plate: what leaves FIRST («−10 [M€]», «−4 [M€] of 10» for a short seat) —
               in the printed order, before the inputs that earn the payout. -->
          <template v-if="levyOn(group, y)">
            <span class="con-iyield__levy" :class="{'con-iyield__levy--short': levy!.short}" data-yield-levy :data-yield-levy-paid="levy!.paid" :data-yield-levy-owed="levy!.owed">
              <b>−{{ levy!.paid }}</b><i class="con-iyield__unit" :class="unitClassOf(group.effect)"></i>
              <small v-if="levy!.short" class="con-iyield__levy-of">{{ ofText(levy!.owed) }}</small>
            </span>
            <span class="con-iyield__arrow con-iyield__arrow--levy" aria-hidden="true">→</span>
          </template>
          <!-- THE INPUTS as one cluster: «[counted object] 2 + [influence] 2» — the
               count is the player's own (the server's), then the influence. -->
          <!-- A SEQUENTIAL reading shows the CHAIN: the total before the
               earlier part moved it, the total after, and the result. The
               player never has to add the influence back in themselves. -->
          <span v-if="y.total !== undefined" class="con-iyield__in con-iyield__in--seq">
            <i class="con-iyield__unit" :class="totalClassOf(group.effect)"></i>
            <b data-yield-in="total-before">{{ y.total.before }}</b>
            <span class="con-iyield__arrow" aria-hidden="true">→</span>
            <b data-yield-in="total-after">{{ y.total.after }}</b>
          </span>
          <span v-else-if="(y.influence !== undefined || y.count !== undefined) && !isFlat(group.effect)" class="con-iyield__in">
            <!-- A count over SEVERAL tags reads TAG BY TAG («[Venus] 1 + [Jovian] 2 + [influence] 1»):
                 the breakdown the server recorded, each tag with its own medallion — never one
                 number the player has to take apart. A single-tag count keeps the one glyph. -->
            <template v-if="y.count !== undefined && y.countedByTag !== undefined && y.countedByTag.length > 1">
              <template v-for="entry in y.countedByTag" :key="entry.tag">
                <PremiumCountGlyph class="con-iyield__glyph" :glyph="{kind: 'tag', tag: entry.tag}" /><b :data-yield-in="'tag:' + entry.tag">{{ entry.count }}</b>
                <span class="con-iyield__plus" aria-hidden="true">+</span>
              </template>
            </template>
            <!-- A count over PRODUCTION STEPS reads RESOURCE BY RESOURCE («[steel] 2 + [titanium] 1 + [energy] 3 +
                 [influence] 2»): each term in its production plate, a zero listed — the twin of the tag breakdown. -->
            <template v-else-if="y.count !== undefined && y.countedByResource !== undefined">
              <template v-for="entry in y.countedByResource" :key="entry.resource">
                <i class="con-iyield__unit con-iyield__unit--prod con-iyield__unit--term" :class="productionUnitClass(entry.resource)" aria-hidden="true"></i><b :data-yield-in="'production:' + entry.resource">{{ entry.count }}</b>
                <span class="con-iyield__plus" aria-hidden="true">+</span>
              </template>
            </template>
            <!-- A THRESHOLD count reads the VALUE and what it came to («[TR] 24 → 1 set + [influence] 3»):
                 the rating is the player's own number, the sets are what the rule made of it — the
                 player never divides in their head. The breakdown in full is the inspector's row. -->
            <template v-else-if="y.count !== undefined && y.countedMetric !== undefined && countGlyphOf(group.effect) !== undefined">
              <PremiumCountGlyph class="con-iyield__glyph" :glyph="countGlyphOf(group.effect)!" /><b data-yield-in="metric">{{ y.countedMetric.value }}</b>
              <span class="con-iyield__arrow con-iyield__arrow--in" aria-hidden="true">→</span>
              <b data-yield-in="count">{{ y.count }}</b><span class="con-iyield__sets">{{ setsNounOf(y.count) }}</span>
              <span class="con-iyield__plus" aria-hidden="true">+</span>
            </template>
            <template v-else-if="y.count !== undefined && countGlyphOf(group.effect) !== undefined">
              <PremiumCountGlyph class="con-iyield__glyph" :glyph="countGlyphOf(group.effect)!" /><b data-yield-in="count">{{ y.count }}</b>
              <span class="con-iyield__plus" aria-hidden="true">+</span>
            </template>
            <template v-if="y.influence !== undefined"><i class="con-iyield__inf"></i><b data-yield-in="influence">{{ y.influence }}</b></template>
          </span>
          <span v-if="(y.total !== undefined || y.influence !== undefined || y.count !== undefined) && !isFlat(group.effect)" class="con-iyield__arrow" aria-hidden="true">→</span>
          <!-- A forfeited payout keeps its SIZE and says it did not land (✕ + struck amount); the caption names why.
               A capped sum says MAX beside the amount — the limit is part of the number, never a footnote. -->
          <span class="con-iyield__result">
            <span class="con-iyield__out" :class="{'con-iyield__out--lost': y.skipped !== undefined && (y.amount ?? 0) > 0}"><b>{{ outText(y) }}</b><i class="con-iyield__unit" :class="unitClassOf(group.effect)"></i><em v-if="atCap(y)" class="con-iyield__max">{{ $t('Max.') }}</em></span>
            <!-- THE NET at the tail — the day's balance once the levy and the payout are both known:
                 «= −3 [M€]». Signed, and in the loss tone when the seat ends poorer today. -->
            <span v-if="levyOn(group, y)" class="con-iyield__net" :class="{'con-iyield__net--minus': netOf(y) < 0}" data-yield-net-line :data-yield-net-amount="netOf(y)">
              <span class="con-iyield__eq" aria-hidden="true">=</span><b>{{ signedText(netOf(y)) }}</b><i class="con-iyield__unit" :class="unitClassOf(group.effect)"></i>
            </span>
            <!-- THE WIN'S DIFFERENCE, as a suffix of this very number — tracked
                 caps, a quiet gold accent carried by weight, the Agenda step
                 as the rail's own node. Not a reading: no kicker, no line of
                 its own, no beat of its own. -->
            <span v-if="y.context === 'estimate' && group.suffix !== undefined"
                  class="con-iyield__suffix"
                  :class="{'con-iyield__suffix--max': group.suffix.atCap}"
                  :data-parl-vote-suffix="group.suffix.delta"
                  :data-suffix-step="group.suffix.agendaStep"
                  :data-hint="suffixHint(group.suffix)">
              <b class="con-iyield__suffix-num">+{{ group.suffix.delta }}</b>
              <i class="con-iyield__unit con-iyield__suffix-unit" :class="unitClassOf(group.effect)"></i>
              <span class="con-iyield__suffix-text">{{ $t(suffixWords) }}</span>
              <template v-if="group.suffix.agendaStep !== undefined">
                <span class="con-iyield__suffix-sep" aria-hidden="true">·</span>
                <span class="con-iyield__suffix-text">{{ $t(suffixStepWord) }}</span>
                <i class="con-iyield__suffix-node" aria-hidden="true">{{ group.suffix.agendaStep }}</i>
              </template>
            </span>
          </span>
          <!-- THE HORIZON of a production part beside a levy: it first PAYS in the next generation — never
               summed with the day's pocket. -->
          <span v-if="horizonOn(group)" class="con-iyield__horizon" data-yield-horizon>{{ $t(horizonKey) }}</span>
          <span v-if="captions && captionOf(y) !== ''" class="con-iyield__caption">{{ captionOf(y) }}</span>
        </div>
      </div>
    </div>
    <span v-if="note !== undefined" class="con-iyield__note" data-yield-note>{{ $t(note) }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Resource} from '@/common/Resource';
import {InfluenceScaledEffect, InfluenceYield, yieldAtCap} from '@/common/parliament/influenceScaling';
import {LevyReading} from '@/common/parliament/resolutionLevy';
import {
  METRIC_SETS_PLURAL_KEY, oneNumberYieldsOf, PRODUCTION_HORIZON_KEY, sequelTotalIcon, WinSuffix, winSuffixesOf, yieldCaptionOf, yieldCountPresentation,
  yieldIconOf, yieldIsFlat, yieldIsMultiplier, YieldCountGlyph, YieldIcon,
} from '@/client/console/parliament/influenceYieldModel';
import {SUFFIX_HINT, SUFFIX_IF_YOU_WIN, SUFFIX_STEP} from '@/client/console/parliament/voteInfoModel';
import PremiumCountGlyph from '@/client/components/premiumCard/PremiumCountGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

type Group = {effect: InfluenceScaledEffect, readings: Array<InfluenceYield>, suffix: WinSuffix | undefined};

export default defineComponent({
  name: 'ConsoleInfluenceYield',
  components: {PremiumCountGlyph},
  props: {
    /** The readings to draw — one or more per scaled effect (the model groups them by effect). */
    yields: {type: Array as PropType<ReadonlyArray<InfluenceYield>>, required: true},
    /** `compact` under a dock / in a footer, `normal` in a block, `hero` on a stage. */
    size: {type: String as PropType<'compact' | 'normal' | 'hero'>, default: 'normal'},
    /** Draw the constant formula above the readings (off where the card's own graphic stands beside the block). */
    formula: {type: Boolean, default: true},
    /**
     * ONE NUMBER: fold every «if you win» forecast into a suffix of its
     * effect's estimate (the vote panel, the playground's proposal context).
     * Off, the forecast stands as its own captioned plate (the inspector).
     */
    oneNumber: {type: Boolean, default: false},
    /**
     * The suffixes to draw in one-number mode, when the host has already
     * separated them from the readings (`voteInfoModel`); absent, they are
     * read off `yields` here — the same `winSuffixesOf` either way.
     */
    suffixes: {type: Array as PropType<ReadonlyArray<WinSuffix> | undefined>, default: undefined},
    /** Print each reading's caption (off inside a block whose own kicker states the question). */
    captions: {type: Boolean, default: true},
    /** An i18n key over the block. */
    kicker: {type: String as PropType<string | undefined>, default: undefined},
    /** An i18n key under the block — the honest «no recipient» note, never a promise. */
    note: {type: String as PropType<string | undefined>, default: undefined},
    /**
     * THE LEVY the card takes FIRST (a budget), read for the same seat and context as `yields`
     * (`voteLevyOf` / `enactedLevyOf`): drawn at the head of the plate of the payout in its
     * currency, with the net at the tail; alone when no such payout exists.
     */
    levy: {type: Object as PropType<LevyReading | undefined>, default: undefined},
  },
  computed: {
    groups(): Array<Group> {
      const out: Array<Group> = [];
      const shown = this.oneNumber ? oneNumberYieldsOf(this.yields) : this.yields;
      const suffixes = this.oneNumber ? (this.suffixes ?? winSuffixesOf(this.yields)) : [];
      for (const y of shown) {
        let group = out.find((g) => g.effect.id === y.effect.id);
        if (group === undefined) {
          group = {effect: y.effect, readings: [], suffix: suffixes.find((s) => s.effectId === y.effect.id)};
          out.push(group);
        }
        if (y.context !== 'reference') {
          group.readings.push(y);
        }
      }
      return out;
    },
    readings(): Array<InfluenceYield> {
      return this.groups.flatMap((g) => g.readings);
    },
    suffixWords(): string {
      return SUFFIX_IF_YOU_WIN;
    },
    suffixStepWord(): string {
      return SUFFIX_STEP;
    },
    /** The levy has no payout of its currency among the groups to stand at the head of — it stands alone. */
    levyAlone(): boolean {
      const levy = this.levy;
      return levy !== undefined && (levy.payout === undefined || !this.groups.some((g) => g.effect.id === levy.payout?.effectId && g.readings.length > 0));
    },
    /** The levy's own unit icon (a standalone plate) — the console's stock sprite of its resource. */
    levyUnitClass(): string {
      return this.levy === undefined ? '' : iconClassFor(this.levy.resource);
    },
    horizonKey(): string {
      return PRODUCTION_HORIZON_KEY;
    },
  },
  methods: {
    /** The levy heads THIS group's readings: the group pays the levy's currency, and the reading is a number (never the reference). */
    levyOn(group: Group, y: InfluenceYield): boolean {
      const levy = this.levy;
      return levy !== undefined && levy.payout !== undefined && levy.payout.effectId === group.effect.id && y.context !== 'reference';
    },
    /** The day's balance of ONE reading: its payout (0 when forfeited) minus what the levy takes. */
    netOf(y: InfluenceYield): number {
      const paid = this.levy?.paid ?? 0;
      const payout = y.skipped !== undefined ? 0 : (y.amount ?? 0);
      return payout - paid;
    },
    signedText(n: number): string {
      return n > 0 ? `+${n}` : n < 0 ? `−${-n}` : '0';
    },
    /** «of 10» — the owed sum beside a short seat's take. */
    ofText(owed: number): string {
      return translateTextWithParams('of ${0}', [String(owed)]);
    },
    isFlat(effect: InfluenceScaledEffect): boolean {
      return yieldIsFlat(effect);
    },
    /**
     * A production part beside a levy carries its horizon: it first pays in the next generation. A host that
     * prints neither captions nor the formula and folds nothing (the sitting's one-line BAND) has no room
     * for a caption-sized note — the panel, the inspector and the stand print it.
     */
    horizonOn(group: Group): boolean {
      return this.levy !== undefined && group.effect.unit.kind === 'production' && group.readings.length > 0 &&
        (this.oneNumber || this.captions || this.formula);
    },
    /** One term of a production breakdown: the resource's sprite in the production plate. */
    productionUnitClass(resource: Resource): string {
      return iconClassFor(resource);
    },
    /** The counted object's glyph (a card with a VP icon, or a printed tag), undefined for an effect without a count term. */
    countGlyphOf(effect: InfluenceScaledEffect): YieldCountGlyph | undefined {
      return effect.count === undefined ? undefined : yieldCountPresentation(effect.count.id).glyph;
    },
    /**
     * The NOUN beside a threshold count («set» / «набора»): the plural key resolves its word forms against the
     * number to its left, so the number is rendered into the key and stripped again — the count itself stands
     * in its own `data-yield-in="count"` element, the way every other reading prints it.
     */
    setsNounOf(count: number): string {
      const numbered = translateTextWithParams(METRIC_SETS_PLURAL_KEY, [String(count)]);
      const digits = String(count);
      return numbered.startsWith(digits) ? numbered.slice(digits.length).trim() : numbered;
    },
    /** The reading stands at the effect's maximum — the MAX mark (reached or passed; the uncapped sum rides the data attribute). */
    atCap(y: InfluenceYield): boolean {
      return yieldAtCap(y);
    },
    capText(effect: InfluenceScaledEffect): string {
      return effect.cap === undefined ? '' : translateTextWithParams('max ${0}', [String(effect.cap)]);
    },
    unitClassOf(effect: InfluenceScaledEffect): string {
      return this.iconClass(yieldIconOf(effect));
    },
    /** The icon of the TOTAL a sequential part divides (the production frame included). */
    totalClassOf(effect: InfluenceScaledEffect): string {
      const term = effect.sequel;
      return term === undefined ? '' : this.iconClass(sequelTotalIcon(term));
    },
    iconClass(icon: YieldIcon): string {
      switch (icon.family) {
      case 'card-resource':
        return iconClassFor(String(icon.resource).toLowerCase().replace(/\s+/g, '-'));
      case 'resource':
        return iconClassFor(icon.resource) + (icon.production ? ' con-iyield__unit--prod' : '');
      case 'cards':
        return iconClassFor('cards');
      case 'colony':
        // The colony TILE, the console's own sprite (the same asset the card faces print for a colony).
        return 'con-iyield__unit--colony';
      }
    },
    outText(y: InfluenceYield): string {
      const amount = y.amount ?? 0;
      // A MULTIPLIER reads «×k» — it is not a count of anything until the ledger multiplies it.
      if (yieldIsMultiplier(y.effect)) {
        return (y.skipped !== undefined && amount > 0 ? '✕ ' : '') + '×' + amount;
      }
      if (y.skipped !== undefined && amount > 0) {
        return '✕ ' + amount;
      }
      // A DRAW the deck could not fill completely names BOTH numbers — what
      // was owed and what landed — rather than quietly printing the smaller.
      if (y.delivered !== undefined && y.delivered < amount) {
        return '+' + y.delivered + ' / ' + amount;
      }
      return '+' + amount;
    },
    captionOf(y: InfluenceYield): string {
      const caption = yieldCaptionOf(y);
      if (caption === undefined) {
        return '';
      }
      return caption.params === undefined ? translateText(caption.key) : translateTextWithParams(caption.key, [...caption.params]);
    },
    /** The suffix's one-phrase explanation (the premium tooltip; a step-less forecast explains nothing more than it says). */
    suffixHint(suffix: WinSuffix): string | undefined {
      return suffix.agendaStep === undefined ? undefined : translateTextWithParams(SUFFIX_HINT, [String(suffix.agendaStep)]);
    },
  },
});
</script>
