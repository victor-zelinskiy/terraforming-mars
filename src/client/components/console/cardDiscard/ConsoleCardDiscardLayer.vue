<template>
  <!--
    CARD DISCARD LAYER — the fixed stage of the ONE "a card physically leaves
    the hand" cinematic (consoleCardDiscard.ts / discardDirector.ts).

    Two objects only: the travelling cards and the pile they land on. Each
    flyer is the shared deal flip chassis — it departs the hand FACE UP (the
    card the player chose, still readable) and turns to its BACK across the
    throw, because a discarded card stops being yours. The pile is the same
    material as the deck-draw discard tray: this is the same place, reached
    from the other side.

    Pointer-inert and clipped — a flight can never create scrollable overflow.
    All motion lives in the director; this file owns no timings.
  -->
  <div v-if="cardDiscardState.live" class="con-discard" aria-hidden="true">
    <!-- The pile. Present from the hand-off beat until the scene settles.
         A COLONY-BONUS discard belongs to the colony RESOLUTION, so its tray
         teleports into the workspace's own «СБРОШЕНО» seat — the mandatory
         cost lands inside the scene that earned it, never at the generic
         board-level corner. The seat renders for the resolution's whole span
         (the focus stage owns it), so the target exists before the tray does. -->
    <Teleport :to="workspaceSeat ?? 'body'" :disabled="workspaceSeat === undefined">
      <div v-if="cardDiscardState.trayVisible" class="con-discard__tray"
           :class="{
             'con-discard__tray--armed': cardDiscardState.trayArmed,
             'con-discard__tray--seated': workspaceSeat !== undefined,
           }">
        <div class="con-discard__pile"
             :class="{
               'con-discard__pile--empty': cardDiscardState.trayCount === 0,
               'con-discard__pile--armed': cardDiscardState.trayArmed,
               'con-discard__pile--pulse': pulsing,
             }">
          <div v-for="n in backs" :key="n"
               class="con-card-back con-discard__back"
               :class="`con-discard__back--${n}`"></div>
          <div class="con-discard__slot" ref="slot"></div>
        </div>
        <div class="con-discard__meta">
          <span class="con-discard__label">{{ $t('DISCARDED') }}</span>
          <span class="con-discard__count">{{ cardDiscardState.trayCount }}</span>
        </div>
      </div>
    </Teleport>

    <!-- One flyer per discarded card. -->
    <div v-for="f in cardDiscardState.flights" :key="f.id"
         class="con-deal-proxy con-discard-proxy"
         :style="{zIndex: f.z}"
         :ref="(el) => registerDiscardEl(f.id, el as HTMLElement | null)">
      <div class="con-deal-proxy__flip">
        <div class="con-deal-proxy__face">
          <ConsoleCardFaceLite :name="f.name" />
        </div>
        <div class="con-deal-proxy__back">
          <div class="con-card-back con-card-back--flyer"></div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {
  cardDiscardState,
  registerDiscardEl,
  registerDiscardTrayEl,
} from '@/client/console/cardDiscard/cardDiscardState';
import {discardPileBacks} from '@/client/console/cardDiscard/discardModel';
import {cardDiscardColonyBonus} from '@/client/console/cardDiscard/consoleCardDiscard';
import {colonyFocusState} from '@/client/console/consoleColoniesModel';
import {workspaceFrameMounted} from '@/client/console/consoleWorkspaceStack';
import ConsoleCardFaceLite from '@/client/components/console/cardDeal/ConsoleCardFaceLite.vue';

export default defineComponent({
  name: 'ConsoleCardDiscardLayer',
  components: {ConsoleCardFaceLite},
  data() {
    return {
      cardDiscardState,
      /** The focus-stage flow state (mirrors the seat's own render guard). */
      colonyFocusState,
      /** One-shot pulse of the pile on each physical landing. */
      pulsing: false,
      pulseTimer: undefined as ReturnType<typeof setTimeout> | undefined,
    };
  },
  computed: {
    /** Thickness caps at three backs; the count carries the rest. */
    backs(): number {
      return discardPileBacks(cardDiscardState.trayCount);
    },
    /**
     * The COLONY workspace's «СБРОШЕНО» seat, when this discard closes a
     * colony bonus and the focus stage (which renders the seat) is standing.
     * The same reactive terms the stage's own `v-if` reads, so the target
     * exists whenever this resolves — a collapsed workspace falls back to
     * the stock corner tray.
     */
    workspaceSeat(): string | undefined {
      const seated = cardDiscardColonyBonus() !== undefined &&
        workspaceFrameMounted('colonies') && this.colonyFocusState.open;
      return seated ? '[data-colony-discard-tray]' : undefined;
    },
  },
  watch: {
    // The nonce (not the count) drives the pulse: a landing must replay it even
    // when the count is re-rendered for another reason.
    'cardDiscardState.trayPulseNonce'(nonce: number): void {
      if (nonce === 0) {
        return;
      }
      this.pulsing = false;
      void this.$nextTick(() => {
        this.pulsing = true;
        clearTimeout(this.pulseTimer);
        this.pulseTimer = setTimeout(() => {
          this.pulsing = false;
        }, 400);
      });
    },
    /** The director measures the slot, so it must be registered as it mounts. */
    'cardDiscardState.trayVisible'(visible: boolean): void {
      if (!visible) {
        registerDiscardTrayEl(null);
        return;
      }
      void this.$nextTick(() => {
        registerDiscardTrayEl((this.$refs.slot as HTMLElement | undefined) ?? null);
      });
    },
  },
  beforeUnmount() {
    clearTimeout(this.pulseTimer);
    registerDiscardTrayEl(null);
  },
  methods: {
    registerDiscardEl,
  },
});
</script>
