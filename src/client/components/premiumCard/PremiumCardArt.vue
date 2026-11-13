<template>
  <div ref="root" class="pcard__art"
       :class="{
         'pcard__art--loaded': loaded,
         'pcard__art--ready': ready,
         'pcard__art--fallback': onFallback,
         'pcard__art--void': exhausted,
         'pcard__art--swap': prevSrc !== '',
       }"
       aria-hidden="true">
    <!-- THE PICTURE BEING REPLACED (a tier change of a face that already painted one): it stays UNDER the new
         file until that one has faded in over it — a crossfade, never a blink to the black art box. -->
    <img v-if="prevSrc !== ''"
         class="pcard__art-prev"
         :src="prevSrc"
         alt=""
         decoding="async"
         draggable="false" />
    <img v-if="!exhausted"
         :src="src"
         alt=""
         loading="lazy"
         decoding="async"
         draggable="false"
         @load="onLoad"
         @error="onError"
         @transitionend="dropPrev" />
  </div>
</template>

<script setup vapor lang="ts">
import {computed, onMounted, ref, useTemplateRef, watch} from 'vue';
import {CARD_ART_FALLBACK_URL, CardArtTier, cardArtUrlAtTier, PremiumCardArt} from '@/client/cards/cardArt';
import {useFlowScope} from '@/client/console/session/useFlowScope';

/**
 * The art viewport. Failure chain is one-shot per link and can never loop:
 * requested tier (thumb) → per-card full art → shared fallback (-1.webp) →
 * procedural theme body (`pcard__art--void`, no <img> at all). At `tier:
 * 'full'` the first link collapses into the second — exactly the historical
 * chain. A missing thumb (stale checkout, art added without `make:cards`)
 * therefore degrades to the full file, never to a lost picture.
 */
defineOptions({name: 'PremiumCardArt'});
const props = defineProps({
  art: {
    type: Object as () => PremiumCardArt,
    required: true,
  },
  /** Which resolution build to paint — see cardArt.ts ART TIERS. */
  tier: {
    type: String as () => CardArtTier,
    required: false,
    default: 'full',
  },
});

const flow = useFlowScope('premium-card-art');
// The viewport's root element — the mount looks for the `<img>` the browser may already hold inside it.
const root = useTemplateRef<HTMLElement>('root');
const loaded = ref(false);
/**
 * THE PICTURE WAS ALREADY THERE AT MOUNT (PL-473): a file the browser holds (a warmed `preloadPremiumCardArt`, a
 * face that painted it before) is `complete` the moment its `<img>` is created, so the face shows it at once —
 * the card's own entry is its motion. Waiting for the async `load` and fading 240 ms from black lit the card's
 * frame first and its art a beat later (the target step at 4K: a lit card with a black body). Mount only: a
 * face re-pointed in place keeps the load fade.
 */
const ready = ref(false);
const failedThumb = ref(false);
const failedPrimary = ref(false);
const exhausted = ref(false);
/** The file a TIER CHANGE replaces, kept under the new one until it has faded in ('' = none). */
const prevSrc = ref('');
let cancelPrev = (() => {}) as () => void;
const src = computed((): string => {
  return srcAt(props.tier);
});
const onFallback = computed((): boolean => {
  return props.art.fallback || failedPrimary.value;
});
/** The URL the chain would paint at `tier` right now (the failure links the chain has already taken included). */
function srcAt(tier: CardArtTier): string {
  if (tier === 'thumb' && !failedThumb.value) {
    return cardArtUrlAtTier(props.art.url, 'thumb');
  }
  return failedPrimary.value ? CARD_ART_FALLBACK_URL : props.art.url;
}
function onLoad(): void {
  loaded.value = true;
  if (prevSrc.value !== '') {
    // The fade's own end drops the old picture; the bound covers a fade that never runs (reduced motion).
    cancelPrev();
    cancelPrev = flow.after(600, 'the old picture\'s fade bound', () => dropPrev());
  }
}
function dropPrev(): void {
  cancelPrev();
  prevSrc.value = '';
}
function resetChain(): void {
  ready.value = false;
  loaded.value = false;
  failedThumb.value = false;
  failedPrimary.value = false;
  exhausted.value = false;
}
function onError(): void {
  if (props.tier === 'thumb' && !failedThumb.value) {
    failedThumb.value = true; // retry with the full-res file
    loaded.value = false;
    return;
  }
  if (!failedPrimary.value && !props.art.fallback) {
    failedPrimary.value = true; // retry once with the shared fallback
    loaded.value = false;
    return;
  }
  exhausted.value = true; // even -1.webp failed → procedural body
}

// A re-pointed keyless card face re-arms the load chain for the new art.
watch(() => props.art.url, () => {
  prevSrc.value = '';
  resetChain();
});
watch(() => props.tier, (_now: CardArtTier, was: CardArtTier) => {
  // A face that already PAINTED its picture keeps it under the new tier's file (the same art, another build):
  // the new one fades in over it — a crossfade, never a fade from black.
  prevSrc.value = loaded.value && !exhausted.value ? srcAt(was) : '';
  resetChain();
});
onMounted(() => {
  const img = root.value?.querySelector?.('img');
  if (img !== null && img !== undefined && img.complete && img.naturalWidth > 0) {
    ready.value = true;
    loaded.value = true;
  }
});
</script>
