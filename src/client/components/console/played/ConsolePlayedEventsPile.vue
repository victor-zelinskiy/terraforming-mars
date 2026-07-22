<template>
  <!--
    The FACE-DOWN events pile — per the printed rules, played events lie
    рубашкой вверх in one stack. Shows the canonical sleeve art, a physical
    thickness (up to three offset backs) and the count. Focus/click belong to
    the parent CATEGORY block (the tableau navigates by category); opening
    the category peels these cards off the stack and flips them open.

    `out` — the events are currently LIFTED into the category view: the
    stack renders as a held ghost (layout kept — the cards are physically
    away at the view; they fly back onto this exact spot on close).
  -->
  <div class="con-played__pile con-played__pile--events" :class="{'con-played__pile--reserved': reserved}" :style="{width: slotW + 'px'}">
    <div class="con-played__slot con-played__slot--events"
         :class="{'con-played__slot--focused': focused, 'con-played__slot--events-out': out}"
         :style="{height: cardH + 'px'}">
      <div class="con-played__lift">
        <div class="con-played__backstack con-played__focusbox" :style="{height: cardH + 'px'}">
          <div v-if="count > 2" class="con-card-back con-played__back con-played__back--3" aria-hidden="true"></div>
          <div v-if="count > 1" class="con-card-back con-played__back con-played__back--2" aria-hidden="true"></div>
          <div class="con-card-back con-played__back con-played__back--1" aria-hidden="true"></div>
          <span class="con-played__events-count">{{ count }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

export default defineComponent({
  name: 'ConsolePlayedEventsPile',
  props: {
    count: {type: Number, required: true},
    focused: {type: Boolean, required: true},
    slotW: {type: Number, required: true},
    cardH: {type: Number, required: true},
    /** Hero scene, FIRST-ever event: the pile exists as hidden geometry (the
     *  landing target) and turns visible with the reveal. */
    reserved: {type: Boolean, default: false},
    /** The events are away in the category view — the stack holds as ghost. */
    out: {type: Boolean, default: false},
  },
});
</script>
