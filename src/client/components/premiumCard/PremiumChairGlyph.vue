<template>
  <!--
    THE CHAIR — the ONE mark of the chairmanship (Turmoil Redux). A resolution's
    face prints it before its quest's condition INSTEAD of the words «задание
    председателя» (a caption repeated on every card), so the same drawing stands
    where the words do — the government's quest block and its reward chip — and
    the player learns the mark beside its name. The chairman's seat front on: a
    crowned back, arms, the seat, two legs; it stays a chair from 17 design px
    down. Coloured by `fill: currentColor` / the host's own rule.
  -->
  <svg class="pchair" viewBox="0 0 16 16" aria-hidden="true"><path :d="PATH" /></svg>
</template>

<script lang="ts">
import {defineComponent} from 'vue';

const PATH = 'M5 1h6a1.4 1.4 0 0 1 1.4 1.4V7h1.1a.9.9 0 0 1 .9.9v3.3H13V15h-1.7v-2.6H4.7V15H3v-3.8H1.6V7.9a.9.9 0 0 1 .9-.9h1.1V2.4A1.4 1.4 0 0 1 5 1Zm.3 1.7V9.2h5.4V2.7Z';

export default defineComponent({
  name: 'PremiumChairGlyph',
  data() {
    return {PATH};
  },
});
</script>
