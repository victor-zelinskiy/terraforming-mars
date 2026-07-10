<template>
  <div class="con-scroll-area" :class="rootClasses">
    <div ref="viewport" class="con-scroll-area__viewport" @scroll.passive="onScroll">
      <div ref="content" class="con-scroll-area__content" :class="contentClass">
        <slot />
      </div>
    </div>
    <div v-if="indicator && overflowing" class="con-scroll-area__rail" aria-hidden="true">
      <div class="con-scroll-area__thumb" :style="thumbStyle"></div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * ConsoleScrollArea — THE controlled scroll primitive of the console-native
 * UI (foundation layer; CONSOLE_FOUNDATION.md §3.3).
 *
 * The overflow policy is: the PAGE never scrolls (html.console-native locks
 * it), panel shells clip (`overflow: hidden`), and the ONLY place content
 * may scroll is inside this component. Native scrollbar chrome never shows
 * (P17 — a visible bar is a desktop smell on a couch screen); when the
 * content genuinely overflows, a slim custom progress rail appears instead.
 *
 * Pad integration: the host's intent handler drives it imperatively —
 * `ensureVisible(el)` after a cursor move (keeps the cursored row inside the
 * viewport with a margin), `scrollByPx(dy)` from right-stick scroll intents.
 * Both are exposed via the component ref.
 *
 * VueUse: `useResizeObserver` on viewport + content keeps the overflow
 * state / thumb geometry honest through async content (fonts, art, filter
 * changes) without manual listeners; scroll position rides the passive
 * scroll event. All measurement work is rAF-coalesced.
 */
import {defineComponent, ref, computed, CSSProperties} from 'vue';
import {useResizeObserver} from '@vueuse/core';

export default defineComponent({
  name: 'ConsoleScrollArea',
  props: {
    /** Scroll axis. The cross axis is always clipped (overflow bugs stay visible in dev via the guard). */
    axis: {type: String as () => 'y' | 'x', default: 'y'},
    /** Show the custom progress rail while overflowing. */
    indicator: {type: Boolean, default: true},
    /**
     * Class(es) for the CONTENT wrapper — lets the host's existing layout
     * class (flex column / grid) apply to the element that actually holds
     * the slot, so migrating a legacy `overflow-y: auto` container is a
     * markup-only change.
     */
    contentClass: {type: String, default: ''},
    /**
     * Stretch the content wrapper to at least the viewport height (`fill`)
     * — needed by layouts that pin a block to the bottom via
     * `margin-top: auto` when the content is SHORTER than the viewport.
     */
    fill: {type: Boolean, default: false},
  },
  emits: {
    /** Fires when content starts/stops overflowing the viewport. */
    'overflow-change': (_overflowing: boolean) => true,
  },
  setup(props, {emit, expose}) {
    const viewport = ref<HTMLElement>();
    const content = ref<HTMLElement>();
    const overflowing = ref(false);
    /** 0..1 scroll progress + viewport/content ratio for the thumb. */
    const progress = ref(0);
    const ratio = ref(1);

    let measurePending = false;
    const measure = (): void => {
      if (measurePending) {
        return;
      }
      measurePending = true;
      requestAnimationFrame(() => {
        measurePending = false;
        const vp = viewport.value;
        if (vp === undefined) {
          return;
        }
        const size = props.axis === 'y' ? vp.clientHeight : vp.clientWidth;
        const total = props.axis === 'y' ? vp.scrollHeight : vp.scrollWidth;
        const pos = props.axis === 'y' ? vp.scrollTop : vp.scrollLeft;
        const max = Math.max(0, total - size);
        const was = overflowing.value;
        overflowing.value = max > 1;
        ratio.value = total > 0 ? Math.max(0.1, Math.min(1, size / total)) : 1;
        progress.value = max > 0 ? Math.min(1, Math.max(0, pos / max)) : 0;
        if (was !== overflowing.value) {
          emit('overflow-change', overflowing.value);
        }
      });
    };

    useResizeObserver(viewport, measure);
    useResizeObserver(content, measure);

    const onScroll = (): void => measure();

    const thumbStyle = computed<CSSProperties>(() => {
      const len = ratio.value * 100;
      const offset = progress.value * (100 - len);
      return props.axis === 'y' ?
        {height: `${len}%`, top: `${offset}%`} :
        {width: `${len}%`, left: `${offset}%`};
    });

    const rootClasses = computed(() => ({
      'con-scroll-area--x': props.axis === 'x',
      'con-scroll-area--fill': props.fill,
      'con-scroll-area--overflowing': overflowing.value,
    }));

    /** Scroll by a pixel delta (right-stick / trigger paging). */
    const scrollByPx = (delta: number): void => {
      const vp = viewport.value;
      if (vp === undefined) {
        return;
      }
      if (props.axis === 'y') {
        vp.scrollTop += delta;
      } else {
        vp.scrollLeft += delta;
      }
      measure();
    };

    const scrollToStart = (): void => {
      const vp = viewport.value;
      if (vp === undefined) {
        return;
      }
      vp.scrollTop = 0;
      vp.scrollLeft = 0;
      measure();
    };

    /**
     * Keep an element (the cursored row) inside the viewport with a margin.
     * Manual math on THIS viewport only — never scrollIntoView, which may
     * walk into outer containers.
     */
    const ensureVisible = (el: Element | null | undefined, margin: number = 12): void => {
      const vp = viewport.value;
      if (vp === undefined || el === null || el === undefined) {
        return;
      }
      const er = el.getBoundingClientRect();
      const vr = vp.getBoundingClientRect();
      if (props.axis === 'y') {
        if (er.top < vr.top + margin) {
          vp.scrollTop += er.top - (vr.top + margin);
        } else if (er.bottom > vr.bottom - margin) {
          vp.scrollTop += er.bottom - (vr.bottom - margin);
        }
      } else {
        if (er.left < vr.left + margin) {
          vp.scrollLeft += er.left - (vr.left + margin);
        } else if (er.right > vr.right - margin) {
          vp.scrollLeft += er.right - (vr.right - margin);
        }
      }
      measure();
    };

    expose({scrollByPx, scrollToStart, ensureVisible, measure});

    return {viewport, content, overflowing, thumbStyle, rootClasses, onScroll};
  },
});
</script>
