<template>
  <div class="con-stdp" role="dialog" :aria-label="$t('Standard Projects')">
    <div class="con-stdp__backdrop" aria-hidden="true"></div>
    <div class="con-stdp__panel">
      <!-- Identity band: emblem + title + the viewer's wallet with a live
           before → after preview for the FOCUSED project's price. -->
      <div class="con-stdp__head">
        <div class="con-stdp__emblem" aria-hidden="true"><BarButtonIcon name="standard-projects" class="con-stdp__emblem-icon" /></div>
        <div class="con-stdp__title">{{ $t('Standard Projects') }}</div>
        <div class="con-stdp__wallet" :class="{'con-stdp__wallet--short': focusedShort > 0}">
          <span class="con-stdp__wallet-label">{{ $t('You have') }}</span>
          <span class="con-stdp__wallet-now"><b>{{ myMegacredits }}</b><i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i></span>
          <template v-if="focusedCost !== undefined">
            <span class="con-stdp__wallet-price">−{{ focusedCost }}</span>
            <span v-if="focusedShort === 0" class="con-stdp__wallet-after">→ <b>{{ myMegacredits - focusedCost }}</b></span>
            <span v-else class="con-stdp__wallet-shortfall">{{ shortfallText }}</span>
          </template>
        </div>
      </div>

      <!-- The dashboard: a 2-column grid — every basic action is a focusable
           card (Patent sale included, Steam-version parity); a disabled card
           still explains itself via the footer context. -->
      <div class="con-stdp__grid con-info__scroll" ref="grid">
        <article v-for="(it, i) in items" :key="it.key"
                 class="con-stdp__card"
                 :class="{
                   'con-stdp__card--focused': i === index,
                   'con-stdp__card--go': it.available,
                   'con-stdp__card--off': !it.available,
                 }"
                 :ref="i === index ? 'focusedCard' : undefined">
          <span v-if="it.available" class="con-stdp__rail" aria-hidden="true"></span>
          <div class="con-stdp__stage" aria-hidden="true">
            <i class="con-stdp__icon" :class="it.iconClass"></i>
          </div>
          <div class="con-stdp__body">
            <div class="con-stdp__name">{{ $t(it.title) }}</div>
            <div class="con-stdp__desc">{{ $t(it.description) }}</div>
          </div>
          <div class="con-stdp__status">
            <span v-if="it.cost !== undefined" class="con-stdp__cost" :class="{'con-stdp__cost--short': it.available === false && it.cost > myMegacredits}">
              <b>{{ it.cost }}</b><i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
            </span>
            <span v-else-if="it.gain !== undefined" class="con-stdp__gain">
              <b>{{ it.gain }}</b><i class="resource_icon resource_icon--megacredits" aria-hidden="true"></i>
              <span class="con-stdp__gain-note">/ {{ $t('card') }}</span>
            </span>
            <span v-if="it.available" class="con-stdp__btn" :class="{'con-stdp__btn--focus': i === index}">
              <GamepadGlyph control="confirm" />
              <span>{{ $t(it.key === 'sell-patents' ? 'Sell' : 'Select') }}</span>
            </span>
          </div>
        </article>
      </div>

      <!-- Footer: the FOCUSED item's one-line context + controller hints. -->
      <div class="con-stdp__foot">
        <div class="con-stdp__context" :class="contextClass">
          <span v-if="focused !== undefined && !focused.available">{{ focusedReason }}</span>
          <span v-else-if="focused !== undefined" class="con-stdp__context-ready">{{ $t('Ready to use now') }}</span>
        </div>
        <div class="con-stdp__hints">
          <span class="con-stdp__hint"><GamepadGlyph control="dpad" /><span>{{ $t('Navigate') }}</span></span>
          <span class="con-stdp__hint" :class="{'con-stdp__hint--off': focused?.available !== true}">
            <GamepadGlyph control="confirm" /><span>{{ $t('Select') }}</span>
          </span>
          <span class="con-stdp__hint"><GamepadGlyph control="back" /><span>{{ $t(backLabel) }}</span></span>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
/**
 * P27 — the console-native STANDARD PROJECTS premium screen (the rewrite of
 * the generic bottom-sheet rows): the whole basic-actions family on one
 * dashboard — every server std project + PATENT SALE as a first-class entry
 * (the Steam-version framing), clear costs, expected results, honest
 * disabled reasons (M€ deficit named), the wallet preview for the focused
 * price. PURE derivation lives in consoleQuickModel.buildStdProjectItems;
 * input handling (grid nav / A / B) stays in ConsoleShell, like every sheet.
 */
import {defineComponent, PropType} from 'vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import BarButtonIcon from '@/client/components/overview/BarButtonIcon.vue';
import {translateTextWithParams, translateText} from '@/client/directives/i18n';
import {StdProjectItem} from '@/client/console/consoleQuickModel';

export default defineComponent({
  name: 'ConsoleStdProjectsScreen',
  components: {GamepadGlyph, BarButtonIcon},
  props: {
    items: {type: Array as PropType<ReadonlyArray<StdProjectItem>>, required: true},
    index: {type: Number, required: true},
    myMegacredits: {type: Number, required: true},
    /** B semantics differ for the MANDATORY std-project prompt (Minimize). */
    backLabel: {type: String, default: 'Close'},
  },
  computed: {
    focused(): StdProjectItem | undefined {
      return this.items[this.index];
    },
    focusedCost(): number | undefined {
      return this.focused?.cost;
    },
    focusedShort(): number {
      const cost = this.focusedCost;
      if (cost === undefined) {
        return 0;
      }
      return Math.max(0, cost - this.myMegacredits);
    },
    shortfallText(): string {
      return translateTextWithParams('Need ${0} more M€', [String(this.focusedShort)]);
    },
    focusedReason(): string {
      const f = this.focused;
      if (f === undefined || f.reason === '') {
        return '';
      }
      return f.reasonParams !== undefined ?
        translateTextWithParams(f.reason, [...f.reasonParams]) :
        translateText(f.reason);
    },
    contextClass(): string {
      if (this.focused === undefined) {
        return '';
      }
      return this.focused.available ? 'con-stdp__context--ready' : 'con-stdp__context--blocked';
    },
  },
  watch: {
    /** Overflow is a fallback — keep the focus visible there. */
    index() {
      void this.$nextTick(() => {
        const slot = this.$refs.focusedCard as HTMLElement | Array<HTMLElement> | undefined;
        const el = Array.isArray(slot) ? slot[0] : slot;
        el?.scrollIntoView({block: 'nearest', behavior: 'smooth'});
      });
    },
  },
});
</script>
