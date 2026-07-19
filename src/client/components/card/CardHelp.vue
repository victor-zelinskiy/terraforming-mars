<template>
  <div class="card-help" v-show="hovering" @click.stop="open"><a>?</a></div>
  <Teleport to="body">
    <PopupPanel v-if="showPopup" @close="close">
      <template v-slot:header>
        <h2>{{ name }}</h2>
      </template>
      <div class="card-help-text" v-html="renderedHelpText"></div>
    </PopupPanel>
  </Teleport>
</template>

<script lang="ts">

import {defineComponent} from 'vue';
import type MarkdownItType from 'markdown-it';
import {CardName} from '@/common/cards/CardName';
import {CARD_HELP_TEXT} from '@/client/cards/CardHelpText';
import PopupPanel from '@/client/components/common/PopupPanel.vue';

// BND-1 (docs/PERFORMANCE_AUDIT.md): markdown-it is used ONLY to render this
// click-triggered card-help popup. Load it lazily (its own async chunk — see
// the `markdownit` splitChunks cacheGroup) so it isn't parsed eagerly in
// vendors.js by every session that never opens a card help. Instance cached
// across all CardHelp components.
let mdPromise: Promise<MarkdownItType> | undefined;
function loadMarkdown(): Promise<MarkdownItType> {
  if (mdPromise === undefined) {
    mdPromise = import(/* webpackChunkName: "markdownit" */ 'markdown-it').then(({default: MarkdownIt}) =>
      new MarkdownIt({html: true, linkify: false, breaks: false}));
  }
  return mdPromise;
}

export default defineComponent({
  name: 'CardHelp',
  components: {
    PopupPanel,
  },
  props: {
    name: {
      type: String as () => CardName,
      required: true,
    },
    hovering: {
      type: Boolean,
      required: false,
      default: false,
    },
  },
  data() {
    return {
      showPopup: false,
      renderedHelpText: '',
    };
  },
  methods: {
    async open() {
      // Show the panel immediately, then fill it once markdown-it's chunk lands
      // (near-instant after the first open — the instance is cached).
      this.renderedHelpText = '';
      this.showPopup = true;
      const md = await loadMarkdown();
      this.renderedHelpText = md.render(CARD_HELP_TEXT[this.name] ?? '');
    },
    close() {
      this.showPopup = false;
    },
  },
});

</script>
