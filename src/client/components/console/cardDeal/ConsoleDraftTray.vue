<template>
  <!--
    THE DRAFT TRAY — the ONE persistent "selected cards area" of the draft
    (top-centre, ON THE TABLE, under the task modal). Picked cards fly
    hero-style INTO its slots (consoleDraftTray.ts owns the beats); during
    the wait it hosts the calm banner; at the draft→research transition
    the whole pile RISES into the research row.

    Pointer-inert (the pad grammar lives in the shell / task host). Slots
    carry `data-tray-slot` — the flight directors land on them; a HELD slot
    (proxy still flying above) hides via the shared `.con-deal-hold` rule,
    Vue-managed (patch-proof), and reveals on the slot's own 160ms fade.
  -->
  <div class="con-drafttray"
       :class="{'con-drafttray--table': tableView}"
       role="status">
    <!-- The PILE is the tray's anchor and renders FIRST: flight targets are
         measured off its slots, and the wait/processing captions mount
         BELOW it — nothing can shift a slot under a mid-flight proxy. -->
    <div v-if="entries.length > 0"
         class="con-drafttray__pile"
         :class="{'con-drafttray__pile--pulse': pulsing, 'con-drafttray__pile--complete': setComplete}">
      <div class="con-drafttray__head">
        <span class="con-drafttray__label">{{ $t(setComplete ? 'Draft set complete' : 'DRAFTED CARDS') }}</span>
        <span class="con-drafttray__count">{{ entries.length }}</span>
        <span v-if="waiting" class="con-drafttray__hint"><GamepadGlyph control="secondary" /><span>{{ $t('Inspect') }}</span></span>
      </div>
      <div class="con-drafttray__stack" :class="{'con-drafttray__stack--dense': entries.length > 6}">
        <div v-for="(entry, idx) in entries" :key="entry.name + '-' + idx"
             class="con-drafttray__slot"
             :style="{zIndex: idx + 1}"
             :class="{'con-deal-hold': isHeld(entry.name)}"
             :data-tray-slot="entry.name">
          <Card :card="entry.card" :key="entry.name" lightweight />
        </div>
      </div>
    </div>

    <!-- The calm wait banner (the draftWait serving surface — leak detector). -->
    <div v-if="waiting" class="con-draftwait">
      <span class="con-draftwait__pulse" aria-hidden="true"></span>
      <span class="con-draftwait__text">
        <span class="con-draftwait__title">{{ $t('Waiting for draft cards') }}</span>
        <span class="con-draftwait__sub">{{ $t('Your pick is locked — waiting for the other players.') }}</span>
      </span>
    </div>
    <!-- The honest slow-server readout after a landed pick. -->
    <div v-else-if="processing" class="con-drafttray__processing">
      <span class="con-draftwait__pulse" aria-hidden="true"></span>
      <span>{{ $t('Processing selection…') }}</span>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import Card from '@/client/components/card/Card.vue';
import GamepadGlyph from '@/client/components/gamepad/GamepadGlyph.vue';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {CardModel} from '@/common/models/CardModel';
import {CardName} from '@/common/cards/CardName';
import {consoleMotionMs} from '@/client/console/composables/useConsoleReducedMotion';
import {
  draftTrayState, isTraySlotHeld, registerTraySlotResolver, trayDisplayCards,
} from '@/client/console/cardDeal/consoleDraftTray';

export default defineComponent({
  name: 'ConsoleDraftTray',
  components: {Card, GamepadGlyph},
  props: {
    playerView: {type: Object as PropType<PlayerViewModel>, required: true},
    /** The optional-repick wait state (the shell's draftWaitActive). */
    waiting: {type: Boolean, default: false},
  },
  data() {
    return {
      draftTrayState,
      pulsing: false,
      pulseTimer: undefined as number | undefined,
    };
  },
  computed: {
    serverDrafted(): ReadonlyArray<CardModel> {
      return this.playerView.draftedCards ?? [];
    },
    /** The rendered pile: the frozen scene snapshot, else server + optimistic.
     *  Server models are preferred (cost badges etc.); an optimistic /
     *  scene-frozen name degrades to a bare manifest render. */
    entries(): Array<{name: CardName, card: CardModel | {name: CardName}}> {
      const names = trayDisplayCards(this.serverDrafted.map((c) => c.name));
      return names.map((name) => ({
        name,
        card: this.serverDrafted.find((c) => c.name === name) ?? {name},
      }));
    },
    processing(): boolean {
      return draftTrayState.processing;
    },
    setComplete(): boolean {
      return draftTrayState.setComplete;
    },
    tableView(): boolean {
      return draftTrayState.tableView;
    },
  },
  watch: {
    /** One-shot pile pulse per landing / set-complete beat. */
    'draftTrayState.pulseNonce'() {
      if (this.pulseTimer !== undefined) {
        window.clearTimeout(this.pulseTimer);
      }
      this.pulsing = false;
      void this.$nextTick(() => {
        this.pulsing = true;
        this.pulseTimer = window.setTimeout(() => {
          this.pulsing = false;
          this.pulseTimer = undefined;
        }, consoleMotionMs(260));
      });
    },
  },
  mounted() {
    registerTraySlotResolver((name) => this.resolveSlot(name));
  },
  beforeUnmount() {
    registerTraySlotResolver(undefined);
    if (this.pulseTimer !== undefined) {
      window.clearTimeout(this.pulseTimer);
    }
  },
  methods: {
    isHeld(name: CardName): boolean {
      return isTraySlotHeld(name);
    },
    resolveSlot(name: CardName): HTMLElement | null {
      const root = this.$el as HTMLElement | undefined;
      if (root === undefined || root === null || typeof root.querySelector !== 'function') {
        return null;
      }
      const esc = typeof CSS !== 'undefined' && typeof CSS.escape === 'function' ? CSS.escape(name) : name.replace(/"/g, '\\"');
      return root.querySelector<HTMLElement>(`[data-tray-slot="${esc}"]`);
    },
  },
});
</script>
