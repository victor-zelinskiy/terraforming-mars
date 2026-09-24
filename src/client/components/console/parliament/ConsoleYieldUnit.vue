<template>
  <!--
    ONE UNIT ICON of a yield — or ONE unit of SEVERAL KINDS (Medical Database's
    «data or microbe»): the icons joined by the word «or», drawn as one unit in
    one place, never as two lines. A single kind renders the very `<i>` the
    block always printed (no wrapper, so the sibling and descendant selectors
    of every host — the result slot, the suffix, the levy head — keep matching).
    The classes arrive resolved (`iconClassFor` families); this draws, only.
  -->
  <i v-if="classes.length <= 1" class="con-iyield__unit" :class="[classes[0] ?? '', extra]" aria-hidden="true"></i>
  <template v-else>
    <template v-for="(cls, k) in classes" :key="k">
      <small v-if="k > 0" class="con-iyield__or" aria-hidden="true">{{ $t('or') }}</small>
      <i class="con-iyield__unit" :class="[cls, extra]" aria-hidden="true" :data-yield-unit-kind="k"></i>
    </template>
  </template>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';

export default defineComponent({
  name: 'ConsoleYieldUnit',
  inheritAttrs: false,
  props: {
    /** The resolved icon classes — one per kind of the unit (one for every ordinary unit). */
    classes: {type: Array as PropType<ReadonlyArray<string>>, required: true},
    /** A host's extra class on every icon (the suffix's, a term's). */
    extra: {type: String, default: ''},
  },
});
</script>
