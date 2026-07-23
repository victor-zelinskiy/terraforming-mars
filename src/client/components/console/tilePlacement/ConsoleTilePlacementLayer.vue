<template>
  <!--
    TILE-PLACEMENT HERO STAGE — the fixed, app-level layer of the "tile
    physically lands on Mars" scene (consoleTilePlacement /
    tilePlacementDirector). Mounted for the WHOLE transaction, so the
    flight survives any surface shuffling beneath it.

    Anatomy:
     - the GROUND SHADOW parks at the target hex for the whole flight
       (wide + faint at altitude → tight contact at touchdown);
     - the TILE proxy is a twin of the REAL board tile art (the same
       `board-space-tile--*` sprite), carrying a thickness EDGE (the same
       art, darkened, offset down — a real hex-shaped underside) and a
       TOUCH overlay (the one quiet surface-acceptance beat);
     - the BONUS icon proxies replay the cell's printed icons from their
       exact captured positions — the reward beat lifts them through the
       placed tile and hands each to its resource chip on the shared
       ConsoleResourceTransferLayer.
  -->
  <div v-if="tilePlacementState.active || remotePlacementState.active" class="con-tileplace" aria-hidden="true">
    <template v-if="tilePlacementState.active">
      <div ref="shadow" class="con-tileplace__shadow"></div>
      <div v-if="artClass !== ''" ref="tile" class="con-tileplace__tile">
        <div class="con-tileplace__edge" :class="artClass"></div>
        <div class="con-tileplace__art" :class="artClass"></div>
        <div ref="touch" class="con-tileplace__touch"></div>
      </div>
      <div v-for="b in tilePlacementState.bonusProxies"
           :key="b.id"
           class="con-tileplace__bonus"
           :class="'board-space-bonus--' + b.icon"
           :style="bonusStyle(b)"
           :ref="(el) => setBonusRef(b.id, el as HTMLElement | null)"></div>
    </template>
    <!-- The REMOTE flight (another player's / the bot's placement) — its
         OWN proxy set, so a remote landing can overlap the own
         transaction's reward beat without fighting over refs. Same
         anatomy (thickness edge + touch overlay + parked ground shadow);
         the pose/direction carries the provenance. -->
    <template v-if="remotePlacementState.active">
      <div ref="remoteShadow" class="con-tileplace__shadow"></div>
      <div v-if="remoteArtClass !== ''" ref="remoteTile" class="con-tileplace__tile con-tileplace__tile--remote">
        <div class="con-tileplace__edge" :class="remoteArtClass"></div>
        <div class="con-tileplace__art" :class="remoteArtClass"></div>
        <div ref="remoteTouch" class="con-tileplace__touch"></div>
      </div>
    </template>
  </div>
</template>

<script lang="ts">
import {defineComponent} from 'vue';
import {tilePlacementState, registerTilePlacementStage, BonusProxy} from '@/client/console/tilePlacement/consoleTilePlacement';
import {remotePlacementState, abortRemotePlacements} from '@/client/console/tilePlacement/consoleRemotePlacement';
import {TileStageEls} from '@/client/console/tilePlacement/tilePlacementDirector';
import {tileCssClassOf} from '@/client/components/board/BoardSpaceTile.vue';

export default defineComponent({
  name: 'ConsoleTilePlacementLayer',
  data() {
    return {
      tilePlacementState,
      remotePlacementState,
      unregister: undefined as (() => void) | undefined,
      bonusEls: new Map<number, HTMLElement>(),
    };
  },
  computed: {
    artClass(): string {
      const t = tilePlacementState.tileType;
      if (t === undefined) {
        return '';
      }
      const suffix = tileCssClassOf(t, tilePlacementState.aresExtension);
      return suffix === '' ? '' : 'board-space-tile--' + suffix;
    },
    remoteArtClass(): string {
      const t = remotePlacementState.tileType;
      if (t === undefined) {
        return '';
      }
      const suffix = tileCssClassOf(t, remotePlacementState.aresExtension);
      return suffix === '' ? '' : 'board-space-tile--' + suffix;
    },
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
    this.unregister = registerTilePlacementStage({
      els: (): TileStageEls | undefined => {
        // Vue 3 sets a template ref to `null` (not `undefined`) once its
        // element has rendered then been removed — here when a SelectSpace has
        // no real tile art (St. Joseph's cathedral lands on an existing city,
        // so `artClass === ''` and the tile div is not rendered). `!tile`
        // covers both null and undefined; a bare `=== undefined` NPE'd.
        const tile = this.$refs.tile as HTMLElement | undefined;
        if (!tile || !tile.isConnected) {
          return undefined;
        }
        const bonusIcons: Array<HTMLElement> = [];
        for (const b of tilePlacementState.bonusProxies) {
          const el = this.bonusEls.get(b.id);
          if (el !== undefined && el.isConnected) {
            bonusIcons.push(el);
          }
        }
        return {
          tile,
          edge: tile.querySelector<HTMLElement>('.con-tileplace__edge') ?? undefined,
          touch: this.$refs.touch as HTMLElement | undefined,
          shadow: this.$refs.shadow as HTMLElement | undefined,
          bonusIcons,
        };
      },
      remoteEls: (): TileStageEls | undefined => {
        const tile = this.$refs.remoteTile as HTMLElement | undefined;
        if (!tile || !tile.isConnected) {
          return undefined;
        }
        return {
          tile,
          edge: tile.querySelector<HTMLElement>('.con-tileplace__edge') ?? undefined,
          touch: this.$refs.remoteTouch as HTMLElement | undefined,
          shadow: this.$refs.remoteShadow as HTMLElement | undefined,
          bonusIcons: [],
        };
      },
    });
  },
  beforeUnmount() {
    this.unregister?.();
    // Shell teardown / game switch mid-flight: every held tile must become
    // visible NOW (the hold set is module-level and would otherwise leak
    // into the next mounted board).
    abortRemotePlacements();
  },
});
</script>
