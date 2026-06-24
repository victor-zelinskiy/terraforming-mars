<template>
  <Teleport to="body">
    <!--
      The handoff beam — a very thin light trace that runs from the previous
      active player's card to the new active player's card when the turn is
      handed off. Optional / decorative; never rendered under reduced-motion
      (the controller leaves `beam` undefined then). Pointer-events: none so it
      never blocks the panel or the board.
    -->
    <div
      v-if="beamStyle !== undefined"
      class="turn-handoff-beam"
      :style="beamStyle"
      aria-hidden="true">
      <span class="turn-handoff-beam__trace"></span>
    </div>

    <!--
      Anchored idle hint — a premium HUD tag ATTACHED to the active local
      player's card (to its RIGHT, level with the status chip, with a connector
      so it reads as part of the card HUD), NOT a toast over the player list.
      Shown ONLY when the local player gave NO input at all after their turn
      started (escalation step 2); no "OK" button — it vanishes on any input.
    -->
    <Transition name="turn-idle-hint">
      <div
        v-if="hintStyle !== undefined"
        class="turn-idle-anchor-hint"
        :style="hintStyle"
        role="status">
        <span class="turn-idle-anchor-hint__connector" aria-hidden="true"></span>
        <span class="turn-idle-anchor-hint__dot" aria-hidden="true"></span>
        <span class="turn-idle-anchor-hint__text" v-i18n>Choose an action</span>
      </div>
    </Transition>
  </Teleport>
</template>

<script lang="ts">
import {defineComponent, PropType} from 'vue';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  turnHandoffState,
  noteTurnState,
  installTurnInputTracking,
  uninstallTurnInputTracking,
  resetTurnHandoff,
} from '@/client/components/overview/turnHandoffState';

type BeamGeom = {top: number; left: number; height: number};

// Idle-hint pill height (keep in sync with `.turn-idle-anchor-hint` height in
// turn_handoff.less) — used to vertically centre the pill on the status chip.
const HINT_HEIGHT = 40;

type DataModel = {
  beamGeom: BeamGeom | undefined;
  lastBeamId: number | undefined;
  hintRect: {top: number; left: number} | undefined;
  reposTimer: number | undefined;
};

/**
 * TurnHandoffLayer — App-level driver for the TurnHandoff presentation. Mounted
 * as a sibling of <player-home> (like NotificationLayer) so it survives the
 * `:key="playerkey"` remount; reads `playerView` and feeds the controller in
 * `turnHandoffState`. Owns the window input listeners (inactivity tracking) and
 * renders the two body-teleported surfaces that can't live inside a player
 * card: the handoff beam and the anchored idle hint.
 *
 * It writes NO game state — purely presentation, fully reversible, and never
 * blocks modals / action selection / placement.
 */
