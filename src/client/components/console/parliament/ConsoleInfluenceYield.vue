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

    Nothing here computes: the numbers arrive from `influenceYieldModel.ts`
    (the client reading of the common `scaledAmount`), the icons are the
    console's own sprite families, the influence badge is the same asset the
    card face prints.
  -->
  <div class="con-iyield" :class="['con-iyield--' + size, {'con-iyield--reference': readings.length === 0}]" data-influence-yield>
    <span v-if="kicker !== undefined" class="con-iyield__kicker">{{ $t(kicker) }}</span>
    <div v-for="group in groups" :key="group.effect.id" class="con-iyield__group" :data-yield-effect="group.effect.id">
      <div v-if="formula || group.readings.length === 0" class="con-iyield__formula" aria-hidden="true">
        <b class="con-iyield__num">{{ group.effect.perInfluence }}</b>
        <i class="con-iyield__unit" :class="unitClassOf(group.effect)"></i>
        <span class="con-iyield__slash">/</span>
        <!-- A COUNTED term shares the rate («1 [unit] / [counted card] + [influence]»):
             the counted object is the card glyph the face prints, never a bare tag. -->
        <template v-if="countGlyphOf(group.effect) !== undefined && group.effect.count?.per === group.effect.perInfluence">
          <PremiumVpCardGlyph class="con-iyield__glyph" :tag="countGlyphOf(group.effect)?.tag" />
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
             :data-yield-uncapped="y.uncapped"
             :data-yield-max="atCap(y) ? 'true' : undefined"
             :data-yield-amount="y.amount"
             :data-yield-skipped="y.skipped">
          <!-- THE INPUTS as one cluster: «[counted card] 2 + [influence] 2» — the number of
               counted cards is the player's own (the server's count), then the influence. -->
          <span v-if="y.influence !== undefined || y.count !== undefined" class="con-iyield__in">
            <template v-if="y.count !== undefined">
              <PremiumVpCardGlyph class="con-iyield__glyph" :tag="countGlyphOf(group.effect)?.tag" /><b data-yield-in="count">{{ y.count }}</b>
              <span class="con-iyield__plus" aria-hidden="true">+</span>
            </template>
            <template v-if="y.influence !== undefined"><i class="con-iyield__inf"></i><b data-yield-in="influence">{{ y.influence }}</b></template>
          </span>
          <span v-if="y.influence !== undefined || y.count !== undefined" class="con-iyield__arrow" aria-hidden="true">→</span>
          <!-- A forfeited payout keeps its SIZE and says it did not land (✕ + struck amount); the caption names why.
               A capped sum says MAX beside the amount — the limit is part of the number, never a footnote. -->
          <span class="con-iyield__out" :class="{'con-iyield__out--lost': y.skipped !== undefined && (y.amount ?? 0) > 0}"><b>{{ outText(y) }}</b><i class="con-iyield__unit" :class="unitClassOf(group.effect)"></i><em v-if="atCap(y)" class="con-iyield__max">{{ $t('Max.') }}</em></span>
          <span v-if="captionOf(y) !== ''" class="con-iyield__caption">{{ captionOf(y) }}</span>
        </div>
      </div>
    </div>
    <span v-if="note !== undefined" class="con-iyield__note" data-yield-note>{{ $t(note) }}</span>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {InfluenceScaledEffect, InfluenceYield, yieldAtCap} from '@/common/parliament/influenceScaling';
import {yieldCaptionOf, yieldCountPresentation, yieldIconOf, YieldCountPresentation} from '@/client/console/parliament/influenceYieldModel';
import PremiumVpCardGlyph from '@/client/components/premiumCard/PremiumVpCardGlyph.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {translateText, translateTextWithParams} from '@/client/directives/i18n';

type Group = {effect: InfluenceScaledEffect, readings: Array<InfluenceYield>};

export default defineComponent({
  name: 'ConsoleInfluenceYield',
  components: {PremiumVpCardGlyph},
  props: {
    /** The readings to draw — one or more per scaled effect (the model groups them by effect). */
    yields: {type: Array as PropType<ReadonlyArray<InfluenceYield>>, required: true},
    /** `compact` under a dock / in a footer, `normal` in a block, `hero` on a stage. */
    size: {type: String as PropType<'compact' | 'normal' | 'hero'>, default: 'normal'},
    /** Draw the constant formula above the readings (off where the card's own graphic stands beside the block). */
    formula: {type: Boolean, default: true},
    /** An i18n key over the block. */
    kicker: {type: String as PropType<string | undefined>, default: undefined},
    /** An i18n key under the block — the honest «no recipient» note, never a promise. */
    note: {type: String as PropType<string | undefined>, default: undefined},
  },
  computed: {
    groups(): Array<Group> {
      const out: Array<Group> = [];
      for (const y of this.yields) {
        let group = out.find((g) => g.effect.id === y.effect.id);
        if (group === undefined) {
          group = {effect: y.effect, readings: []};
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
  },
  methods: {
    /** The counted object's glyph (a card with a tag and a VP icon), undefined for an effect without a count term. */
    countGlyphOf(effect: InfluenceScaledEffect): YieldCountPresentation['glyph'] | undefined {
      return effect.count === undefined ? undefined : yieldCountPresentation(effect.count.id).glyph;
    },
    /** The reading stands at the effect's maximum — the MAX mark (reached or passed; the uncapped sum rides the data attribute). */
    atCap(y: InfluenceYield): boolean {
      return yieldAtCap(y);
    },
    capText(effect: InfluenceScaledEffect): string {
      return effect.cap === undefined ? '' : translateTextWithParams('max ${0}', [String(effect.cap)]);
    },
    unitClassOf(effect: InfluenceScaledEffect): string {
      const icon = yieldIconOf(effect);
      switch (icon.family) {
      case 'card-resource':
        return iconClassFor(String(icon.resource).toLowerCase().replace(/\s+/g, '-'));
      case 'resource':
        return iconClassFor(icon.resource) + (icon.production ? ' con-iyield__unit--prod' : '');
      case 'cards':
        return iconClassFor('cards');
      }
    },
    outText(y: InfluenceYield): string {
      const amount = y.amount ?? 0;
      return y.skipped !== undefined && amount > 0 ? '✕ ' + amount : '+' + amount;
    },
    captionOf(y: InfluenceYield): string {
      const caption = yieldCaptionOf(y);
      if (caption === undefined) {
        return '';
      }
      return caption.params === undefined ? translateText(caption.key) : translateTextWithParams(caption.key, [...caption.params]);
    },
  },
});
</script>
