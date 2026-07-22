<template>
  <div class="con-inspect-side con-zoom-rules-host" :class="{'con-zoom-rules-host--closing': closing}">
    <aside class="con-inspect-side__box">
      <!-- ── The ONE tab bar (replaces each panel's own head) ─────────── -->
      <div class="con-inspect-side__tabs" role="tablist">
        <span class="con-inspect-side__tab-key" aria-hidden="true"><GamepadGlyph control="bumperL" /></span>
        <button type="button" class="con-inspect-side__tab"
                :class="{'con-inspect-side__tab--active': tab === 'rules'}"
                role="tab" :aria-selected="tab === 'rules'">
          <span class="con-inspect-side__tab-mark" aria-hidden="true">§</span>
          <span>{{ $t('Card rules') }}</span>
        </button>
        <button type="button" class="con-inspect-side__tab"
                :class="{'con-inspect-side__tab--active': tab === 'history'}"
                role="tab" :aria-selected="tab === 'history'">
          <span class="con-inspect-side__tab-mark" aria-hidden="true">◷</span>
          <span>{{ $t('History') }}</span>
        </button>
        <span class="con-inspect-side__tab-key" aria-hidden="true"><GamepadGlyph control="bumperR" /></span>
      </div>

      <!-- ── The body — only the content crossfades; the box + card are
           stable (the brief: a page swap, not a new modal). ──────────── -->
      <div class="con-inspect-side__content">
        <transition :name="reduced ? '' : 'con-inspect-swap'" mode="out-in">
          <ConsoleCardRulesPanel v-if="tab === 'rules'"
                                 key="rules"
                                 embedded
                                 :cardName="cardName"
                                 :nonce="nonce"
                                 :closing="closing" />
          <ConsoleCardHistoryPanel v-else key="history" :history="history" />
        </transition>
      </div>
    </aside>
  </div>
</template>

<script lang="ts">
/**
 * CONSOLE fullscreen-card INSPECT DOSSIER — the two-tab right panel of the
 * card viewer's inspect mode (the Action Browser's X-inspect). ONE stable
 * glass box hosting a ПРАВИЛА ⇄ ИСТОРИЯ tab bar; LB/RB (owned by the shell)
 * switch `tab`, only the BODY content crossfades — the big card, the backdrop
 * and the box geometry never move (a page swap of a dossier, never a new
 * modal). Reduced motion drops the swap to an instant content change.
 *
 * It reuses `ConsoleCardRulesPanel` (in `embedded` mode — its own head + glass
 * chrome yield to this box) and `ConsoleCardHistoryPanel`; the tab STATE lives
 * in `consoleCardZoom.inspectTab` (module state, driven by the shell), so this
 * component is a pure presentation of it.
 */
import {defineComponent, PropType} from 'vue';
import {CardName} from '@/common/cards/CardName';
import {ActionInspectHistory} from '@/client/components/actions/actionInspectHistory';
import {ConsoleZoomInspectTab} from '@/client/console/consoleCardZoom';
import {consoleReducedMotionActive} from '@/client/console/composables/useConsoleReducedMotion';
import ConsoleCardRulesPanel from '@/client/components/console/ConsoleCardRulesPanel.vue';
import ConsoleCardHistoryPanel from '@/client/components/console/ConsoleCardHistoryPanel.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';

export default defineComponent({
  name: 'ConsoleInspectSide',
  components: {ConsoleCardRulesPanel, ConsoleCardHistoryPanel, GamepadGlyph},
  props: {
    cardName: {type: String as PropType<CardName>, required: true},
    history: {type: Object as PropType<ActionInspectHistory>, required: true},
    tab: {type: String as PropType<ConsoleZoomInspectTab>, required: true},
    /** The viewer's settle signal (forwarded to the rules panel's measure). */
    nonce: {type: Number, default: 0},
    /** The close flight began — hide instantly (never lag the card). */
    closing: {type: Boolean, default: false},
  },
  computed: {
    reduced(): boolean {
      return consoleReducedMotionActive();
    },
  },
});
</script>