export default defineComponent({
  name: 'TurnHandoffLayer',
  props: {
    playerView: {
      type: Object as PropType<PlayerViewModel>,
      required: true,
    },
  },
  data(): DataModel {
    return {
      beamGeom: undefined,
      lastBeamId: undefined,
      hintRect: undefined,
      reposTimer: undefined,
    };
  },
  computed: {
    owner(): Color | undefined {
      const game = this.playerView.game;
      if (game.phase !== Phase.ACTION) {
        return undefined;
      }
      return this.playerView.players.find((p) => p.isActive)?.color;
    },
    localColor(): Color | undefined {
      return this.playerView.thisPlayer?.color;
    },
    beam() {
      return turnHandoffState.beam;
    },
    idleHintActive(): boolean {
      return turnHandoffState.idleHintActive;
    },
    beamStyle(): Record<string, string> | undefined {
      if (this.beamGeom === undefined) {
        return undefined;
      }
      return {
        top: `${this.beamGeom.top}px`,
        left: `${this.beamGeom.left}px`,
        height: `${this.beamGeom.height}px`,
      };
    },
    hintStyle(): Record<string, string> | undefined {
      if (!this.idleHintActive || this.hintRect === undefined) {
        return undefined;
      }
      return {
        top: `${this.hintRect.top}px`,
        left: `${this.hintRect.left}px`,
      };
    },
  },
  watch: {
    // Any server response replaces playerView — re-evaluate the turn owner.
    playerView: {
      handler(): void {
        this.update();
      },
      deep: false,
    },
    beam: {
      handler(): void {
        this.refreshBeamGeometry();
      },
    },
    idleHintActive(active: boolean): void {
      if (active) {
        this.captureHintAnchor();
      } else {
        this.hintRect = undefined;
      }
    },
  },
  mounted(): void {
    installTurnInputTracking();
    window.addEventListener('resize', this.onReposition, {passive: true});
    this.update();
  },
  beforeUnmount(): void {
    uninstallTurnInputTracking();
    window.removeEventListener('resize', this.onReposition);
    if (this.reposTimer !== undefined) {
      window.clearTimeout(this.reposTimer);
    }
    resetTurnHandoff();
  },
  methods: {
    update(): void {
      // The endgame experience owns the screen — silence the handoff entirely.
      if (this.playerView.game.phase === Phase.END) {
        resetTurnHandoff();
        return;
      }
      noteTurnState({localColor: this.localColor, owner: this.owner});
    },
    cardRect(color: Color): DOMRect | undefined {
      const el = document.querySelector(`.left-panel-card[data-player-color="${color}"]`);
      return el instanceof HTMLElement ? el.getBoundingClientRect() : undefined;
    },
    refreshBeamGeometry(): void {
      const beam = turnHandoffState.beam;
      if (beam === undefined) {
        this.beamGeom = undefined;
        this.lastBeamId = undefined;
        return;
      }
      if (beam.id === this.lastBeamId) {
        return;
      }
      this.lastBeamId = beam.id;
      const from = this.cardRect(beam.from);
      const to = this.cardRect(beam.to);
      if (from === undefined || to === undefined) {
        this.beamGeom = undefined; // a card not on-screen — skip the trace gracefully
        return;
      }
      // The cards stack vertically in the panel — draw a slim trace along the
      // left edge spanning from the source card's centre to the target's.
      const x = Math.min(from.left, to.left) + 3;
      const y1 = from.top + from.height / 2;
      const y2 = to.top + to.height / 2;
      this.beamGeom = {
        top: Math.min(y1, y2),
        left: x,
        height: Math.max(Math.abs(y2 - y1), 2),
      };
    },
    captureHintAnchor(): void {
      const color = this.localColor;
      if (color === undefined) {
        this.hintRect = undefined;
        return;
      }
      const card = document.querySelector(`.left-panel-card[data-player-color="${color}"]`);
      if (!(card instanceof HTMLElement)) {
        this.hintRect = undefined;
        return;
      }
      const cardRect = card.getBoundingClientRect();
      // Anchor to the RIGHT of the card (so it never overlaps the next player
      // card), vertically centred on the status-chip row — the connector then
      // points right at the "● ДЕЙСТВИЕ X/Y" capsule. Fall back to the lower
      // third of the card if the chip isn't found.
      const chip = card.querySelector('.player-status-chip');
      let anchorY: number;
      if (chip instanceof HTMLElement) {
        const cr = chip.getBoundingClientRect();
        anchorY = cr.top + cr.height / 2;
      } else {
        anchorY = cardRect.top + cardRect.height * 0.62;
      }
      this.hintRect = {
        top: Math.max(8, Math.round(anchorY - HINT_HEIGHT / 2)),
        left: Math.round(cardRect.right + 8),
      };
    },
    onReposition(): void {
      // Keep the hint glued to the card across resize (debounced).
      if (this.reposTimer !== undefined) {
        window.clearTimeout(this.reposTimer);
      }
      this.reposTimer = window.setTimeout(() => {
        if (this.idleHintActive) {
          this.captureHintAnchor();
        }
        this.reposTimer = undefined;
      }, 120);
    },
  },
});
</script>
