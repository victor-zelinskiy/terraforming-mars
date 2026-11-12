<template>
  <span v-if="reaction.chips.length > 0 || reaction.more > 0"
        class="con-fxdoor"
        :class="{'con-forecast--descend': pulse}"
        data-forecast-row
        @click="emit('open')">
    <ConsoleForecastReactions :reaction="reaction" />
    <span v-if="canOpen" class="con-forecast__key" aria-hidden="true"><GamepadGlyph control="stickR" /></span>
  </span>
</template>

<script setup vapor lang="ts">
/*
 * THE DOOR of the R3 «Эффекты» layer on a STAGE — the composers' «⚡ сработает» group (what the TABLE adds to this
 * move, bare deltas, at most two chips + «+N») with the R3 key riding it: ONE flex item on the host's own chips line
 * (the group never parts from its key), a click opens the layer exactly as R3 does. Rendered only while there is
 * something to show; the key only while the host says the door may open (its setup level, nothing held). The host
 * marks nothing else: the motion hooks find the door by `data-forecast-row`.
 *
 * A VAPOR component — one of the three leaves of the Vue 3.6 pilot (docs/claude/vapor/ROADMAP.md §3.6): this one is
 * the event a virtual-DOM parent listens to, the attributes that parent lets fall through onto the root
 * (`data-unfold-late`), and two virtual-DOM children hosted inside a Vapor parent.
 *
 * ⚠ THE TEMPLATE STARTS WITH ITS ROOT — no comment before it. A development build keeps template comments, a comment
 * beside the root makes the component's root a FRAGMENT for Vapor, and the attributes its parent lets fall through
 * are then dropped (with a warning) — in development and in unit specs only; a production build strips the comment
 * and inherits them. What the template is, is said here instead (guard: `vaporReadiness.spec`).
 */
import {VariantReaction} from '@/client/console/effectForecastModel';
import ConsoleForecastReactions from '@/client/components/console/ConsoleForecastReactions.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

defineOptions({name: 'ConsoleForecastDoor'});
withDefaults(defineProps<{
  /** The table's answer, compact (`reactionChipsOf(forecast.facts)`). */
  reaction: VariantReaction,
  /** The host's setup level with nothing held — the key is drawn. */
  canOpen?: boolean,
  /** The one-shot COMMIT flare (`pulseForecastDoor`). */
  pulse?: boolean,
}>(), {canOpen: false, pulse: false});
const emit = defineEmits<{(e: 'open'): void}>();
</script>
