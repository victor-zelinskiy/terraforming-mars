<template>
  <span class="con-ptsel__tag-line" :class="{'con-ptsel__tag-line--stacked': stacked}">
    <!-- THE OUTCOME TAG (PL-219) — what the N do on ONE candidate, in glyphs and digits: the count it moves first
         («[мех] 0 → 3», TR56 П4), then its consequence after a dot (a role's money, a priced good, the VP). ONE renderer
         for every host that shows it — under each card of the target step, beside the answered row's miniature — so
         the step and the row it answers can never read the same candidate two ways. The host owns the outer box (its
         reserved row, its tone class); this is the line's content. STACKED (a host whose cell is narrower than the
         whole line — the target step): the count on one line, its consequence under it, no dot between. -->
    <span v-if="tag.lead !== undefined" class="con-ptsel__tag-lead" data-ptsel-tag-lead>
      <i v-if="tag.lead.icon !== undefined" class="con-ptsel__tag-icon" :class="iconClass(tag.lead.icon)" aria-hidden="true"></i>
      <b class="con-ptsel__tag-num">{{ tag.lead.text }}</b>
      <span v-if="!stacked" class="con-ptsel__tag-sep" aria-hidden="true">·</span>
    </span>
    <span class="con-ptsel__tag-out">
      <!-- A CHOICE of goods at one price (PL-484): every good, in the printed order, joined by the choice's «/». -->
      <template v-if="tag.icons !== undefined">
        <template v-for="(icon, i) in tag.icons" :key="'c' + i">
          <span v-if="i > 0" class="con-ptsel__tag-sep" aria-hidden="true">{{ tag.join === 'and' ? '+' : '/' }}</span>
          <i class="con-ptsel__tag-icon" :class="[iconClass(icon), {'con-ptsel__tag-icon--production': (tag.plates?.[i] ?? tag.plate) === 'production'}]"
             :data-ptsel-choice-icon="icon" aria-hidden="true"></i>
        </template>
      </template>
      <i v-else-if="tag.icon !== undefined" class="con-ptsel__tag-icon"
         :class="[iconClass(tag.icon), {'con-ptsel__tag-icon--production': tag.plate === 'production'}]"
         aria-hidden="true"></i>
      <span v-if="tag.word !== undefined" class="con-ptsel__tag-word">{{ $t(tag.word) }}</span>
      <b v-if="tag.text !== ''" class="con-ptsel__tag-num">{{ tag.text }}</b>
      <TagGlyph v-if="tag.payTag !== undefined" class="con-ptsel__tag-pay" :tag="tag.payTag" size="big" type="secondary" />
      <span v-if="tag.reached === true" class="con-ptsel__tag-check" aria-hidden="true">✓</span>
      <!-- WHAT ELSE this candidate gives (TR53 — the server's `extraByCard`): «· [card] +1», or the glyph struck when the
           server names a zero (science draws nothing). -->
      <span v-for="(x, k) in tag.extra ?? []" :key="'x' + k" class="con-ptsel__tag-extra"
            :class="{'con-ptsel__tag-extra--none': x.none === true}" :data-ptsel-extra="x.none === true ? 'none' : x.icon">
        <span class="con-ptsel__tag-sep" aria-hidden="true">·</span>
        <i class="con-ptsel__tag-icon" :class="iconClass(x.icon)" aria-hidden="true"></i>
        <b v-if="x.text !== ''" class="con-ptsel__tag-num">{{ x.text }}</b>
      </span>
    </span>
  </span>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import TagGlyph from '@/client/components/Tag.vue';
import {iconClassFor} from '@/client/components/modalInputs/optionIcons';
import {PlayedTargetTag} from '@/client/console/played/consolePlayedTargetModel';

export default defineComponent({
  name: 'ConsolePlayedTargetTag',
  components: {TagGlyph},
  props: {
    tag: {type: Object as PropType<PlayedTargetTag>, required: true},
    /** The count on its own line, the consequence under it (`playedTargetTagStacked`, the host's reserved two lines). */
    stacked: {type: Boolean, default: false},
  },
  methods: {
    iconClass(icon: string): string {
      return iconClassFor(icon);
    },
  },
});
</script>
