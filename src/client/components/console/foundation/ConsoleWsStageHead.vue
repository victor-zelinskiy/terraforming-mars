<template>
  <header class="con-ws-stage-head" :class="{'con-ws-stage-head--badged': hasBadges}">
    <span class="con-ws-stage-head__title con-ws-stage-title">{{ title }}</span>
    <span v-if="hasBadges" class="con-ws-stage-head__badges"><slot name="badges" /></span>
  </header>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

/**
 * @console-shared LIVE — console native stands on this file.
 *
 * THE EMBEDDED WORKSPACE STAGE HEADER — one component, every card result a
 * workspace shows.
 *
 * «Получены карты · ПОЛУЧЕНО 2» and «Купить открытые карты? · ВЫБРАНО 0/1 ·
 * ПОКУПКА −0» are the same moment («вот карта(ы) — решай»), so they are one
 * heading with one hierarchy: the stage's sentence on the left, its live state
 * as compact badges beside it. Two things follow from making it a COMPONENT
 * rather than two matching rule sets:
 *
 *  · the state can never take a second ROW. The title occupied one line and the
 *    count chip another, which cost the result stage a whole band of vertical
 *    space for two short strings — the cards paid for it in size.
 *  · the two stages cannot drift again. A shared class still leaves two
 *    markup trees, and every past divergence in this flow (title tier, kicker,
 *    chip placement, head height) was a markup divergence, not a style one.
 *
 * The host still owns the OUTER element's identity (`.con-reveal__head` /
 * `.con-task__head` arrive as fall-through classes onto this root), because the
 * shared chassis rules are written compound against those base classes on
 * purpose — see `.con-ws-stage-head` in console.less.
 *
 * Height is reserved, not content-driven: a batch that goes from one card to
 * several must not move the row underneath it.
 */
export default defineComponent({
  name: 'ConsoleWsStageHead',
  props: {
    /** The stage's own sentence — ALREADY translated by the host. */
    title: {type: String, required: true},
  },
  computed: {
    hasBadges(): boolean {
      return this.$slots.badges !== undefined;
    },
  },
});
</script>
