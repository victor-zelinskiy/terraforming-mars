<template>
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

<script setup vapor lang="ts">
/*
 * «ВЗВЕДЕНО НА СЛЕДУЮЩУЮ КАРТУ» (TR49 class) — what the NEXT card this
 * player plays will spend, standing where that card is CHOSEN (the hand
 * album's head; the dock carries the compact twin). Renders NOTHING when
 * nothing is armed — and reserves nothing: its host's row keeps its own
 * height either way. Not a focus stop: it states a fact the composer of
 * the next card names again, and «ЭФФЕКТЫ» lets the player inspect it.
 *
 * (This comment opened the template; the template starts with its root now.)
 */
import {computed, PropType} from 'vue';
import {$t, translateText} from '@/client/directives/i18n';
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
defineOptions({name: 'ConsoleArmedEffectsStrip'});
const props = defineProps({
  effects: {type: Array as PropType<ReadonlyArray<PresentedArmedEffect>>, required: true},
  variant: {type: String as PropType<'strip' | 'chip'>, default: 'strip'},
});

/** Every effect drawn is still in the air (TR49 flight): the strip stands invisible — its box is the landing. */
const allHeld = computed((): boolean => {
  return props.effects.length > 0 && props.effects.every((e) => e.held === true);
});
const source = computed((): ArmedEffectView | undefined => {
  return armedSourceOf(props.effects);
});
const sourceName = computed((): string => {
  return source.value?.sourceName ?? '';
});
const expiry = computed((): string => {
  return props.effects[0]?.expiry ?? '';
});
const artStyle = computed((): Record<string, string> => {
  const armedSource = source.value;
  if (armedSource === undefined) {
    return {};
  }
  // The THUMB tier: the strip paints the art at ~2 rem. A LAW (RX36) wears its own art, keyed by its printed code.
  const law = armedSource.law === undefined ? undefined : getResolution(armedSource.law);
  const url = law !== undefined ? premiumCardArtForKey(law.code)?.url : armedSource.source !== undefined ? premiumCardArt(armedSource.source).url : undefined;
  return url === undefined ? {} : {backgroundImage: `url(${cardArtUrlAtTier(url, 'thumb')})`};
});
const ariaLabel = computed((): string => {
  const parts = [translateText('Armed for your next card'), sourceName.value, ...props.effects.map((e) => e.formula), expiry.value];
  return parts.filter((p) => p !== '').join(' · ');
});
</script>
