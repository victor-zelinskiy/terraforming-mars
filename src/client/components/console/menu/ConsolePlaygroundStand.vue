<template>
  <!--
    CONSOLE-NATIVE PLAYGROUND STAND — the fullscreen chassis every dev
    showcase renders inside. The showcase content itself stays a plain
    document (the premium-cards showcase is a long reference sheet, not a
    game surface); what makes it console-native lives HERE: the ONE
    ConsoleScrollArea (no native scrollbar — console rule), pad-driven
    scrolling, section jumps, and a foot bar that speaks glyphs, never
    button literals.

    Two hosts, one component:
     - the main-menu Playground hub (admin-only) forwards pad intents via
       `handleIntent` — the hub owns the pad while its overlay is up;
     - the `?premiumCardsPlayground` deep link (App) mounts it `standalone`,
       where it installs its own pre-game pad pipe (installMenuPad) and B
       exits to the main menu. The deep link stays because e2e/visual
       verification scripts drive the showcase by URL.
  -->
  <div class="cm-stand" role="dialog" :aria-label="$t(titleKey)">
    <div class="cm-stand__head">
      <span class="cm-stand__kicker">{{ $t('Playground') }}</span>
      <span class="cm-stand__title">{{ $t(titleKey) }}</span>
    </div>
    <ConsoleScrollArea ref="scroll" class="cm-stand__scroll">
      <div ref="body" class="cm-stand__body">
        <slot />
      </div>
    </ConsoleScrollArea>
    <div class="cm-stand__foot">
      <span class="cm-stand__hint"><GamepadGlyph control="stickR" />{{ $t('Scroll') }}</span>
      <span class="cm-stand__hint"><GamepadGlyph control="bumperL" /><GamepadGlyph control="bumperR" />{{ $t('Sections') }}</span>
      <span v-if="sectionTitle !== ''" class="cm-stand__section">{{ sectionTitle }}</span>
      <span class="cm-stand__hint cm-stand__hint--right"><GamepadGlyph control="back" />{{ $t('Back') }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {GamepadIntent} from '@/client/gamepad/gamepadPollModel';
import {consoleActionOf} from '@/client/console/composables/consoleActionModel';
import {installMenuPad} from '@/client/console/menu/consoleMenuPad';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import ConsoleScrollArea from '@/client/components/console/foundation/ConsoleScrollArea.vue';

/** One d-pad step / held-stick tick of scroll, in px. */
const SCROLL_STEP = 220;

export default defineComponent({
  name: 'ConsolePlaygroundStand',
  components: {GamepadGlyph, ConsoleScrollArea},
  props: {
    titleKey: {
      type: String,
      required: true,
    },
    /**
     * Deep-link mode (`?premiumCardsPlayground`): no hub above to forward
     * pad intents, so the stand claims the pre-game pad slot itself.
     */
    standalone: {
      type: Boolean,
      required: false,
      default: false,
    },
    /** What counts as a section header for LB/RB jumps (h2 by default;
     *  a showcase with its own header markup passes its selector). */
    sectionSelector: {
      type: String,
      required: false,
      default: 'h2',
    },
  },
  emits: ['close'],
  data() {
    return {
      offPad: undefined as (() => void) | undefined,
      /** Title of the section the viewport top currently sits in. */
      sectionTitle: '',
      sectionIdx: 0,
    };
  },
  mounted() {
    if (this.standalone) {
      this.offPad = installMenuPad((intent) => this.handleIntent(intent));
    }
    this.refreshSectionTitle();
  },
  beforeUnmount() {
    this.offPad?.();
  },
  methods: {
    /** Section anchors = the showcase's own headers — no registry to drift. */
    sections(): Array<HTMLElement> {
      const body = this.$refs.body as HTMLElement | undefined;
      return body === undefined ? [] : Array.from(body.querySelectorAll(this.sectionSelector));
    },
    scrollApi(): {scrollByPx: (dy: number) => void, ensureVisible: (el: Element | null, margin?: number) => void, scrollToStart: () => void} | undefined {
      return this.$refs.scroll as never;
    },
    jumpSection(dir: 1 | -1): void {
      const sections = this.sections();
      if (sections.length === 0) {
        return;
      }
      this.sectionIdx = Math.max(0, Math.min(sections.length - 1, this.sectionIdx + dir));
      const target = sections[this.sectionIdx];
      // Land the header at the viewport top. ConsoleScrollArea's contract
      // forbids scrollIntoView (it may walk into outer containers) — compute
      // the delta against the scroll area's own box and drive its API.
      const scrollEl = (this.$refs.scroll as {$el?: HTMLElement} | undefined)?.$el;
      if (scrollEl !== undefined) {
        const delta = target.getBoundingClientRect().top - scrollEl.getBoundingClientRect().top - 16;
        this.scrollApi()?.scrollByPx(delta);
      }
      this.sectionTitle = target.textContent?.trim() ?? '';
    },
    refreshSectionTitle(): void {
      const first = this.sections()[this.sectionIdx];
      this.sectionTitle = first?.textContent?.trim() ?? '';
    },
    handleIntent(intent: GamepadIntent): boolean {
      const action = consoleActionOf(intent);
      if (action === 'back') {
        this.$emit('close');
        return true;
      }
      if (intent.kind === 'nav' && (intent.dir === 'up' || intent.dir === 'down')) {
        this.scrollApi()?.scrollByPx(intent.dir === 'down' ? SCROLL_STEP : -SCROLL_STEP);
        return true;
      }
      if (intent.kind === 'scroll') {
        this.scrollApi()?.scrollByPx(intent.dy);
        return true;
      }
      if (intent.kind === 'press' && intent.button === 'bumperL') {
        this.jumpSection(-1);
        return true;
      }
      if (intent.kind === 'press' && intent.button === 'bumperR') {
        this.jumpSection(1);
        return true;
      }
      // Swallow everything else — nothing under the stand should react.
      return true;
    },
  },
});
</script>
