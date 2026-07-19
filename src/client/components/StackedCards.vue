<!--
@deprecated Desktop-only UI — FROZEN 2026-07-15. Do not develop further.
All UI work goes into console native (`?console=1`, ConsoleShell.vue); the next
desktop UI will be rebuilt from it. Unreachable from ConsoleShell, so changes
here cannot affect console. Fix only what breaks the shared layer or play.
See docs/DESKTOP_DEPRECATION_AUDIT.md + the deprecation banner in CLAUDE.md.
-->
<template>
    <div class="cardbox">
        <div v-for="(card, index) in cards" :key="card.name" :class="{'cards-stack':(index > 0),'cards-stack-first':(index === 0) }">
            <Card :card="card" />
        </div>
    </div>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import Card from '@/client/components/card/CardFace.vue';
import {CardModel} from '@/common/models/CardModel';

export default defineComponent({
  name: 'stacked-cards',
  props: {
    cards: {
      type: Array as () => ReadonlyArray<CardModel>,
      required: true,
    },
  },
  components: {
    Card,
  },
});

</script>

