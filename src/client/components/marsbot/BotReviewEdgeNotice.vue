<template>
  <Transition name="mbr-edge">
    <div
      v-if="state.edge !== ''"
      :key="state.edgeNonce"
      class="mbr-edge"
      :class="['mbr-edge--' + state.edge, {'mbr-edge--large': large}]"
      role="status"
      aria-live="polite"
    >
      <span class="mbr-edge__glyph" aria-hidden="true">{{ state.edge === 'no-prev' ? '⟨' : '⟩' }}</span>
      <span class="mbr-edge__text">{{ $t(edgeText) }}</span>
    </div>
  </Transition>
</template>

<script setup vapor lang="ts">
/*
 * A small, review-LOCAL premium toast for turn-navigation boundaries (LB/RB or the desktop ◀/▶/[ ] at the first /
 * last archived turn). The global notification layer is held while the review is the foreground item, so this
 * boundary feedback lives on review state instead. `:key` on the nonce so a repeated press at the same edge replays
 * the pop animation.
 *
 * A VAPOR component — one of the three leaves of the Vue 3.6 pilot (docs/claude/vapor/ROADMAP.md §3.6): this one is
 * the `<Transition>` over a keyed `v-if` driven by a module's reactive state. It runs inside the virtual-DOM app
 * through `vaporInteropPlugin` (main.ts). `$t` is the imported binding — a Vapor component has no global properties.
 *
 * ⚠ THE TEMPLATE STARTS WITH ITS ROOT — no comment before it. A development build keeps template comments, a comment
 * beside the root makes the component's root a FRAGMENT for Vapor, and the attributes its parent lets fall through
 * are then dropped (with a warning) — in development and in unit specs only; a production build strips the comment
 * and inherits them. What the template is, is said here instead (guard: `vaporReadiness.spec`).
 */
import {computed} from 'vue';
import {$t} from '@/client/directives/i18n';
import {botTurnReviewState as state} from './botTurnReviewState';

defineOptions({name: 'BotReviewEdgeNotice'});
withDefaults(defineProps<{
  /** TV-readable sizing to match the console review body. */
  large?: boolean,
}>(), {large: false});

const edgeText = computed(() => (state.edge === 'no-prev' ? 'Previous turn unavailable' : 'The next turn has not been played yet'));
</script>
