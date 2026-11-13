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

<script setup lang="ts">
import {computed, onBeforeUnmount, onMounted, PropType, ref, watch} from 'vue';
import {vI18n} from '@/client/directives/vDirectives';
import {Color} from '@/common/Color';
import {Phase} from '@/common/Phase';
import {generationPhaseOf} from '@/common/game/generationPhase';
import {PlayerViewModel} from '@/common/models/PlayerModel';
import {
  turnHandoffState,
  noteTurnState,
  installTurnInputTracking,
  uninstallTurnInputTracking,
  resetTurnHandoff,
} from '@/client/components/overview/turnHandoffState';
import {useFlowScope} from '@/client/console/session/useFlowScope';

type BeamGeom = {top: number; left: number; height: number};

// Idle-hint pill height (keep in sync with `.turn-idle-anchor-hint` height in
// turn_handoff.less) — used to vertically centre the pill on the status chip.
const HINT_HEIGHT = 40;

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
defineOptions({name: 'TurnHandoffLayer'});
const props = defineProps({
  playerView: {
    type: Object as PropType<PlayerViewModel>,
    required: true,
  },
});

const flow = useFlowScope('turn-handoff-layer');
const beamGeom = ref<BeamGeom | undefined>(undefined);
const lastBeamId = ref<number | undefined>(undefined);
const hintRect = ref<{top: number; left: number} | undefined>(undefined);
/** The pending resize debounce's cancel (a beat of the layer's own scope — taken back with it). */
let reposTimer: (() => void) | undefined;
const owner = computed((): Color | undefined => {
  const game = props.playerView.game;
  if (generationPhaseOf(game) !== Phase.ACTION) {
    return undefined;
  }
  return props.playerView.players.find((p) => p.isActive)?.color;
});
const localColor = computed((): Color | undefined => {
  return props.playerView.thisPlayer?.color;
});
const beam = computed(() => {
  return turnHandoffState.beam;
});
const idleHintActive = computed((): boolean => {
  return turnHandoffState.idleHintActive;
});
const beamStyle = computed((): Record<string, string> | undefined => {
  if (beamGeom.value === undefined) {
    return undefined;
  }
  return {
    top: `${beamGeom.value.top}px`,
    left: `${beamGeom.value.left}px`,
    height: `${beamGeom.value.height}px`,
  };
});
const hintStyle = computed((): Record<string, string> | undefined => {
  if (!idleHintActive.value || hintRect.value === undefined) {
    return undefined;
  }
  return {
    top: `${hintRect.value.top}px`,
    left: `${hintRect.value.left}px`,
  };
});
function update(): void {
  // The endgame experience owns the screen — silence the handoff entirely.
  if (props.playerView.game.phase === Phase.END) {
    resetTurnHandoff();
    return;
  }
  noteTurnState({localColor: localColor.value, owner: owner.value});
}
function cardRect(color: Color): DOMRect | undefined {
  const el = document.querySelector(`.left-panel-card[data-player-color="${color}"]`);
  return el instanceof HTMLElement ? el.getBoundingClientRect() : undefined;
}
function refreshBeamGeometry(): void {
  const beam = turnHandoffState.beam;
  if (beam === undefined) {
    beamGeom.value = undefined;
    lastBeamId.value = undefined;
    return;
  }
  if (beam.id === lastBeamId.value) {
    return;
  }
  lastBeamId.value = beam.id;
  const from = cardRect(beam.from);
  const to = cardRect(beam.to);
  if (from === undefined || to === undefined) {
    beamGeom.value = undefined; // a card not on-screen — skip the trace gracefully
    return;
  }
  // The cards stack vertically in the panel — draw a slim trace along the
  // left edge spanning from the source card's centre to the target's.
  const x = Math.min(from.left, to.left) + 3;
  const y1 = from.top + from.height / 2;
  const y2 = to.top + to.height / 2;
  beamGeom.value = {
    top: Math.min(y1, y2),
    left: x,
    height: Math.max(Math.abs(y2 - y1), 2),
  };
}
function captureHintAnchor(): void {
  const color = localColor.value;
  if (color === undefined) {
    hintRect.value = undefined;
    return;
  }
  const card = document.querySelector(`.left-panel-card[data-player-color="${color}"]`);
  if (!(card instanceof HTMLElement)) {
    hintRect.value = undefined;
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
  hintRect.value = {
    top: Math.max(8, Math.round(anchorY - HINT_HEIGHT / 2)),
    left: Math.round(cardRect.right + 8),
  };
}
function onReposition(): void {
  // Keep the hint glued to the card across resize (debounced).
  if (reposTimer !== undefined) {
    reposTimer();
  }
  reposTimer = flow.after(120, 'the idle hint re-anchors after a resize', () => {
    if (idleHintActive.value) {
      captureHintAnchor();
    }
    reposTimer = undefined;
  });
}

// Any server response replaces playerView — re-evaluate the turn owner.
watch(() => props.playerView, (): void => {
  update();
}, {deep: false});
watch(() => beam.value, (): void => {
  refreshBeamGeometry();
});
watch(() => idleHintActive.value, (active: boolean): void => {
  if (active) {
    captureHintAnchor();
  } else {
    hintRect.value = undefined;
  }
});
onMounted((): void => {
  installTurnInputTracking();
  window.addEventListener('resize', onReposition, {passive: true});
  update();
});
onBeforeUnmount((): void => {
  uninstallTurnInputTracking();
  window.removeEventListener('resize', onReposition);
  resetTurnHandoff();
});
</script>
