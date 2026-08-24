<template>
  <!--
    MARS NOMADS MOVE STAGE — the fixed, app-level layer of the "camp module
    hops to the adjacent cell" scene (consoleNomadMove / nomadMoveDirector).
    Mounted for the whole transaction, so the hop survives any surface
    shuffling beneath it. ONE proxy set serves both the viewer's own move
    and a remote/undo hop — there is only ever one nomad camp in the game,
    so the two legs can never overlap.

    Anatomy:
     - the SOURCE contact shadow stays on the departure cell and lets go as
       the module rises (height is told by the separation);
     - the module proxy is the REAL NomadToken component at the resting
       board size (touchdown is a scale-1 identity with the board token);
     - the DESTINATION ground shadow parks at the target anchor and
       converges through the approach;
     - the displaced printed-bonus icon proxies replay the destination's
       icons from their exact captured rects and hand off to the shared
       resource chips (own move only).

    `con-flight-to-board`: this flight lands on a live board hex, so while
    a workspace surface is docked the layer recedes beneath the shared
    shade instead of flying bright over the panel the player is reading.
  -->
  <div v-if="nomadMoveState.active || nomadMoveState.remoteActive"
       class="con-nomadmove con-flight-to-board" aria-hidden="true">
    <div ref="srcShadow" class="con-nomadmove__shadow"></div>
    <div ref="dstShadow" class="con-nomadmove__shadow"></div>
    <div ref="token" class="con-nomadmove__token">
      <nomad-token :size="nomadMoveState.tokenSizePx" :shadow="false" />
    </div>
    <div v-for="b in nomadMoveState.bonusProxies"
         :key="b.id"
         class="con-nomadmove__bonus"
         :class="'board-space-bonus--' + b.icon"
         :style="bonusStyle(b)"
         :ref="(el) => setBonusRef(b.id, el as HTMLElement | null)"></div>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import NomadToken from '@/client/components/NomadToken.vue';
import {
  nomadMoveState, registerNomadStage, abortRemoteNomadMoves,
} from '@/client/console/nomads/consoleNomadMove';
import {BonusProxy} from '@/client/console/tilePlacement/consoleTilePlacement';
import {NomadStageEls} from '@/client/console/nomads/nomadMoveDirector';

export default defineComponent({
  name: 'ConsoleNomadMoveLayer',
  components: {
    'nomad-token': NomadToken,
  },
  data() {
    return {
      nomadMoveState,
      unregister: undefined as (() => void) | undefined,
      bonusEls: new Map<number, HTMLElement>(),
    };
  },
  methods: {
    /** The captured live rect IS the resting pose (the director only lifts). */
    bonusStyle(b: BonusProxy): Record<string, string> {
      return {
        left: `${Math.round(b.rect.x)}px`,
        top: `${Math.round(b.rect.y)}px`,
        width: `${Math.round(b.rect.w)}px`,
        height: `${Math.round(b.rect.h)}px`,
      };
    },
    setBonusRef(id: number, el: HTMLElement | null): void {
      if (el === null) {
        this.bonusEls.delete(id);
      } else {
        this.bonusEls.set(id, el);
      }
    },
  },
  mounted() {
    this.unregister = registerNomadStage({
      els: (): NomadStageEls | undefined => {
        const token = this.$refs.token as HTMLElement | undefined;
        if (!token || !token.isConnected) {
          return undefined;
        }
        const bonusIcons: Array<HTMLElement> = [];
        for (const b of nomadMoveState.bonusProxies) {
          const el = this.bonusEls.get(b.id);
          if (el !== undefined && el.isConnected) {
            bonusIcons.push(el);
          }
        }
        return {
          token,
          srcShadow: this.$refs.srcShadow as HTMLElement | undefined,
          dstShadow: this.$refs.dstShadow as HTMLElement | undefined,
          bonusIcons,
        };
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
    // Shell teardown / game switch mid-hop: every held token must become
    // visible NOW (the hold/ghost sets are module-level and would otherwise
    // leak into the next mounted board).
    abortRemoteNomadMoves();
  },
});
</script>
