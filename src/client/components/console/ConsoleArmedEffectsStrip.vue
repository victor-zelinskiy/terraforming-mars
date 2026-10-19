<template>
  <!-- «ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ» (TR49 class) — what the NEXT card this
       player plays will spend, standing where that card is CHOSEN (the hand
       album's head; the dock carries the compact twin). Renders NOTHING when
       nothing is armed — and reserves nothing: its host's row keeps its own
       height either way. Not a focus stop: it states a fact the composer of
       the next card names again, and «ЭФФЕКТЫ» lets the player inspect it. -->
  <div v-if="effects.length > 0"
       class="con-armed"
       :class="['con-armed--' + variant, {'con-armed--arriving': allHeld}]"
       role="status"
       :aria-label="ariaLabel"
       data-armed-strip
       :data-armed-variant="variant"
       :data-armed-source="source?.sourceKey">
    <span class="con-armed__spark" aria-hidden="true">⚡</span>
    <template v-if="variant === 'strip'">
      <span class="con-armed__kicker">{{ $t('Armed for your next card') }}</span>
      <span class="con-armed__art" :style="artStyle" aria-hidden="true"></span>
      <span class="con-armed__source">{{ sourceName }}</span>
      <!-- The badge / plate never yields; the formula beside it is the FIRST member to yield (flex-basis 0, up to its
           max-content), the expiry the second (an ellipsis in its own box) — never a plate cut by its neighbour. -->
      <template v-for="e in effects" :key="e.key">
        <span class="con-armed__effect" :class="['con-armed__effect--' + e.kind, {'con-armed__effect--held': e.held}]" :data-armed-kind="e.kind">
          <span v-if="e.kind === 'requirementWaiver'" class="con-armed__struck" aria-hidden="true">{{ $t('Global requirements') }}</span>
          <!-- the PARTY family (TR70): the printed party plate, struck — the face's own glyph of the waiver -->
          <PremiumPartyRequirementGlyph v-else-if="e.kind === 'partyWaiver'" class="pprq--waived con-armed__pprq" />
          <span v-else class="con-armed__badge">{{ e.badge }}</span>
        </span>
        <span class="con-armed__formula" :class="{'con-armed__formula--held': e.held}">{{ e.formula }}</span>
      </template>
      <span class="con-armed__expiry">{{ expiry }}</span>
    </template>
    <template v-else>
      <span v-for="e in effects" :key="e.key" class="con-armed__chip" :class="['con-armed__chip--' + e.kind, {'con-armed__chip--held': e.held}]" :data-armed-kind="e.kind">
        <span v-if="e.kind === 'requirementWaiver'" class="con-armed__struck con-armed__struck--chip" aria-hidden="true">{{ $t('Reqs') }}</span>
        <PremiumPartyRequirementGlyph v-else-if="e.kind === 'partyWaiver'" class="pprq--waived con-armed__pprq con-armed__pprq--chip" />
        <span v-else class="con-armed__badge">{{ e.badge }}</span>
      </span>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {translateText} from '@/client/directives/i18n';
import {cardArtUrlAtTier, premiumCardArt, premiumCardArtForKey} from '@/client/cards/cardArt';
import {ArmedEffectView, armedSourceOf} from '@/client/console/armedEffects';
import {getResolution} from '@/client/parliament/ClientParliamentManifest';
import {PresentedArmedEffect} from '@/client/console/armedEffectFlight';
import PremiumPartyRequirementGlyph from '@/client/components/premiumCard/PremiumPartyRequirementGlyph.vue';

/**
 * ConsoleArmedEffectsStrip — the armed one-play effects of the VIEWER, in two
 * densities: `strip` (the album head: «⚡ ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ · [art]
 * Особая разработка · ±2 Требования глобальных параметров ±2 · до следующего
 * розыгрыша») and `chip` (the dock: «⚡ ±2» / «⚡ [струк] ТРЕБ.» / «⚡ −8»).
 * Host-agnostic: the hosted album (a prelude's «play a card») carries the same
 * instance by the same prop. Every word comes from `requirementEasingText`.
 */
export default defineComponent({
  name: 'ConsoleArmedEffectsStrip',
  components: {PremiumPartyRequirementGlyph},
  props: {
    effects: {type: Array as PropType<ReadonlyArray<PresentedArmedEffect>>, required: true},
    variant: {type: String as PropType<'strip' | 'chip'>, default: 'strip'},
  },
  computed: {
    /** Every effect drawn is still in the air (TR49 flight): the strip stands invisible — its box is the landing. */
    allHeld(): boolean {
      return this.effects.length > 0 && this.effects.every((e) => e.held === true);
    },
    source(): ArmedEffectView | undefined {
      return armedSourceOf(this.effects);
    },
    sourceName(): string {
      return this.source?.sourceName ?? '';
    },
    expiry(): string {
      return this.effects[0]?.expiry ?? '';
    },
    artStyle(): Record<string, string> {
      const source = this.source;
      if (source === undefined) {
        return {};
      }
      // The THUMB tier: the strip paints the art at ~2 rem. A LAW (RX36) wears its own art, keyed by its printed code.
      const law = source.law === undefined ? undefined : getResolution(source.law);
      const url = law !== undefined ? premiumCardArtForKey(law.code)?.url : source.source !== undefined ? premiumCardArt(source.source).url : undefined;
      return url === undefined ? {} : {backgroundImage: `url(${cardArtUrlAtTier(url, 'thumb')})`};
    },
    ariaLabel(): string {
      const parts = [translateText('Armed for your next card'), this.sourceName, ...this.effects.map((e) => e.formula), this.expiry];
      return parts.filter((p) => p !== '').join(' · ');
    },
  },
});
</script>
